import { afterEach, describe, expect, it } from "vitest";
import { statusBrief } from "../../src/core/brief";
import { codeChangedSince, derive, isCodeCommit, staleCause } from "../../src/core/derive";
import { evaluateGate, nextGate, type GateContext } from "../../src/core/gates";
import { buildInbox } from "../../src/core/inbox";
import type { Model } from "../../src/core/model";
import { nextForFeature, nextWork } from "../../src/core/next";
import { specHash } from "../../src/core/spec-hash";
import type { Feature, Index, Issue } from "../../src/core/types";
import { sortProblems, validate } from "../../src/core/validate";
import type { Facts } from "../../src/core/facts";
import { expectedIndex } from "../fixtures/hookline/expected-index";
import { featureFiles, loadTree, makeFacts } from "../helpers/project";
import { MINIMAL_CONFIG } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

function analyze(model: Model, facts: Facts): GateContext & { derived: ReturnType<typeof derive> } {
  const derived = derive(model, facts);
  const problems = sortProblems([...model.problems, ...validate(model, facts, derived)]);
  return { model, facts, derived, problems };
}

function load(files: Record<string, string>, config = MINIMAL_CONFIG) {
  const tree = loadTree(files, config);
  cleanup = tree.cleanup;
  return tree.model;
}

const MANUAL = `${MINIMAL_CONFIG}autonomy:\n  approve_specs: manual\n  accept_adrs: manual\n`;

describe("derive", () => {
  it("computes reverse dependencies, blockers, progress and coverage", () => {
    const model = load({
      ...featureFiles({
        id: "F-001",
        status: "done",
        tasks: [{ id: "T-001.1", status: "done", covers: ["S-001.1.1", "S-001.1.2"] }],
      }),
      ...featureFiles({
        id: "F-002",
        status: "approved",
        extra: { depends_on: "[F-001, F-003]" },
      }),
      ...featureFiles({
        id: "F-003",
        status: "in-progress",
        extra: { depends_on: "[F-001]" },
        tasks: [
          { id: "T-003.1", status: "done", covers: ["S-003.1.1"] },
          { id: "T-003.2", status: "todo", covers: ["S-003.1.2"] },
        ],
      }),
      ...featureFiles({
        id: "F-004",
        status: "cancelled",
        ideaOnly: true,
        extra: { depends_on: "[F-003]" },
      }),
      ".azimuth/questions/Q-0001.md":
        "---\nid: Q-0001\ntitle: Which?\nfeature: F-003\nblocking: true\nraised_by: you\nraised_at: 2026-10-10T10:00:00Z\n---\n",
      ".azimuth/cache/runs/R-0001.json": JSON.stringify({
        id: "R-0001",
        target: "T-003.1",
        at: "2026-10-17T10:00:00Z",
        ok: false,
        scenarios: [{ id: "S-003.1.1", status: "failing" }],
      }),
    });
    const facts = makeFacts({
      tests: new Map([
        [
          "S-003.1.1",
          [{ file: "test/a.test.ts", name: "S-003.1.1 works", confidence: "marker" as const }],
        ],
        [
          "S-003.1.2",
          [{ file: "test/a.test.ts", name: "S-003.1.2 fails", confidence: "marker" as const }],
        ],
      ]),
    });
    const { info } = derive(model, facts);
    expect(info.get("F-001")?.blocks).toEqual(["F-002", "F-003"]);
    expect(info.get("F-003")?.blocks).toEqual(["F-002"]);
    expect(info.get("F-002")?.blocked_by).toEqual([{ kind: "dependency", id: "F-003" }]);
    expect(info.get("F-003")?.blocked_by).toEqual([{ kind: "question", id: "Q-0001" }]);
    expect(info.get("F-003")?.progress).toEqual({ done: 1, total: 2 });
    expect(info.get("F-003")?.coverage).toEqual({
      passing: 0,
      failing: 1,
      not_run: 1,
      untested: 0,
      total: 2,
    });
    expect(info.get("F-003")?.last_activity).toBe("2026-10-17T10:00:00Z");
    expect(info.get("F-003")?.stale).toBe(false);
  });

  it("marks stale in-progress work and file conflicts between active features", () => {
    const model = load({
      ...featureFiles({
        id: "F-001",
        status: "in-progress",
        impact: [{ path: "src/a.ts", change: "modify" }],
      }),
      ...featureFiles({
        id: "F-002",
        status: "approved",
        impact: [{ path: "src/a.ts", change: "create" }],
      }),
      ...featureFiles({
        id: "F-003",
        status: "done",
        impact: [{ path: "src/a.ts", change: "modify" }],
      }),
    });
    const { info } = derive(model, makeFacts());
    expect(info.get("F-001")?.stale).toBe(true);
    expect(info.get("F-001")?.file_conflicts).toEqual([{ path: "src/a.ts", with: "F-002" }]);
    expect(info.get("F-003")?.file_conflicts).toEqual([]);
  });

  it("flags a spec modified since approval", () => {
    const model = load(
      featureFiles({ id: "F-001", status: "approved", extra: { approved_hash: "sha256:old" } }),
    );
    const facts = makeFacts({
      git: {
        approvalChanges: new Map([
          [
            "F-001",
            [
              {
                path: "x/contract.md",
                commit: "abc1234",
                at: "2026-10-16T13:00:00Z",
                session: null,
              },
            ],
          ],
        ]),
      },
    });
    const { info } = derive(model, facts);
    expect(info.get("F-001")?.modified_since_approval).toBe(true);
    expect(info.get("F-001")?.approval_changes).toHaveLength(1);
  });
});

