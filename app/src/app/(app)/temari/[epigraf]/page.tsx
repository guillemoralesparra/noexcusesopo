import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { marked } from "marked";
import { ArrowLeft, ArrowRight, BookMarked, ExternalLink, Play } from "lucide-react";
import { Tile } from "@/components/Tile";
import { getDb } from "@/db";
import { notes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getDict, getLang } from "@/lib/lang";
import { topicStats } from "@/lib/progress";
import { blockIndex, getBlock, PART_LABEL, PARTS, sanitizeHtml } from "@/lib/temari";
import { startPractice } from "../../actions";

const L = {
  ca: {
    back: "Temari",
    contents: "Contingut de l'epígraf",
    note: "Fitxa resum",
    noteHint: "Resum redactat per la plataforma (no és text del temari).",
    keys: "Per recordar",
    practice: "Practicar aquest epígraf",
    empty: "Aquest epígraf encara no té contingut.",
    prev: "Anterior",
    next: "Següent",
    source: "Font",
    words: (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")}k paraules` : `${n} paraules`),
    official: (n: number) => (n === 1 ? "1 pregunta oficial" : `${n} preguntes oficials`),
    lang: "",
  },
  es: {
    back: "Temario",
    contents: "Contenido del epígrafe",
    note: "Ficha resumen",
    noteHint: "Resumen redactado por la plataforma (no es texto del temario).",
    keys: "Para recordar",
    practice: "Practicar este epígrafe",
    empty: "Este epígrafe todavía no tiene contenido.",
    prev: "Anterior",
    next: "Siguiente",
    source: "Fuente",
    words: (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")}k palabras` : `${n} palabras`),
    official: (n: number) => (n === 1 ? "1 pregunta oficial" : `${n} preguntas oficiales`),
    lang: "El texto se muestra en su idioma original (catalán o castellano).",
  },
};

const PROSE =
  "max-w-[72ch] text-[17px] leading-relaxed [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-extrabold [&_h3]:mb-1 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h4]:mb-1 [&_h4]:mt-6 [&_h4]:text-lg [&_h4]:font-bold [&_h5]:mt-5 [&_h5]:font-bold [&_h6]:mt-4 [&_h6]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-surface-2 [&_blockquote]:pl-3 [&_blockquote]:text-ink-2 [&_table]:my-4 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:text-[15px] [&_td]:border-b-2 [&_td]:border-ground [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_th]:bg-surface-2 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_mark]:bg-ochre-soft";

export default async function EpigrafPage({
  params,
  searchParams,
}: {
  params: Promise<{ epigraf: string }>;
  searchParams: Promise<{ b?: string; vista?: string }>;
}) {
  const user = await requireUser();
  const [{ epigraf }, sp] = await Promise.all([params, searchParams]);
  const [stats, t, lang] = await Promise.all([topicStats(user.id), getDict(), getLang()]);
  const ep = stats.find((s) => s.id === epigraf && s.kind === "epigraf");
  if (!ep) notFound();
  const tema = stats.find((s) => s.id === ep.parentId)!;
  const l = L[lang];
  const db = await getDb();
  const [index, [note]] = await Promise.all([blockIndex(epigraf), db.select().from(notes).where(eq(notes.epigrafId, epigraf))]);

  const showNote = sp.vista === "fitxa" || (index.length === 0 && !!note);
  const pos = showNote ? -1 : Math.max(0, index.findIndex((b) => String(b.sort) === sp.b));
  const current = !showNote && index.length > 0 ? await getBlock(epigraf, index[pos].sort) : null;
  const html = current
    ? sanitizeHtml(await marked.parse(current.body, { gfm: true }))
    : showNote && note
      ? await marked.parse(note.body, { gfm: true })
      : "";
  const href = (sort: number) => `/temari/${epigraf}?b=${sort}`;
  const prev = pos > 0 ? index[pos - 1] : null;
  const next = pos >= 0 && pos < index.length - 1 ? index[pos + 1] : null;

  const Index = (
    <nav aria-label={l.contents} className="space-y-4 text-[14px]">
      {PARTS.filter((p) => index.some((b) => b.part === p)).map((p) => (
        <section key={p}>
          <h3 className="mb-1 text-[13px] font-bold uppercase tracking-wide text-ink-3">{PART_LABEL[lang][p]}</h3>
          <ul className="space-y-0.5">
            {index
              .filter((b) => b.part === p)
              .map((b) => (
                <li key={b.id}>
                  <Link
                    href={href(b.sort)}
                    aria-current={current?.id === b.id ? "page" : undefined}
                    className={`block rounded-lg px-2 py-1.5 leading-snug ${current?.id === b.id ? "bg-glaze text-on-glaze" : "hover:bg-glaze-soft"}`}
                  >
                    <span className="font-semibold">{b.title}</span>
                    <span className={`block text-[12px] ${current?.id === b.id ? "text-on-glaze-2" : "text-ink-3"}`}>
                      {b.source} · {l.words(b.words)}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {note && (
        <Link
          href={`/temari/${epigraf}?vista=fitxa`}
          aria-current={showNote ? "page" : undefined}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 font-semibold ${showNote ? "bg-glaze text-on-glaze" : "hover:bg-glaze-soft"}`}
        >
          <BookMarked className="size-4" aria-hidden /> {l.note}
        </Link>
      )}
    </nav>
  );

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <article className="min-w-0">
        <Link href={`/temari?tema=${tema.id}#${ep.id}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-glaze">
          <ArrowLeft className="size-5" aria-hidden /> {l.back} · {tema.id} {tema.title}
        </Link>
        <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[36px]">
          <span className="text-ink-3">{ep.id}</span> {ep.title}
        </h1>
        {l.lang && <p className="mt-2 text-sm text-ink-3">{l.lang}</p>}

        {/* Índex a dalt en pantalles petites; a la dreta en ordinador */}
        {(index.length > 0 || note) && (
          <details className="mt-5 rounded-2xl bg-surface p-4 xl:hidden">
            <summary className="cursor-pointer font-bold">{l.contents}</summary>
            <div className="mt-3">{Index}</div>
          </details>
        )}

        {current && (
          <header className="mt-6 border-b-2 border-surface-2 pb-3">
            <p className="text-sm font-semibold text-ink-3">{PART_LABEL[lang][current.part]}</p>
            <h2 className="text-xl font-extrabold leading-snug">{current.title}</h2>
            <p className="mt-1 text-[14px] text-ink-3">
              {l.source}: {current.source}
              {current.url && (
                <a href={current.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-glaze underline">
                  <ExternalLink className="size-3.5" aria-hidden /> {current.url.replace(/^https?:\/\//, "").split("/")[0]}
                </a>
              )}
            </p>
          </header>
        )}
        {showNote && note && <p className="mt-6 text-[14px] text-ink-3">{l.noteHint}</p>}

        {html ? (
          <div lang={current ? undefined : "ca"} className={`note mt-4 ${PROSE}`} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="mt-6 rounded-2xl bg-surface p-5 text-ink-2">{l.empty}</p>
        )}

        {current && (prev || next) && (
          <nav className="mt-10 flex flex-wrap justify-between gap-3" aria-label={l.contents}>
            {prev ? (
              <Link href={href(prev.sort)} className="btn-quiet max-w-full">
                <ArrowLeft className="size-5 shrink-0" aria-hidden /> <span className="truncate">{l.prev}: {prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={href(next.sort)} className="btn-glaze max-w-full">
                <span className="truncate">{l.next}: {next.title}</span> <ArrowRight className="size-5 shrink-0" aria-hidden />
              </Link>
            )}
          </nav>
        )}
      </article>

      <aside className="space-y-4 xl:sticky xl:top-10 xl:max-h-[calc(100vh-5rem)] xl:self-start xl:overflow-y-auto">
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
        {showNote && note && note.keyPoints.length > 0 && (
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
        {(index.length > 0 || note) && (
          <section className="hidden rounded-2xl bg-surface p-4 xl:block">
            <h2 className="mb-3 font-bold">{l.contents}</h2>
            {Index}
          </section>
        )}
      </aside>
    </div>
  );
}
