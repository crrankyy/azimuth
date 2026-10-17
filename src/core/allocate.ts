import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sharedCacheDir, withLock, writeFileAtomic } from "./lock";
import { azPath } from "./paths";

export type CounterKind =
  "milestone" | "feature" | "decision" | "question" | "bug" | "debt" | "risk" | "run";

const COUNTERS: Record<CounterKind, { prefix: string; digits: number; folder: string[] }> = {
  milestone: { prefix: "M", digits: 2, folder: ["milestones"] },
  feature: { prefix: "F", digits: 3, folder: ["features"] },
  decision: { prefix: "ADR", digits: 4, folder: ["decisions"] },
  question: { prefix: "Q", digits: 4, folder: ["questions"] },
  bug: { prefix: "BUG", digits: 4, folder: ["issues"] },
  debt: { prefix: "DEBT", digits: 4, folder: ["issues"] },
  risk: { prefix: "RISK", digits: 4, folder: ["issues"] },
  run: { prefix: "R", digits: 4, folder: ["cache", "runs"] },
};

function readMarks(path: string): Record<string, number> {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, number>;
  } catch {
    return {};
  }
}

function highestOnDisk(root: string, kind: CounterKind): number {
  const { prefix, folder } = COUNTERS[kind];
  const pattern = new RegExp(`^${prefix}-(\\d+)`);
  let max = 0;
  try {
    for (const name of readdirSync(azPath(root, ...folder))) {
      const n = Number(pattern.exec(name)?.[1] ?? 0);
      if (n > max) max = n;
    }
  } catch {
    // Folder doesn't exist yet: nothing allocated.
  }
  return max;
}

export function formatId(kind: CounterKind, n: number): string {
  const { prefix, digits } = COUNTERS[kind];
  return `${prefix}-${String(n).padStart(digits, "0")}`;
}

/**
 * Allocates the next ID of `kind` and calls `create(id)` under the project lock. `create` must
 * create its file or folder exclusively (`wx` / non-recursive mkdir) and throw EEXIST if it is
 * taken; the next number is then tried. IDs are never reissued, even after deletion.
 */
export function allocateId(root: string, kind: CounterKind, create: (id: string) => void): string {
  return withLock(root, () => {
    const marksPath = join(sharedCacheDir(root), "ids.json");
    const marks = readMarks(marksPath);
    let n = Math.max(highestOnDisk(root, kind), marks[kind] ?? 0) + 1;
    for (;;) {
      const id = formatId(kind, n);
      try {
        create(id);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "EEXIST") {
          n++;
          continue;
        }
        throw e;
      }
      writeFileAtomic(marksPath, JSON.stringify({ ...marks, [kind]: n }, null, 2) + "\n");
      return id;
    }
  });
}

/** `SES-YYYYMMDD-HHMM` (UTC), with `-2`, `-3`… when that minute is already taken. */
export function sessionIdFor(root: string, now: Date): string {
  const iso = now.toISOString();
  const base = `SES-${iso.slice(0, 10).replace(/-/g, "")}-${iso.slice(11, 16).replace(":", "")}`;
  let id = base;
  for (let n = 2; existsSync(azPath(root, "sessions", `${id}.md`)); n++) id = `${base}-${n}`;
  return id;
}