describe("code commits", () => {
  const commit = (sha: string) => ({
    sha,
    at: "2026-10-17T10:00:00Z",
    actor: "agent" as const,
    session: null,
    subject: sha,
    refs: [],
    files_changed: 1,
  });
  const facts = makeFacts({
    git: {
      available: true,
      head: "ccccccc",
      commits: [commit("ccccccc"), commit("bbbbbbb"), commit("aaaaaaa")],
      files: new Map([
        ["ccccccc", [".azimuth/features/F-001-x/as-built.md", ".azimuth/project/architecture.md"]],
        ["bbbbbbb", ["src/app.ts", ".azimuth/features/F-001-x/log.md"]],
        ["aaaaaaa", ["src/app.ts"]],
      ]),
    },
  });

  it("tells code commits from commits that only change .azimuth/", () => {
    expect(isCodeCommit("ccccccc", facts)).toBe(false);
    expect(isCodeCommit("bbbbbbb", facts)).toBe(true);
    // Nothing known about its files: counted as code, so a gate never passes on a guess.
    expect(isCodeCommit("ddddddd", facts)).toBe(true);
  });

  it("says whether code changed after a commit", () => {
    expect(codeChangedSince("ccccccc", facts)).toBe(false);
    expect(codeChangedSince("bbbbbbb", facts)).toBe(false);
    expect(codeChangedSince("aaaaaaa", facts)).toBe(true);
    expect(codeChangedSince("ddddddd", facts)).toBeNull();
  });
});

describe("staleCause", () => {
  /** Commits newest first, each with its changed files (null: not known). */
  const history = (entries: [string, string[] | null][]) =>
    makeFacts({
      git: {
        available: true,
        head: entries[0]?.[0] ?? null,
        commits: entries.map(([sha]) => ({
          sha,
          at: "2026-10-17T10:00:00Z",
          actor: "agent" as const,
          session: null,
          subject: sha,
          refs: [],
          files_changed: 1,
        })),
        files: new Map(
          entries.filter((e): e is [string, string[]] => e[1] !== null).map(([s, f]) => [s, f]),
        ),
      },
    });
  const only =
    (...paths: string[]) =>
    (path: string) =>
      paths.includes(path);

  it("S-006.3.1 keeps the run current when later commits miss the scope", () => {
    const facts = history([
      ["ccccccc", ["docs/x.md"]],
      ["bbbbbbb", ["src/b.ts"]],
      ["aaaaaaa", ["src/a.ts"]],
    ]);
    expect(staleCause("aaaaaaa", facts, only("src/a.ts"))).toBeNull();
  });

  it("S-006.3.2 names the earliest touching commit and its first matching path", () => {
    const facts = history([
      ["ddddddd", ["src/z.ts"]],
      ["ccccccc", ["src/a.ts", "src/z.ts"]],
      ["bbbbbbb", ["src/b.ts"]],
      ["aaaaaaa", ["src/a.ts"]],
    ]);
    expect(staleCause("aaaaaaa", facts, only("src/a.ts", "src/z.ts"))).toEqual({
      kind: "changed",
      commit: "ccccccc",
      path: "src/a.ts",
    });
  });

  it("S-006.3.3 counts the first path outside .azimuth/ without a scope", () => {
    const facts = history([
      ["ccccccc", [".azimuth/features/F-001-x/log.md", "docs/readme.md"]],
      ["bbbbbbb", [".azimuth/features/F-001-x/as-built.md"]],
      ["aaaaaaa", ["src/a.ts"]],
    ]);
    expect(staleCause("aaaaaaa", facts, null)).toEqual({
      kind: "changed",
      commit: "ccccccc",
      path: "docs/readme.md",
    });
  });

  it("S-006.3.4 never counts Azimuth's records, even in scope", () => {
    const facts = history([
      ["bbbbbbb", [".azimuth/project/architecture.md"]],
      ["aaaaaaa", ["src/a.ts"]],
    ]);
    expect(staleCause("aaaaaaa", facts, () => true)).toBeNull();
  });

  it("S-006.3.5 names a later commit whose changed files are unknown", () => {
    const facts = history([
      ["bbbbbbb", null],
      ["aaaaaaa", ["src/a.ts"]],
    ]);
    expect(staleCause("aaaaaaa", facts, () => false)).toEqual({
      kind: "unknown-files",
      commit: "bbbbbbb",
    });
  });

  it("S-006.3.6 reports a run outside the history read", () => {
    const facts = history([
      ["bbbbbbb", ["src/b.ts"]],
      ["aaaaaaa", ["src/a.ts"]],
    ]);
    expect(staleCause("9999999", facts, null)).toEqual({ kind: "outside-history" });
  });
});

