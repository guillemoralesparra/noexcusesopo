import { asc } from "drizzle-orm";
import { Timer } from "lucide-react";
import { getDb } from "@/db";
import { cases, exams, questions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { examLabel, isFudenExam } from "@/lib/exam-label";
import { startPractice } from "../actions";

const L = {
  ca: {
    title: "Simulacres",
    sub: "Exàmens oficials reals de l'ICS amb el seu format. La correcció arriba en lliurar, com a l'examen.",
    penalty: "Penalització per error",
    none: "Cap",
    noneHint: "El 2019 i el 2024 no hi havia penalització.",
    timed: (m: number) => `Amb rellotge (${m} min)`,
    case: "Supòsit",
    start: "Començar simulacre",
    note: "Els criteris de la convocatòria 2025 encara no s'han publicat: pots provar també amb −1/4 o −1/3.",
    qs: (n: number) => `${n} preguntes`,
    official: "Exàmens oficials de l'ICS",
    fuden: "Simulacres de FUDEN",
    fudenSub: "Simulacres de l'acadèmia amb la seva clau. No compten per decidir què és prioritari: això només ho marquen els exàmens oficials.",
  },
  es: {
    title: "Simulacros",
    sub: "Exámenes oficiales reales del ICS con su formato. La corrección llega al entregar, como en el examen.",
    penalty: "Penalización por error",
    none: "Ninguna",
    noneHint: "En 2019 y 2024 no había penalización.",
    timed: (m: number) => `Con reloj (${m} min)`,
    case: "Supuesto",
    start: "Empezar simulacro",
    note: "Los criterios de la convocatoria 2025 aún no se han publicado: puedes probar también con −1/4 o −1/3.",
    qs: (n: number) => `${n} preguntas`,
    official: "Exámenes oficiales del ICS",
    fuden: "Simulacros de FUDEN",
    fudenSub: "Simulacros de la academia con su clave. No cuentan para decidir qué es prioritario: eso solo lo marcan los exámenes oficiales.",
  },
};

export default async function SimulacresPage() {
  await requireUser();
  const l = L[await getLang()];
  const db = await getDb();
  const [examRows, caseRows, qRows] = await Promise.all([
    db.select().from(exams).orderBy(asc(exams.date)),
    db.select().from(cases),
    db.select({ examId: questions.examId, caseId: questions.caseId, annulled: questions.annulled }).from(questions),
  ]);
  /** Preguntes que tindrà el simulacre: vàlides, i amb supòsits alternatius només un d'ells */
  const countFor = (examId: string, alternative: boolean) => {
    const qs = qRows.filter((q) => q.examId === examId && !q.annulled);
    if (!alternative) return qs.length;
    const firstCase = qs.find((q) => q.caseId)?.caseId;
    return qs.filter((q) => !q.caseId || q.caseId === firstCase).length;
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[36px]">{l.title}</h1>
        <p className="mt-1 max-w-[62ch] text-lg text-ink-2">{l.sub}</p>
        <p className="mt-3 max-w-[62ch] rounded-xl bg-ochre-soft px-4 py-3 text-[15px]">{l.note}</p>
      </div>
      {(
        [
          [l.official, null, examRows.filter((e) => !isFudenExam(e.id)).reverse()],
          [l.fuden, l.fudenSub, examRows.filter((e) => isFudenExam(e.id))],
        ] as const
      ).map(([heading, sub, rows]) => rows.length > 0 && (
      <section key={heading} className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.01em]">{heading}</h2>
        {sub && <p className="max-w-[62ch] text-[15px] text-ink-2">{sub}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((e) => {
          const examCases = caseRows.filter((c) => c.examId === e.id);
          const alternative = e.format?.note?.includes("s'escull un");
          const sim = e.id.match(/^fuden-sim-(\d+)$/)?.[1];
          const year = sim ? `S${Number(sim)}` : e.date.slice(0, 4);
          return (
            <form key={e.id} action={startPractice} className="flex flex-col gap-4 rounded-2xl bg-surface p-5">
              <input type="hidden" name="mode" value="exam" />
              <input type="hidden" name="examId" value={e.id} />
              <div className="flex items-start gap-4">
                <span className="shrink-0 text-center"><span className="tabular block text-4xl font-extrabold leading-none tracking-[-0.04em] text-glaze">{year}</span><span className="tabular text-[13px] text-ink-3">{e.date.split("-").reverse().join("/")}</span></span>
                <span className="min-w-0 text-[15px] text-ink-2">
                  <span className="block font-semibold text-ink">{examLabel(e.id, e.date)}</span>
                  {l.qs(countFor(e.id, !!alternative))} · {e.format?.note}
                </span>
              </div>
              <fieldset className="space-y-1.5">
                <legend className="mb-1 text-sm font-bold text-ink-2">{l.penalty}</legend>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["0", l.none],
                    ["0.25", "−1/4"],
                    ["0.33", "−1/3"],
                  ].map(([v, label]) => (
                    <label key={v} className="cursor-pointer">
                      <input type="radio" name="penalty" value={v} defaultChecked={v === "0"} className="peer sr-only" />
                      <span className="inline-flex min-h-10 items-center rounded-full bg-surface-2 px-3.5 text-[15px] font-semibold text-ink-2 peer-checked:bg-glaze peer-checked:text-on-glaze peer-focus-visible:outline-3 peer-focus-visible:outline-[var(--focus)]">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[13px] text-ink-3">{l.noneHint}</p>
              </fieldset>
              <div className="flex flex-wrap items-center gap-4 text-[15px]">
                <label className="flex min-h-10 items-center gap-2">
                  <input type="checkbox" name="timed" defaultChecked className="size-5 accent-[var(--glaze)]" /> {l.timed(e.format?.time_min ?? 120)}
                </label>
                {alternative && (
                  <label className="flex items-center gap-2">
                    {l.case}
                    <select name="caseLabel" className="field w-auto min-h-10">
                      {examCases.map((c) => (
                        <option key={c.id} value={c.label}>
                          {((x) => (x === x.toUpperCase() ? x.charAt(0) + x.slice(1).toLowerCase() : x))(c.title.split("(")[0].trim())}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <button className="btn-glaze mt-auto">
                <Timer className="size-5" aria-hidden /> {l.start}
              </button>
            </form>
          );
        })}
      </div>
      </section>
      ))}
    </div>
  );
}
