import { idKind } from "./ids";
import { nextForFeature, nextWork } from "./next";
import type { Feature, Index } from "./types";

/** Compact, line-oriented summaries for agents (and hook context): cheap to read, no files. */

function featureLine(f: Feature): string {
  const p = f.derived.progress;
  const c = f.derived.coverage;
  const flags = [
    f.derived.blocked_by.length
      ? `blocked by ${f.derived.blocked_by.map((b) => b.id).join(", ")}`
      : null,
    f.derived.modified_since_approval ? "spec changed since approval" : null,
    f.derived.stale ? "stale" : null,
  ].filter(Boolean);
  return `${f.id} ${f.status} ${f.priority} ${f.title} — tasks ${p.done}/${p.total}, scenarios ${c.passing}/${c.total} passing${flags.length ? ` [${flags.join("; ")}]` : ""}`;
}

export function statusBrief(index: Index, viewerUrl: string | null = null): string {
  const p = index.project;
  const lines: string[] = [];
  const git = p.git.head
    ? ` · ${p.git.branch ?? "detached"}@${p.git.head}${p.git.dirty ? " (uncommitted changes)" : ""}`
    : "";
  lines.push(`${p.name} · ${p.mode}${git}`);
  lines.push(
    `Autonomy: specs ${p.autonomy.approve_specs}, decisions ${p.autonomy.accept_adrs}${viewerUrl ? ` · Viewer: ${viewerUrl}` : ""}`,
  );
  const needs = index.inbox.filter((i) => i.urgency !== "low");
  if (needs.length) {
    lines.push("", `Needs the user (${needs.length}):`);
    for (const i of needs.slice(0, 6))
      lines.push(
        `  ${i.urgency === "high" ? "!" : "-"} ${i.ref ?? ""} ${i.title} — ${i.detail}`.replace(
          "   ",
          " ",
        ),
      );
  }
  const flight = index.features.filter((f) =>
    ["in-progress", "verifying", "approved"].includes(f.status),
  );
  if (flight.length) {
    lines.push("", "In flight:");
    for (const f of flight) lines.push(`  ${featureLine(f)}`);
  }
  const next = nextWork(index).slice(0, 5);
  if (next.length) {
    lines.push("", "Next:");
    for (const n of next) lines.push(`  ${n.ref} ${n.action} — ${n.reason}`);
  }
  const errors = index.problems.filter((x) => x.severity === "error").length;
  const warnings = index.problems.length - errors;
  if (errors || warnings)
    lines.push("", `Problems: ${errors} errors, ${warnings} warnings (run \`azimuth check\`).`);
  return lines.join("\n");
}

function featureBrief(index: Index, f: Feature): string {
  const lines = [featureLine(f), `Folder: ${f.file}`];
  if (f.summary) lines.push(`Summary: ${f.summary}`);
  if (f.depends_on.length) lines.push(`Depends on: ${f.depends_on.join(", ")}`);
  if (f.derived.blocks.length) lines.push(`Blocks: ${f.derived.blocks.join(", ")}`);
  const gate = f.derived.next_gate;
  if (gate) {
    lines.push(`Next gate → ${gate.to}:`);
    for (const c of gate.checks)
      lines.push(`  ${c.ok ? "✓" : "✗"} ${c.rule}${c.detail && !c.ok ? ` — ${c.detail}` : ""}`);
  }
  const tasks = f.detail?.tasks ?? [];
  if (tasks.length) {
    lines.push("Tasks:");
    for (const t of tasks) {
      const run = t.last_run
        ? ` (last run ${t.last_run.ok ? "passed" : "failed"} ${t.last_run.run})`
        : "";
      lines.push(
        `  ${t.id} ${t.status} ${t.title}${t.after.length ? ` after ${t.after.join(", ")}` : ""}${run}${t.note ? ` — ${t.note}` : ""}`,
      );
    }
  }
  const questions = index.questions.filter((q) => q.feature === f.id && q.status === "open");
  for (const q of questions)
    lines.push(`Open question ${q.id}${q.blocking ? " (blocking)" : ""}: ${q.title}`);
  const answered = index.questions.filter(
    (q) => q.feature === f.id && q.status === "answered" && !q.resolution,
  );
  for (const q of answered) {
    const option = q.options.find((o) => o.key === q.answer?.option);
    lines.push(
      `Answered, not yet applied ${q.id}: ${option?.label ?? ""}${q.answer?.text ? ` — ${q.answer.text}` : ""}`,
    );
  }
  const log = f.detail?.log ?? [];
  const lastTransition = [...log].reverse().findIndex((e) => e.type === "transition");
  const reviews = log
    .slice(lastTransition === -1 ? 0 : log.length - lastTransition)
    .filter((e) => e.type === "review");
  for (const r of reviews) lines.push(`Change request from the user (${r.at}): ${r.body}`);
  const recent = log.filter((e) => e.type !== "review").slice(-3);
  if (recent.length) {
    lines.push("Recent log:");
    for (const e of recent) lines.push(`  ${e.at} ${e.actor} ${e.type}: ${e.body.split("\n")[0]}`);
  }
  const next = nextForFeature(index, f);
  if (next.length) lines.push(`Next: ${next.map((n) => `${n.action} (${n.reason})`).join("; ")}`);
  return lines.join("\n");
}

