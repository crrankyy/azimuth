import { afterEach, describe, expect, it } from "vitest";
import { loadProject } from "../../src/core/model";
import { MINIMAL_CONFIG, featureMd, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const SPEC = {
  ".azimuth/features/F-001-login/impact.md":
    "---\nfiles:\n  - path: src/login.ts\n    change: create\n---\n",
  ".azimuth/features/F-001-login/stories.md":
    "## ST-001.1 · Log in\n**Intent:** x\n\n### S-001.1.1 · Works {happy}\n- **GIVEN** a\n- **WHEN** b\n- **THEN** c\n",
  ".azimuth/features/F-001-login/contract.md":
    "## Types\n```ts\ntype User = { id: string };\n```\n",
  ".azimuth/features/F-001-login/plan.md":
    "---\ntasks:\n  - id: T-001.1\n    title: Build\n    covers: [S-001.1.1]\n    verify: pnpm test\n---\n",
  ".azimuth/features/F-001-login/log.md":
    "## 2026-10-01T10:00:00Z · agent · transition\nidea → draft\n",
};

describe("loadProject", () => {
  it("reads every entity type and builds spec parts", () => {
    const tree = writeTree({
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      ".azimuth/project/vision.md":
        "---\nupdated: 2026-10-01\n---\n# Vision\n\n## Problem\nIt hurts.\n",
      ".azimuth/project/architecture.md":
        "---\nreconciled_at: 4e12345\nmodules:\n  - name: app\n    path: src/\n---\nOverview.\n",
      ".azimuth/project/glossary.md": "---\nterms:\n  - term: User\n    definition: Someone\n---\n",
      ".azimuth/features/F-001-login/feature.md": featureMd(
        { id: "F-001", title: "Login", status: "draft", created: "2026-10-01" },
        "## Objective\nLet users in.\n",
      ),
      ...SPEC,
      ".azimuth/milestones/M-01-mvp.md": "---\nid: M-01\ntitle: MVP\n---\n",
      ".azimuth/decisions/ADR-0001-use-sqlite.md":
        "---\nid: ADR-0001\ntitle: SQLite\nstatus: accepted\ndate: 2026-10-01\n---\n## Decision\nUse it.\n",
      ".azimuth/questions/Q-0001.md":
        "---\nid: Q-0001\ntitle: Which?\nraised_by: you\nraised_at: 2026-10-01T10:00:00Z\n---\nWhy not.\n",
      ".azimuth/issues/BUG-0001-crash.md":
        "---\nid: BUG-0001\ntype: bug\ntitle: Crash\nseverity: high\ncreated: 2026-10-01\n---\n## Repro\nRun it.\n",
      ".azimuth/sessions/SES-20261001-1000.md":
        "---\nid: SES-20261001-1000\nstarted_at: 2026-10-01T10:00:00Z\n---\n## Summary\nDid things.\n## Handoff\nNext.\n",
      ".azimuth/cache/runs/R-0001.json": JSON.stringify({
        id: "R-0001",
        target: "T-001.1",
        at: "2026-10-01T11:00:00Z",
        ok: true,
      }),
    });
    cleanup = tree.cleanup;
    const model = loadProject(tree.root);
    expect(model.problems).toEqual([]);
    expect(model.knowledge.vision.body).toBe("## Problem\nIt hurts.");
    expect(model.knowledge.architecture.reconciled_at).toBe("4e12345");
    expect(model.knowledge.architecture.modules[0]?.path).toBe("src");
    expect(model.knowledge.glossary).toEqual([
      { term: "User", definition: "Someone", aliases: [] },
    ]);
    const feature = model.features[0];
    expect(feature).toMatchObject({
      id: "F-001",
      slug: "login",
      dir: ".azimuth/features/F-001-login/",
    });
    expect(feature?.files.asBuilt).toBeNull();
    expect(feature?.stories[0]?.scenarios[0]?.id).toBe("S-001.1.1");
    expect(feature?.tasks[0]?.covers).toEqual(["S-001.1.1"]);
    expect(feature?.log[0]?.transition).toEqual({ from: "idea", to: "draft" });
    expect(feature?.spec?.featureBody).toBe("## Objective\nLet users in.\n");
    expect(model.milestones[0]?.file).toBe(".azimuth/milestones/M-01-mvp.md");
    expect(model.decisions[0]?.body.decision).toBe("Use it.");
    expect(model.questions[0]?.context).toBe("Why not.");
    expect(model.issues[0]?.body).toBe("## Repro\nRun it.");
    expect(model.sessions[0]?.handoff).toBe("Next.");
    expect(model.runs[0]?.id).toBe("R-0001");
  });

  it("reports duplicate IDs, mismatched names and stray files", () => {
    const tree = writeTree({
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      ".azimuth/decisions/ADR-0001-a.md":
        "---\nid: ADR-0001\ntitle: A\nstatus: accepted\ndate: 2026-10-01\n---\n",
      ".azimuth/decisions/ADR-0001-b.md":
        "---\nid: ADR-0001\ntitle: B\nstatus: accepted\ndate: 2026-10-01\n---\n",
      ".azimuth/decisions/ADR-0002-c.md":
        "---\nid: ADR-0003\ntitle: C\nstatus: accepted\ndate: 2026-10-01\n---\n",
      ".azimuth/decisions/notes.md": "scratch\n",
    });
    cleanup = tree.cleanup;
    const model = loadProject(tree.root);
    expect(model.decisions.map((d) => d.id)).toEqual(["ADR-0001", "ADR-0003"]);
    expect(model.problems.map((p) => p.code).sort()).toEqual([
      "E-ID-DUP",
      "E-ID-MISMATCH",
      "W-STRAY-FILE",
    ]);
  });

  it("has no spec parts for an idea without spec files", () => {
    const tree = writeTree({
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      ".azimuth/features/F-002-idea/feature.md": featureMd({
        id: "F-002",
        title: "Idea",
        status: "idea",
        created: "2026-10-01",
      }),
    });
    cleanup = tree.cleanup;
    const model = loadProject(tree.root);
    expect(model.features[0]?.spec).toBeNull();
    expect(model.features[0]?.files.plan).toBeNull();
  });
});