describe("gates", () => {
  it("passes the approval gate for a complete, committed draft", () => {
    const model = load(featureFiles({ id: "F-001", status: "draft" }));
    const spec = model.features[0]?.spec;
    const facts = makeFacts({
      git: { available: true, headSpecHash: new Map([["F-001", spec ? specHash(spec) : null]]) },
    });
    const gate = nextGate(analyze(model, facts), model.features[0]!);
    expect(gate?.to).toBe("approved");
    expect(gate?.checks.map((c) => [c.id, c.ok])).toEqual([
      ["approve.no-errors", true],
      ["approve.story-kinds", true],
      ["approve.gwt", true],
      ["approve.scenarios-covered", true],
      ["approve.verify-commands", true],
      ["approve.committed", true],
      ["approve.no-blocking-questions", true],
      ["approve.dependencies", true],
      ["approve.size", true],
    ]);
  });

  it("explains failing approval checks", () => {
    const model = load({
      ...featureFiles({
        id: "F-001",
        status: "draft",
        extra: { size: "XL", depends_on: "[F-009]" },
        stories: { "ST-001.1": ["happy"] },
        tasks: [{ id: "T-001.1", covers: [], verify: '""' }],
      }),
      ".azimuth/questions/Q-0001.md":
        "---\nid: Q-0001\ntitle: Which?\nfeature: F-001\nblocking: true\nraised_by: you\nraised_at: 2026-10-10T10:00:00Z\n---\n",
    });
    const facts = makeFacts({
      git: { available: true, headSpecHash: new Map([["F-001", "sha256:other"]]) },
    });
    const gate = nextGate(analyze(model, facts), model.features[0]!);
    const failed = gate?.checks.filter((c) => !c.ok).map((c) => [c.id, c.detail]);
    expect(failed).toEqual([
      ["approve.no-errors", "1 error"],
      ["approve.story-kinds", "ST-001.1"],
      ["approve.scenarios-covered", "S-001.1.1"],
      ["approve.verify-commands", "T-001.1"],
      ["approve.committed", "Commit the spec before approving it"],
      ["approve.no-blocking-questions", "Q-0001 is open"],
      ["approve.dependencies", "Unknown: F-009"],
      ["approve.size", "Split the feature before approving it"],
    ]);
  });

  it("reports unfinished tasks, changed specs and unfinished dependencies", () => {
    const model = load({
      ...featureFiles({ id: "F-001", status: "in-progress" }),
      ...featureFiles({
        id: "F-002",
        status: "approved",
        extra: { depends_on: "[F-001]", approved_hash: "sha256:old" },
      }),
    });
    const facts = makeFacts({
      git: {
        approvalChanges: new Map([
          [
            "F-002",
            [
              {
                path: ".azimuth/features/F-002-thing/contract.md",
                commit: "e02b6f7",
                at: "2026-10-16T13:38:00Z",
                session: null,
              },
            ],
          ],
        ]),
      },
    });
    const ctx = analyze(model, facts);
    expect(nextGate(ctx, model.features[0]!)?.checks.map((c) => c.detail ?? null)).toEqual([
      "1 of 1 tasks still open",
      null,
    ]);
    expect(nextGate(ctx, model.features[1]!)?.checks.map((c) => c.detail)).toEqual([
      "contract.md changed on 2026-10-16 (commit e02b6f7)",
      "F-001 is in-progress",
    ]);
  });

  it("requires passing runs at HEAD, as-built and a reconciled architecture to finish", () => {
    const model = load({
      ...featureFiles({
        id: "F-001",
        status: "verifying",
        tasks: [{ id: "T-001.1", status: "done", covers: ["S-001.1.1", "S-001.1.2"] }],
      }),
      ".azimuth/project/architecture.md": "---\nreconciled_at: aaaaaaa\n---\n",
      ".azimuth/cache/runs/R-0001.json": JSON.stringify({
        id: "R-0001",
        target: "T-001.1",
        at: "2026-10-17T10:00:00Z",
        ok: false,
        commit: "bbbbbbb",
        scenarios: [],
      }),
    });
    const facts = makeFacts({
      git: {
        available: true,
        head: "ccccccc",
        commits: [
          {
            sha: "ccccccc",
            at: "2026-10-17T11:00:00Z",
            actor: "agent",
            session: null,
            subject: "x",
            refs: ["T-001.1"],
            files_changed: 1,
          },
          {
            sha: "aaaaaaa",
            at: "2026-10-01T11:00:00Z",
            actor: "agent",
            session: null,
            subject: "y",
            refs: [],
            files_changed: 1,
          },
        ],
        commitsAfter: (sha) => ({ ccccccc: 0, aaaaaaa: 1 })[sha] ?? null,
      },
    });
    const gate = nextGate(analyze(model, facts), model.features[0]!);
    expect(gate?.checks.map((c) => [c.id, c.ok, c.detail])).toEqual([
      ["done.verify-passed", false, "T-001.1 failed at bbbbbbb"],
      ["done.scenarios-passing", false, "0 of 2"],
      ["done.as-built", false, undefined],
      ["done.architecture-reconciled", false, "Reconciled at aaaaaaa, 1 commits behind"],
    ]);
  });

  describe("record-only commits after a passing run", () => {
    const verifyCheck = (laterFiles: string[] | null) => {
      const model = load({
        ...featureFiles({
          id: "F-001",
          status: "verifying",
          tasks: [{ id: "T-001.1", status: "done", covers: ["S-001.1.1", "S-001.1.2"] }],
        }),
        ".azimuth/cache/runs/R-0001.json": JSON.stringify({
          id: "R-0001",
          target: "T-001.1",
          at: "2026-10-17T10:00:00Z",
          ok: true,
          commit: "aaaaaaa",
          scenarios: [],
        }),
      });
      const commit = (sha: string, refs: string[]) => ({
        sha,
        at: "2026-10-17T11:00:00Z",
        actor: "agent" as const,
        session: null,
        subject: sha,
        refs,
        files_changed: 1,
      });
      const files = new Map([["aaaaaaa", ["src/app.ts"]]]);
      if (laterFiles) files.set("bbbbbbb", laterFiles);
      const facts = makeFacts({
        git: {
          available: true,
          head: "bbbbbbb",
          commits: [commit("bbbbbbb", ["F-001"]), commit("aaaaaaa", ["T-001.1"])],
          files,
        },
      });
      const gate = nextGate(analyze(model, facts), model.features[0]!);
      return gate?.checks.find((c) => c.id === "done.verify-passed");
    };

    it("S-002.1.1 keeps the run current when only .azimuth/ changed after it", () => {
      expect(verifyCheck([".azimuth/features/F-001-x/as-built.md"])?.ok).toBe(true);
    });

    it("S-002.1.2 makes the run stale when code changed after it", () => {
      expect(verifyCheck(["src/app.ts"])).toMatchObject({
        ok: false,
        detail: "T-001.1 last passed at aaaaaaa; bbbbbbb changed src/app.ts",
      });
    });

    it("S-002.1.3 makes the run stale when the later commit's files are unknown", () => {
      expect(verifyCheck(null)).toMatchObject({
        ok: false,
        detail: "T-001.1 last passed at aaaaaaa; bbbbbbb's changed files are unknown",
      });
    });
  });

  describe("which later commits make a passing run stale", () => {
    interface Setup {
      impact?: { path: string; change: string }[];
      taskFiles?: string[];
      runAt?: string;
      /** Commits after the run's, newest (HEAD) first, with their files (null: unknown). */
      later: [string, string[] | null][];
      config?: string;
    }
    const verifyCheck = ({
      impact = [{ path: "src/a.ts", change: "modify" }],
      taskFiles = ["src/a.ts"],
      runAt = "aaaaaaa",
      later,
      config,
    }: Setup) => {
      const model = load(
        {
          ...featureFiles({
            id: "F-001",
            status: "verifying",
            impact,
            tasks: [
              {
                id: "T-001.1",
                status: "done",
                covers: ["S-001.1.1", "S-001.1.2"],
                files: taskFiles,
              },
            ],
          }),
          ".azimuth/cache/runs/R-0001.json": JSON.stringify({
            id: "R-0001",
            target: "T-001.1",
            at: "2026-10-17T10:00:00Z",
            ok: true,
            commit: runAt,
            scenarios: [],
          }),
        },
        config,
      );
      const history: [string, string[] | null][] = [...later, ["aaaaaaa", ["src/a.ts"]]];
      const facts = makeFacts({
        git: {
          available: true,
          head: history[0]?.[0] ?? null,
          commits: history.map(([sha]) => ({
            sha,
            at: "2026-10-17T11:00:00Z",
            actor: "agent" as const,
            session: null,
            subject: sha,
            refs: [],
            files_changed: 1,
          })),
          files: new Map(
            history.filter((e): e is [string, string[]] => e[1] !== null).map(([s, f]) => [s, f]),
          ),
        },
      });
      const gate = nextGate(analyze(model, facts), model.features[0]!);
      return gate?.checks.find((c) => c.id === "done.verify-passed");
    };

    it("S-006.4.1 keeps the run current across another feature's commit", () => {
      expect(verifyCheck({ later: [["bbbbbbb", ["src/b.ts"]]] })?.ok).toBe(true);
    });

    it("S-006.4.2 names the commit and path when the task's file changes", () => {
      expect(verifyCheck({ later: [["bbbbbbb", ["src/a.ts"]]] })).toMatchObject({
        ok: false,
        detail: "T-001.1 last passed at aaaaaaa; bbbbbbb changed src/a.ts",
      });
    });

    it("S-006.4.3 names a later commit whose changed files are unknown", () => {
      expect(verifyCheck({ later: [["bbbbbbb", null]] })).toMatchObject({
        ok: false,
        detail: "T-001.1 last passed at aaaaaaa; bbbbbbb's changed files are unknown",
      });
    });

    it("S-006.4.4 keeps today's detail for a run outside the history read", () => {
      expect(verifyCheck({ runAt: "9999999", later: [["bbbbbbb", ["src/b.ts"]]] })).toMatchObject({
        ok: false,
        detail: "T-001.1 last passed at 9999999",
      });
    });

    it("S-006.4.5 replaces the default shared paths with configured ones", () => {
      const check = verifyCheck({
        config: `${MINIMAL_CONFIG}verify:\n  shared_paths: ["crates/*/Cargo.toml"]\n`,
        later: [
          ["ccccccc", ["crates/core/Cargo.toml"]],
          ["bbbbbbb", ["Cargo.lock"]],
        ],
      });
      expect(check).toMatchObject({
        ok: false,
        detail: "T-001.1 last passed at aaaaaaa; ccccccc changed crates/core/Cargo.toml",
      });
    });

    it("S-006.4.6 falls back to any code commit for a task without paths", () => {
      const check = verifyCheck({
        impact: [{ path: "src/c.ts", change: "read" }],
        taskFiles: [],
        later: [["bbbbbbb", ["docs/readme.md"]]],
      });
      expect(check).toMatchObject({
        ok: false,
        detail: "T-001.1 last passed at aaaaaaa; bbbbbbb changed docs/readme.md",
      });
    });
  });

  describe("the architecture against the feature's last code commit", () => {
    const archCheck = (laterFiles: string[], laterRefs: string[]) => {
      const model = load({
        ...featureFiles({
          id: "F-001",
          status: "verifying",
          tasks: [{ id: "T-001.1", status: "done", covers: ["S-001.1.1", "S-001.1.2"] }],
        }),
        ".azimuth/project/architecture.md": "---\nreconciled_at: aaaaaaa\n---\n",
      });
      const commit = (sha: string, refs: string[]) => ({
        sha,
        at: "2026-10-17T11:00:00Z",
        actor: "agent" as const,
        session: null,
        subject: sha,
        refs,
        files_changed: 1,
      });
      const facts = makeFacts({
        git: {
          available: true,
          head: "bbbbbbb",
          commits: [commit("bbbbbbb", laterRefs), commit("aaaaaaa", ["T-001.1"])],
          files: new Map([
            ["bbbbbbb", laterFiles],
            ["aaaaaaa", ["src/app.ts"]],
          ]),
          commitsAfter: (sha) => ({ bbbbbbb: 0, aaaaaaa: 1 })[sha] ?? null,
        },
      });
      const gate = nextGate(analyze(model, facts), model.features[0]!);
      return gate?.checks.find((c) => c.id === "done.architecture-reconciled");
    };

    it("S-002.2.1 ignores a close-out commit that only changes .azimuth/", () => {
      expect(archCheck([".azimuth/features/F-001-x/as-built.md"], ["F-001"])?.ok).toBe(true);
    });

    it("S-002.2.2 counts a code commit to the feature after the reconciliation", () => {
      expect(archCheck(["src/app.ts"], ["T-001.1"])).toMatchObject({
        ok: false,
        detail: "Reconciled at aaaaaaa, 1 commits behind",
      });
    });
  });

  it("has no gate for retired features or backwards moves", () => {
    const model = load(featureFiles({ id: "F-001", status: "cancelled", ideaOnly: true }));
    const ctx = analyze(model, makeFacts());
    expect(nextGate(ctx, model.features[0]!)).toBeNull();
    expect(evaluateGate(ctx, model.features[0]!, "idea")).toBeNull();
  });
});

