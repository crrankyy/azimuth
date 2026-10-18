import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  PRIORITIES,
  type Feature,
  type FeatureStatus,
  type Milestone,
} from "../../../../src/core/types";
import { useCanAct } from "../../components/AppShell";
import { IdChip } from "../../components/IdChip";
import { PriorityTag, ProgressBar } from "../../components/primitives";
import { FeatureStatusPill, StatusGlyph, StatusPill } from "../../components/Status";
import { useAction, useUi } from "../../components/Ui";
import { useIndexState } from "../../data/IndexProvider";
import { useListKeys } from "../../lib/keys";
import { href, navigate } from "../../lib/router";
import { FEATURE_LOOK, MILESTONE_LOOK } from "../../lib/status";
import {
  activityLabel,
  milestoneMeta,
  NO_MILESTONE,
  orderedMilestones,
  type FlagKey,
} from "./model";
import { CoverageMini, FlagList } from "./parts";

export type GroupBy = "milestone" | "status" | "none";
type EditField = "priority" | "milestone";

type Group =
  | { kind: "milestone"; key: string; milestone: Milestone | null; rows: Feature[] }
  | { kind: "status"; key: string; status: FeatureStatus; rows: Feature[] }
  | { kind: "all"; key: string; rows: Feature[] };

/** Status groups lead with the work in flight. */
const STATUS_GROUPS: FeatureStatus[] = [
  "in-progress",
  "verifying",
  "approved",
  "draft",
  "idea",
  "done",
  "deferred",
  "cancelled",
  "superseded",
];

// Widths are CSS variables so features.css can tighten them below 1440px.
const COLUMNS = [
  "var(--ft-id)",
  "minmax(var(--ft-title), 1fr)",
  "var(--ft-status)",
  "var(--ft-pri)",
  "var(--ft-size)",
];
const TAIL = ["var(--ft-progress)", "var(--ft-coverage)", "var(--ft-flags)", "var(--ft-last)"];
const HEADERS = ["ID", "Title", "Status", "Pri", "Size"];
const TAIL_HEADERS = ["Progress", "Coverage", "Flags", "Last activity"];

function groupRows(rows: Feature[], groupBy: GroupBy, milestones: Milestone[]): Group[] {
  if (groupBy === "none") return [{ kind: "all", key: "all", rows }];
  if (groupBy === "status") {
    return STATUS_GROUPS.map((status): Group => ({
      kind: "status",
      key: status,
      status,
      rows: rows.filter((f) => f.status === status),
    })).filter((g) => g.rows.length > 0);
  }
  const ordered = orderedMilestones(milestones);
  const known = new Set(ordered.map((m) => m.id));
  const groups: Group[] = ordered.map((m) => ({
    kind: "milestone",
    key: m.id,
    milestone: m,
    rows: rows.filter((f) => f.milestone === m.id),
  }));
  groups.push({
    kind: "milestone",
    key: NO_MILESTONE,
    milestone: null,
    rows: rows.filter((f) => !f.milestone || !known.has(f.milestone)),
  });
  return groups.filter((g) => g.rows.length > 0);
}

const isTyping = (el: HTMLElement | null) =>
  Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));

