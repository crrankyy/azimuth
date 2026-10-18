import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Index } from "../../../src/core/types";
import { useIndexState } from "../data/IndexProvider";
import { GOTO } from "../lib/keys";
import { FEATURE_LOOK } from "../lib/status";
import { href, navigate, routeForId, SECTIONS, type Section } from "../lib/router";
import { useCanAct } from "./AppShell";
import { copyText } from "./CodeBlock";
import { Icon } from "./Icon";
import { Kbd } from "./primitives";
import { StatusGlyph } from "./Status";
import { useAction, useUi } from "./Ui";
import "./overlays.css";

interface Item {
  key: string;
  group: "Needs you" | "Go to" | "Copy CLI";
  icon: ReactNode;
  label: ReactNode;
  /** Text matched against the query. */
  text: string;
  hint?: string;
  keys?: string[];
  /** The entity ID, for ⌘C. */
  id?: string;
  disabled?: string;
  run: () => void | Promise<unknown>;
}

const SECTION_LABEL: Record<Section, string> = {
  inbox: "Inbox",
  overview: "Overview",
  roadmap: "Roadmap",
  features: "Features",
  decisions: "Decisions",
  questions: "Questions",
  issues: "Issues",
  activity: "Activity",
  verification: "Verification",
  knowledge: "Knowledge",
};

const KEY_FOR: Partial<Record<Section, string>> = Object.fromEntries(
  Object.entries(GOTO).map(([k, s]) => [s, k]),
);

function actionItems(index: Index, canAct: boolean, act: ReturnType<typeof useAction>): Item[] {
  const items: Item[] = [];
  for (const i of index.inbox) {
    const ref = i.ref ?? "";
    if (i.kind === "approve-spec") {
      items.push({
        key: `approve-${ref}`,
        group: "Needs you",
        icon: <StatusGlyph glyph="s-done" />,
        label: (
          <>
            Approve <span className="mono">{ref}</span>
          </>
        ),
        text: `approve ${ref} ${i.title}`,
        hint: i.detail,
        id: ref,
        disabled: canAct ? undefined : "Read-only",
        run: () => act("approve", ref, undefined, "draft"),
      });
    } else if (i.kind === "answer-question") {
      items.push({
        key: `answer-${ref}`,
        group: "Needs you",
        icon: <StatusGlyph glyph={i.urgency === "high" ? "s-blocked" : "s-open"} />,
        label: (
          <>
            Answer <span className="mono">{ref}</span>
          </>
        ),
        text: `answer ${ref} ${i.title}`,
        hint: i.title,
        id: ref,
        run: () => navigate(routeForId(ref)),
      });
    } else if (i.kind === "reapprove-spec") {
      items.push({
        key: `reapprove-${ref}`,
        group: "Needs you",
        icon: <StatusGlyph glyph="s-approved" />,
        label: (
          <>
            Re-approve <span className="mono">{ref}</span>
          </>
        ),
        text: `reapprove ${ref} ${i.title}`,
        hint: i.detail,
        id: ref,
        run: () => navigate(routeForId(ref)),
      });
    } else if (i.kind === "review-adr" || i.kind === "review-auto") {
      items.push({
        key: `review-${ref}`,
        group: "Needs you",
        icon: <StatusGlyph glyph="s-proposed" />,
        label: (
          <>
            Review <span className="mono">{ref}</span>
          </>
        ),
        text: `review ${ref} ${i.title}`,
        hint: i.title,
        id: ref,
        run: () => navigate(routeForId(ref)),
      });
    } else if (i.kind === "failing-verify") {
      items.push({
        key: `run-${ref}`,
        group: "Copy CLI",
        icon: <Icon name="terminal" size={14} />,
        label: <span className="mono">azimuth verify {ref}</span>,
        text: `azimuth verify ${ref}`,
        hint: "Re-run after the fix",
        run: () => copyText(`azimuth verify ${ref}`),
      });
    }
  }
  // Drafts that can't be approved yet, with the reason (the reference shows them disabled).
  for (const f of index.features) {
    if (f.status !== "draft" || items.some((it) => it.key === `approve-${f.id}`)) continue;
    const failing = f.derived.next_gate?.checks.find((c) => !c.ok);
    if (!failing) continue;
    items.push({
      key: `approve-${f.id}`,
      group: "Needs you",
      icon: <StatusGlyph glyph="" />,
      label: (
        <>
          Approve <span className="mono">{f.id}</span>
        </>
      ),
      text: `approve ${f.id} ${f.title}`,
      hint: `Unavailable: ${failing.detail ?? failing.rule}`,
      id: f.id,
      disabled: failing.rule,
      run: () => undefined,
    });
  }
  return items;
}

