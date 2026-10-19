import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { FUDEN_KIND, fudenPage, highlight } from "@/lib/fuden";
import { getLang } from "@/lib/lang";

const L = {
  ca: {
    back: "Tornar a la cerca",
    page: (p: number, n: number) => `Pàgina ${p} de ${n}`,
    prev: "Anterior",
    next: "Següent",
    original: "Obrir el PDF original a FUDEN",
    originalHint: "Cal tenir la sessió de FUDEN oberta. Aquí es mostra el text extret: les taules i els esquemes es veuen millor a l'original.",
    empty: "Aquesta pàgina no té text (sol ser una imatge o una portada).",
    contents: "Apartats",
    notice: "Material de FUDEN · còpia privada per a l'alumnat de FUDEN. No el comparteixis.",
  },
  es: {
    back: "Volver a la búsqueda",
    page: (p: number, n: number) => `Página ${p} de ${n}`,
    prev: "Anterior",
    next: "Siguiente",
    original: "Abrir el PDF original en FUDEN",
    originalHint: "Hay que tener la sesión de FUDEN abierta. Aquí se muestra el texto extraído: las tablas y los esquemas se ven mejor en el original.",
    empty: "Esta página no tiene texto (suele ser una imagen o una portada).",
    contents: "Apartados",
    notice: "Material de FUDEN · copia privada para el alumnado de FUDEN. No lo compartas.",
  },
};

export default async function FudenReader({
  params,
  searchParams,
}: {
  params: Promise<{ doc: string }>;
  searchParams: Promise<{ p?: string; q?: string }>;
}) {
  const user = await requireUser();
  if (!user.fudenAccess) notFound();
  const [{ doc: docParam }, { p = "1", q = "" }, lang] = await Promise.all([params, searchParams, getLang()]);
  const l = L[lang];
  const docId = Number(docParam);
  const res = Number.isInteger(docId) ? await fudenPage(docId, Math.max(1, Number(p) || 1)) : null;
  if (!res) notFound();
  const { doc, text } = res;
  const page = Math.min(Math.max(1, Number(p) || 1), Math.max(1, doc.pages));
  const href = (n: number) => `/fuden/${doc.id}?p=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  const pager = (
    <nav className="flex items-center justify-between gap-2" aria-label={l.page(page, doc.pages)}>
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn-quiet min-h-11 px-4">
          <ChevronLeft className="size-5" aria-hidden /> {l.prev}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-[15px] font-semibold text-ink-2">{l.page(page, doc.pages)}</span>
      {page < doc.pages ? (
        <Link href={href(page + 1)} className="btn-quiet min-h-11 px-4">
          {l.next} <ChevronRight className="size-5" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
      <article className="min-w-0 space-y-4">
        <Link href={q ? `/cerca?q=${encodeURIComponent(q)}&k=fuden` : "/cerca"} className="inline-flex min-h-11 items-center gap-2 font-semibold text-glaze">
          <ArrowLeft className="size-5" aria-hidden /> {l.back}
        </Link>
        <header>
          <p className="text-sm font-semibold text-ink-3">
            FUDEN · {FUDEN_KIND[lang][doc.kind]} · {doc.section}
          </p>
          <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[32px]">{doc.title}</h1>
          {doc.summary && <p className="mt-2 max-w-[68ch] text-ink-2">{doc.summary}</p>}
        </header>
        {pager}
        {text ? (
          <div
            className="max-w-[80ch] whitespace-pre-wrap rounded-2xl bg-surface p-5 text-[16px] leading-relaxed [&_mark]:rounded-sm [&_mark]:bg-ochre-soft [&_mark]:px-0.5 [&_mark]:text-ink"
            dangerouslySetInnerHTML={{ __html: highlight(text, q) }}
          />
        ) : (
          <p className="rounded-2xl bg-surface p-5 text-ink-2">{l.empty}</p>
        )}
        {pager}
        <p className="text-[13px] text-ink-3">{l.notice}</p>
      </article>

      <aside className="space-y-4 xl:sticky xl:top-10 xl:self-start">
        {doc.moodleUrl && (
          <div className="rounded-2xl bg-surface p-5">
            <a href={doc.moodleUrl} target="_blank" rel="noreferrer" className="btn-glaze w-full">
              <ExternalLink className="size-5" aria-hidden /> {l.original}
            </a>
            <p className="mt-2 text-[14px] text-ink-3">{l.originalHint}</p>
          </div>
        )}
        {doc.sections.length > 0 && (
          <section className="rounded-2xl bg-surface p-5">
            <h2 className="mb-2 font-bold">{l.contents}</h2>
            <ul className="space-y-1 text-[14px]">
              {doc.sections.map((s) => {
                const first = Number(s.pages.split(/[-,]/)[0]) || 1;
                return (
                  <li key={`${s.label}-${s.pages}`}>
                    <Link href={href(first)} className="flex gap-2 rounded-lg px-1 py-1 hover:bg-glaze-soft">
                      <span className="min-w-0 flex-1">{s.label}</span>
                      <span className="shrink-0 text-ink-3">p. {s.pages}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
