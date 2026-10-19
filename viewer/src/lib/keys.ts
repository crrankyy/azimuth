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

/** Lists pause while a dialog, the palette or the problems panel has the keyboard. */
const overlayOpen = () => Boolean(document.querySelector(".overlay, .problems"));

const GO_WINDOW_MS = 1_200;

/** Remembers the key before the current one, so a `g`+letter shortcut is never also a list key. */
export function keyTracker() {
  let previous = { key: "", at: -Infinity };
  let current = { key: "", at: -Infinity };
  return {
    record(key: string, at: number) {
      previous = current;
      current = { key, at };
    },
    /** True while handling the key that follows a `g`. */
    afterG(at: number) {
      return previous.key === "g" && at - previous.at < GO_WINDOW_MS;
    },
  };
}

// Recorded in the capture phase, before any handler runs, whatever order they were added in.
const recent = keyTracker();
const record = (e: KeyboardEvent) => recent.record(e.key, e.timeStamp);

/** Global shortcuts: ⌘K / Ctrl-K palette, `g`+letter navigation, `g p` problems. */
export function useGlobalKeys(handlers: { palette: () => void; problems: () => void }): void {
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
      if (!recent.afterG(e.timeStamp)) return;
      if (e.key === "p") {
        e.preventDefault();
        latest.current.problems();
        return;
      }
      const section = GOTO[e.key];
      if (section) {
        e.preventDefault();
        navigate(href(section));
      }
    };
    window.addEventListener("keydown", record, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", record, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}

/**
 * `j`/`k` move through a list, `Enter` opens, `a` runs the primary action, `Esc` leaves the view.
 * Returns nothing; the caller owns the selected index.
 */
export function useListKeys(opts: {
  count: number;
  selected: number;
  onSelect: (index: number) => void;
  onOpen?: (index: number) => void;
  onPrimary?: (index: number) => void;
  /** Esc: leave the view (an issue's page goes back to the list). Paused like the other keys. */
  onBack?: () => void;
  enabled?: boolean;
  /** The list itself is in an overlay (the problems panel), so overlays don't pause it. */
  insideOverlay?: boolean;
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
        recent.afterG(e.timeStamp) ||
        o.count === 0 ||
        (!o.insideOverlay && overlayOpen())
      )
        return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        o.onSelect(Math.min(o.count - 1, o.selected + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        o.onSelect(Math.max(0, o.selected - 1));
      } else if (e.key === "Enter") {
        // Buttons and links keep their own Enter.
        if ((e.target as HTMLElement | null)?.closest?.("button, a")) return;
        o.onOpen?.(o.selected);
      } else if (e.key === "Escape") {
        o.onBack?.();
      } else if (e.key === "a") {
        // The action may focus a field (the inline answer); don't type the "a" into it.
        e.preventDefault();
        o.onPrimary?.(o.selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
