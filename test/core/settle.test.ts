import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { loadProject } from "../../src/core/model";
import { settleValue } from "../../src/core/settle";
import { specHash } from "../../src/core/spec-hash";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const DIR = ".azimuth/features/F-001-thing";
const THEN = "- **THEN** the heading starts at byte {?}";

/** F-001's stories: S-001.1.1 with `then`, S-001.1.2 without placeholders. */
const stories = (then: string) =>
  [
    "## ST-001.1 · Headings",
    "**Intent:** As a reader, I want headings found.",
    "",
    "### S-001.1.1 · Finds the heading {happy}",
    "- **GIVEN** the text `# Hi`",
    "- **WHEN** it is parsed",
    then,
    "",
    "### S-001.1.2 · No heading {negative}",
    "- **GIVEN** the text `Hi`",
    "- **WHEN** it is parsed",
    "- **THEN** it returns `null`",
    "",
  ].join("\n");

function project(extra: Record<string, string> = {}) {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({ id: "F-001", status: "in-progress", extra }),
    [`${DIR}/stories.md`]: stories(THEN),
  });
  cleanup = tree.cleanup;
  return tree;
}

const read = (root: string, name: string) => readFileSync(join(root, DIR, name), "utf8");

describe("ST-008.7 azimuth settle records the value", () => {
  it("S-008.7.1 writes the story and the log", () => {
    const { root } = project();
    const result = settleValue(root, "S-001.1.1", "17..30", {
      actor: "agent",
      session: "SES-20261020-0900",
      now: new Date("2026-10-20T10:00:00Z"),
    });
    expect(read(root, "stories.md")).toBe(
      stories("- **THEN** the heading starts at byte {=17..30}"),
    );
    expect(
      read(root, "log.md").endsWith(
        "## 2026-10-20T10:00:00Z · agent · note · SES-20261020-0900\nSettled S-001.1.1: {=17..30}\n",
      ),
    ).toBe(true);
    expect(result.changed).toEqual([`${DIR}/stories.md`, `${DIR}/log.md`]);
    expect(result.message).toBe("S-001.1.1: settled 17..30");
  });
});

describe("ST-008.8 settling never changes the spec hash", () => {
  it("S-008.8.5 keeps a settled feature unmodified since approval", () => {
    const tree = project();
    const spec = loadProject(tree.root).features[0]?.spec;
    if (!spec) throw new Error("F-001 has no spec");
    const approved = featureFiles({
      id: "F-001",
      status: "in-progress",
      extra: { approved_by: "agent", approved_at: "2026-10-19", approved_hash: specHash(spec) },
    });
    tree.write(`${DIR}/feature.md`, approved[`${DIR}/feature.md`] as string);
    settleValue(tree.root, "S-001.1.1", "17", { actor: "agent" });
    expect(read(tree.root, "stories.md")).toContain("{=17}");
    const { index } = buildIndex(tree.root, { now: new Date("2026-10-20T12:00:00Z") });
    expect(index.features[0]?.derived.modified_since_approval).toBe(false);
    expect(index.inbox.filter((i) => i.kind === "reapprove-spec")).toEqual([]);
  });
});
