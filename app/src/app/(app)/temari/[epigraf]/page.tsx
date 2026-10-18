import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { marked } from "marked";
import { ArrowLeft, BookMarked, Play, Scale } from "lucide-react";
import { Tile } from "@/components/Tile";
import { getDb } from "@/db";
import { notes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getDict, getLang } from "@/lib/lang";
import { topicStats } from "@/lib/progress";
import { startPractice } from "../../actions";

const L = {
  ca: { back: "Temari", keys: "Per recordar", sources: "Fonts", practice: "Practicar aquest epígraf", none: "La fitxa d'aquest epígraf encara s'està preparant.", official: (n: number) => (n === 1 ? "1 pregunta oficial" : `${n} preguntes oficials`), own: "Fitxa redactada per la plataforma a partir de fonts públiques i dels exàmens oficials; no revisada per una infermera.", lang: "", flags: (n: number) => (n === 1 ? "1 punt pendent de verificar" : `${n} punts pendents de verificar`) },
  es: { back: "Temario", keys: "Para recordar", sources: "Fuentes", practice: "Practicar este epígrafe", none: "La ficha de este epígrafe aún se está preparando.", official: (n: number) => (n === 1 ? "1 pregunta oficial" : `${n} preguntas oficiales`), own: "Ficha redactada por la plataforma a partir de fuentes públicas y de los exámenes oficiales; no revisada por una enfermera.", lang: "Contenido en catalán, el idioma del examen.", flags: (n: number) => (n === 1 ? "1 punto pendiente de verificar" : `${n} puntos pendientes de verificar`) },
};

export default async function NotePage({ params }: { params: Promise<{ epigraf: string }> }) {
  const user = await requireUser();
  const { epigraf } = await params;
  const [stats, t, lang] = await Promise.all([topicStats(user.id), getDict(), getLang()]);
  const ep = stats.find((s) => s.id === epigraf && s.kind === "epigraf");
  if (!ep) notFound();
  const tema = stats.find((s) => s.id === ep.parentId)!;
  const db = await getDb();
  const [note] = await db.select().from(notes).where(eq(notes.epigrafId, epigraf));
  const l = L[lang];
  const html = note ? await marked.parse(note.body, { gfm: true }) : "";

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <article className="min-w-0">
        <Link href={`/temari?tema=${tema.id}#${ep.id}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-glaze">
          <ArrowLeft className="size-5" aria-hidden /> {l.back} · {tema.id} {tema.title}
        </Link>
        <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[36px]">
          <span className="text-ink-3">{ep.id}</span> {ep.title}
        </h1>
        {l.lang && <p className="mt-2 text-sm text-ink-3">{l.lang}</p>}
        {!note ? (
          <p className="mt-6 rounded-2xl bg-surface p-5 text-ink-2">{l.none}</p>
        ) : (
          <div
            lang="ca"
            className="note mt-6 max-w-[68ch] text-[17px] leading-relaxed [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:tracking-[-0.01em] [&_h3]:mb-1 [&_h3]:mt-5 [&_h3]:font-bold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_strong]:font-bold [&_table]:my-4 [&_table]:w-full [&_table]:text-[15px] [&_td]:border-b-2 [&_td]:border-ground [&_td]:px-2 [&_td]:py-1.5 [&_th]:bg-surface-2 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
        {note && note.reviewFlags.length > 0 && (
          <details className="mt-8 rounded-2xl bg-ochre-soft p-5 text-[15px]">
            <summary className="cursor-pointer font-bold">{l.flags(note.reviewFlags.length)}</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
              {note.reviewFlags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </details>
        )}
        {note && <p className="mt-6 text-[13px] text-ink-3">{l.own}</p>}
      </article>

      <aside className="space-y-4 xl:sticky xl:top-10 xl:self-start">
        <div className="flex items-center gap-4 rounded-2xl bg-surface p-4">
          <span className="size-14 shrink-0">
            <Tile state={ep.mastery} />
          </span>
          <div className="text-[15px] leading-tight">
            <p className="font-bold">{t.mastery[ep.mastery]}</p>
            <p className="text-ink-2">
              {ep.correctNow}/{ep.available} · {l.official(ep.officialWeight)}
            </p>
          </div>
        </div>
        {ep.available > 0 && (
          <form action={startPractice}>
            <input type="hidden" name="mode" value="topic" />
            <input type="hidden" name="topicIds" value={ep.id} />
            <input type="hidden" name="count" value={String(Math.min(20, Math.max(5, ep.available)))} />
            <button className="btn-glaze w-full">
              <Play className="size-5" aria-hidden /> {l.practice}
            </button>
          </form>
        )}
        {note && note.keyPoints.length > 0 && (
          <section className="rounded-2xl bg-glaze-soft p-5">
            <h2 className="mb-2 flex items-center gap-2 font-bold text-glaze-deep">
              <BookMarked className="size-4" aria-hidden /> {l.keys}
            </h2>
            <ul className="space-y-2 text-[15px] font-semibold">
              {note.keyPoints.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </section>
        )}
        {note && note.sources.length > 0 && (
          <section className="rounded-2xl bg-surface p-5">
            <h2 className="mb-2 font-bold">{l.sources}</h2>
            <ul className="space-y-1.5 text-[14px]">
              {note.sources.map((s) => (
                <li key={s.label} className="flex gap-2">
                  <Scale className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-glaze underline">
                      {s.label}
                    </a>
                  ) : (
                    <span>{s.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
