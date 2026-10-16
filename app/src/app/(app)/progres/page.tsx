import Link from "next/link";
import { Mosaic } from "@/components/Mosaic";
import { Tile } from "@/components/Tile";
import { requireUser } from "@/lib/auth";
import { getDict, getLang } from "@/lib/lang";
import { estimateTest, overview, topicStats } from "@/lib/progress";

const L = {
  ca: {
    title: "Progrés",
    estimate: "Nota estimada del test",
    estimateSub: (lo: string, hi: string) => `Entre ${lo} i ${hi} sobre 50 en un examen com els oficials. Com més treballis, més estreta serà la forquilla.`,
    estimateNone: "Respon unes quantes preguntes i et farem una primera estimació.",
    min: "mínim 25",
    calib: "Com et coneixes",
    calibSub: "Si et coneixes bé, «Ho sé» encerta gairebé sempre i «Dubto» encerta més que l'atzar (25 %).",
    weak: "Punts febles",
    weakSub: "Epígrafs molt preguntats que encara no domines.",
    practice: "Practicar",
    days: "Dies d'estudi (últimes 8 setmanes)",
    daysSub: (n: number) => (n === 1 ? "1 dia actiu. Cada dia compta, sense ratxes." : `${n} dies actius. Cada dia compta, sense ratxes.`),
    answers: (n: number) => `${n} respostes`,
    floor: "El paviment sencer",
    memory: "Memòria",
    memorySub: (n: number) => `Retenció mitjana estimada de les ${n} preguntes que has treballat. Els repassos arriben just abans d'oblidar-les.`,
    due: (n: number) => (n === 1 ? "1 repàs pendent avui" : `${n} repassos pendents avui`),
    memoryNone: "Quan responguis preguntes, aquí veuràs quant en recordes.",
  },
  es: {
    title: "Progreso",
    estimate: "Nota estimada del test",
    estimateSub: (lo: string, hi: string) => `Entre ${lo} y ${hi} sobre 50 en un examen como los oficiales. Cuanto más trabajes, más estrecha será la horquilla.`,
    estimateNone: "Responde unas cuantas preguntas y te haremos una primera estimación.",
    min: "mínimo 25",
    calib: "Cómo te conoces",
    calibSub: "Si te conoces bien, «Lo sé» acierta casi siempre y «Dudo» acierta más que el azar (25 %).",
    weak: "Puntos débiles",
    weakSub: "Epígrafes muy preguntados que aún no dominas.",
    practice: "Practicar",
    days: "Días de estudio (últimas 8 semanas)",
    daysSub: (n: number) => (n === 1 ? "1 día activo. Cada día cuenta, sin rachas." : `${n} días activos. Cada día cuenta, sin rachas.`),
    answers: (n: number) => `${n} respuestas`,
    floor: "El pavimento entero",
    memory: "Memoria",
    memorySub: (n: number) => `Retención media estimada de las ${n} preguntas que has trabajado. Los repasos llegan justo antes de olvidarlas.`,
    due: (n: number) => (n === 1 ? "1 repaso pendiente hoy" : `${n} repasos pendientes hoy`),
    memoryNone: "Cuando respondas preguntas, aquí verás cuánto recuerdas.",
  },
};

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