describe("validate", () => {
  it("catches drift, uncovered scenarios, task problems and missing paths", () => {
    const model = load({
      ...featureFiles({
        id: "F-001",
        status: "approved",
        log: "## 2026-10-01T10:00:00Z · agent · transition\nidea → draft\n",
      }),
      ...featureFiles({
        id: "F-002",
        status: "draft",
        stories: { "ST-002.1": ["happy"] },
        tasks: [
          { id: "T-002.1", after: ["T-002.2"], covers: [] },
          { id: "T-002.2", after: ["T-002.1"], covers: ["S-002.9.9"] },
        ],
        impact: [
          { path: "lib/x.ts", change: "create" },
          { path: "lib/y.ts", change: "create" },
          { path: "src/gone.ts", change: "modify" },
        ],
      }),
      ".azimuth/project/architecture.md": "---\nmodules:\n  - name: app\n    path: src\n---\n",
    });
    const facts = makeFacts({ exists: (p) => p !== "src/gone.ts" });
    const codes = validate(model, facts, derive(model, facts)).map((p) => `${p.code} ${p.ref}`);
    expect(codes.sort()).toEqual(
      [
        "E-STATUS-DRIFT F-001",
        "E-TASK-CYCLE F-002",
        "E-TASK-REF T-002.2",
        "W-IMPACT-MISSING F-002",
        "W-NO-NEGATIVE ST-002.1",
        "W-PATH F-002",
        "W-UNCOVERED-SCENARIO S-002.1.1",
      ].sort(),
    );
  });

  it("BUG-0058 counts a file named after a module path as part of that module", () => {
    const model = load({
      ...featureFiles({
        id: "F-001",
        status: "draft",
        impact: [
          { path: "src/buffer.rs", change: "create" },
          { path: "src/buffer/gap.rs", change: "create" },
          { path: "src/lib.rs", change: "modify" },
          { path: "src/render/html.rs", change: "create" },
        ],
      }),
      ".azimuth/project/architecture.md":
        "---\nmodules:\n  - name: root\n    path: src/lib.rs\n  - name: buffer\n    path: src/buffer\n---\n",
    });
    const facts = makeFacts({ exists: () => true });
    const paths = validate(model, facts, derive(model, facts))
      .filter((p) => p.code === "W-PATH")
      .map((p) => p.message);
    expect(paths).toEqual(["src/render/ is not under any module path in architecture.md."]);
  });

  it("BUG-0020 doesn't ask root-level project files to sit under a module", () => {
    const model = load({
      ...featureFiles({
        id: "F-001",
        status: "draft",
        impact: [
          { path: "package.json", change: "modify" },
          { path: "vitest.config.ts", change: "create" },
          { path: "lib/x.ts", change: "create" },
        ],
      }),
      ".azimuth/project/architecture.md": "---\nmodules:\n  - name: app\n    path: src\n---\n",
    });
    const facts = makeFacts();
    const paths = validate(model, facts, derive(model, facts))
      .filter((p) => p.code === "W-PATH")
      .map((p) => p.message);
    expect(paths).toEqual(["lib/ is not under any module path in architecture.md."]);
  });

  it("reports one conflict per pair and a stale architecture", () => {
    const model = load({
      ...featureFiles({
        id: "F-001",
        status: "in-progress",
        impact: [{ path: "src/a.ts", change: "modify" }],
      }),
      ...featureFiles({
        id: "F-002",
        status: "verifying",
        impact: [{ path: "src/a.ts", change: "modify" }],
      }),
      ".azimuth/project/architecture.md": "---\nreconciled_at: abcdef1\n---\n",
    });
    const facts = makeFacts({
      now: new Date("2026-10-02T00:00:00Z"),
      git: { available: true, commitsAfter: () => 11 },
    });
    const problems = validate(model, facts, derive(model, facts));
    expect(problems.map((p) => [p.code, p.message])).toEqual([
      ["W-FILE-CONFLICT", "F-001 and F-002 both modify src/a.ts."],
      ["W-ARCH-STALE", "11 commits since architecture.md was last reconciled (abcdef1)."],
    ]);
  });

  it("BUG-0028 counts only code commits since architecture.md was reconciled", () => {
    const model = load({
      ".azimuth/project/architecture.md": "---\nreconciled_at: r000000\n---\n",
    });
    const commit = (sha: string) => ({
      sha,
      at: "2026-10-01T00:00:00Z",
      author: "dev",
      actor: "agent" as const,
      session: null,
      subject: sha,
      refs: [],
      files_changed: 1,
    });
    const history = (code: number, records: number) => {
      const shas = [
        ...Array.from({ length: code }, (_, i) => `c${i}00000`),
        ...Array.from({ length: records }, (_, i) => `a${i}00000`),
      ];
      return makeFacts({
        now: new Date("2026-10-02T00:00:00Z"),
        git: {
          available: true,
          commits: [...shas, "r000000"].map(commit),
          files: new Map(
            shas.map((sha) => [
              sha,
              sha.startsWith("c") ? ["src/app.ts"] : [".azimuth/features/F-001-x/log.md"],
            ]),
          ),
          commitsAfter: () => shas.length,
        },
      });
    };
    const stale = (facts: Facts) =>
      validate(model, facts, derive(model, facts))
        .filter((p) => p.code === "W-ARCH-STALE")
        .map((p) => p.message);
    expect(stale(history(2, 12))).toEqual([]);
    expect(stale(history(11, 3))).toEqual([
      "11 code commits since architecture.md was last reconciled (r000000).",
    ]);
  });

  it("BUG-0029 warns when marked tests in different files share a function name", () => {
    const model = load({});
    const ref = (file: string, name: string, confidence: "marker" | "fallback" = "marker") => ({
      file,
      name,
      confidence,
    });
    const facts = makeFacts({
      tests: new Map([
        ["S-001.1.1", [ref("src/buffer.rs", "parses_empty")]],
        ["S-001.2.1", [ref("src/render.rs", "parses_empty"), ref("src/render.rs", "renders")]],
        // One test covering two scenarios is a single test, not a duplicate.
        ["S-001.2.2", [ref("src/render.rs", "renders")]],
        // Titles and unmarked mentions aren't matched by name, so they can't clash.
        ["S-001.3.1", [ref("a.test.ts", "S-001.3.1 works"), ref("b.rs", "renders", "fallback")]],
      ]),
    });
    const problems = validate(model, facts, derive(model, facts));
    expect(problems.filter((p) => p.code === "W-TEST-NAME")).toEqual([
      {
        code: "W-TEST-NAME",
        severity: "warning",
        file: "src/buffer.rs",
        line: null,
        ref: "S-001.1.1",
        message:
          "Marked tests in src/buffer.rs and src/render.rs are both named parses_empty, so verify can't tell their results apart. Rename one.",
      },
    ]);
  });

  it("reports unknown links", () => {
    const model = load({
      ...featureFiles({
        id: "F-001",
        status: "idea",
        ideaOnly: true,
        extra: { milestone: "M-09" },
      }),
      ".azimuth/decisions/ADR-0001-x.md":
        "---\nid: ADR-0001\ntitle: X\nstatus: accepted\ndate: 2026-10-01\nsupersedes: ADR-0009\nlinks: [F-404]\n---\n",
    });
    const facts = makeFacts();
    const codes = validate(model, facts, derive(model, facts)).map((p) => `${p.code} ${p.ref}`);
    expect(codes).toEqual(["E-LINK F-001", "E-LINK ADR-0001", "W-LINK ADR-0001"]);
  });
});

