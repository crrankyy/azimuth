import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { allocateId, sessionIdFor } from "../../src/core/allocate";
import { buildIndex } from "../../src/core/build-index";
import { userEventsSince } from "../../src/core/delta";
import { AzimuthError } from "../../src/core/errors";
import { updateFrontmatterItem } from "../../src/core/frontmatter";
import { loadProject } from "../../src/core/model";
import {
  FEATURE_FLOW,
  acknowledge,
  addLogEntry,
  answerQuestion,
  featureTransitionError,
  move,
  moveFeature,
  needsReason,
  reapproveFeature,
  resolveQuestion,
  setField,
} from "../../src/core/transitions";
import { FEATURE_STATUSES } from "../../src/core/types";
import { featureFiles } from "../helpers/project";
import { commitAll, initRepo } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const MANUAL = `${MINIMAL_CONFIG}autonomy:\n  approve_specs: manual\n  accept_adrs: manual\n`;
const agent = { actor: "agent" as const, now: new Date("2026-10-18T12:00:00Z") };
const you = { actor: "you" as const, now: new Date("2026-10-18T12:00:00Z") };

function repo(files: Record<string, string>, config = MINIMAL_CONFIG) {
  const tree = writeTree({
    ".azimuth/config.yaml": config,
    "src/app.ts": "export {};\n",
    ...files,
  });
  cleanup = tree.cleanup;
  initRepo(tree.root);
  commitAll(tree.root, "chore: start");
  return tree;
}

function errorOf(fn: () => unknown): AzimuthError {
  try {
    fn();
  } catch (e) {
    if (e instanceof AzimuthError) return e;
    throw e;
  }
  throw new Error("expected an AzimuthError");
}

describe("feature transition rules (exhaustive)", () => {
  for (const from of FEATURE_STATUSES) {
    for (const to of FEATURE_STATUSES) {
      for (const actor of ["you", "agent"] as const) {
        for (const approveSpecs of ["auto", "manual"] as const) {
          it(`${from} → ${to} by ${actor} (${approveSpecs})`, () => {
            const error = featureTransitionError("F-001", from, to, {
              actor,
              approveSpecs,
              reason: "because",
              supersededBy: "F-002",
            });
            const listed = FEATURE_FLOW[from].includes(to);
            const policyBlocked =
              to === "approved" && actor === "agent" && approveSpecs === "manual";
            if (!listed) expect(error?.code).toBe("invalid");
            else if (policyBlocked) expect(error?.code).toBe("policy");
            else expect(error).toBeNull();
          });
        }
      }
    }
  }

  it("requires reasons for moves that undo or park work", () => {
    expect(needsReason("approved", "draft")).toBe(true);
    expect(needsReason("idea", "draft")).toBe(false);
    expect(
      featureTransitionError("F-001", "idea", "cancelled", { actor: "you", approveSpecs: "auto" })
        ?.code,
    ).toBe("invalid");
    expect(
      featureTransitionError("F-001", "draft", "superseded", { actor: "you", approveSpecs: "auto" })
        ?.message,
    ).toContain("--by");
    expect(
      featureTransitionError("F-001", "approved", "in-progress", {
        actor: "agent",
        approveSpecs: "auto",
        override: true,
      })?.code,
    ).toBe("policy");
  });
});

