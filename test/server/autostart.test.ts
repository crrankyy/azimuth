import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildId, ensureViewer, healthy } from "../../src/server/autostart";
import { readViewerRecord, viewerRecordPath } from "../../src/server/registry";
import { featureFiles } from "../helpers/project";
import { commitAll, initRepo } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let tree: ReturnType<typeof writeTree>;

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

beforeAll(() => {
  tree = writeTree({
    ".azimuth/config.yaml": `${MINIMAL_CONFIG}viewer:\n  port: 0\n`,
    ...featureFiles({ id: "F-001", status: "draft" }),
  });
  initRepo(tree.root);
  commitAll(tree.root, "chore: start");
});

afterAll(() => {
  const record = readViewerRecord(tree.root);
  if (record && alive(record.pid)) process.kill(record.pid, "SIGTERM");
  tree.cleanup();
});

describe("viewer autostart", () => {
  it("starts one detached viewer, reuses it, and replaces a dead one", async () => {
    const url = await ensureViewer(tree.root, 8_000);
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    const first = readViewerRecord(tree.root);
    expect(first && alive(first.pid)).toBe(true);
    const health = (await (await fetch(`${url}api/health`)).json()) as { root: string };
    expect(health.root).toContain("azimuth-test-");

    expect(await ensureViewer(tree.root, 8_000)).toBe(url);
    expect(readViewerRecord(tree.root)?.pid).toBe(first?.pid);
    // A rebuilt bundle with the same version must count as a different build.
    expect(await healthy(first!, tree.root)).toBe("ok");
    expect(await healthy(first!, tree.root, `${buildId()}0`)).toBe("stale");

    process.kill(first!.pid, "SIGTERM");
    await new Promise((r) => setTimeout(r, 300));
    writeFileSync(viewerRecordPath(tree.root), JSON.stringify({ ...first, pid: 999_999 }));
    const restarted = await ensureViewer(tree.root, 8_000);
    expect(restarted).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(readViewerRecord(tree.root)?.pid).not.toBe(first?.pid);
  });
});
