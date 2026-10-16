"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import type { Confidence, OptionKey } from "@/db/schema";
import type { AnswerResult, SessionView } from "@/lib/practice";
import { answerAction, finishAction } from "@/app/(app)/actions";
import { useT } from "./LangProvider";
import { CaseText, Explanation, KEYS, Options, QuestionMeta } from "./QuestionCard";
import { SessionTop } from "./SessionTop";

/** Pràctica: una pregunta per pantalla, correcció immediata amb explicació. */
export function PracticeRunner({ view }: { view: SessionView }) {
  const t = useT();
  const firstPending = view.questions.findIndex((q) => !q.result);
  const [idx, setIdx] = useState(firstPending === -1 ? view.questions.length - 1 : firstPending);
  const [results, setResults] = useState<Record<string, AnswerResult>>(
    Object.fromEntries(view.questions.filter((q) => q.result).map((q) => [q.id, q.result!])),
  );
  const [selected, setSelected] = useState<OptionKey[]>([]);
  const [pending, start] = useTransition();
  const shownAt = useRef(Date.now());
  const feedbackRef = useRef<HTMLHeadingElement>(null);

  const q = view.questions[idx];
  const result = results[q.id];
  const answeredAll = Object.keys(results).length === view.questions.length;
  const ready = selected.length === q.required;

  useEffect(() => {
    shownAt.current = Date.now();
    setSelected([]);
    window.scrollTo({ top: 0 });
  }, [idx]);

  useEffect(() => {
    if (result) feedbackRef.current?.focus();
  }, [result]);

  const toggle = useCallback(
    (k: OptionKey) => setSelected((s) => (q.required === 1 ? [k] : s.includes(k) ? s.filter((x) => x !== k) : [...s, k])),
    [q.required],
  );

  const submit = useCallback(
    (confidence: Confidence | null, blank = false) =>
      start(async () => {
        const r = await answerAction({
          sessionId: view.id,
          questionId: q.id,
          selected: blank ? [] : selected,
          confidence: blank ? null : confidence,
          timeMs: Date.now() - shownAt.current,
        });
        if ("outcome" in r) setResults((m) => ({ ...m, [q.id]: r }));
      }),
    [q.id, selected, view.id],
  );

  const next = useCallback(() => {
    if (answeredAll || idx === view.questions.length - 1) start(() => finishAction(view.id));
    else setIdx((i) => i + 1);
  }, [answeredAll, idx, view.id, view.questions.length]);

  // Teclat: 1-4 / A-D tria · Q W E comprova · Intro continua
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (!result) {
        const n = "1234".indexOf(k);
        const letter = n >= 0 ? KEYS[n] : (KEYS as string[]).includes(k) ? (k as OptionKey) : null;
        if (letter && q.options[letter]) toggle(letter);
        else if (ready && !pending && (k === "q" || k === "w" || k === "e")) submit(k === "q" ? "sure" : k === "w" ? "doubt" : "guess");
      } else if (e.key === "Enter" && !pending) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, ready, pending, q.options, toggle, submit, next]);

  const outcome = result?.outcome;
  const title = !result
    ? ""
    : outcome === "correct"
      ? result.confidence === "guess"
        ? t.fb.correctGuess
        : result.confidence === "doubt"
          ? t.fb.correctDoubt
          : t.fb.correct
      : outcome === "blank"
        ? t.fb.blank
        : result.confidence === "sure"
          ? t.fb.wrongSure
          : t.fb.wrong;
  const answerLetters = result?.accepted.map((l) => l.toUpperCase()).join(", ");

  return (
    <div className="pb-48 lg:pb-32">
      <SessionTop
        title={view.title}
        current={idx}
        outcomes={view.questions.map((x) => results[x.id]?.outcome ?? "pending")}
        onJump={(i) => (results[view.questions[i].id] || i <= Object.keys(results).length ? setIdx(i) : undefined)}
      />

      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-4 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10 lg:px-10 lg:pt-8">
        <section className="min-w-0 space-y-5" key={q.id}>
          {q.caseId && view.cases[q.caseId] && <CaseText
              key={q.id}
              {...view.cases[q.caseId]}
              upTo={q.number}
              open={idx === 0 || view.questions[idx - 1].caseId !== q.caseId || view.cases[q.caseId].segments.some((s) => s.from_question === q.number)}
            />}
          <h1 className="max-w-[62ch] text-[20px] font-bold leading-snug tracking-[-0.01em] sm:text-[22px]">{q.stem}</h1>
          {q.required > 1 && !result && <p className="text-[15px] font-semibold text-glaze">{t.q.pickN(q.required)}</p>}
          <Options q={q} selected={selected} onToggle={result ? undefined : toggle} result={result} />
          <QuestionMeta q={q} />
        </section>

        {/* Correcció: panell lateral a escriptori, sota la pregunta a mòbil/tauleta */}
        <aside className={`${result ? "block" : "hidden lg:block"} min-w-0`} aria-live="polite">
          {result ? (
            <div className="panel space-y-4 p-5 animate-[rise_240ms_var(--ease-out-expo)_both]">
              <div className="flex items-start gap-3">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    outcome === "correct" ? "bg-glaze text-on-glaze" : outcome === "blank" ? "bg-surface-2 text-ink-2" : "bg-brick text-on-brick"
                  }`}
                >
                  {outcome === "correct" ? <Check className="size-6" strokeWidth={3} aria-hidden /> : <X className="size-6" strokeWidth={3} aria-hidden />}
                </span>
                <div>
                  <h2 ref={feedbackRef} tabIndex={-1} className={`text-lg font-extrabold leading-tight outline-none ${outcome === "correct" ? "text-glaze-deep" : outcome === "blank" ? "text-ink" : "text-brick"}`}>
                    {title}
                  </h2>
                  {outcome !== "correct" && answerLetters && <p className="font-semibold text-ink-2">{t.fb.answerIs(answerLetters)}</p>}
                </div>
              </div>
              <Explanation q={q} result={result} />
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-surface-2 p-5 text-[15px] text-ink-3">
              <p className="font-semibold text-ink-2">{q.epigrafId} · {q.epigrafTitle}</p>
              <p className="mt-2">{t.q.keys}</p>
            </div>
          )}
        </aside>
      </div>

      {/* Barra d'acció fixa (zona del polze) */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t-2 pb-[env(safe-area-inset-bottom)] ${
          !result ? "border-surface-2 bg-surface" : outcome === "correct" ? "border-glaze bg-glaze-soft" : outcome === "blank" ? "border-surface-2 bg-surface" : "border-brick bg-brick-soft"
        }`}
      >
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:px-10">
          {!result ? (
            <>
              <p className="text-sm font-semibold text-ink-2 lg:mr-auto">{ready ? t.q.howSure : t.q.pickFirst}</p>
              <div className="grid grid-cols-3 gap-2 lg:flex">
                {(
                  [
                    ["sure", t.q.sure, "Q"],
                    ["doubt", t.q.doubt, "W"],
                    ["guess", t.q.guess, "E"],
                  ] as const
                ).map(([c, label, key]) => (
                  <button key={c} type="button" className="btn-glaze px-3 lg:min-w-32" disabled={!ready || pending} onClick={() => submit(c)}>
                    {label}
                    <kbd className="hidden text-xs font-semibold opacity-70 lg:inline">{key}</kbd>
                  </button>
                ))}
              </div>
              <button type="button" className="min-h-11 text-sm font-bold text-ink-2 underline-offset-4 hover:underline lg:ml-2" disabled={pending} onClick={() => submit(null, true)}>
                {t.q.blank}
              </button>
            </>
          ) : (
            <button type="button" className={`${outcome === "correct" ? "btn-glaze" : "btn-quiet"} w-full lg:ml-auto lg:w-auto lg:min-w-48`} disabled={pending} onClick={next}>
              {answeredAll || idx === view.questions.length - 1 ? t.q.finish : t.q.next}
              <ArrowRight className="size-5" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