/** A short description of one entity, or null when the ID is unknown. */
export function showBrief(index: Index, id: string): string | null {
  switch (idKind(id)) {
    case "feature": {
      const f = index.features.find((x) => x.id === id);
      return f ? featureBrief(index, f) : null;
    }
    case "task": {
      const f = index.features.find((x) => x.detail?.tasks.some((t) => t.id === id));
      const t = f?.detail?.tasks.find((x) => x.id === id);
      if (!f || !t) return null;
      return [
        `${t.id} ${t.status} ${t.title} (in ${f.id} ${f.status})`,
        `Verify: ${t.verify || "(none)"}`,
        t.after.length ? `After: ${t.after.join(", ")}` : null,
        t.covers.length ? `Covers: ${t.covers.join(", ")}` : null,
        t.files.length ? `Files: ${t.files.join(", ")}` : null,
        t.note ? `Note: ${t.note}` : null,
        t.last_run
          ? `Last run: ${t.last_run.run} ${t.last_run.ok ? "passed" : "failed"} at ${t.last_run.at}`
          : "Never run",
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "question": {
      const q = index.questions.find((x) => x.id === id);
      if (!q) return null;
      return [
        `${q.id} ${q.status}${q.blocking ? " blocking" : ""}${q.feature ? ` for ${q.feature}` : ""}: ${q.title}`,
        q.context,
        ...q.options.map(
          (o) =>
            `  ${o.key}${o.recommended ? " (recommended)" : ""}: ${o.label}${o.detail ? ` — ${o.detail}` : ""}`,
        ),
        q.answer ? `Answer: ${q.answer.option ?? ""} ${q.answer.text}`.trim() : null,
        q.resolution ? `Applied as ${q.resolution.kind} ${q.resolution.ref}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "decision": {
      const d = index.decisions.find((x) => x.id === id);
      if (!d) return null;
      return [
        `${d.id} ${d.status}: ${d.title}`,
        `Decision: ${d.body.decision}`,
        d.links.length ? `Links: ${d.links.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "issue": {
      const i = index.issues.find((x) => x.id === id);
      if (!i) return null;
      return [
        `${i.id} ${i.type} ${i.status}${i.severity ? ` ${i.severity}` : ""}: ${i.title}`,
        i.body,
      ].join("\n");
    }
    case "session": {
      const s = index.sessions.find((x) => x.id === id);
      if (!s) return null;
      return [
        `${s.id} ${s.skill ?? ""} ${s.started_at}–${s.ended_at ?? "open"}: ${s.goal}`,
        `Handoff:\n${s.handoff || "(none)"}`,
      ].join("\n");
    }
    case "milestone": {
      const m = index.milestones.find((x) => x.id === id);
      if (!m) return null;
      return `${m.id} ${m.status} ${m.title}: ${m.progress.done}/${m.progress.total} done${m.target ? `, target ${m.target}` : ""}`;
    }
    default:
      return null;
  }
}
