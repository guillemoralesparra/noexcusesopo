"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Eye, EyeOff, Grid3x3, X } from "lucide-react";
import type { Confidence, OptionKey } from "@/db/schema";
import type { SessionView } from "@/lib/practice";
import { answerAction, finishAction } from "@/app/(app)/actions";
import { useT } from "./LangProvider";
import { CaseText, KEYS, Options } from "./QuestionCard";
import { SessionTop } from "./SessionTop";

type Draft = { selected: OptionKey[]; confidence: Confidence | null };
type Filter = "all" | "blank" | "flagged";

const LABELS = {
  ca: { sheet: "Full de respostes", all: "Totes", blank: "En blanc", flagged: "Marcades", flag: "Marcar", prev: "Anterior", next: "Següent", deliver: "Lliurar", hide: "Amagar temps", show: "Mostrar temps", penalty: "Penalització", none: "cap", confirmBlank: (n: number) => `Tens ${n} preguntes en blanc. Vols lliurar igualment?`, confirm: "Vols lliurar l'examen?", answered: (n: number, t: number) => `${n} de ${t} respostes`, sure: "Seguretat (opcional)", close: "Tancar", gaps: "Del 101 endavant, supòsits pràctics. Les preguntes anul·lades pel tribunal no hi són." },
  es: { sheet: "Hoja de respuestas", all: "Todas", blank: "En blanco", flagged: "Marcadas", flag: "Marcar", prev: "Anterior", next: "Siguiente", deliver: "Entregar", hide: "Ocultar tiempo", show: "Mostrar tiempo", penalty: "Penalización", none: "ninguna", confirmBlank: (n: number) => `Tienes ${n} preguntas en blanco. ¿Entregar igualmente?`, confirm: "¿Entregar el examen?", answered: (n: number, t: number) => `${n} de ${t} respuestas`, sure: "Seguridad (opcional)", close: "Cerrar", gaps: "Del 101 en adelante, supuestos prácticos. Las preguntas anuladas por el tribunal no están." },
};

