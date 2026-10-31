import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AzimuthError } from "../../src/core/errors";
import { loadProject } from "../../src/core/model";
import { moveFeature } from "../../src/core/transitions";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const now = new Date("2026-10-31T12:00:00Z");
const agent = { actor: "agent" as const, now };

const milestone = (id: string, title: string, status: string, extra = "") =>
  `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\n${extra}---\n`;

const M01 = ".azimuth/milestones/M-01-first.md";
const M02 = ".azimuth/milestones/M-02-second.md";
const featureMd = (id: string) => `.azimuth/features/${id}-thing/feature.md`;
const logMd = (id: string) => `.azimuth/features/${id}-thing/log.md`;

function project(files: Record<string, string>): string {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    "src/app.ts": "export {};\n",
    ...files,
  });
  cleanup = tree.cleanup;
  return tree.root;
}

const readAt = (root: string, file: string) => readFileSync(join(root, file), "utf8");

function errorOf(fn: () => unknown): AzimuthError {
  try {
    fn();
  } catch (e) {
    if (e instanceof AzimuthError) return e;
    throw e;
  }
  throw new Error("expected an AzimuthError");
}

describe("a feature starting activates its planned milestone", () => {
  it("S-026.1.1 a feature starting moves its planned milestone to active", () => {
    const root = project({
      [M01]: milestone("M-01", "First", "planned"),
      ...featureFiles({ id: "F-001", status: "approved", extra: { milestone: "M-01" } }),
    });
    const result = moveFeature(root, "F-001", "in-progress", agent);
    expect(result).toEqual({
      ref: "F-001",
      from: "approved",
      to: "in-progress",
      changed: [featureMd("F-001"), logMd("F-001"), M01],
      auto: false,
      message: "F-001: approved → in-progress (M-01: planned → active)",
    });
    expect(readAt(root, M01)).toBe("---\nid: M-01\ntitle: First\nstatus: active\n---\n");
    const f = loadProject(root).features.find((x) => x.id === "F-001");
    expect(f?.status).toBe("in-progress");
    expect(f?.log.at(-1)?.body).toBe("approved → in-progress");
  });

  it("S-026.1.2 an active or released milestone is left alone", () => {
    const root = project({
      [M01]: milestone("M-01", "First", "active"),
      [M02]: milestone("M-02", "Second", "released", "released_at: 2026-10-01\n"),
      ...featureFiles({ id: "F-001", status: "approved", extra: { milestone: "M-01" } }),
      ...featureFiles({ id: "F-002", status: "approved", extra: { milestone: "M-02" } }),
    });
    const before = [readAt(root, M01), readAt(root, M02)];
    const first = moveFeature(root, "F-001", "in-progress", agent);
    const second = moveFeature(root, "F-002", "in-progress", agent);
    expect(first.message).toBe("F-001: approved → in-progress");
    expect(second.message).toBe("F-002: approved → in-progress");
    expect(first.changed).toEqual([featureMd("F-001"), logMd("F-001")]);
    expect(second.changed).toEqual([featureMd("F-002"), logMd("F-002")]);
    expect([readAt(root, M01), readAt(root, M02)]).toEqual(before);
  });

  it("S-026.1.3 no milestone, or one without a file, changes nothing more", () => {
    const root = project({
      [M01]: milestone("M-01", "First", "planned"),
      ...featureFiles({ id: "F-001", status: "approved" }),
      ...featureFiles({ id: "F-002", status: "approved", extra: { milestone: "M-09" } }),
    });
    const first = moveFeature(root, "F-001", "in-progress", agent);
    const second = moveFeature(root, "F-002", "in-progress", agent);
    expect(first.message).toBe("F-001: approved → in-progress");
    expect(second.message).toBe("F-002: approved → in-progress");
    expect(first.changed).toEqual([featureMd("F-001"), logMd("F-001")]);
    expect(second.changed).toEqual([featureMd("F-002"), logMd("F-002")]);
    expect(readAt(root, M01)).toContain("status: planned\n");
  });

  it("S-026.1.4 a refused start leaves the milestone planned", () => {
    const root = project({
      [M01]: milestone("M-01", "First", "planned"),
      ...featureFiles({
        id: "F-001",
        status: "approved",
        extra: { milestone: "M-01", depends_on: "[F-002]" },
      }),
      ...featureFiles({ id: "F-002", status: "draft" }),
    });
    const files = [M01, featureMd("F-001"), logMd("F-001")];
    const before = files.map((f) => readAt(root, f));
    const error = errorOf(() => moveFeature(root, "F-001", "in-progress", agent));
    expect(error.code).toBe("gate");
    expect(error.message).toBe(
      "F-001 cannot move to in-progress: Every dependency is done (F-002 is draft).",
    );
    expect(files.map((f) => readAt(root, f))).toEqual(before);
  });

  it("S-026.1.5 a verifying feature sent back activates a drifted milestone", () => {
    const root = project({
      [M01]: milestone("M-01", "First", "planned"),
      ...featureFiles({ id: "F-001", status: "verifying", extra: { milestone: "M-01" } }),
    });
    const result = moveFeature(root, "F-001", "in-progress", {
      ...agent,
      reason: "A test fails on CI",
    });
    expect(result.message).toBe("F-001: verifying → in-progress (M-01: planned → active)");
    expect(readAt(root, M01)).toBe("---\nid: M-01\ntitle: First\nstatus: active\n---\n");
  });
});
