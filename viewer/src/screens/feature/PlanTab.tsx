import { Fragment, useState } from "react";
import type { Feature, ImpactChange, Index, Task } from "../../../../src/core/types";
import { CopyButton } from "../../components/CodeBlock";
import { IdChip } from "../../components/IdChip";
import { Eyebrow, EmptyState } from "../../components/primitives";
import { RunResult } from "../../components/RunResult";
import { StatusGlyph, StatusPill } from "../../components/Status";
import { TaskDag } from "../../components/TaskDag";
import { useIndexState } from "../../data/IndexProvider";
import { runById, scenarioById } from "../../data/selectors";
import { ago } from "../../lib/format";
import { useListKeys } from "../../lib/keys";
import { inline } from "../../lib/markdown";
import { href, routeForId } from "../../lib/router";
import { COVERAGE_LOOK, TASK_LOOK } from "../../lib/status";
import "./plan.css";

/** With no task in the URL, open the one being worked on, else the next open one. */
function defaultTask(tasks: Task[]): Task | undefined {
  return (
    tasks.find((t) => t.status === "in-progress") ??
    tasks.find((t) => t.status !== "done" && t.status !== "skipped") ??
    tasks[0]
  );
}

/** A task deep link: feature detail reads the fourth segment (`#/features/F-005/plan/T-005.4`). */
function taskHash(featureId: string, taskId: string): string {
  return `${href("features", featureId, "plan")}/${encodeURIComponent(taskId)}`;
}

function noteLead(task: Task): string | null {
  if (task.status === "blocked") return "Blocked:";
  if (task.status === "skipped") return "Skipped:";
  return null;
}

function TaskRow({
  task,
  selected,
  onSelect,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const lead = noteLead(task);
  return (
    <li className={`pl-row ${selected ? "sel az-focus" : ""}`.trim()}>
      <button
        type="button"
        className="pl-row-btn"
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(task.id)}
      >
        <StatusGlyph glyph={TASK_LOOK[task.status].glyph} label={TASK_LOOK[task.status].label} />
        <span className="pl-row-id">{task.id}</span>
        <span className="pl-row-title" title={task.title}>
          {task.title}
        </span>
      </button>
      {lead && task.note && (
        <div className="pl-row-note">
          {lead} {inline(task.note)}
        </div>
      )}
    </li>
  );
}

function Covers({ index, task }: { index: Index; task: Task }) {
  if (task.covers.length === 0) return <div className="pl-none">Covers no scenarios.</div>;
  return (
    <div className="pl-covers">
      {task.covers.map((id) => {
        const scenario = scenarioById(index, id)?.scenario;
        const status = scenario?.coverage.status;
        const look = status ? COVERAGE_LOOK[status] : null;
        return (
          <a
            key={id}
            className={`pl-cover ${status ?? "unknown"}`}
            href={routeForId(id)}
            title={scenario?.title}
          >
            {look && <StatusGlyph glyph={look.glyph} />}
            <span className="mono pl-cover-id">{id}</span>
            {look?.label ?? "not in this index"}
          </a>
        );
      })}
    </div>
  );
}

function Files({ files, impact }: { files: string[]; impact: Map<string, ImpactChange> }) {
  if (files.length === 0) return <div className="pl-none">No files listed.</div>;
  return (
    <ul className="pl-files mono">
      {files.map((path) => (
        <li key={path}>
          <span className="pl-change">{impact.get(path) ?? ""}</span>
          {path}
        </li>
      ))}
    </ul>
  );
}

function LastRun({ index, task, now }: { index: Index; task: Task; now: number }) {
  if (!task.last_run) return <div className="pl-none">Not run yet.</div>;
  const run = runById(index, task.last_run.run);
  if (run) return <RunResult run={run} now={now} />;
  return (
    <div className="pl-none row">
      <IdChip id={task.last_run.run} />
      {task.last_run.ok ? "passed" : "failed"} {ago(task.last_run.at, now)}. Its output isn't in
      this index.
    </div>
  );
}

function TaskDetail({
  feature,
  task,
  onSelect,
}: {
  feature: Feature;
  task: Task;
  onSelect: (id: string) => void;
}) {
  const { index, now } = useIndexState();
  if (!index) return null;
  const impact = new Map((feature.detail?.impact ?? []).map((e) => [e.path, e.change]));
  return (
    <section className="pl-detail" aria-label={`${task.id} detail`}>
      <div className="pl-detail-head">
        <div className="row">
          <IdChip id={task.id} />
          <StatusPill look={TASK_LOOK[task.status]} />
          {task.after.length > 0 && (
            <span className="pl-after">
              after{" "}
              {task.after.map((id, i) => (
                <Fragment key={id}>
                  {i > 0 && ", "}
                  <button type="button" className="pl-after-id" onClick={() => onSelect(id)}>
                    {id}
                  </button>
                </Fragment>
              ))}
            </span>
          )}
        </div>
        <h3 className="pl-title">{task.title}</h3>
      </div>
      <div className="pl-block">
        <Eyebrow>Covers</Eyebrow>
        <Covers index={index} task={task} />
      </div>
      <div className="pl-block">
        <Eyebrow>Files</Eyebrow>
        <Files files={task.files} impact={impact} />
      </div>
      <div className="pl-block">
        <Eyebrow>Verify</Eyebrow>
        {task.verify ? (
          <div className="pl-verify">
            <span className="mono pl-prompt" aria-hidden="true">
              $
            </span>
            <code className="mono pl-cmd">{task.verify}</code>
            <CopyButton text={task.verify} />
          </div>
        ) : (
          <div className="pl-none">No verify command.</div>
        )}
      </div>
      <div className="pl-block">
        <Eyebrow>Last run</Eyebrow>
        <LastRun index={index} task={task} now={now} />
      </div>
      <div className={`pl-note ${task.note ? "has" : ""}`.trim()}>
        {task.note ? inline(task.note) : "No note on this task."}
      </div>
    </section>
  );
}

/** The Plan tab of feature detail: TaskDag, TaskRow list and the selected task's RunResult. */
export function PlanTab({ feature, taskId }: { feature: Feature; taskId: string | null }) {
  const tasks = feature.detail?.tasks ?? [];
  const [picked, setPicked] = useState<string | null>(taskId);
  const [fromProp, setFromProp] = useState(taskId);
  if (taskId !== fromProp) {
    setFromProp(taskId);
    setPicked(taskId);
  }
  const current = tasks.find((t) => t.id === picked) ?? defaultTask(tasks);
  const select = (id: string) => {
    setPicked(id);
    // Replace rather than navigate: a hashchange makes the router scroll the page to the top.
    window.history.replaceState(null, "", taskHash(feature.id, id));
  };
  useListKeys({
    count: tasks.length,
    selected: current ? tasks.indexOf(current) : 0,
    onSelect: (i) => {
      const task = tasks[i];
      if (task) select(task.id);
    },
  });

  if (!feature.detail) {
    return <EmptyState title="The plan isn't in this index" />;
  }
  if (!current) {
    return (
      <EmptyState title="No tasks yet">
        Run <code className="az-c">/azimuth:spec {feature.id}</code> in Claude Code to write the
        plan.
      </EmptyState>
    );
  }
  return (
    <div className="pl">
      <TaskDag tasks={tasks} selected={current.id} onSelect={select} />
      <div className="pl-split">
        <ul className="pl-list" aria-label="Tasks">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} selected={t.id === current.id} onSelect={select} />
          ))}
        </ul>
        <TaskDetail feature={feature} task={current} onSelect={select} />
      </div>
    </div>
  );
}
