import type { VerifyProgress } from "../core/verify";
import { color } from "./io";

export type ReportMode = "full" | "summary";

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** A command's output, each line indented and dimmed; nothing when it printed nothing. */
function tailLines(tail: string): string[] {
  return tail ? tail.split("\n").map((line) => color.dim(`    ${line}`)) : [];
}

function outcome(ok: boolean, exitCode: number): string {
  return ok ? color.green("passed") : color.red(`failed (exit ${exitCode})`);
}

/** The lines `azimuth verify` prints for one progress event (coloured only on a TTY). */
export function reportLines(event: VerifyProgress, mode: ReportMode): string[] {
  const full = mode === "full";
  switch (event.kind) {
    case "waited":
      // Rounded up, so any wait shows as at least 1s.
      return event.waited_ms > 0
        ? [`waited ${Math.ceil(event.waited_ms / 1000)}s for another verify`]
        : [];
    case "prebuild":
      return full ? [color.dim(`prebuild: ${event.command}`)] : [];
    case "prebuilt": {
      const { ok, exit_code, duration_ms, output_tail } = event.result;
      const line = `prebuild ${outcome(ok, exit_code)} in ${seconds(duration_ms)}`;
      return ok ? [line] : [line, ...tailLines(output_tail)];
    }
    case "target":
      return full ? [color.dim(`${event.target.task}: ${event.target.command}`)] : [];
    case "run": {
      const { id, target, ok, exit_code, duration_ms, output_tail, prebuild } = event.run;
      // Only verify.prebuild_failure: continue lets a run follow a failed prebuild.
      const after = prebuild?.ok === false ? " after a failed prebuild" : "";
      const line = `${id} ${target} ${outcome(ok, exit_code)} in ${seconds(duration_ms)}${after}`;
      return ok ? [line] : [line, ...tailLines(output_tail)];
    }
  }
}
