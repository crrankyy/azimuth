import type { VerifyRun } from "../../../src/core/types";
import { ago, clock, duration } from "../lib/format";
import { CopyButton, OutputTail } from "./CodeBlock";
import { IdChip } from "./IdChip";
import { StatusGlyph } from "./Status";
import "./runresult.css";

/** The feature a run belongs to: `T-005.4` → `F-005`; feature targets stay as they are. */
export function runFeature(target: string): string {
  const task = /^T-(\d{3})\./.exec(target);
  return task ? `F-${task[1]}` : target;
}

/** "12 tests · 1 failed · 2 skipped", or null when the run has no JUnit report. */
export function junitSummary(junit: VerifyRun["junit"]): string | null {
  if (!junit) return null;
  const parts = [
    `${junit.tests} ${junit.tests === 1 ? "test" : "tests"}`,
    junit.failures ? `${junit.failures} failed` : null,
    junit.errors ? `${junit.errors} ${junit.errors === 1 ? "error" : "errors"}` : null,
    junit.skipped ? `${junit.skipped} skipped` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

function Tail({ text, wrap }: { text: string; wrap?: boolean }) {
  if (!text.trim()) return <div className="rr-empty">No output captured.</div>;
  return <OutputTail text={text} wrap={wrap} />;
}

/** The bordered result card: header facts over the output tail (Plan tab "Last run"). */
function RunCard({ run, now }: { run: VerifyRun; now: number }) {
  const junit = junitSummary(run.junit);
  return (
    <div className={`rr-card ${run.ok ? "ok" : "fail"}`}>
      <div className="rr-head">
        <StatusGlyph glyph={run.ok ? "s-done" : "s-failing"} />
        <span className="rr-verdict">{run.ok ? "Passed" : "Failed"}</span>
        <IdChip id={run.id} />
        <span className="rr-facts">
          exit {run.exit_code} · {duration(run.duration_ms)}
          {junit && ` · ${junit}`}
        </span>
        {run.commit && <span className="rr-sha">{run.commit}</span>}
        <span className="spacer" />
        <span className="rr-when">
          {clock(run.at)} · {ago(run.at, now)}
        </span>
      </div>
      <Tail text={run.output_tail} />
    </div>
  );
}

/** The expanded row in the Verification runs list: facts, command, output and copy actions. */
function RunDrawer({ run }: { run: VerifyRun }) {
  const junit = junitSummary(run.junit);
  const feature = runFeature(run.target);
  return (
    <div className="rr-drawer">
      <div className="rr-meta">
        <span>exit {run.exit_code}</span>
        {run.commit && (
          <span>
            commit <span className="rr-strong mono">{run.commit}</span>
          </span>
        )}
        <span>{clock(run.at)}</span>
        {run.scenarios.length > 0 && (
          <span>
            covers{" "}
            <span className="rr-strong mono">{run.scenarios.map((s) => s.id).join(", ")}</span>
          </span>
        )}
        {junit && <span>{junit}</span>}
      </div>
      <div className="rr-command mono">$ {run.command}</div>
      <Tail text={run.output_tail} wrap />
      <div className="rr-actions">
        {run.output_tail.trim() && <CopyButton text={run.output_tail} label="Copy output" />}
        <CopyButton text={`azimuth verify ${feature}`} label={`Copy azimuth verify ${feature}`} />
      </div>
    </div>
  );
}

/** A verify run's outcome with its output tail, as a card or as a runs-list drawer. */
export function RunResult({
  run,
  now,
  variant = "card",
}: {
  run: VerifyRun;
  /** The provider's clock, for the run's age. */
  now: number;
  variant?: "card" | "drawer";
}) {
  return variant === "drawer" ? <RunDrawer run={run} /> : <RunCard run={run} now={now} />;
}
