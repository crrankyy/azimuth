import { ID_PATTERNS, type IdKind } from "./ids";
import type { Problem } from "./types";

/**
 * A tiny field reader for frontmatter. Each reader either accepts a value (returning it typed)
 * or describes what it expected, which becomes an `E-SCHEMA` problem.
 */
export type Reader<T> = (
  value: unknown,
) => { ok: true; value: T } | { ok: false; expected: string };

const ok = <T>(value: T) => ({ ok: true as const, value });
const fail = (expected: string) => ({ ok: false as const, expected });

export function listPhrase(values: readonly string[]): string {
  if (values.length <= 1) return values.join("");
  return `${values.slice(0, -1).join(", ")} or ${values.at(-1)}`;
}

export const r = {
  string: (): Reader<string> => (v) => (typeof v === "string" ? ok(v) : fail("text")),
  text: (): Reader<string> => (v) =>
    typeof v === "string" ? ok(v) : typeof v === "number" ? ok(String(v)) : fail("text"),
  oneOf:
    <T extends string>(values: readonly T[]): Reader<T> =>
    (v) =>
      typeof v === "string" && (values as readonly string[]).includes(v)
        ? ok(v as T)
        : fail(listPhrase(values)),
  date: (): Reader<string> => (v) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? ok(v) : fail("a date (YYYY-MM-DD)"),
  datetime: (): Reader<string> => (v) =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(v)
      ? ok(v)
      : fail("a timestamp (YYYY-MM-DDTHH:MM:SSZ)"),
  id:
    (...kinds: IdKind[]): Reader<string> =>
    (v) =>
      typeof v === "string" && kinds.some((k) => ID_PATTERNS[k].test(v))
        ? ok(v)
        : fail(`an ID (${kinds.join(" or ")})`),
  ids:
    (...kinds: IdKind[]): Reader<string[]> =>
    (v) => {
      if (v === null || v === undefined) return ok([]);
      if (!Array.isArray(v)) return fail(`a list of IDs (${kinds.join(" or ")})`);
      const bad = v.find(
        (x) => typeof x !== "string" || !kinds.some((k) => ID_PATTERNS[k].test(x)),
      );
      return bad === undefined ? ok(v as string[]) : fail(`a list of IDs (${kinds.join(" or ")})`);
    },
  strings: (): Reader<string[]> => (v) => {
    if (v === null || v === undefined) return ok([]);
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string" && typeof x !== "number")) {
      return fail("a list of text values");
    }
    return ok(v.map(String));
  },
  bool: (): Reader<boolean> => (v) => (typeof v === "boolean" ? ok(v) : fail("true or false")),
  int:
    (min = 0): Reader<number> =>
    (v) =>
      typeof v === "number" && Number.isInteger(v) && v >= min
        ? ok(v)
        : fail(`a whole number ≥ ${min}`),
  any: (): Reader<unknown> => (v) => ok(v),
  nullable:
    <T>(reader: Reader<T>): Reader<T | null> =>
    (v) =>
      v === null || v === undefined ? ok(null) : reader(v),
};

export interface FieldContext {
  file: string;
  ref: string | null;
  data: Record<string, unknown>;
  keyLines: Record<string, number>;
  problems: Problem[];
  /** Set when any field fails; the entity is then left out of the index. */
  failed: boolean;
}

export function fieldContext(
  file: string,
  data: Record<string, unknown>,
  keyLines: Record<string, number>,
): FieldContext {
  const ref = typeof data.id === "string" ? data.id : null;
  return { file, ref, data, keyLines, problems: [], failed: false };
}

function schemaProblem(ctx: FieldContext, key: string, message: string): void {
  ctx.failed = true;
  ctx.problems.push({
    code: "E-SCHEMA",
    severity: "error",
    file: ctx.file,
    line: ctx.keyLines[key] ?? null,
    ref: ctx.ref,
    message,
  });
}

/** Reads a required field. Missing or invalid values are reported and replaced by `fallback`. */
export function need<T>(ctx: FieldContext, key: string, reader: Reader<T>, fallback: T): T {
  const value = ctx.data[key];
  if (value === undefined) {
    schemaProblem(ctx, key, `${key} is required.`);
    return fallback;
  }
  const result = reader(value);
  if (result.ok) return result.value;
  schemaProblem(ctx, key, `${key} must be ${result.expected} (got ${JSON.stringify(value)}).`);
  return fallback;
}

/** Reads an optional field; absent means `fallback`. */
export function opt<T>(ctx: FieldContext, key: string, reader: Reader<T>, fallback: T): T {
  if (ctx.data[key] === undefined) return fallback;
  return need(ctx, key, reader, fallback);
}

/** Warns about keys the format doesn't define (they are kept, not removed). */
/** Values the index computes; storing them in a file would go stale, so it is an error. */
const DERIVED_KEYS = [
  "blocks",
  "blocked_by",
  "progress",
  "coverage",
  "stale",
  "modified_since_approval",
  "next_gate",
  "last_activity",
  "file_conflicts",
  "approval_changes",
];

export function unknownKeys(ctx: FieldContext, known: readonly string[]): void {
  for (const key of Object.keys(ctx.data)) {
    if (known.includes(key)) continue;
    if (DERIVED_KEYS.includes(key)) {
      ctx.problems.push({
        code: "E-DERIVED-FIELD",
        severity: "error",
        file: ctx.file,
        line: ctx.keyLines[key] ?? null,
        ref: ctx.ref,
        message: `${key} is computed by Azimuth; remove it from the file.`,
      });
      continue;
    }
    ctx.problems.push({
      code: "W-UNKNOWN-KEY",
      severity: "warning",
      file: ctx.file,
      line: ctx.keyLines[key] ?? null,
      ref: ctx.ref,
      message: `Unknown key "${key}".`,
    });
  }
}

/**
 * Marks every problem of an excluded entity so the reason it disappeared is visible. Their
 * `ref` is cleared: the entity is not in the index, so there is nothing to link to.
 */
export function finishSchema(ctx: FieldContext): Problem[] {
  if (!ctx.failed) return ctx.problems;
  const label = ctx.ref ?? ctx.file;
  return ctx.problems.map((p) =>
    p.code === "E-SCHEMA"
      ? {
          ...p,
          ref: null,
          message: `${p.message.replace(/\.$/, "")}. ${label} was left out of the index.`,
        }
      : { ...p, ref: null },
  );
}
