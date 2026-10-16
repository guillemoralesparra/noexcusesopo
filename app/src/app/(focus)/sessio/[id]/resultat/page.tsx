import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Home } from "lucide-react";
import { ReviewList } from "@/components/ReviewList";
import { Tile } from "@/components/Tile";
import { requireUser } from "@/lib/auth";
import { getDict, getLang } from "@/lib/lang";
import { MASTERY_ORDER } from "@/lib/mastery";
import { getSessionView, summarize } from "@/lib/practice";
import { topicStats } from "@/lib/progress";
import { guessExpectedValue, type ExerciseScore } from "@/lib/scoring";

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((100 * n) / d));

const EXAM = {
  ca: { title: "Simulacre lliurat", test: "Exercici 1 · Test", cases: "Exercici 2 · Supòsits", pass: "Arriba al mínim de 25", fail: "No arriba al mínim de 25", blanks: (n: number, ev: string) => `Has deixat ${n} en blanc. Amb aquesta penalització, respondre a l'atzar suma de mitjana ${ev} punts per pregunta: a l'examen, no en deixis cap.`, review: "Revisió" },
  es: { title: "Simulacro entregado", test: "Ejercicio 1 · Test", cases: "Ejercicio 2 · Supuestos", pass: "Llega al mínimo de 25", fail: "No llega al mínimo de 25", blanks: (n: number, ev: string) => `Has dejado ${n} en blanco. Con esta penalización, responder al azar suma de media ${ev} puntos por pregunta: en el examen, no dejes ninguna.`, review: "Revisión" },
};

function Figure({ value, label, tone = "ink" }: { value: string; label: string; tone?: "ink" | "glaze" | "brick" }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className={`tabular text-3xl font-extrabold tracking-[-0.02em] ${tone === "glaze" ? "text-glaze" : tone === "brick" ? "text-brick" : ""}`}>{value}</p>
      <p className="text-[15px] text-ink-2">{label}</p>
    </div>
  );
}