/** `p` and `m` on the selected row; `g p` stays the global problems shortcut. */
function useEditKeys(onKey: (field: EditField) => void): void {
  const latest = useRef(onKey);
  useEffect(() => {
    latest.current = onKey;
  });
  useEffect(() => {
    let lastG = -Infinity;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target as HTMLElement | null)) return;
      if (e.key === "g") {
        lastG = e.timeStamp;
        return;
      }
      if (e.timeStamp - lastG < 1_200) return;
      if (e.key !== "p" && e.key !== "m") return;
      e.preventDefault();
      latest.current(e.key === "p" ? "priority" : "milestone");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

export function FeatureTable({
  rows,
  groupBy,
  flagsById,
}: {
  rows: Feature[];
  groupBy: GroupBy;
  flagsById: Map<string, FlagKey[]>;
}) {
  const { index, now, changed } = useIndexState();
  const { canAct, reason } = useCanAct();
  const { toast } = useUi();
  const run = useAction();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; field: EditField } | null>(null);
  const rowEls = useRef(new Map<string, HTMLDivElement>());

  const milestones = index?.milestones ?? [];
  const groups = groupRows(rows, groupBy, milestones);
  const ids = groups.flatMap((g) => g.rows.map((f) => f.id));
  const found = selectedId ? ids.indexOf(selectedId) : -1;
  const selected = found >= 0 ? found : 0;
  const showMilestone = groupBy !== "milestone";
  const columns = [...COLUMNS, ...(showMilestone ? ["var(--ft-ms)"] : []), ...TAIL].join(" ");
  const headers = [...HEADERS, ...(showMilestone ? ["Milestone"] : []), ...TAIL_HEADERS];

  const select = (i: number) => {
    const id = ids[i];
    if (!id) return;
    setSelectedId(id);
    rowEls.current.get(id)?.scrollIntoView({ block: "nearest" });
  };
  const startEdit = (id: string, field: EditField) => {
    if (!canAct) {
      toast({ title: reason ?? "Actions are unavailable.", tone: "danger" });
      return;
    }
    setSelectedId(id);
    setEditing({ id, field });
  };
  const save = async (f: Feature, field: EditField, value: string) => {
    setEditing(null);
    const current = field === "priority" ? f.priority : (f.milestone ?? NO_MILESTONE);
    if (value === current) return;
    await run("set", f.id, { field, value: value === NO_MILESTONE ? null : value });
  };

  useListKeys({
    count: ids.length,
    selected,
    onSelect: select,
    onOpen: (i) => ids[i] && navigate(href("features", ids[i])),
    enabled: editing === null,
  });
  useEditKeys((field) => {
    const id = ids[selected];
    if (id && editing === null) startEdit(id, field);
  });

  const milestoneOptions = [
    ...orderedMilestones(milestones).map((m) => ({ value: m.id, label: `${m.id} ${m.title}` })),
    { value: NO_MILESTONE, label: "No milestone" },
  ];

  return (
    <div role="table" aria-label="Features" className="ft-table">
      <div role="row" className="ft-row ft-head" style={{ gridTemplateColumns: columns }}>
        {headers.map((h) => (
          <span key={h} role="columnheader" className={h === "Last activity" ? "ft-right" : ""}>
            {h}
          </span>
        ))}
      </div>
      {groups.map((g) => (
        <div role="rowgroup" key={g.key}>
          {g.kind !== "all" && <GroupHead group={g} now={now} />}
          {g.rows.map((f) => {
            const field = editing?.id === f.id ? editing.field : null;
            const edit: RowEdit = {
              field,
              canAct,
              start: (which) => startEdit(f.id, which),
              save: (which, value) => void save(f, which, value),
              cancel: () => setEditing(null),
              milestoneOptions,
            };
            return (
              <FeatureRow
                key={f.id}
                f={f}
                flags={flagsById.get(f.id) ?? []}
                columns={columns}
                selected={ids[selected] === f.id}
                changed={changed.has(f.id)}
                showMilestone={showMilestone}
                now={now}
                edit={edit}
                rowRef={(el) => {
                  if (el) rowEls.current.set(f.id, el);
                  else rowEls.current.delete(f.id);
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function GroupHead({ group, now }: { group: Exclude<Group, { kind: "all" }>; now: number }) {
  if (group.kind === "status") {
    return (
      <div role="row" className="ft-group">
        <span role="cell" aria-colspan={10} className="ft-group-cell">
          <StatusGlyph glyph={FEATURE_LOOK[group.status].glyph} />
          <span className="ft-group-title">{FEATURE_LOOK[group.status].label}</span>
          <span className="ft-group-meta">{group.rows.length}</span>
        </span>
      </div>
    );
  }
  const m = group.milestone;
  return (
    <div role="row" className="ft-group">
      <span role="cell" aria-colspan={10} className="ft-group-cell">
        {m ? (
          <>
            <IdChip id={m.id} />
            <span className="ft-group-title">{m.title}</span>
            <span className="ft-group-pill">
              <StatusPill look={MILESTONE_LOOK[m.status]} />
            </span>
            <span className="ft-group-meta">{milestoneMeta(m, now)}</span>
          </>
        ) : (
          <>
            <span className="ft-group-title">No milestone</span>
            <span className="ft-group-meta">{group.rows.length}</span>
          </>
        )}
      </span>
    </div>
  );
}

interface RowEdit {
  field: EditField | null;
  canAct: boolean;
  start: (field: EditField) => void;
  save: (field: EditField, value: string) => void;
  cancel: () => void;
  milestoneOptions: { value: string; label: string }[];
}

const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: p }));

function openUnlessControl(e: MouseEvent<HTMLDivElement>, id: string) {
  if ((e.target as HTMLElement).closest("a, button, select, input, label")) return;
  navigate(href("features", id));
}

function FeatureRow({
  f,
  flags,
  columns,
  selected,
  changed,
  showMilestone,
  now,
  edit,
  rowRef,
}: {
  f: Feature;
  flags: FlagKey[];
  columns: string;
  selected: boolean;
  changed: boolean;
  showMilestone: boolean;
  now: number;
  edit: RowEdit;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  const { done, total } = f.derived.progress;
  const c = f.derived.coverage;
  const milestoneSelect = edit.field === "milestone" && (
    <InlineSelect
      label={`Milestone for ${f.id}`}
      value={f.milestone ?? NO_MILESTONE}
      options={edit.milestoneOptions}
      onSave={(v) => edit.save("milestone", v)}
      onCancel={edit.cancel}
    />
  );
  const className = ["ft-row", selected ? "sel az-focus" : "", changed ? "az-flash" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      role="row"
      ref={rowRef}
      className={className}
      style={{ gridTemplateColumns: columns }}
      aria-selected={selected}
      onClick={(e) => openUnlessControl(e, f.id)}
    >
      <span role="cell" className="ft-cell">
        <IdChip id={f.id} />
      </span>
      <span role="cell" className="ft-cell ft-title">
        {/* The title is cut with an ellipsis in narrow windows; the tooltip shows all of it. */}
        <a className="ft-title-link" href={href("features", f.id)} title={f.title}>
          {f.title}
        </a>
        {changed && <span className="ft-updated">updated</span>}
        {!showMilestone && milestoneSelect}
      </span>
      <span role="cell" className="ft-cell">
        <FeatureStatusPill status={f.status} />
      </span>
      <span role="cell" className="ft-cell">
        {edit.field === "priority" ? (
          <InlineSelect
            label={`Priority for ${f.id}`}
            value={f.priority}
            options={PRIORITY_OPTIONS}
            onSave={(v) => edit.save("priority", v)}
            onCancel={edit.cancel}
          />
        ) : (
          <EditButton
            label="Set priority (p)"
            canAct={edit.canAct}
            onClick={() => edit.start("priority")}
          >
            <PriorityTag priority={f.priority} />
          </EditButton>
        )}
      </span>
      <span role="cell" className="ft-cell az-mono ft-size">
        {f.size ?? "—"}
      </span>
      {showMilestone && (
        <span role="cell" className="ft-cell">
          {milestoneSelect || (
            <EditButton
              label="Set milestone (m)"
              canAct={edit.canAct}
              onClick={() => edit.start("milestone")}
            >
              <span className="az-mono ft-ms">{f.milestone ?? "—"}</span>
            </EditButton>
          )}
        </span>
      )}
      <span role="cell" className="ft-cell ft-pair">
        <ProgressBar done={done} total={total} width={52} />
        <span>{total ? `${done} / ${total}` : "—"}</span>
      </span>
      <span role="cell" className="ft-cell ft-pair">
        <CoverageMini coverage={c} width={72} />
        <span>{c.total ? `${c.passing} / ${c.total}` : "—"}</span>
      </span>
      <span role="cell" className="ft-cell">
        <FlagList feature={f} flags={flags} />
      </span>
      <span role="cell" className="ft-cell ft-right ft-last">
        {activityLabel(f.derived.last_activity, now)}
      </span>
    </div>
  );
}

/** In live mode a cell value opens its inline select; in a snapshot it is plain text. */
function EditButton({
  label,
  canAct,
  onClick,
  children,
}: {
  label: string;
  canAct: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  if (!canAct) return <>{children}</>;
  return (
    <button type="button" className="ft-cell-btn" title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function InlineSelect({
  label,
  value,
  options,
  onSave,
  onCancel,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  return (
    <select
      className="az-select ft-inline"
      aria-label={label}
      autoFocus
      defaultValue={value}
      onChange={(e) => onSave(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        onCancel();
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