describe("inbox", () => {
  it("orders items by urgency, kind and age and respects autonomy", () => {
    const files = {
      ...featureFiles({ id: "F-001", status: "draft", title: "Login" }),
      ...featureFiles({
        id: "F-002",
        status: "in-progress",
        extra: { approved_by: "agent", approved_at: "2026-10-03" },
        tasks: [{ id: "T-002.1", status: "done", covers: ["S-002.1.1", "S-002.1.2"] }],
      }),
      ".azimuth/questions/Q-0001.md":
        "---\nid: Q-0001\ntitle: Blocking one\nfeature: F-001\nblocking: true\nraised_by: you\nraised_at: 2026-10-10T10:00:00Z\n---\n",
      ".azimuth/questions/Q-0002.md":
        "---\nid: Q-0002\ntitle: Minor one\nfeature: F-002\nlinks: [T-002.1]\nraised_by: you\nraised_at: 2026-10-09T10:00:00Z\n---\n",
      ".azimuth/decisions/ADR-0001-x.md":
        "---\nid: ADR-0001\ntitle: Use X\nstatus: proposed\ndate: 2026-10-11\n---\n",
      ".azimuth/cache/runs/R-0001.json": JSON.stringify({
        id: "R-0001",
        target: "T-002.1",
        command: "pnpm test",
        exit_code: 1,
        at: "2026-10-12T10:00:00Z",
        ok: false,
        scenarios: [],
      }),
    };
    const facts = makeFacts();
    const autoCtx = analyze(load(files), facts);
    const auto = buildInbox(autoCtx, autoCtx.derived);
    cleanup?.();
    expect(auto.map((i) => `${i.urgency} ${i.kind} ${i.ref}`)).toEqual([
      "high answer-question Q-0001",
      "high failing-verify F-002",
      "normal answer-question Q-0002",
      "low stale F-002",
      "low review-auto F-002",
    ]);
    expect(auto[0]?.detail).toBe("Blocking: F-001 can't be approved until this is answered.");
    expect(auto[2]?.detail).toBe("Affects T-002.1 in F-002. Not blocking.");

    const model = load(files, MANUAL);
    const ctx = analyze(model, facts);
    const manual = buildInbox(ctx, ctx.derived);
    expect(manual.map((i) => i.kind)).toContain("review-adr");
    expect(manual.find((i) => i.kind === "approve-spec")).toBeUndefined();
  });

  it("BUG-0004 asks you to review decisions an agent accepted or rejected", () => {
    const adr = (id: string, status: string, extra = "") =>
      `---\nid: ${id}\ntitle: Use ${id}\nstatus: ${status}\ndate: 2026-10-11\n${extra}---\n`;
    const agent = "decided_by: agent\ndecided_at: 2026-10-12T10:00:00Z\n";
    const ctx = analyze(
      load({
        ".azimuth/decisions/ADR-0001-a.md": adr("ADR-0001", "accepted", agent),
        ".azimuth/decisions/ADR-0002-b.md": adr("ADR-0002", "rejected", agent),
        ".azimuth/decisions/ADR-0003-c.md": adr("ADR-0003", "rejected", "decided_by: you\n"),
        ".azimuth/decisions/ADR-0004-d.md": adr(
          "ADR-0004",
          "rejected",
          `${agent}review_ack_at: 2026-10-12T11:00:00Z\n`,
        ),
      }),
      makeFacts(),
    );
    const review = buildInbox(ctx, ctx.derived).filter((i) => i.kind === "review-auto");
    expect(review.map((i) => [i.ref, i.title])).toEqual([
      ["ADR-0001", "Use ADR-0001 was accepted automatically"],
      ["ADR-0002", "Use ADR-0002 was rejected automatically"],
    ]);
    expect(review[1]?.detail).toBe(
      "An agent rejected this decision. Acknowledge it or move it back to proposed.",
    );
  });
});

