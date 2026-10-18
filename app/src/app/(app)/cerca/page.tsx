import Link from "next/link";
import { BookOpen, HelpCircle, Scale, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { safeSnippet, search, type SearchHit } from "@/lib/search";

const L = {
  ca: {
    title: "Cerca al temari",
    ph: "Paraules clau: p. ex. úlceres pressió Braden, insulina, consentiment informat…",
    hint: "Busca a les fitxes del temari, a les preguntes i a la normativa. Admet \"frase exacta\" i -paraula per excloure.",
    none: (q: string) => `Cap resultat per a «${q}». Prova amb menys paraules o sinònims.`,
    kinds: { note: "Temari", question: "Preguntes", norma: "Normativa" },
    all: "Tot",
    go: "Cercar",
  },
  es: {
    title: "Buscar en el temario",
    ph: "Palabras clave: p. ej. úlceras presión Braden, insulina, consentimiento informado…",
    hint: "Busca en las fichas del temario, en las preguntas y en la normativa (contenido en catalán). Admite \"frase exacta\" y -palabra para excluir.",
    none: (q: string) => `Ningún resultado para «${q}». Prueba con menos palabras o sinónimos (en catalán).`,
    kinds: { note: "Temario", question: "Preguntas", norma: "Normativa" },
    all: "Todo",
    go: "Buscar",
  },
};

const ICON = { note: BookOpen, question: HelpCircle, norma: Scale } as const;

function hrefFor(h: SearchHit) {
  if (h.kind === "note" && h.epigrafId) return `/temari/${h.epigrafId}`;
  if (h.kind === "norma" && h.url) return h.url;
  if (h.epigrafId) return `/temari/${h.epigrafId}`;
  return "/temari";
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; k?: string }> }) {
  await requireUser();
  const [{ q = "", k }, lang] = await Promise.all([searchParams, getLang()]);
  const l = L[lang];
  const kind = k === "note" || k === "question" || k === "norma" ? k : undefined;
  const hits = q ? await search(q, kind) : [];
  const qs = (kk?: string) => `/cerca?q=${encodeURIComponent(q)}${kk ? `&k=${kk}` : ""}`;

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[36px]">{l.title}</h1>
      <form action="/cerca" className="flex gap-2" role="search">
        <label className="relative flex-1">
          <span className="sr-only">{l.title}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={q} placeholder={l.ph} className="field pl-10" autoFocus={!q} />
        </label>
        {kind && <input type="hidden" name="k" value={kind} />}
        <button className="btn-glaze">{l.go}</button>
      </form>
      <p className="text-[15px] text-ink-3">{l.hint}</p>

      {q && (
        <nav className="flex flex-wrap gap-2" aria-label="Filtre">
          {[undefined, "note", "question", "norma"].map((kk) => (
            <Link
              key={kk ?? "all"}
              href={qs(kk)}
              aria-current={kind === kk ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full px-4 text-[15px] font-semibold ${kind === kk ? "bg-glaze text-on-glaze" : "bg-surface-2 text-ink-2"}`}
            >
              {kk ? l.kinds[kk as SearchHit["kind"]] : l.all}
            </Link>
          ))}
        </nav>
      )}

      {q && hits.length === 0 && <p className="rounded-2xl bg-surface p-5 text-ink-2">{l.none(q)}</p>}
      <ul className="space-y-2">
        {hits.map((h) => {
          const Icon = ICON[h.kind];
          const href = hrefFor(h);
          const external = href.startsWith("http");
          return (
            <li key={h.id}>
              <Link
                href={href}
                {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="block rounded-2xl bg-surface p-4 transition-colors hover:bg-glaze-soft"
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-ink-3">
                  <Icon className="size-4" aria-hidden /> {l.kinds[h.kind]}
                  {h.epigrafId && <span>· {h.epigrafId}</span>}
                </p>
                <p className="mt-0.5 font-bold leading-snug">{h.title}</p>
                <p
                  className="mt-1 text-[15px] leading-relaxed text-ink-2 [&_mark]:rounded-sm [&_mark]:bg-ochre-soft [&_mark]:px-0.5 [&_mark]:text-ink"
                  dangerouslySetInnerHTML={{ __html: safeSnippet(h.snippet) }}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
