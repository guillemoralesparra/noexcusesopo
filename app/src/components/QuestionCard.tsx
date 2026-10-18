"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, BookMarked, Check, ChevronDown, Flag, Scale, X } from "lucide-react";
import type { CaseSegment, OptionKey } from "@/db/schema";
import type { AnswerResult, ClientQuestion } from "@/lib/practice";
import { reportAction } from "@/app/(app)/actions";
import { useT } from "./LangProvider";

export const KEYS: OptionKey[] = ["a", "b", "c", "d", "e"];

/**
 * Enunciat del supòsit. Durant la sessió només es mostra la narració fins a la pregunta actual,
 * com a l'examen imprès; a la revisió (`upTo` = "all") es mostra sencera.
 */
export function CaseText({ title, segments, upTo, open = true }: { title: string; segments: CaseSegment[]; upTo: number | null | "all"; open?: boolean }) {
  const t = useT();
  const visible = segments.filter((s) => {
    if (upTo === "all" || s.from_question === null) return true;
    if (s.from_question === "end" || upTo === null) return false;
    return s.from_question <= upTo;
  });
  return (
    <details open={open} className="group rounded-2xl bg-surface-2/70 px-5 py-4">
      <summary className="flex min-h-6 cursor-pointer list-none items-center gap-2 text-sm font-bold text-ink-2 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        {t.q.case} · {title.split("(")[0].trim()}
      </summary>
      <div className="mt-3 max-w-[68ch] space-y-3 text-[16px] leading-relaxed text-ink">
        {visible.map((s, i) => (
          <p key={i} className="whitespace-pre-line">
            {s.text}
          </p>
        ))}
      </div>
    </details>
  );
}

/** Opcions de resposta: targetes grans; amb `result` mostren la correcció. */
export function Options({
  q,
  selected,
  onToggle,
  result,
}: {
  q: ClientQuestion;
  selected: OptionKey[];
  onToggle?: (k: OptionKey) => void;
  result?: AnswerResult;
}) {
  const multi = q.required > 1;
  return (
    <ul className="space-y-2.5" role={multi ? "group" : "radiogroup"}>
      {KEYS.filter((k) => q.options[k]).map((k, i) => {
        const isSel = (result?.selected ?? selected).includes(k);
        const isOk = !!result?.accepted.includes(k);
        let tone = "border-surface-2 bg-surface hover:border-glaze-mid";
        let letter = "bg-ground text-ink-2";
        if (result) {
          if (isOk) {
            tone = "border-glaze bg-glaze-soft";
            letter = "bg-glaze text-on-glaze";
          } else if (isSel) {
            tone = "border-brick bg-brick-soft";
            letter = "bg-brick text-on-brick";
          } else tone = "border-surface-2 bg-surface opacity-75";
        } else if (isSel) {
          tone = "border-glaze bg-glaze-soft";
          letter = "bg-glaze text-on-glaze";
        }
        return (
          <li key={k}>
            <button
              type="button"
              role={multi ? "checkbox" : "radio"}
              aria-checked={isSel}
              disabled={!!result || !onToggle}
              onClick={() => onToggle?.(k)}
              className={`flex w-full items-start gap-3 rounded-2xl border-2 border-b-4 px-4 py-3.5 text-left text-[17px] leading-snug transition-colors duration-100 disabled:cursor-default ${tone}`}
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-[15px] font-extrabold uppercase ${letter}`}>
                {result && isOk ? <Check className="size-5" strokeWidth={3} aria-hidden /> : result && isSel ? <X className="size-5" strokeWidth={3} aria-hidden /> : k}
              </span>
              <span className="min-w-0 flex-1 pt-1">{q.options[k]}</span>
              {!result && onToggle && <kbd className="hidden pt-1.5 text-xs font-semibold text-ink-3 lg:block">{i + 1}</kbd>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function QuestionMeta({ q }: { q: ClientQuestion }) {
  return (
    <p className="text-sm text-ink-3">
      <span className="font-semibold text-ink-2">{q.epigrafId}</span> {q.epigrafTitle.split(":")[0]} · {q.source}
    </p>
  );
}

/** Explicació completa d'una pregunta ja corregida. */
export function Explanation({ q, result }: { q: ClientQuestion; result: AnswerResult }) {
  const t = useT();
  const ex = result.explanation;
  const accepted = new Set(result.accepted);
  return (
    <div className="space-y-5 text-[16px] leading-relaxed">
      {(ex?.status === "disputed" || q.currency === "check") && (
        <div className="flex gap-3 rounded-xl bg-ochre-soft p-4 text-[15px]">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-ochre-ink" aria-hidden />
          <div className="space-y-1">
            <p className="font-bold">{ex?.status === "disputed" ? t.fb.disputed : t.fb.outdated}</p>
            {ex?.notes.map((n) => (
              <p key={n} className="text-ink-2">
                {n}
              </p>
            ))}
            {!ex?.notes.length && q.currencyReason && <p className="text-ink-2">{q.currencyReason}</p>}
          </div>
        </div>
      )}
      {!ex ? (
        <p className="text-ink-2">{t.fb.noExplanation}</p>
      ) : (
        <>
          <section>
            <h3 className="mb-1 text-sm font-bold text-ink-2">{t.fb.why}</h3>
            <p className="max-w-[62ch]">{ex.summary}</p>
          </section>
          {ex.keyPoint && (
            <section className="rounded-xl bg-glaze-soft p-4">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-glaze-deep">
                <BookMarked className="size-4" aria-hidden /> {t.fb.remember}
              </h3>
              <p className="max-w-[62ch] font-semibold">{ex.keyPoint}</p>
            </section>
          )}
          <section>
            <h3 className="mb-2 text-sm font-bold text-ink-2">{t.fb.others}</h3>
            <ul className="space-y-2">
              {KEYS.filter((k) => ex.options[k]).map((k) => (
                <li key={k} className="flex gap-3">
                  <span
                    className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-xs font-extrabold uppercase ${
                      accepted.has(k) ? "bg-glaze text-on-glaze" : "bg-surface-2 text-ink-2"
                    }`}
                  >
                    {k}
                  </span>
                  <p className="max-w-[62ch] text-[15px] text-ink-2">{ex.options[k]}</p>
                </li>
              ))}
            </ul>
          </section>
          {ex.sources.length > 0 && (
            <section>
              <h3 className="mb-1 text-sm font-bold text-ink-2">{t.fb.sources}</h3>
              <ul className="space-y-1 text-[15px]">
                {ex.sources.map((s) => (
                  <li key={s.label} className="flex items-start gap-2">
                    <Scale className="mt-1 size-4 shrink-0 text-ink-3" aria-hidden />
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
          <p className="text-[13px] text-ink-3">{t.fb.generated}</p>
        </>
      )}
      <ReportLink questionId={q.id} />
    </div>
  );
}

export function ReportLink({ questionId }: { questionId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (sent) return <p className="text-sm text-ink-3">{t.fb.thanks}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-3 hover:text-ink">
        <Flag className="size-4" aria-hidden /> {t.fb.report}
      </button>
    );
  return (
    <div className="space-y-2">
      <textarea className="field min-h-20 py-2 text-[15px]" placeholder={t.fb.reportPh} value={msg} onChange={(e) => setMsg(e.target.value)} />
      <button
        type="button"
        className="btn-quiet text-sm"
        disabled={pending || !msg.trim()}
        onClick={() =>
          start(async () => {
            await reportAction(questionId, msg);
            setSent(true);
          })
        }
      >
        {t.fb.send}
      </button>
    </div>
  );
}