export default async function ProgressPage() {
  const user = await requireUser();
  const [stats, ov, t, lang] = await Promise.all([topicStats(user.id), overview(user.id), getDict(), getLang()]);
  const l = L[lang];
  const est = ov.answered > 0 ? estimateTest(stats) : null;
  const weak = stats
    .filter((s) => s.kind === "epigraf" && s.available > 0 && s.mastery !== "mastered")
    .sort((a, b) => b.officialWeight - a.officialWeight)
    .slice(0, 5);

  // 8 setmanes de dilluns a diumenge, acabant avui
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7 * 7);
  const days = Array.from({ length: 56 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = d.toISOString().slice(0, 10);
    return { k, n: ov.activeDays.get(k) ?? 0, future: d > today };
  });
  const active = days.filter((d) => d.n > 0).length;

  return (
    <div className="space-y-8">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[36px]">{l.title}</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="rounded-2xl bg-glaze p-6 text-on-glaze">
          <h2 className="font-bold text-on-glaze-2">{l.estimate}</h2>
          {est ? (
            <>
              <p className="tabular mt-1 text-6xl font-extrabold tracking-[-0.04em]">
                {fmt(est.point)}
                <span className="text-2xl text-on-glaze-2"> / 50</span>
              </p>
              <div className="relative mt-4 h-3 rounded-full bg-glaze-deep">
                <div className="absolute inset-y-0 rounded-full bg-on-glaze-2" style={{ left: `${(est.low / 50) * 100}%`, width: `${((est.high - est.low) / 50) * 100}%` }} />
                <div className="absolute inset-y-[-5px] w-1 rounded bg-ochre" style={{ left: `${(est.point / 50) * 100}%` }} />
                <div className="absolute inset-y-[-8px] left-1/2 w-0.5 bg-on-glaze" title="25" />
              </div>
              <p className="mt-2 text-sm text-on-glaze-2">{l.min}</p>
              <p className="mt-3 max-w-[52ch] text-[15px] text-on-glaze-2">{l.estimateSub(fmt(est.low), fmt(est.high))}</p>
            </>
          ) : (
            <p className="mt-2 text-lg">{l.estimateNone}</p>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-6">
          <h2 className="text-lg font-extrabold">{l.calib}</h2>
          <p className="mt-1 text-[15px] text-ink-2">{l.calibSub}</p>
          <ul className="mt-4 space-y-3">
            {(
              [
                ["sure", t.q.sure],
                ["doubt", t.q.doubt],
                ["guess", t.q.guess],
              ] as const
            ).map(([k, label]) => {
              const c = ov.calibration[k];
              const p = c.total ? Math.round((100 * c.correct) / c.total) : null;
              return (
                <li key={k}>
                  <div className="mb-1 flex justify-between text-[15px]">
                    <span className="font-semibold">{label}</span>
                    <span className="tabular text-ink-2">
                      {p === null ? "—" : `${p} %`} · {l.answers(c.total)}
                    </span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-tile-empty">
                    {p !== null && <div className="h-full rounded-full bg-glaze" style={{ width: `${p}%` }} />}
                    <div className="absolute inset-y-[-3px] w-0.5 bg-ink-3" style={{ left: "25%" }} title="25 %" />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-6 sm:flex-row sm:items-center">
        <div className="shrink-0">
          <h2 className="text-lg font-extrabold">{l.memory}</h2>
          <p className="tabular text-5xl font-extrabold tracking-[-0.03em] text-glaze">
            {ov.memory.retention === null ? "—" : `${Math.round(ov.memory.retention * 100)} %`}
          </p>
        </div>
        <div className="text-[15px] text-ink-2 sm:ml-4">
          <p>{ov.memory.cards ? l.memorySub(ov.memory.cards) : l.memoryNone}</p>
          {ov.memory.cards > 0 && <p className="mt-1 font-semibold text-ink">{l.due(ov.memory.dueNow)}</p>}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl bg-surface p-6">
          <h2 className="text-lg font-extrabold">{l.weak}</h2>
          <p className="mt-1 text-[15px] text-ink-2">{l.weakSub}</p>
          <ul className="mt-4 space-y-2">
            {weak.map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <span className="size-9 shrink-0">
                  <Tile state={e.mastery} />
                </span>
                <span className="min-w-0 flex-1 text-[15px] leading-tight">
                  <span className="block truncate font-semibold">{e.id} {e.title.split(":")[0]}</span>
                  <span className="text-ink-2">{t.mastery[e.mastery]} · {e.correctNow}/{e.available}</span>
                </span>
                <Link href={`/temari?tema=${e.parentId}#${e.id}`} className="btn-quiet min-h-10 px-3 text-sm">
                  {l.practice}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-surface p-6">
          <h2 className="text-lg font-extrabold">{l.days}</h2>
          <p className="mt-1 text-[15px] text-ink-2">{l.daysSub(active)}</p>
          <div className="mt-4 grid max-w-[300px] grid-flow-col grid-rows-7 gap-1" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
            {days.map((d) => (
              <span
                key={d.k}
                title={`${d.k}: ${d.n}`}
                className={`aspect-square rounded-[3px] ${d.future ? "bg-transparent" : d.n === 0 ? "bg-tile-empty" : d.n < 15 ? "bg-glaze-mid" : "bg-glaze"}`}
              />
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl bg-surface p-6">
        <h2 className="mb-4 text-lg font-extrabold">{l.floor}</h2>
        <Mosaic stats={stats} t={t} columns={14} />
      </section>
    </div>
  );
}
