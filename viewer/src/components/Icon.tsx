import type { ReactNode } from "react";

/** Stroke icons from the handoff screens (16×16 grid, 1.5px strokes, currentColor). */
const ICONS: Record<string, ReactNode> = {
  inbox: (
    <>
      <path d="M2 9h3.5l1 2h3l1-2H14" />
      <path d="M3.6 3h8.8L14 9v4H2V9z" />
    </>
  ),
  agents: (
    <>
      <rect x="3" y="4.5" width="10" height="8.5" rx="2" />
      <path d="M8 4.5V2.5" strokeLinecap="round" />
      <circle cx="8" cy="2" r=".6" />
      <path d="M6 8.2v.6M10 8.2v.6M6.5 11h3" strokeLinecap="round" />
    </>
  ),
  overview: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </>
  ),
  roadmap: <path d="M2 4h7M5 8h9M3 12h6" strokeLinecap="round" />,
  features: (
    <>
      <path d="M8 2l6 3-6 3-6-3z" />
      <path d="M2 8l6 3 6-3" />
      <path d="M2 11l6 3 6-3" />
    </>
  ),
  decisions: (
    <>
      <path d="M4 2h5.5L13 5.5V14H4z" />
      <path d="M6.5 9.2l1.4 1.4 2.8-2.8" />
    </>
  ),
  questions: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M6.3 6.3a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.8.6-.8 1.1v.4" strokeLinecap="round" />
      <path d="M8 11.4v.1" strokeLinecap="round" />
    </>
  ),
  issues: (
    <>
      <path d="M8 2.5l6 11H2z" />
      <path d="M8 7v2.6M8 11.6v.1" strokeLinecap="round" />
    </>
  ),
  activity: <path d="M1.5 8h3l1.5-4 3 8 1.5-4h4" strokeLinecap="round" />,
  verification: (
    <>
      <path d="M8 1.8l5 2v4c0 3-2.2 5.2-5 6.4-2.8-1.2-5-3.4-5-6.4v-4z" />
      <path d="M5.8 8l1.6 1.6 3-3" strokeLinecap="round" />
    </>
  ),
  knowledge: (
    <path d="M2.5 3h4A1.5 1.5 0 0 1 8 4.5V14a1.5 1.5 0 0 0-1.5-1.5h-4zM13.5 3h-4A1.5 1.5 0 0 0 8 4.5V14a1.5 1.5 0 0 1 1.5-1.5h4z" />
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </>
  ),
  collapse: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <path d="M6 2.5v11" />
    </>
  ),
  branch: (
    <>
      <circle cx="4" cy="3.5" r="1.5" />
      <circle cx="4" cy="12.5" r="1.5" />
      <circle cx="12" cy="5.5" r="1.5" />
      <path d="M4 5v6M12 7c0 3-4 2.5-7.2 4.4" />
    </>
  ),
  chevronDown: <path d="M4 6l4 4 4-4" strokeLinecap="round" />,
  chevronRight: <path d="M6 4l4 4-4 4" strokeLinecap="round" />,
  arrowRight: <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" />,
  lock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </>
  ),
  copy: (
    <>
      <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
      <path d="M3 10.5V3.5A1 1 0 0 1 4 2.5h6.5" />
    </>
  ),
  close: <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />,
  check: <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" />,
  terminal: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M5 7l2 1.5L5 10M8.5 10h2.5" strokeLinecap="round" />
    </>
  ),
  refresh: (
    <path
      d="M13 3v3.5H9.5M3 13V9.5h3.5M12.6 6.5A5 5 0 0 0 3.6 6M3.4 9.5a5 5 0 0 0 9 .5"
      strokeLinecap="round"
    />
  ),
  shieldX: (
    <>
      <path d="M8 1.8l5 2v4c0 3-2.2 5.2-5 6.4-2.8-1.2-5-3.4-5-6.4v-4z" />
      <path d="M6.3 6.3l3.4 3.4M9.7 6.3l-3.4 3.4" strokeLinecap="round" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 8.2l1.8 1.8 3.4-3.6" strokeLinecap="round" />
    </>
  ),
  doc: (
    <>
      <path d="M4 2h5.5L13 5.5V14H4z" />
      <path d="M6.5 8.5h4M6.5 11h3" strokeLinecap="round" />
    </>
  ),
  camera: (
    <>
      <path d="M2.5 5.5h2.2l1.2-1.8h4.2l1.2 1.8h2.2v7.5h-11z" />
      <circle cx="8" cy="9" r="2.2" />
    </>
  ),
  wifiOff: (
    <path
      d="M2 2l12 12M5.6 8.6a3.5 3.5 0 0 1 4.8 0M3 6a7 7 0 0 1 3-1.6M13 6a7 7 0 0 0-2.4-1.4M8 12h.01"
      strokeLinecap="round"
    />
  ),
  external: <path d="M9 3h4v4M13 3L7.5 8.5M11.5 9v3.5h-8.5v-8.5H6.5" strokeLinecap="round" />,
  filter: <path d="M2.5 4h11M4.5 8h7M6.5 12h3" strokeLinecap="round" />,
  needle: (
    <>
      <path d="M8 2.5L9.6 8H6.4z" fill="currentColor" stroke="none" />
      <path d="M8 13.5L6.4 8h3.2z" opacity="0.4" fill="currentColor" stroke="none" />
    </>
  ),
};

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}

/** The brand mark: a compass with a lavender needle. */
export function CompassMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" role="img" aria-label="Azimuth">
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="var(--ink-subtle)" strokeWidth="1.5" />
      <path d="M10 3.6 L12 10 L8 10 Z" fill="var(--primary)" />
      <path d="M10 16.4 L8 10 L12 10 Z" fill="var(--surface-4)" />
      <circle cx="10" cy="10" r="1.2" fill="var(--canvas)" />
    </svg>
  );
}
