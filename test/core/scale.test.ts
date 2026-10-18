import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { clearParseCache } from "../../src/core/model";
import { featureFiles } from "../helpers/project";
import { commitAll, initRepo } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const STATUSES = ["idea", "draft", "approved", "in-progress", "verifying", "done"];
let tree: ReturnType<typeof writeTree>;

beforeAll(() => {
  const files: Record<string, string> = {};
  for (let i = 1; i <= 120; i++) {
    const id = `F-${String(i).padStart(3, "0")}`;
    const status = STATUSES[i % STATUSES.length] as string;
    const num = id.slice(2);
    const stories = Object.fromEntries(
      [1, 2, 3].map((s) => [`ST-${num}.${s}`, ["happy", "negative", "edge"]]),
    );
    const scenarios = Object.keys(stories).flatMap((st) =>
      [1, 2, 3].map((n) => `${st.replace("ST-", "S-")}.${n}`),
    );
    const tasks = Array.from({ length: 8 }, (_, t) => ({
      id: `T-${num}.${t + 1}`,
      status: status === "done" ? "done" : "todo",
      after: t > 0 ? [`T-${num}.${t}`] : [],
      covers: scenarios.slice(t, t + 2),
    }));
    tasks[7]!.covers = scenarios;
    Object.assign(
      files,
      featureFiles({
        id,
        status,
        stories: status === "idea" ? undefined : stories,
        tasks: status === "idea" ? undefined : tasks,
        ideaOnly: status === "idea",
        extra: { depends_on: i > 1 ? `[F-${String(i - 1).padStart(3, "0")}]` : "[]" },
        impact: [{ path: `src/module${i}.ts`, change: "modify" }],
      }),
    );
  }
  tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG, ...files });
  initRepo(tree.root);
  commitAll(tree.root, "chore: scale fixture");
});

afterAll(() => tree.cleanup());

describe("scale", () => {
  it("builds the index for 120 features within budget", () => {
    clearParseCache();
    const cold = performance.now();
    const { index } = buildIndex(tree.root);
    const coldMs = performance.now() - cold;
    const warm = performance.now();
    buildIndex(tree.root);
    const warmMs = performance.now() - warm;
    const bytes = Buffer.byteLength(JSON.stringify(index));
    console.log(
      `scale: cold ${coldMs.toFixed(0)} ms, warm ${warmMs.toFixed(0)} ms, ${(bytes / 1024).toFixed(0)} KB`,
    );
    expect(index.features).toHaveLength(120);
    expect(warmMs).toBeLessThan(1_500);
    expect(bytes).toBeLessThan(2 * 1024 * 1024);
  });
});