function ExerciseCard({ label, s, L }: { label: string; s: ExerciseScore; L: (typeof EXAM)["ca"] }) {
  const pass = s.points >= 25;
  return (
    <div className="rounded-2xl bg-surface p-5">
      <p className="font-semibold text-ink-2">{label}</p>
      <p className={`tabular mt-1 text-5xl font-extrabold tracking-[-0.03em] ${pass ? "text-glaze" : "text-brick"}`}>
        {s.points.toFixed(2).replace(".", ",")}
        <span className="text-xl text-ink-3"> / 50</span>
      </p>
      <div className="relative mt-3 h-2.5 rounded-full bg-tile-empty">
        <div className={`h-full rounded-full ${pass ? "bg-glaze" : "bg-brick"}`} style={{ width: `${(s.points / 50) * 100}%` }} />
        <div className="absolute inset-y-[-4px] left-1/2 w-0.5 bg-ink" title="25" />
      </div>
      <p className="mt-2 text-[15px] text-ink-2">
        {pass ? L.pass : L.fail} · {s.correct} ✓ · {s.wrong} ✗ · {s.blank} —
      </p>
    </div>
  );
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [view, t, lang] = await Promise.all([getSessionView(user.id, id), getDict(), getLang()]);
  if (!view) notFound();
  if (!view.finishedAt) redirect(`/sessio/${id}`);
  const sum = summarize(view);
  const exam = view.mode === "exam";
  const L = EXAM[lang];

  // Rajoles: epígrafs de la sessió que han pujat d'estat (abans vs ara)
  const [before, after] = await Promise.all([topicStats(user.id, new Date(view.startedAt)), topicStats(user.id)]);
  const beforeBy = new Map(before.map((s) => [s.id, s]));
  const sessionEps = [...new Set(view.questions.map((q) => q.epigrafId))];
  const moved = after
    .filter((s) => sessionEps.includes(s.id))
    .map((s) => ({ s, from: beforeBy.get(s.id)!.mastery }))
    .sort((a, b) => MASTERY_ORDER.indexOf(b.s.mastery) - MASTERY_ORDER.indexOf(a.s.mastery));
  const laid = moved.filter((m) => m.s.mastery === "mastered" && m.from !== "mastered").length;
  // La rajola protagonista: la que més ha pujat (o la més avançada)
  const hero =
    [...moved].sort(
      (a, b) =>
        MASTERY_ORDER.indexOf(b.s.mastery) - MASTERY_ORDER.indexOf(b.from) - (MASTERY_ORDER.indexOf(a.s.mastery) - MASTERY_ORDER.indexOf(a.from)) ||
        MASTERY_ORDER.indexOf(b.s.mastery) - MASTERY_ORDER.indexOf(a.s.mastery),
    )[0] ?? null;

  const mins = Math.max(1, Math.round((new Date(view.finishedAt).getTime() - new Date(view.startedAt).getTime()) / 60000));
  const toReview = view.questions.filter((q) => q.result && (q.result.outcome !== "correct" || q.result.confidence === "guess"));
  const wrongSure = view.questions.filter((q) => q.result?.outcome === "wrong" && q.result.confidence === "sure").length;
  const { sure, doubt } = sum.byConfidence;
  const blanks = sum.test.blank + (sum.cases?.blank ?? 0);

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <h1 className="text-[32px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[44px]">{exam ? L.title : t.done.title}</h1>
        <p className="mt-1 text-lg text-ink-2">{t.done.sub(view.questions.length, mins)}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-8">
        <div className="min-w-0 space-y-6 lg:col-start-1">
          {exam ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ExerciseCard label={L.test} s={sum.test} L={L} />
              {sum.cases && <ExerciseCard label={L.cases} s={sum.cases} L={L} />}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Figure value={`${sum.test.correct}/${sum.test.valid}`} label={t.done.correct} tone="glaze" />
              <Figure value={`${mins} min`} label={t.done.time} />
              <Figure value={sum.test.points.toFixed(1).replace(".", ",")} label={`${t.done.net} /50`} />
            </div>
          )}

          {(sure.total > 0 || doubt.total > 0 || wrongSure > 0 || (exam && blanks > 0)) && (
            <section className="space-y-2 rounded-2xl bg-glaze-soft p-5 text-[16px] leading-relaxed">
              {(sure.total > 0 || doubt.total > 0) && <p className="font-semibold">{t.done.calib(pct(sure.correct, sure.total), pct(doubt.correct, doubt.total))}</p>}
              {wrongSure > 0 && <p>{t.done.wrongSure(wrongSure)}</p>}
              {exam && blanks > 0 && guessExpectedValue(view.penalty) > 0 && <p>{L.blanks(blanks, guessExpectedValue(view.penalty).toFixed(2).replace(".", ","))}</p>}
            </section>
          )}
        </div>

        {/* Moment característic: la rajola col·locada */}
        <aside className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="overflow-hidden rounded-2xl bg-glaze p-6 text-on-glaze">
            {hero && (
              <div className={`mx-auto mb-5 size-36 sm:size-44 ${hero.from !== hero.s.mastery ? "animate-[lay_900ms_var(--ease-out-expo)_both]" : ""}`}>
                <Tile state={hero.s.mastery} />
              </div>
            )}
            <p className="text-center text-xl font-extrabold leading-tight tracking-[-0.02em]">{laid > 0 ? t.done.laid(laid) : hero ? `${hero.s.id} ${hero.s.title.split(":")[0]}` : t.home.floorTitle}</p>
            {hero && (
              <p className="mt-1 text-center text-on-glaze-2">
                {hero.from !== hero.s.mastery ? `${t.mastery[hero.from]} → ` : ""}
                {t.mastery[hero.s.mastery]}
              </p>
            )}
            {moved.length > 1 && hero && (
              <ul className="mt-5 space-y-2 border-t-2 border-glaze-deep pt-4">
                {moved.filter((m) => m !== hero).slice(0, 5).map(({ s, from }) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className="size-8 shrink-0">
                      <Tile state={s.mastery} />
                    </span>
                    <span className="min-w-0 text-[14px] leading-tight">
                      <span className="block truncate font-semibold">{s.id} {s.title.split(":")[0]}</span>
                      <span className="text-on-glaze-2">
                        {MASTERY_ORDER.indexOf(s.mastery) > MASTERY_ORDER.indexOf(from) ? `${t.mastery[from]} → ` : ""}
                        {t.mastery[s.mastery]}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/" className="btn-glaze">
              {t.done.more} <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link href="/" className="btn-quiet">
              <Home className="size-5" aria-hidden /> {t.done.stop}
            </Link>
            <p className="pt-1 text-center text-[15px] text-ink-3">{t.done.goodbye}</p>
          </div>
        </aside>

        <section className="min-w-0 lg:col-start-1">
          <h2 className="mb-3 text-xl font-extrabold tracking-[-0.02em]">{exam ? L.review : t.done.review}</h2>
          {toReview.length === 0 ? <p className="text-ink-2">{t.done.allRight}</p> : <ReviewList view={view} questions={exam ? view.questions : toReview} />}
        </section>
      </div>
    </main>
  );
}
