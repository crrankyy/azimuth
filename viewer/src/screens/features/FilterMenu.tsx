import { useEffect, useRef, useState, type ReactNode } from "react";
import { FilterChip } from "../../components/primitives";

export interface FacetOption {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

const toggle = (values: string[], v: string) =>
  values.includes(v) ? values.filter((x) => x !== v) : [...values, v];

/** "+ Status" until something is picked, then "Status: a, b ×" with a menu of checkboxes. */
export function FilterMenu({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const known = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  const names = [...known, ...selected.filter((v) => !options.some((o) => o.value === v))];
  const summary = names.length > 3 ? `${names.length} selected` : names.join(", ");
  return (
    <span className="ft-filter" ref={box}>
      {selected.length > 0 ? (
        <span className="az-chip on ft-chip-on">
          <button
            type="button"
            className="ft-chip-part"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {label}: {summary}
          </button>
          <button
            type="button"
            className="ft-chip-part ft-chip-clear"
            aria-label={`Clear ${label.toLowerCase()} filter`}
            onClick={() => onChange([])}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </span>
      ) : (
        <FilterChip on={false} onClick={() => setOpen(!open)}>
          + {label}
        </FilterChip>
      )}
      {open && (
        <div className="ft-menu" role="group" aria-label={`Filter by ${label.toLowerCase()}`}>
          {options.length === 0 && <div className="ft-menu-empty">Nothing to filter by</div>}
          {options.map((o) => (
            <label key={o.value} className="ft-menu-item">
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => onChange(toggle(selected, o.value))}
              />
              {o.icon}
              <span className="spacer">{o.label}</span>
              {o.count !== undefined && <span className="ft-n">{o.count}</span>}
            </label>
          ))}
        </div>
      )}
    </span>
  );
}
