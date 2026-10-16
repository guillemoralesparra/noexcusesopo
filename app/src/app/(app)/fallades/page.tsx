import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { mistakesByEpigraf } from "@/lib/progress";
import { startPractice } from "../actions";

const L = {
  ca: {
    title: "Per repassar",
    sub: "Preguntes que l'últim cop vas fallar o deixar en blanc. Tornar-hi és el que més rendeix: cada error és una oportunitat.",
    start: (n: number) => (n === 1 ? "Repassar-la" : `Repassar-ne ${n}`),
    all: (n: number) => `Totes (${n})`,
    empty: "No tens res pendent de repàs.",
    emptySub: "Quan en fallis alguna, la trobaràs aquí.",
    go: "Anar a practicar",
    qs: (n: number) => (n === 1 ? "1 pregunta" : `${n} preguntes`),
    practice: "Repassar",
    pending: (n: number) => (n === 1 ? "1 pregunta pendent, en un sol bloc" : `${n} preguntes pendents, barrejades`),
  },
  es: {
    title: "Para repasar",
    sub: "Preguntas que la última vez fallaste o dejaste en blanco. Volver a ellas es lo que más rinde: cada error es una oportunidad.",
    start: (n: number) => (n === 1 ? "Repasarla" : `Repasar ${n}`),
    all: (n: number) => `Todas (${n})`,
    empty: "No tienes nada pendiente de repaso.",
    emptySub: "Cuando falles alguna, la encontrarás aquí.",
    go: "Ir a practicar",
    qs: (n: number) => (n === 1 ? "1 pregunta" : `${n} preguntas`),
    practice: "Repasar",
    pending: (n: number) => (n === 1 ? "1 pregunta pendiente, en un solo bloque" : `${n} preguntas pendientes, mezcladas`),
  },
};

export default async function FalladesPage() {
  const user = await requireUser();
  const [groups, lang] = await Promise.all([mistakesByEpigraf(user.id), getLang()]);
  const l = L[lang];
  const total = groups.reduce((a, g) => a + g.n, 0);
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[36px]">{l.title}</h1>
        <p className="mt-1 max-w-[62ch] text-lg text-ink-2">{l.sub}</p>
      </div>
      {total === 0 ? (
        <div className="rounded-2xl bg-surface p-6">
          <p className="text-lg font-bold">{l.empty}</p>
          <p className="text-ink-2">{l.emptySub}</p>
          <Link href="/" className="btn-glaze mt-4">
            {l.go}
          </Link>
        </div>
      ) : (
        <>
          <form action={startPractice} className="flex flex-wrap items-center gap-3 rounded-2xl bg-ochre-soft p-5">
            <input type="hidden" name="mode" value="mistakes" />
            <p className="mr-auto text-lg font-bold">{l.pending(total)}</p>
            <button name="count" value={String(Math.min(20, Math.max(5, total)))} className="btn-ochre">
              <RotateCcw className="size-5" aria-hidden /> {l.start(Math.min(20, total))}
            </button>
            {total > 20 && (
              <button name="count" value={String(Math.min(100, total))} className="btn-quiet">
                {l.all(total)}
              </button>
            )}
          </form>
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-4 rounded-2xl bg-surface p-4">
                <span className="tabular w-10 shrink-0 text-2xl font-extrabold text-ochre-ink">{g.n}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block font-bold">
                    <span className="text-ink-3">{g.id}</span> {g.title.split(":")[0]}
                  </span>
                  <span className="text-[14px] text-ink-2">{l.qs(g.n)}</span>
                </span>
                <form action={startPractice}>
                  <input type="hidden" name="mode" value="topic" />
                  <input type="hidden" name="topicIds" value={g.id} />
                  <input type="hidden" name="count" value="10" />
                  <button className="btn-quiet min-h-10 px-3 text-sm">{l.practice}</button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