describe("moveFeature", () => {
  it("runs a feature through approval automatically and records it for review", () => {
    const tree = repo(featureFiles({ id: "F-001", status: "draft" }));
    const result = moveFeature(tree.root, "F-001", "approved", agent);
    expect(result).toMatchObject({ from: "draft", to: "approved", auto: true });
    const feature = loadProject(tree.root).features[0];
    expect(feature).toMatchObject({
      status: "approved",
      approved_by: "agent",
      approved_at: "2026-10-18",
    });
    expect(feature?.approved_hash).toMatch(/^sha256:/);
    expect(feature?.approved_commit).toMatch(/^[0-9a-f]{7}$/);
    expect(feature?.log.at(-1)).toMatchObject({
      auto: true,
      transition: { from: "draft", to: "approved" },
    });
    const { index } = buildIndex(tree.root, { now: agent.now });
    expect(index.inbox.map((i) => i.kind)).toEqual(["review-auto"]);
    expect(index.problems).toEqual([]);
  });

  it("refuses agent approval when approval is manual", () => {
    const tree = repo(featureFiles({ id: "F-001", status: "draft" }), MANUAL);
    expect(errorOf(() => moveFeature(tree.root, "F-001", "approved", agent)).code).toBe("policy");
    expect(moveFeature(tree.root, "F-001", "approved", you).auto).toBe(false);
  });

  it("refuses approval of an uncommitted spec and reports the gate", () => {
    const tree = repo(featureFiles({ id: "F-001", status: "draft" }));
    tree.write(".azimuth/features/F-001-thing/contract.md", "## Types\n```ts\ntype B = 2;\n```\n");
    const error = errorOf(() => moveFeature(tree.root, "F-001", "approved", agent));
    expect(error.code).toBe("gate");
    expect(error.gate?.checks.filter((c) => !c.ok).map((c) => c.id)).toEqual(["approve.committed"]);
    expect(
      readFileSync(join(tree.root, ".azimuth/features/F-001-thing/feature.md"), "utf8"),
    ).toContain("status: draft");
  });

  it("detects a changed spec after approval and re-approves it", () => {
    const tree = repo(featureFiles({ id: "F-001", status: "draft" }));
    moveFeature(tree.root, "F-001", "approved", you);
    tree.write(".azimuth/features/F-001-thing/contract.md", "## Types\n```ts\ntype B = 2;\n```\n");
    commitAll(tree.root, "docs(F-001): change contract\n\nRefs: F-001", "2026-10-18T12:30:00Z");
    let index = buildIndex(tree.root, { now: you.now }).index;
    expect(index.features[0]?.derived.modified_since_approval).toBe(true);
    expect(index.features[0]?.derived.approval_changes.map((c) => c.path)).toEqual([
      ".azimuth/features/F-001-thing/contract.md",
    ]);
    expect(index.inbox.map((i) => i.kind)).toEqual(["reapprove-spec"]);
    expect(
      errorOf(() => moveFeature(tree.root, "F-001", "in-progress", agent)).gate?.checks[0]?.ok,
    ).toBe(false);
    reapproveFeature(tree.root, "F-001", agent);
    index = buildIndex(tree.root, { now: you.now }).index;
    expect(index.features[0]?.derived.modified_since_approval).toBe(false);
    expect(index.inbox.map((i) => i.kind)).toEqual(["review-auto"]);
  });

  it("needs a reason to go back and clears the approval", () => {
    const tree = repo(featureFiles({ id: "F-001", status: "draft" }));
    moveFeature(tree.root, "F-001", "approved", you);
    expect(errorOf(() => moveFeature(tree.root, "F-001", "draft", you)).code).toBe("invalid");
    moveFeature(tree.root, "F-001", "draft", { ...you, reason: "Scope changed" });
    const f = loadProject(tree.root).features[0];
    expect(f).toMatchObject({
      status: "draft",
      approved_at: null,
      approved_by: null,
      approved_hash: null,
    });
    expect(f?.log.at(-1)?.body).toBe("approved → draft\n\nScope changed");
  });

  it("lets you override unfinished dependencies when starting", () => {
    const tree = repo({
      ...featureFiles({ id: "F-001", status: "in-progress" }),
      ...featureFiles({ id: "F-002", status: "draft", extra: { depends_on: "[F-001]" } }),
    });
    moveFeature(tree.root, "F-002", "approved", you);
    expect(errorOf(() => moveFeature(tree.root, "F-002", "in-progress", agent)).code).toBe("gate");
    moveFeature(tree.root, "F-002", "in-progress", {
      ...you,
      override: true,
      reason: "F-001 API is stable",
    });
    expect(loadProject(tree.root).features[1]?.overrides[0]).toMatchObject({
      gate: "start.dependencies-done",
    });
  });

  it("rejects a stale expected status", () => {
    const tree = repo(featureFiles({ id: "F-001", status: "draft" }));
    expect(
      errorOf(() => moveFeature(tree.root, "F-001", "approved", { ...you, expectStatus: "idea" }))
        .code,
    ).toBe("conflict");
  });
});

describe("tasks", () => {
  it("moves tasks by editing only their own lines", () => {
    const tree = repo(
      featureFiles({
        id: "F-001",
        status: "in-progress",
        tasks: [{ id: "T-001.1", covers: ["S-001.1.1", "S-001.1.2"] }, { id: "T-001.2" }],
      }),
    );
    const plan = ".azimuth/features/F-001-thing/plan.md";
    const before = readFileSync(join(tree.root, plan), "utf8");
    move(tree.root, "T-001.1", "in-progress", agent);
    const after = readFileSync(join(tree.root, plan), "utf8");
    const changed = after.split("\n").filter((line, i) => line !== before.split("\n")[i]);
    expect(changed).toEqual(["    status: in-progress"]);
    expect(errorOf(() => move(tree.root, "T-001.2", "blocked", agent)).code).toBe("invalid");
    move(tree.root, "T-001.2", "blocked", { ...agent, note: "Waiting on ADR-0001" });
    const task = loadProject(tree.root).features[0]?.tasks[1];
    expect(task).toMatchObject({ status: "blocked", note: "Waiting on ADR-0001" });
  });

  it("requires the feature to be in progress", () => {
    const tree = repo(featureFiles({ id: "F-001", status: "approved" }));
    expect(errorOf(() => move(tree.root, "T-001.1", "in-progress", agent)).message).toContain(
      "Move it to in-progress first",
    );
  });
});

