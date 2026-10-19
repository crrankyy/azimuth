import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AzimuthError } from "./errors";
import { featureOf, idKind } from "./ids";
import { withLock, writeFileAtomic } from "./lock";
import { loadProject } from "./model";
import type { Result, Who } from "./transitions";
import type { Id, ISODate } from "./types";

/**
 * notes.md after one more note: `existing` (or, when null or blank, a new "# <featureId>: Notes"
 * file) with its trailing whitespace trimmed, a blank line, "### <ref> · <date>", a blank line,
 * the trimmed text and a final newline.
 */
export function appendNoteText(
  existing: string | null,
  featureId: Id,
  ref: Id,
  date: ISODate,
  text: string,
): string {
  const base =
    existing === null || existing.trim() === ""
      ? `# ${featureId}: Notes`
      : existing.replace(/\s+$/, "");
  return `${base}\n\n### ${ref} · ${date}\n\n${text.trim()}\n`;
}

function readOptional(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/**
 * Appends a note for a feature or one of its tasks to the feature's notes.md, under the project
 * lock. Result: { ref, from: null, to: null, changed: [notes.md], auto: false,
 * message: "<ref>: note added" }.
 */
export function addNote(root: string, ref: string, text: string, opts: Who): Result {
  const kind = idKind(ref);
  if (kind !== "feature" && kind !== "task")
    throw new AzimuthError("invalid", `${ref} is not a feature or task.`);
  if (!text.trim()) throw new AzimuthError("invalid", "A note needs some text.");
  const featureId = featureOf(ref) ?? ref;
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const f = loadProject(root).features.find((x) => x.id === featureId);
    if (!f) throw new AzimuthError("not-found", `${featureId} does not exist.`);
    if (kind === "task" && !f.tasks.some((t) => t.id === ref)) {
      const plan = f.files.plan ?? `${f.dir}plan.md`;
      throw new AzimuthError("not-found", `${ref} is not a task in ${plan}.`);
    }
    const file = f.files.notes ?? `${f.dir}notes.md`;
    const abs = join(root, file);
    // Notes are dated by the UTC day, like the rest of Azimuth's dates.
    const date = now.toISOString().slice(0, 10);
    writeFileAtomic(abs, appendNoteText(readOptional(abs), f.id, ref, date, text));
    return {
      ref,
      from: null,
      to: null,
      changed: [file],
      auto: false,
      message: `${ref}: note added`,
    };
  });
}
