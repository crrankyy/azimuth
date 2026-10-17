import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Coverage, CoverageStatus, Priority } from "../../../src/core/types";
import { COVERAGE_LOOK } from "../lib/status";

export function Button({
  variant = "secondary",
  small = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "tertiary";
  small?: boolean;
}) {
  return (
    <button
      type="button"
      className={`lc-btn lc-btn-${variant} ${small ? "sm" : ""} ${className}`.trim()}
      {...props}
    />
  );
}

export function PriorityTag({ priority }: { priority: Priority }) {
  return <span className={`az-prio ${priority === "P0" ? "p0" : ""}`.trim()}>{priority}</span>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="az-tag">{children}</span>;
}

export function KindTag({ kind }: { kind: string }) {
  return <span className="az-kind">{kind}</span>;
}

export function FlagBadge({
  tone = "warning",
  children,
}: {
  tone?: "warning" | "danger" | "info";
  children: ReactNode;
}) {
  return <span className={`az-flag ${tone === "warning" ? "" : tone}`.trim()}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="az-kbd">{children}</span>;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`az-eyebrow ${className}`.trim()}>{children}</div>;
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Tag className={`az-card ${className}`.trim()}>{children}</Tag>;
}

export function ProgressBar({
  done,
  total,
  width = 96,
}: {
  done: number;
  total: number;
  width?: number;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <span
      className="az-prog"
      style={{ width }}
      role="progressbar"
      aria-valuenow={done}
      aria-valuemax={total}
      aria-label={`${done} of ${total}`}
    >
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/** One segment per item (scenarios, features), colored and shaped by status. */
export function SegmentBar({
  segments,
  width,
  height,
}: {
  segments: string[];
  width?: number;
  height?: number;
}) {
  return (
    <span className="az-cov" style={{ width, height }} aria-hidden="true">
      {segments.map((cls, i) => (
        <span key={i} className={cls} />
      ))}
    </span>
  );
}

/** Coverage as one segment per scenario: passing, failing, not run, untested. */
export function CoverageBar({ coverage, width = 136 }: { coverage: Coverage; width?: number }) {
  const order: [CoverageStatus, number][] = [
    ["passing", coverage.passing],
    ["failing", coverage.failing],
    ["not-run", coverage.not_run],
    ["untested", coverage.untested],
  ];
  const segments = order.flatMap(([status, n]) =>
    Array<string>(n).fill(COVERAGE_LOOK[status].segment),
  );
  return <SegmentBar segments={segments} width={width} />;
}

export function coverageSummary(c: Coverage): string {
  const parts = [
    c.passing ? `${c.passing} passing` : null,
    c.failing ? `${c.failing} failing` : null,
    c.not_run ? `${c.not_run} not run` : null,
    c.untested ? `${c.untested} untested` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "no scenarios";
}

export interface TabItem {
  id: string;
  label: string;
  count?: ReactNode;
  disabled?: boolean;
  title?: string;
  icon?: ReactNode;
}

export function Tabs({
  items,
  selected,
  onSelect,
  trailing,
}: {
  items: TabItem[];
  selected: string;
  onSelect: (id: string) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="az-tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          className="az-tab"
          aria-selected={t.id === selected}
          disabled={t.disabled}
          title={t.title}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
          {t.count !== undefined && <span className="n">{t.count}</span>}
          {t.icon}
        </button>
      ))}
      {trailing && <span className="tabs-trailing">{trailing}</span>}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="az-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="n">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function FilterChip({
  on,
  children,
  onClick,
}: {
  on: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`az-chip ${on ? "on" : ""}`.trim()}
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  children,
  icon,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children && <div>{children}</div>}
    </div>
  );
}