function clock(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Simulacre: format oficial, sense correcció fins a lliurar. */
export function ExamRunner({ view }: { view: SessionView }) {
  const t = useT();
  const L = LABELS[t.lang === "Castellano" ? "ca" : "es"];
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(Object.fromEntries(view.questions.filter((q) => q.draft).map((q) => [q.id, q.draft!])));
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [hideTime, setHideTime] = useState(false);
  const [pending, start] = useTransition();
  const shownAt = useRef(Date.now());
  const deadline = useMemo(() => (view.timeLimitS ? new Date(view.startedAt).getTime() + view.timeLimitS * 1000 : null), [view.startedAt, view.timeLimitS]);
  const [now, setNow] = useState(() => Date.now());

  const finish = useCallback(() => start(() => finishAction(view.id)), [view.id]);
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  const remaining = deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : null;
  useEffect(() => {
    if (remaining === 0) finish();
  }, [remaining, finish]);
  useEffect(() => {
    shownAt.current = Date.now();
    window.scrollTo({ top: 0 });
  }, [idx]);

  const q = view.questions[idx];
  const draft = useMemo<Draft>(() => drafts[q.id] ?? { selected: [], confidence: null }, [drafts, q.id]);
  const answered = view.questions.filter((x) => (drafts[x.id]?.selected.length ?? 0) > 0).length;

  const save = useCallback(
    (qid: string, next: Draft) => {
      setDrafts((d) => ({ ...d, [qid]: next }));
      start(async () => {
        await answerAction({ sessionId: view.id, questionId: qid, ...next, timeMs: Date.now() - shownAt.current });
      });
    },
    [view.id],
  );
  const toggle = useCallback(
    (k: OptionKey) => {
      const sel = q.required === 1 ? (draft.selected[0] === k ? [] : [k]) : draft.selected.includes(k) ? draft.selected.filter((x) => x !== k) : [...draft.selected, k];
      save(q.id, { ...draft, selected: sel });
    },
    [q, draft, save],
  );
  const toggleFlag = useCallback(() => setFlags((f) => { const n = new Set(f); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; }), [q.id]);
  const confirmFinish = () => {
    const blanks = view.questions.length - answered;
    if (window.confirm(blanks > 0 ? L.confirmBlank(blanks) : L.confirm)) finish();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      const n = "1234".indexOf(k);
      const letter = n >= 0 ? KEYS[n] : (KEYS as string[]).includes(k) ? (k as OptionKey) : null;
      if (letter && q.options[letter]) toggle(letter);
      else if (e.key === "ArrowRight") setIdx((i) => Math.min(view.questions.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      else if (k === "m") toggleFlag();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q.options, toggle, toggleFlag, view.questions.length]);

  const shown = view.questions
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => filter === "all" || (filter === "blank" ? !(drafts[x.id]?.selected.length) : flags.has(x.id)));

  const sheet = (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-ground p-1 text-sm font-semibold" role="tablist">
        {(["all", "blank", "flagged"] as const).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`min-h-9 flex-1 rounded-lg ${filter === f ? "bg-surface text-ink" : "text-ink-3"}`}>
            {L[f]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
        {shown.map(({ x, i }) => {
          const done = (drafts[x.id]?.selected.length ?? 0) > 0;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => { setIdx(i); setSheetOpen(false); }}
              className={`tabular relative h-11 rounded-lg text-sm font-bold ${done ? "bg-glaze-mid text-on-glaze" : "bg-ground text-ink-2"} ${i === idx ? "outline-2 outline-offset-1 outline-ink" : ""}`}
            >
              {x.caseId ? x.number : i + 1}
              {flags.has(x.id) && <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-ochre" />}
            </button>
          );
        })}
      </div>
      {view.questions.some((x) => x.caseId) && <p className="text-[13px] leading-snug text-ink-3">{L.gaps}</p>}
      <button type="button" className="btn-glaze w-full" disabled={pending} onClick={confirmFinish}>
        {L.deliver}
      </button>
    </div>
  );

  return (
    <div className="pb-32">
      <SessionTop
        title={view.title}
        current={idx}
        outcomes={view.questions.map((x) => ((drafts[x.id]?.selected.length ?? 0) > 0 ? "answered" : "pending"))}
        onJump={setIdx}
        right={
          remaining !== null ? (
            <span className="flex items-center gap-1">
              <span className={`text-base ${remaining < 600 ? "text-ochre-ink" : "text-ink"}`}>{hideTime ? "··:··" : clock(remaining)}</span>
              <button type="button" onClick={() => setHideTime((h) => !h)} className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-2" aria-label={hideTime ? L.show : L.hide}>
                {hideTime ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
              </button>
            </span>
          ) : undefined
        }
      />

      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-4 pt-4 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 lg:px-10 lg:pt-8">
        <aside className="hidden lg:block">
          <div className="panel sticky top-24 max-h-[calc(100dvh-12rem)] space-y-3 overflow-y-auto p-4">
            <p className="text-sm font-bold">{L.sheet}</p>
            <p className="tabular text-sm text-ink-2">
              {L.answered(answered, view.questions.length)} · {L.penalty}: {view.penalty === 0 ? L.none : `−${view.penalty === 0.33 ? "1/3" : view.penalty === 0.25 ? "1/4" : view.penalty}`}
            </p>
            {sheet}
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          {q.caseId && view.cases[q.caseId] && <CaseText
              key={q.id}
              {...view.cases[q.caseId]}
              upTo={q.number}
              open={idx === 0 || view.questions[idx - 1].caseId !== q.caseId || view.cases[q.caseId].segments.some((s) => s.from_question === q.number)}
            />}
          <h1 className="max-w-[62ch] text-[20px] font-bold leading-snug sm:text-[22px]">{q.stem}</h1>
          {q.required > 1 && <p className="text-[15px] font-semibold text-glaze">{t.q.pickN(q.required)}</p>}
          <Options q={q} selected={draft.selected} onToggle={toggle} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-3">{L.sure}:</span>
            {(
              [
                ["sure", t.q.sure],
                ["doubt", t.q.doubt],
                ["guess", t.q.guess],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                disabled={draft.selected.length === 0}
                onClick={() => save(q.id, { ...draft, confidence: draft.confidence === v ? null : v })}
                aria-pressed={draft.confidence === v}
                className={`min-h-9 rounded-full px-3 font-semibold disabled:opacity-40 ${draft.confidence === v ? "bg-glaze text-on-glaze" : "bg-surface-2 text-ink-2"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Full de respostes a mòbil/tauleta */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setSheetOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-bold">{L.sheet} · {L.answered(answered, view.questions.length)}</p>
              <button type="button" className="grid size-11 place-items-center" onClick={() => setSheetOpen(false)} aria-label={L.close}>
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {sheet}
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-surface-2 bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-4 py-3 sm:px-6 lg:px-10">
          <button type="button" className="btn-quiet px-3" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label={L.prev}>
            <ArrowLeft className="size-5" aria-hidden /> <span className="hidden sm:inline">{L.prev}</span>
          </button>
          <button type="button" className={`btn-quiet px-3 ${flags.has(q.id) ? "text-ochre-ink" : ""}`} onClick={toggleFlag} aria-pressed={flags.has(q.id)}>
            <Bookmark className="size-5" fill={flags.has(q.id) ? "currentColor" : "none"} aria-hidden /> <span className="hidden sm:inline">{L.flag}</span>
          </button>
          <button type="button" className="btn-quiet px-3 lg:hidden" onClick={() => setSheetOpen(true)} aria-label={L.sheet}>
            <Grid3x3 className="size-5" aria-hidden />
          </button>
          <div className="ml-auto flex gap-2">
            {idx < view.questions.length - 1 ? (
              <button type="button" className="btn-glaze" onClick={() => setIdx(idx + 1)}>
                {L.next} <ArrowRight className="size-5" aria-hidden />
              </button>
            ) : (
              <button type="button" className="btn-glaze" disabled={pending} onClick={confirmFinish}>
                {L.deliver}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