describe("decisions and questions", () => {
  const adr = (id: string, extra = "") =>
    `---\nid: ${id}\ntitle: Decision ${id}\nstatus: proposed\ndate: 2026-10-18\n${extra}---\n## Decision\nDo it.\n`;
  const question =
    "---\nid: Q-0001\ntitle: Which?\nraised_by: you\nraised_at: 2026-10-18T10:00:00Z\noptions:\n  - key: a\n    label: A\n    recommended: true\n  - key: b\n    label: B\n---\n";

  it("auto-accepts agent decisions with guardrails", () => {
    const tree = repo({
      ".azimuth/decisions/ADR-0001-a.md": adr("ADR-0001"),
      ".azimuth/decisions/ADR-0002-b.md": adr("ADR-0002", "resolves: [Q-0001]\n"),
      ".azimuth/questions/Q-0001.md": question,
    });
    expect(move(tree.root, "ADR-0001", "accepted", agent).auto).toBe(true);
    expect(errorOf(() => move(tree.root, "ADR-0002", "accepted", agent)).message).toContain(
      "hasn't answered",
    );
    expect(errorOf(() => move(tree.root, "ADR-0001", "proposed", agent)).code).toBe("policy");
    move(tree.root, "ADR-0001", "proposed", you);
    expect(loadProject(tree.root).decisions[0]).toMatchObject({
      status: "proposed",
      decided_by: null,
    });
  });

  it("keeps your note on a decision and tells the agent", () => {
    const tree = repo({ ".azimuth/decisions/ADR-0001-a.md": adr("ADR-0001") });
    move(tree.root, "ADR-0001", "rejected", { ...you, note: "Too slow.\nTry a lease." });
    const model = loadProject(tree.root);
    expect(model.decisions[0]?.decision_note).toBe("Too slow.\nTry a lease.");
    const [event] = userEventsSince(model, { at: "2026-10-18T00:00:00Z", keys: [] });
    expect(event?.text).toBe("rejected ADR-0001 (Decision ADR-0001): Too slow.\nTry a lease.");
    move(tree.root, "ADR-0001", "proposed", you);
    expect(loadProject(tree.root).decisions[0]?.decision_note).toBeNull();
  });

  it("supersedes a decision and links both sides", () => {
    const tree = repo({
      ".azimuth/decisions/ADR-0001-a.md": adr("ADR-0001").replace(
        "status: proposed",
        "status: accepted",
      ),
      ".azimuth/decisions/ADR-0002-b.md": adr("ADR-0002"),
    });
    move(tree.root, "ADR-0001", "superseded", { ...you, supersededBy: "ADR-0002" });
    const [a, b] = loadProject(tree.root).decisions;
    expect(a).toMatchObject({ status: "superseded", superseded_by: "ADR-0002" });
    expect(b?.supersedes).toBe("ADR-0001");
  });

  it("only lets you answer, then an agent resolves", () => {
    const tree = repo({
      ".azimuth/questions/Q-0001.md": question,
      ".azimuth/decisions/ADR-0001-a.md": adr("ADR-0001"),
    });
    expect(errorOf(() => answerQuestion(tree.root, "Q-0001", { option: "a" }, agent)).code).toBe(
      "policy",
    );
    expect(errorOf(() => answerQuestion(tree.root, "Q-0001", { option: "z" }, you)).code).toBe(
      "invalid",
    );
    answerQuestion(tree.root, "Q-0001", { option: "a", text: "A, clearly" }, you);
    resolveQuestion(tree.root, "Q-0001", { kind: "adr", ref: "ADR-0001" }, agent);
    expect(loadProject(tree.root).questions[0]).toMatchObject({
      status: "answered",
      answer: { option: "a", text: "A, clearly", answered_at: "2026-10-18T12:00:00Z" },
      resolution: { kind: "adr", ref: "ADR-0001" },
    });
  });
});

