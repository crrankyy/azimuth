import {
  IMPACT_CHANGES,
  type Feature,
  type ImpactChange,
  type ImpactEntry,
} from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { Icon } from "../../components/Icon";
import { EmptyState } from "../../components/primitives";
import { countBy } from "./featureData";

function dirOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut < 0 ? "./" : path.slice(0, cut + 1);
}

function groupByDir(entries: ImpactEntry[]): [string, ImpactEntry[]][] {
  const groups = new Map<string, ImpactEntry[]>();
  for (const e of entries) groups.set(dirOf(e.path), [...(groups.get(dirOf(e.path)) ?? []), e]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function ChangeBadge({ change }: { change: ImpactChange }) {
  return <span className={`fd-change ${change}`}>{change}</span>;
}

function ImpactRow({ entry, conflicts }: { entry: ImpactEntry; conflicts: string[] }) {
  const name = entry.path.slice(dirOf(entry.path).length);
  const planned = !entry.exists;
  return (
    <li className={`fd-impact-row ${planned ? "planned" : ""}`.trim()}>
      <ChangeBadge change={entry.change} />
      <div className="fd-impact-main">
        <div className="row fd-impact-name-row">
          <span className="az-mono fd-impact-name" title={entry.path}>
            {name}
          </span>
          {planned && <span className="fd-impact-planned">not created yet</span>}
          {conflicts.map((other) => (
            <span key={other} className="az-flag fd-impact-conflict">
              <Icon name="issues" size={12} />
              <span>
                Also changed by <IdChip id={other} className="fd-flag-id" />
              </span>
            </span>
          ))}
        </div>
        {entry.note && <div className="fd-impact-note">{entry.note}</div>}
        {entry.symbols.length > 0 && (
          <div className="fd-impact-symbols">
            {entry.symbols.map((s) => (
              <code key={s} className="az-c">
                {s}
              </code>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/** Files the feature touches, grouped by directory and badged create/modify/read/test. */
export function ImpactTree({ f }: { f: Feature }) {
  const impact = f.detail?.impact ?? [];
  if (impact.length === 0) {
    return <EmptyState title="No impact listed">{f.id}'s impact.md lists no files.</EmptyState>;
  }
  const counts = countBy(impact, (e) => e.change);
  const missing = impact.filter((e) => !e.exists).length;
  const conflictsFor = (path: string) =>
    f.derived.file_conflicts.filter((c) => c.path === path).map((c) => c.with);
  return (
    <div className="fd-impact">
      <div className="fd-impact-sum">
        <span>{impact.length} files</span>
        {IMPACT_CHANGES.filter((c) => counts[c]).map((c) => (
          <span key={c} className="row fd-impact-count">
            <ChangeBadge change={c} />
            {counts[c]}
          </span>
        ))}
        {missing > 0 && <span className="fd-impact-missing">{missing} not created yet</span>}
      </div>
      {groupByDir(impact).map(([dir, entries]) => (
        <section key={dir} className="fd-impact-dir" aria-label={dir}>
          <div className="row fd-impact-dir-head">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" />
            </svg>
            <span className="az-mono">{dir}</span>
            <span className="fd-impact-dir-n">{entries.length}</span>
          </div>
          <ul className="fd-impact-list">
            {entries.map((e) => (
              <ImpactRow key={e.path} entry={e} conflicts={conflictsFor(e.path)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
