import { useEffect, useRef } from "react";
import { href, navigate, type Section } from "./router";

/** `g` + letter jumps between sections (documented in docs/viewer.md). */
export const GOTO: Record<string, Section> = {
  i: "inbox",
  o: "overview",
  r: "roadmap",
  f: "features",
  d: "decisions",
  q: "questions",
  s: "issues",
  a: "activity",
  v: "verification",
  k: "knowledge",
};

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(
    el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)),
  );
};

/** Global shortcuts: ⌘K / Ctrl-K palette, `g`+letter navigation, `g p` problems. */
export function useGlobalKeys(handlers: { palette: () => void; problems: () => void }): void {
  const pendingG = useRef(0);
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        latest.current.palette();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "g") {
        pendingG.current = Date.now();
        return;
      }
      if (Date.now() - pendingG.current < 1_200) {
        pendingG.current = 0;
        if (e.key === "p") {
          latest.current.problems();
          return;
        }
        const section = GOTO[e.key];
        if (section) {
          e.preventDefault();
          navigate(href(section));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * `j`/`k` move through a list, `Enter` opens, `a` runs the primary action. Returns nothing;
 * the caller owns the selected index.
 */
export function useListKeys(opts: {
  count: number;
  selected: number;
  onSelect: (index: number) => void;
  onOpen?: (index: number) => void;
  onPrimary?: (index: number) => void;
  enabled?: boolean;
}): void {
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const o = latest.current;
      if (
        o.enabled === false ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isTyping(e.target) ||
        o.count === 0
      )
        return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        o.onSelect(Math.min(o.count - 1, o.selected + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        o.onSelect(Math.max(0, o.selected - 1));
      } else if (e.key === "Enter") {
        o.onOpen?.(o.selected);
      } else if (e.key === "a") {
        o.onPrimary?.(o.selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
