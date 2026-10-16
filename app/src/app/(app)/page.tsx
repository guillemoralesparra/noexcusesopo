import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";
import { Mosaic } from "@/components/Mosaic";
import { TimePicker } from "@/components/TimePicker";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/lang";
import { suggestionPreview } from "@/lib/practice";
import { estimateTest, overview, topicStats } from "@/lib/progress";
import { MINUTES_TO_COUNT } from "@/lib/session-sizes";

export default async function HomePage() {
  const user = await requireUser();
  const [t, ov, stats] = await Promise.all([getDict(), overview(user.id), topicStats(user.id)]);
  const minutes = Object.keys(MINUTES_TO_COUNT);
  const previews = await suggestionPreview(user.id, minutes.map((m) => MINUTES_TO_COUNT[m]));
  const byMinutes = Object.fromEntries(minutes.map((m, i) => [m, previews[i]]));

  const eps = stats.filter((s) => s.kind === "epigraf");
  const mastered = eps.filter((e) => e.mastery === "mastered").length;
  const sure = ov.calibration.sure;
  const est = estimateTest(stats);

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-x-10">
      <section className="min-w-0 space-y-6">
        <div>
          <h1 className="text-[28px] font-extrabold leading-[1.05] tracking-[-0.03em] text-balance sm:text-[40px]">{t.home.hello(user.displayName)}</h1>
          <p className="mt-2 max-w-[60ch] text-lg text-ink-2">{t.home.sub}</p>
        </div>

        <TimePicker previews={byMinutes} firstTime={ov.answered === 0} />

        {ov.unfinished && (
          <Link
            href={`/sessio/${ov.unfinished.id}`}
            className="flex items-center gap-4 rounded-2xl bg-ochre-soft p-4 transition-colors hover:bg-ochre/30 sm:p-5"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border-b-4 border-ochre-edge bg-ochre text-on-ochre">
              <Play className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{t.home.resumeTitle}</span>
              <span className="block truncate text-[15px] text-ink-2">{ov.unfinished.title}</span>
            </span>
            <span className="ml-auto hidden font-bold text-on-ochre sm:block">{t.home.resume}</span>
          </Link>
        )}

      </section>

      <aside className="panel p-5 sm:p-6 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start">
        <h2 className="text-xl font-extrabold tracking-[-0.02em]">{t.home.floorTitle}</h2>
        <p className="mb-4 mt-1 text-[15px] leading-snug text-ink-2">{t.home.floorSub}</p>
        <Mosaic stats={stats} t={t} />
        <dl className="mt-5 grid grid-cols-3 gap-2">
          {[
            [`${mastered}/${eps.length}`, t.home.mastered],
            [sure.total ? `${Math.round((100 * sure.correct) / sure.total)} %` : t.home.noData, t.home.sureRate],
            [est && ov.answered > 0 ? est.point.toFixed(1).replace(".", ",") : t.home.noData, t.home.estimate],
          ].map(([v, label]) => (
            <Link key={label} href="/progres" className="rounded-xl bg-ground p-3 transition-colors hover:bg-surface-2">
              <dd className="tabular text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">{v}</dd>
              <dt className="mt-0.5 text-[13px] leading-tight text-ink-2">{label}</dt>
            </Link>
          ))}
        </dl>
      </aside>

        <section className="min-w-0 xl:col-start-1">
          <h2 className="mb-3 text-lg font-extrabold tracking-[-0.01em]">{t.home.recent}</h2>
          {ov.recentFinished.length === 0 ? (
            <p className="text-[15px] text-ink-3">{t.home.recentEmpty}</p>
          ) : (
            <ul className="divide-y-2 divide-ground overflow-hidden rounded-2xl bg-surface">
              {ov.recentFinished.map((s) => (
                <li key={s.id}>
                  <Link href={`/sessio/${s.id}/resultat`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-glaze-soft">
                    <span className="tabular w-16 shrink-0 text-lg font-extrabold text-glaze">
                      {s.correct}/{s.questions}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{s.mode === "exam" ? `${t.home.exam} · ` : ""}{s.title.replace(/^(Simulacre|Pràctica) · /, "")}</span>
                      <span className="tabular text-sm text-ink-3">{s.finishedAt.toLocaleDateString(t.lang === "Castellano" ? "ca-ES" : "es-ES", { day: "numeric", month: "short" })}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
    </div>
  );
}