function entityItems(index: Index): Item[] {
  const go = (id: string, title: string, glyph: string): Item => ({
    key: `go-${id}`,
    group: "Go to",
    icon: <StatusGlyph glyph={glyph} />,
    label: (
      <>
        <span className="mono">{id}</span> {title}
      </>
    ),
    text: `${id} ${title}`,
    id,
    run: () => navigate(routeForId(id)),
  });
  return [
    ...index.features.map((f) => go(f.id, f.title, FEATURE_LOOK[f.status].glyph)),
    ...index.questions.map((q) => go(q.id, q.title, q.status === "open" ? "s-open" : "s-done")),
    ...index.decisions.map((d) =>
      go(d.id, d.title, d.status === "accepted" ? "s-done" : "s-proposed"),
    ),
    ...index.issues.map((i) => go(i.id, i.title, i.status === "resolved" ? "s-done" : "s-open")),
    ...index.milestones.map((m) =>
      go(m.id, m.title, m.status === "released" ? "s-done" : "s-active"),
    ),
    ...index.sessions.map((s) => go(s.id, s.goal, "s-muted")),
  ];
}

function sectionItems(): Item[] {
  return SECTIONS.map((s) => ({
    key: `section-${s}`,
    group: "Go to" as const,
    icon: <span className="palette-blank" />,
    label: SECTION_LABEL[s],
    text: SECTION_LABEL[s],
    keys: KEY_FOR[s] ? ["g", KEY_FOR[s] as string] : undefined,
    run: () => navigate(href(s)),
  }));
}

/** ⌘K: jump to any ID or title, run what needs you, copy CLI commands. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { index } = useIndexState();
  const { canAct } = useCanAct();
  const act = useAction();
  const { toast } = useUi();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const items = useMemo(() => {
    if (!index) return [];
    const q = query.trim().toLowerCase();
    const all = [
      ...actionItems(index, canAct, act),
      ...(q ? entityItems(index) : []),
      ...sectionItems(),
    ];
    const matched = q ? all.filter((i) => i.text.toLowerCase().includes(q)) : all;
    return matched.slice(0, 40);
  }, [index, query, canAct, act]);

  const choose = async (item: Item | undefined) => {
    if (!item || item.disabled) return;
    onClose();
    await item.run();
    if (item.group === "Copy CLI") toast({ title: "Copied to the clipboard", detail: item.text });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void choose(items[selected]);
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && items[selected]?.id) {
      e.preventDefault();
      void copyText(items[selected]?.id ?? "");
      toast({ title: `Copied ${items[selected]?.id}` });
    }
  };

  let lastGroup = "";
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKey}
      >
        <div className="palette-input">
          <Icon name="search" />
          <input
            autoFocus
            value={query}
            placeholder="Jump to an ID or title, or type an action"
            aria-label="Search"
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="palette-list" role="listbox">
          {items.length === 0 && <div className="palette-empty">Nothing matches “{query}”.</div>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.key}>
                {header && <div className="palette-group">{header}</div>}
                <div
                  role="option"
                  aria-selected={i === selected}
                  aria-disabled={Boolean(item.disabled)}
                  className={`palette-item ${i === selected ? "sel" : ""} ${item.disabled ? "disabled" : ""}`.trim()}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => void choose(item)}
                >
                  {item.icon}
                  <span className="palette-label">{item.label}</span>
                  {item.hint && <span className="palette-hint">{item.hint}</span>}
                  <span className="spacer" />
                  {item.keys?.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                  {i === selected && !item.keys && !item.disabled && <Kbd>↵</Kbd>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="palette-foot">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move <Kbd>↵</Kbd> run <Kbd>⌘</Kbd>
          <Kbd>C</Kbd> copy ID
        </div>
      </div>
    </div>
  );
}