describe("next and status brief", () => {
  const withIssues = (issues: Partial<Issue>[]): Index => ({
    ...structuredClone(expectedIndex),
    issues: issues.map((i, n) => ({
      ...(expectedIndex.issues[0] as Issue),
      id: `BUG-${String(n + 1).padStart(4, "0")}`,
      ...i,
    })),
  });

  it("puts critical issues first and high ones after feature work", () => {
    const index = withIssues([
      { severity: "high" },
      { severity: "critical" },
      { severity: "high", status: "in-progress" },
      { severity: "medium" },
      { severity: "critical", status: "resolved" },
    ]);
    const refs = nextWork(index).map((n) => n.ref);
    expect(refs[0]).toBe("BUG-0002");
    expect(refs.slice(-2)).toEqual(["BUG-0003", "BUG-0001"]);
    expect(refs.filter((r) => r.startsWith("BUG-"))).toHaveLength(3);
    expect(nextWork(index).at(-1)).toMatchObject({
      action: "azimuth move BUG-0001 in-progress",
      reason: "high bug",
    });
  });

  describe("answers waiting to be applied", () => {
    const withAnswer = (status: Feature["status"]) => {
      const index = structuredClone(expectedIndex) as Index;
      const f = index.features.find((x) => x.id === "F-009") as Feature;
      f.status = status;
      f.derived.next_gate = {
        to: "approved",
        checks: [{ id: "approve.no-errors", rule: "No check errors in this feature", ok: true }],
      };
      index.questions = [
        {
          ...(index.questions[0] as Index["questions"][number]),
          id: "Q-0042",
          title: "Which limit?",
          feature: "F-009",
          status: "answered",
          options: [{ key: "a", label: "Per endpoint", detail: "", recommended: true }],
          answer: { option: "a", text: "Start low", answered_at: "2026-10-18T10:30:00Z" },
          resolution: null,
        },
      ];
      return { index, f };
    };

    it("BUG-0012 puts applying the user's answer before approval", () => {
      const { index, f } = withAnswer("draft");
      const next = nextForFeature(index, f);
      expect(next.map((n) => n.ref)).toEqual(["Q-0042"]);
      expect(next[0]?.action).toContain("azimuth resolve Q-0042");
    });

    it("BUG-0013 lists the user's decisions in the status brief", () => {
      const { index } = withAnswer("draft");
      expect(statusBrief(index)).toContain(
        "Decided by the user in the viewer, not yet applied:\n  Q-0042 (F-009) Which limit?: Per endpoint — Start low",
      );
    });
  });

  describe("an idea's next step", () => {
    const ideaWithDraftGate = (ok: boolean) => {
      const f = structuredClone(expectedIndex.features.find((x) => x.id === "F-010")) as Feature;
      f.derived.next_gate = {
        to: "draft",
        checks: [{ id: "draft.spec-files", rule: "Spec files written", ok }],
      };
      return nextForFeature(expectedIndex as Index, f);
    };

    it("S-004.1.1 suggests the draft move once the spec is written", () => {
      expect(ideaWithDraftGate(true)).toMatchObject([
        {
          ref: "F-010",
          action: "azimuth move F-010 draft",
          reason: "Spec written; ready for draft",
        },
      ]);
    });

    it("S-004.1.2 asks for the spec while it isn't written", () => {
      expect(ideaWithDraftGate(false)).toMatchObject([
        { ref: "F-010", action: "/azimuth:spec F-010", reason: "Idea without a spec" },
      ]);
    });
  });

  it("lists open high and critical issues in the status brief", () => {
    const brief = statusBrief(withIssues([{ severity: "high", title: "Lost writes" }]));
    expect(brief).toContain(
      "Open issues, high or critical (1):\n  BUG-0001 open high: Lost writes",
    );
    expect(statusBrief(withIssues([{ severity: "low" }]))).not.toContain("Open issues");
  });
});