describe("milestones, issues, fields and logs", () => {
  it("releases milestones (you only) and closes issues", () => {
    const tree = repo({
      ".azimuth/milestones/M-01-mvp.md": "---\nid: M-01\ntitle: MVP\nstatus: active\n---\n",
      ".azimuth/issues/BUG-0001-x.md":
        "---\nid: BUG-0001\ntype: bug\ntitle: X\nseverity: low\ncreated: 2026-10-01\n---\n",
    });
    expect(errorOf(() => move(tree.root, "M-01", "released", agent)).code).toBe("policy");
    move(tree.root, "M-01", "released", you);
    expect(errorOf(() => move(tree.root, "BUG-0001", "wontfix", agent)).code).toBe("invalid");
    move(tree.root, "BUG-0001", "resolved", agent);
    const model = loadProject(tree.root);
    expect(model.milestones[0]).toMatchObject({ status: "released", released_at: "2026-10-18" });
    expect(model.issues[0]).toMatchObject({ status: "resolved", resolved_at: "2026-10-18" });
  });

  it("sets fields, adds log entries and acknowledges automatic approvals", () => {
    const tree = repo({
      ...featureFiles({ id: "F-001", status: "draft" }),
      ".azimuth/milestones/M-01-mvp.md": "---\nid: M-01\ntitle: MVP\n---\n",
    });
    setField(tree.root, "F-001", "priority", "P0", you);
    setField(tree.root, "F-001", "milestone", "M-01", you);
    expect(errorOf(() => setField(tree.root, "F-001", "priority", "P9", you)).code).toBe("invalid");
    addLogEntry(tree.root, "T-001.1", "note", "Halfway there", agent);
    expect(errorOf(() => addLogEntry(tree.root, "F-001", "review", "Nope", agent)).code).toBe(
      "policy",
    );
    addLogEntry(tree.root, "F-001", "review", "Spell out the error code", you);
    moveFeature(tree.root, "F-001", "approved", agent);
    acknowledge(tree.root, "F-001", you);
    const f = loadProject(tree.root).features[0];
    expect(f).toMatchObject({
      priority: "P0",
      milestone: "M-01",
      review_ack_at: "2026-10-18T12:00:00Z",
    });
    expect(f?.log.map((e) => [e.type, e.body.split("\n")[0]])).toEqual([
      ["transition", "idea → draft"],
      ["note", "T-001.1: Halfway there"],
      ["review", "Spell out the error code"],
      ["transition", "draft → approved"],
    ]);
  });
});

describe("allocation", () => {
  it("allocates sequential IDs, skips taken ones and never reissues", () => {
    const tree = repo({ ".azimuth/questions/Q-0003.md": "x" });
    const created: string[] = [];
    const create = (id: string) => {
      const path = join(tree.root, ".azimuth/questions", `${id}.md`);
      writeFileSync(path, id, { flag: "wx" });
      created.push(id);
    };
    expect(allocateId(tree.root, "question", create)).toBe("Q-0004");
    writeFileSync(join(tree.root, ".azimuth/questions/Q-0005.md"), "taken");
    expect(
      allocateId(tree.root, "question", (id) =>
        id === "Q-0005"
          ? (() => {
              throw Object.assign(new Error("exists"), { code: "EEXIST" });
            })()
          : create(id),
      ),
    ).toBe("Q-0006");
    expect(sessionIdFor(tree.root, new Date("2026-10-18T11:00:00Z"))).toBe("SES-20261018-1100");
    tree.write(".azimuth/sessions/SES-20261018-1100.md", "x");
    expect(sessionIdFor(tree.root, new Date("2026-10-18T11:00:30Z"))).toBe("SES-20261018-1100-2");
  });
});

describe("updateFrontmatterItem", () => {
  const plan =
    "---\ntasks:\n  - id: T-001.1\n    title: One\n    status: todo\n  - id: T-001.2\n    title: Two\n---\nNotes\n";
  it("replaces and inserts keys on one list item", () => {
    const out = updateFrontmatterItem(plan, "tasks", (t) => t.id === "T-001.2", {
      status: "blocked",
      note: "Waiting",
    });
    expect(out).toBe(
      "---\ntasks:\n  - id: T-001.1\n    title: One\n    status: todo\n  - id: T-001.2\n    title: Two\n    status: blocked\n    note: Waiting\n---\nNotes\n",
    );
    expect(
      updateFrontmatterItem(plan, "tasks", (t) => t.id === "T-009.1", { status: "done" }),
    ).toBeNull();
  });
});
