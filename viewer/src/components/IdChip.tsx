import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useIndexState } from "../data/IndexProvider";
import { describe } from "../data/selectors";
import { routeForId } from "../lib/router";
import { StatusPill } from "./Status";

interface HoverState {
  id: string;
  rect: DOMRect;
}

const HoverCtx = createContext<{
  show: (id: string, el: HTMLElement) => void;
  hide: () => void;
} | null>(null);

/** Shows a HoverCard for whichever IdChip is hovered or focused. */
export function HoverCardLayer({ children }: { children: ReactNode }) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const timer = useRef<number | null>(null);
  const { index } = useIndexState();
  const show = (id: string, el: HTMLElement) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => setHover({ id, rect: el.getBoundingClientRect() }),
      350,
    );
  };
  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setHover(null);
  };
  useEffect(() => {
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, []);
  const summary = hover && index ? describe(index, hover.id) : null;
  return (
    <HoverCtx.Provider value={{ show, hide }}>
      {children}
      {hover && summary && <HoverCard summary={summary} rect={hover.rect} />}
    </HoverCtx.Provider>
  );
}

function HoverCard({
  summary,
  rect,
}: {
  summary: NonNullable<ReturnType<typeof describe>>;
  rect: DOMRect;
}) {
  const below = rect.bottom + 180 < window.innerHeight;
  const style = {
    left: Math.min(rect.left, window.innerWidth - 316),
    top: below ? rect.bottom + 6 : undefined,
    bottom: below ? undefined : window.innerHeight - rect.top + 6,
  };
  return (
    <div className="hovercard" role="tooltip" style={style}>
      <div className="row">
        <span className="az-id">{summary.id}</span>
        {summary.look && <StatusPill look={summary.look} />}
      </div>
      <div className="title">{summary.title}</div>
      {summary.facts.map((f) => (
        <div key={f}>{f}</div>
      ))}
    </div>
  );
}

/** An ID as a link to its screen, with a HoverCard. */
export function IdChip({
  id,
  className = "",
  large = false,
}: {
  id: string;
  className?: string;
  large?: boolean;
}) {
  const hover = useContext(HoverCtx);
  return (
    <a
      className={`az-id ${large ? "lg" : ""} ${className}`.trim()}
      href={routeForId(id)}
      onMouseEnter={(e) => hover?.show(id, e.currentTarget)}
      onMouseLeave={() => hover?.hide()}
      onFocus={(e) => hover?.show(id, e.currentTarget)}
      onBlur={() => hover?.hide()}
    >
      {id}
    </a>
  );
}
