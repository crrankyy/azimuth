import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { featureFiles } from "../helpers/project";
import { commitAll, gitEnv, initRepo } from "../helpers/git";
import { writeTree } from "../helpers/tree";

const LAUNCHER = fileURLToPath(new URL("../../plugin/bin/azimuth", import.meta.url));
const CLI = fileURLToPath(new URL("../../plugin/dist/cli.mjs", import.meta.url));

let tree: ReturnType<typeof writeTree>;
let cache: string;

function env(actor: "you" | "agent", extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...gitEnv(),
    HOME: process.env.HOME,
    PATH: "/usr/local/bin:/usr/bin:/bin",
    XDG_CACHE_HOME: cache,
    AZIMUTH_NO_VIEWER: "1",
    AZIMUTH_ACTOR: actor,
    NO_COLOR: "1",
    ...extra,
  };
}

function az(args: string[], actor: "you" | "agent" = "agent", extra: Record<string, string> = {}) {
  const r = spawnSync(LAUNCHER, args, { cwd: tree.root, env: env(actor, extra), encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function json<T>(args: string[], actor: "you" | "agent" = "agent"): T {
  const r = az([...args, "--json"], actor);
  if (r.code !== 0) throw new Error(`${args.join(" ")} failed (${r.code}): ${r.err}`);
  return JSON.parse(r.out) as T;
}

beforeAll(() => {
  if (!existsSync(CLI)) throw new Error("Run `pnpm build:cli` before the e2e tests.");
  cache = mkdtempSync(join(tmpdir(), "azimuth-cache-"));
  tree = writeTree({
    "package.json": JSON.stringify({
      name: "@acme/shop",
      scripts: { test: "vitest run", build: "tsc" },
      devDependencies: { vitest: "1", typescript: "5", prettier: "3" },
    }),
    "pnpm-lock.yaml": "",
    "src/app.ts": "export {};\n",
  });
  initRepo(tree.root);
  commitAll(tree.root, "chore: start");
});

afterAll(() => {
  tree.cleanup();
  rmSync(cache, { recursive: true, force: true });
});

describe("azimuth CLI (through the launcher, without node on PATH)", () => {
  it("initializes a repository", () => {
    const r = az(["init"], "you");
    expect(r.code).toBe(0);
    expect(r.out).toContain('Detected brownfield project "shop" (typescript)');
    const config = readFileSync(join(tree.root, ".azimuth/config.yaml"), "utf8");
    expect(config).toContain("test: pnpm test");
    expect(config).toContain("approve_specs: auto");
    expect(readFileSync(join(tree.root, "CLAUDE.md"), "utf8")).toContain("@.azimuth/PROTOCOL.md");
    expect(readFileSync(join(tree.root, ".gitignore"), "utf8")).toContain(".azimuth/cache/");
    expect(readFileSync(join(tree.root, ".prettierignore"), "utf8")).toContain(".azimuth/");
    expect(JSON.parse(readFileSync(join(tree.root, ".claude/settings.json"), "utf8"))).toEqual({
      env: { AZIMUTH_ACTOR: "agent" },
    });
    expect(az(["init"], "you").code).toBe(1);
    expect(az(["init", "--refresh"], "you").code).toBe(0);
    expect(az(["check"]).code).toBe(0);
  });

  it("takes a feature from idea to an automatic approval", () => {
    const created = json<{ id: string }>([
      "new",
      "feature",
      "Checkout: pay by card",
      "--summary",
      "Pay for an order.",
    ]);
    expect(created.id).toBe("F-001");
    expect(json<{ files: string[] }>(["new", "spec", "F-001"]).files).toHaveLength(4);
    for (const [path, text] of Object.entries(
      featureFiles({ id: "F-001", slug: "checkout-pay-by-card", status: "draft" }),
    )) {
      if (!path.endsWith("feature.md") && !path.endsWith("log.md")) tree.write(path, text);
    }
    expect(az(["move", "F-001", "draft"]).code).toBe(0);
    commitAll(tree.root, "docs(F-001): spec checkout\n\nRefs: F-001");
    const approve = az(["move", "F-001", "approved"]);
    expect(approve.code).toBe(0);
    expect(approve.out).toContain("approved automatically");
    const index = json<{ inbox: { kind: string; ref: string }[] }>(["status"]);
    expect(index.inbox).toEqual([expect.objectContaining({ kind: "review-auto", ref: "F-001" })]);
  });

  it("refuses an uncommitted spec, then flags spec edits after approval", () => {
    json(["new", "feature", "Refunds"]);
    for (const [path, text] of Object.entries(
      featureFiles({ id: "F-002", slug: "refunds", status: "draft" }),
    )) {
      if (!path.endsWith("feature.md") && !path.endsWith("log.md")) tree.write(path, text);
    }
    az(["move", "F-002", "draft"]);
    const refused = az(["move", "F-002", "approved"]);
    expect(refused.code).toBe(1);
    expect(refused.err).toContain("Spec files committed");
    commitAll(tree.root, "docs(F-002): spec refunds\n\nRefs: F-002");
    expect(az(["move", "F-002", "approved"]).code).toBe(0);
    tree.write(
      ".azimuth/features/F-002-refunds/contract.md",
      "## Types\n```ts\ntype Refund = { id: string };\n```\n",
    );
    commitAll(tree.root, "docs(F-002): refine contract\n\nRefs: F-002");
    const index = json<{ inbox: { kind: string; ref: string }[] }>(["status"]);
    expect(index.inbox.map((i) => `${i.kind} ${i.ref}`)).toContain("reapprove-spec F-002");
  });

  it("enforces manual approval for agents when configured", () => {
    const configPath = join(tree.root, ".azimuth/config.yaml");
    const config = readFileSync(configPath, "utf8");
    tree.write(
      ".azimuth/config.yaml",
      config.replace("approve_specs: auto", "approve_specs: manual"),
    );
    json(["new", "feature", "Invoices"]);
    for (const [path, text] of Object.entries(
      featureFiles({ id: "F-003", slug: "invoices", status: "draft" }),
    )) {
      if (!path.endsWith("feature.md") && !path.endsWith("log.md")) tree.write(path, text);
    }
    az(["move", "F-003", "draft"]);
    commitAll(tree.root, "docs(F-003): spec invoices\n\nRefs: F-003");
    const refused = az(["move", "F-003", "approved"], "agent");
    expect(refused.code).toBe(1);
    expect(refused.err).toContain("Spec approval is manual");
    expect(az(["move", "F-003", "approved"], "you").code).toBe(0);
    tree.write(".azimuth/config.yaml", config);
  });

  it("records verify runs and session commits", () => {
    expect(az(["move", "F-001", "in-progress"]).code).toBe(0);
    const plan = ".azimuth/features/F-001-checkout-pay-by-card/plan.md";
    tree.write(
      plan,
      readFileSync(join(tree.root, plan), "utf8").replace(
        "verify: pnpm test",
        "verify: echo S-001.1.1 ok",
      ),
    );
    const ses = az(["session", "start", "--skill", "build", "--goal", "Build F-001"]).out.trim();
    expect(ses).toMatch(/^SES-\d{8}-\d{4}/);
    const extra = { AZIMUTH_SESSION: ses };
    expect(az(["move", "T-001.1", "in-progress"], "agent", extra).code).toBe(0);
    commitAll(tree.root, "feat(F-001): card payments\n\nRefs: T-001.1", new Date().toISOString());
    const passed = az(["verify", "T-001.1"]);
    expect(passed.code).toBe(0);
    expect(passed.out).toMatch(/R-0001 T-001\.1 passed/);
    tree.write(
      plan,
      readFileSync(join(tree.root, plan), "utf8").replace(
        "verify: echo S-001.1.1 ok",
        "verify: exit 3",
      ),
    );
    expect(az(["verify", "T-001.1"]).code).toBe(1);
    expect(az(["log", "T-001.1", "Card form wired"], "agent", extra).code).toBe(0);
    expect(
      az(["session", "handoff", "Fix the failing verify, then finish T-001.1."], "agent", extra)
        .code,
    ).toBe(0);
    expect(az(["session", "close"], "agent", extra).code).toBe(0);
    const session = json<{ commits: string[]; touched: string[]; handoff: string }>(["show", ses]);
    expect(session.commits).toHaveLength(1);
    expect(session.touched).toEqual(expect.arrayContaining(["F-001", "T-001.1"]));
    expect(session.handoff).toBe("Fix the failing verify, then finish T-001.1.");
    const runs = json<{ id: string; ok: boolean; scenarios: { id: string; status: string }[] }[]>([
      "status",
    ]) as unknown as { runs: { id: string; ok: boolean }[] };
    expect(runs.runs.map((r) => [r.id, r.ok])).toEqual([
      ["R-0002", false],
      ["R-0001", true],
    ]);
  });

  it("reports hand-edited status as drift", () => {
    const path = ".azimuth/features/F-002-refunds/feature.md";
    tree.write(
      path,
      readFileSync(join(tree.root, path), "utf8").replace("status: approved", "status: done"),
    );
    const r = az(["check", "F-002"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("E-STATUS-DRIFT");
    tree.write(
      path,
      readFileSync(join(tree.root, path), "utf8").replace("status: done", "status: approved"),
    );
  });

  it("uses exit codes 2 for usage errors and 3 when the build is missing", () => {
    expect(az(["move", "F-001"]).code).toBe(2);
    expect(az(["move", "F-001", "nonsense"]).code).toBe(1);
    const bin = mkdtempSync(join(tmpdir(), "azimuth-bin-"));
    mkdirSync(join(bin, "bin"));
    copyFileSync(LAUNCHER, join(bin, "bin", "azimuth"));
    const r = spawnSync(join(bin, "bin", "azimuth"), ["status"], {
      cwd: tree.root,
      env: env("you"),
      encoding: "utf8",
    });
    expect(r.status).toBe(3);
    expect(r.stderr).toContain("pnpm build");
    rmSync(bin, { recursive: true, force: true });
  });

  it("allocates unique IDs under concurrency", async () => {
    const runs = Array.from(
      { length: 20 },
      (_, i) =>
        new Promise<number>((resolve) => {
          const child = spawn(LAUNCHER, ["new", "question", `Question ${i}`], {
            cwd: tree.root,
            env: env("agent"),
          });
          child.on("close", (code) => resolve(code ?? 1));
        }),
    );
    expect(await Promise.all(runs)).toEqual(Array(20).fill(0));
    const files = readdirSync(join(tree.root, ".azimuth/questions")).sort();
    expect(files).toHaveLength(20);
    expect(files[0]).toBe("Q-0001.md");
    expect(files[19]).toBe("Q-0020.md");
  });
});
