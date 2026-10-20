import { afterEach, describe, expect, it, vi } from "vitest";
import { diskSpace, diskWarning } from "../../src/core/disk";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const LOW =
  "Low disk space: 4.2 GB free on the project's disk, below verify.min_free_gb (10). Builds fail when the disk fills up.";

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

function project(config = ""): string {
  const tree = writeTree({ ".azimuth/config.yaml": `${MINIMAL_CONFIG}${config}` });
  cleanup = tree.cleanup;
  return tree.root;
}

describe("ST-018.7 the disk guard", () => {
  it("S-018.7.1 warns below the default threshold", () => {
    const space = diskSpace(project(), () => 4_200_000_000);
    expect(space).toEqual({ state: "low", free_bytes: 4_200_000_000, min_free_gb: 10 });
    expect(diskWarning(space)).toBe(LOW);
  });

  it("S-018.7.2 rounds the free space down and takes the threshold itself as enough", () => {
    const root = project();
    expect(diskWarning(diskSpace(root, () => 9_999_999_999))).toBe(
      "Low disk space: 9.9 GB free on the project's disk, below verify.min_free_gb (10). Builds fail when the disk fills up.",
    );
    const atThreshold = diskSpace(root, () => 10_000_000_000);
    expect(atThreshold).toEqual({ state: "ok", free_bytes: 10_000_000_000, min_free_gb: 10 });
    expect(diskWarning(atThreshold)).toBeNull();
  });

  it("S-018.7.3 reads nothing and warns about nothing with min_free_gb 0", () => {
    const free = vi.fn(() => 1);
    const space = diskSpace(project("verify:\n  min_free_gb: 0\n"), free);
    expect(space).toEqual({ state: "off" });
    expect(free).not.toHaveBeenCalled();
    expect(diskWarning(space)).toBeNull();
  });

  it("S-018.7.4 never warns when the free space can't be read", () => {
    const space = diskSpace(project(), () => {
      throw new Error("ENOSYS: function not implemented, statfs");
    });
    expect(space).toEqual({ state: "unknown", error: "ENOSYS: function not implemented, statfs" });
    expect(diskWarning(space)).toBeNull();
  });
});
