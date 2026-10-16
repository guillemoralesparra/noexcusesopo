import Link from "next/link";
import { ArrowLeft, ChevronRight, Play } from "lucide-react";
import { Tile } from "@/components/Tile";
import { requireUser } from "@/lib/auth";
import { getDict, getLang } from "@/lib/lang";
import { topicStats, type TopicStat } from "@/lib/progress";
import { startPractice } from "../actions";

const L = {
  ca: { title: "Temari", sub: "Tria un tema per veure els seus epígrafs. L'ordre suggerit és el que més cau a l'examen, però pots anar on vulguis.", official: (n: number) => (n === 1 ? "1 pregunta oficial" : `${n} preguntes oficials`), practiceAll: "Practicar tot el tema", practice: "Practicar", nothing: "Encara no hi ha preguntes d'aquest epígraf.", pick: "Tria un tema de la llista.", back: "Tots els temes", qs: (c: number, a: number) => `${c} de ${a} dominades` },
  es: { title: "Temario", sub: "Elige un tema para ver sus epígrafes. El orden sugerido es el que más cae en el examen, pero puedes ir donde quieras.", official: (n: number) => (n === 1 ? "1 pregunta oficial" : `${n} preguntas oficiales`), practiceAll: "Practicar todo el tema", practice: "Practicar", nothing: "Todavía no hay preguntas de este epígrafe.", pick: "Elige un tema de la lista.", back: "Todos los temas", qs: (c: number, a: number) => `${c} de ${a} dominadas` },
};

function TemaBar({ eps }: { eps: TopicStat[] }) {
  return (
    <span className="mt-2 flex gap-[3px]" aria-hidden>
      {eps.map((e) => (
        <span key={e.id} className="size-3.5">
          <Tile state={e.mastery} />
        </span>
      ))}
    </span>
  );
}

export default async function TemariPage({ searchParams }: { searchParams: Promise<{ tema?: string }> }) {
  const user = await requireUser();
  const [stats, t, lang, sp] = await Promise.all([topicStats(user.id), getDict(), getLang(), searchParams]);
  const l = L[lang];
  const blocs = stats.filter((s) => s.kind === "bloc");
  const temes = stats.filter((s) => s.kind === "tema");
  const sel = temes.find((x) => x.id === sp.tema) ?? null;
  const epsOf = (id: string) => stats.filter((s) => s.parentId === id);

  return (
    <div className="space-y-6">
      <div className={sel ? "hidden lg:block" : ""}>
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[36px]">{l.title}</h1>
        <p className="mt-1 max-w-[62ch] text-lg text-ink-2">{l.sub}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-8">
        <nav className={`${sel ? "hidden lg:block" : ""} space-y-6`} aria-label={l.title}>
          {blocs.map((b) => (
            <section key={b.id}>
              <h2 className="mb-2 text-sm font-bold text-ink-2">{b.title}</h2>
              <ul className="space-y-1.5">
                {temes
                  .filter((x) => x.parentId === b.id)
                  .map((x) => (
                    <li key={x.id}>
                      <Link
                        href={`/temari?tema=${x.id}`}
                        aria-current={sel?.id === x.id ? "true" : undefined}
                        className={`flex items-center gap-3 rounded-2xl p-3.5 transition-colors ${sel?.id === x.id ? "bg-glaze text-on-glaze" : "bg-surface hover:bg-glaze-soft"}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[16px] font-bold leading-tight">
                            <span className={sel?.id === x.id ? "text-on-glaze-2" : "text-ink-3"}>{x.id}</span> {x.title}
                          </span>
                          <span className={`block text-[13px] ${sel?.id === x.id ? "text-on-glaze-2" : "text-ink-3"}`}>{l.official(x.officialWeight)}</span>
                          <TemaBar eps={epsOf(x.id)} />
                        </span>
                        <ChevronRight className="size-5 shrink-0 opacity-60" aria-hidden />
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </nav>

        <section className="min-w-0">
          {!sel ? (
            <p className="hidden rounded-2xl border-2 border-dashed border-surface-2 p-8 text-ink-3 lg:block">{l.pick}</p>
          ) : (
            <div className="space-y-5 lg:sticky lg:top-10">
              <Link href="/temari" className="inline-flex min-h-11 items-center gap-2 font-semibold text-glaze lg:hidden">
                <ArrowLeft className="size-5" aria-hidden /> {l.back}
              </Link>
              <div className="rounded-2xl bg-glaze p-5 text-on-glaze sm:p-6">
                <h2 className="text-2xl font-extrabold leading-tight tracking-[-0.02em] sm:text-3xl">
                  <span className="text-on-glaze-2">{sel.id}</span> {sel.title}
                </h2>
                <p className="mt-1 text-[15px] font-semibold text-on-glaze-2">{l.official(sel.officialWeight)}</p>
                <form action={startPractice} className="mt-4">
                  <input type="hidden" name="mode" value="topic" />
                  <input type="hidden" name="topicIds" value={sel.id} />
                  <input type="hidden" name="count" value="20" />
                  <button className="btn-ochre" disabled={sel.available === 0}>
                    <Play className="size-5" aria-hidden /> {l.practiceAll}
                  </button>
                </form>
              </div>
              <ul className="space-y-2">
                {epsOf(sel.id)
                  .sort((a, b) => b.officialWeight - a.officialWeight)
                  .map((e) => (
                    <li key={e.id} id={e.id} className="flex scroll-mt-24 items-center gap-4 rounded-2xl bg-surface p-4">
                      <span className="size-12 shrink-0">
                        <Tile state={e.mastery} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold leading-tight">
                          <span className="text-ink-3">{e.id}</span> {e.title}
                        </span>
                        <span className="text-[14px] text-ink-2">
                          {t.mastery[e.mastery]} · {e.available ? l.qs(e.correctNow, e.available) : l.nothing} · {l.official(e.officialWeight)}
                        </span>
                      </span>
                      {e.available > 0 && (
                        <form action={startPractice}>
                          <input type="hidden" name="mode" value="topic" />
                          <input type="hidden" name="topicIds" value={e.id} />
                          <input type="hidden" name="count" value={String(Math.min(20, Math.max(5, e.available)))} />
                          <button className="btn-quiet px-3 text-sm" aria-label={`${l.practice} ${e.id}`}>
                            <Play className="size-4" aria-hidden /> <span className="hidden sm:inline">{l.practice}</span>
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
