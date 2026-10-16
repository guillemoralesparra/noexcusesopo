import Link from "next/link";
import { tileSize } from "@/lib/mastery";
import type { TopicStat } from "@/lib/progress";
import type { Dict } from "@/lib/i18n";
import { Tile } from "./Tile";

/**
 * El paviment: un epígraf per rajola, en l'ordre del temari. Les rajoles grans són els epígrafs
 * que més han caigut als exàmens oficials. Cada rajola porta a practicar el seu tema.
 */
export function Mosaic({ stats, t, columns = 10, highlight }: { stats: TopicStat[]; t: Dict; columns?: number; highlight?: Set<string> }) {
  const eps = stats.filter((s) => s.kind === "epigraf");
  return (
    <div>
      <ul className="grid gap-1 [grid-auto-flow:dense]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {eps.map((e) => {
          const big = tileSize(e.officialWeight) === 2;
          const label = `${e.id} · ${e.title} — ${t.mastery[e.mastery]} · ${e.correctNow}/${e.available}`;
          return (
            <li key={e.id} className={big ? "col-span-2 row-span-2" : ""}>
              <Link
                href={`/temari?tema=${e.parentId}#${e.id}`}
                title={label}
                aria-label={label}
                className={`block aspect-square rounded-[4px] transition-transform duration-150 hover:-translate-y-0.5 ${highlight?.has(e.id) ? "animate-[lay_700ms_var(--ease-out-expo)_both]" : ""}`}
              >
                <Tile state={e.mastery} />
              </Link>
            </li>
          );
        })}
      </ul>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        {(["none", "untouched", "started", "competent", "mastered"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="inline-block size-4">
              <Tile state={s} />
            </span>
            {t.mastery[s]}
          </li>
        ))}
      </ul>
    </div>
  );
}
