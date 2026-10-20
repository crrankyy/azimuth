import { ID_PATTERNS, isId } from "../ids";
import type { CoverageStatus, Problem, VerifyRun } from "../types";
import { problem } from "./common";

const STATUSES: CoverageStatus[] = ["passing", "failing", "not-run", "untested"];

export function parseRun(
  text: string,
  file: string,
): { run: VerifyRun | null; problems: Problem[] } {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      run: null,
      problems: [problem("W-RUN-INVALID", file, null, "Verify run file is not valid JSON.")],
    };
  }
  const id = typeof data.id === "string" && ID_PATTERNS.run.test(data.id) ? data.id : null;
  if (!id || typeof data.target !== "string" || typeof data.at !== "string") {
    return {
      run: null,
      problems: [
        problem("W-RUN-INVALID", file, null, "Verify run file is missing id, target or at."),
      ],
    };
  }
  const scenarios = Array.isArray(data.scenarios)
    ? (data.scenarios as Record<string, unknown>[])
        .filter((s) => typeof s?.id === "string" && STATUSES.includes(s.status as CoverageStatus))
        .map((s) => ({ id: s.id as string, status: s.status as CoverageStatus }))
    : [];
  const junit = data.junit as VerifyRun["junit"] | undefined;
  return {
    run: {
      id,
      target: data.target,
      command: typeof data.command === "string" ? data.command : "",
      ok: data.ok === true,
      exit_code: typeof data.exit_code === "number" ? data.exit_code : data.ok === true ? 0 : 1,
      duration_ms: typeof data.duration_ms === "number" ? data.duration_ms : 0,
      at: data.at,
      commit: typeof data.commit === "string" ? data.commit : null,
      output_tail: typeof data.output_tail === "string" ? data.output_tail : "",
      scenarios,
      junit: junit && typeof junit === "object" ? junit : null,
      // Runs written before these fields existed (or with invalid values) leave them out.
      ...(typeof data.waited_ms === "number" && data.waited_ms >= 0
        ? { waited_ms: data.waited_ms }
        : {}),
      ...(data.ses === null || isId(data.ses, "session") ? { ses: data.ses } : {}),
      prebuild: null,
    },
    problems: [],
  };
}
