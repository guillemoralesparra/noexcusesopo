import type { MasteryState } from "@/lib/mastery";

/**
 * Rajola hidràulica: el motiu es va completant amb el domini.
 * started: un quart de cercle · familiar: dos · competent: quatre · mastered: quatre + rosassa central.
 */
const CORNERS: Record<MasteryState, number> = { none: 0, untouched: 0, started: 1, familiar: 2, competent: 4, mastered: 4 };

const CORNER_PATHS = [
  "M0 0 H14 A14 14 0 0 1 0 14 Z",
  "M40 40 H26 A14 14 0 0 1 40 26 Z",
  "M40 0 V14 A14 14 0 0 1 26 0 Z",
  "M0 40 V26 A14 14 0 0 1 14 40 Z",
];

export function Tile({ state, className = "" }: { state: MasteryState; className?: string }) {
  const ground =
    state === "mastered" ? "var(--glaze)" : state === "competent" ? "var(--glaze-mid)" : state === "none" ? "transparent" : state === "untouched" ? "var(--tile-empty)" : "var(--glaze-soft)";
  const motif = state === "mastered" ? "var(--ochre)" : "var(--glaze)";
  return (
    <svg viewBox="0 0 40 40" className={`block h-full w-full ${className}`} aria-hidden="true">
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="3"
        fill={ground}
        stroke={state === "none" ? "var(--tile-empty)" : "none"}
        strokeWidth={state === "none" ? 1.5 : 0}
        strokeDasharray={state === "none" ? "3 3" : undefined}
      />
      {CORNER_PATHS.slice(0, CORNERS[state]).map((d) => (
        <path key={d} d={d} fill={motif} />
      ))}
      {state === "mastered" && (
        <g fill="var(--on-glaze-2)">
          <path d="M20 9 L24 20 L20 31 L16 20 Z" />
          <path d="M9 20 L20 16 L31 20 L20 24 Z" />
          <circle cx="20" cy="20" r="3" fill="var(--ochre)" />
        </g>
      )}
    </svg>
  );
}
