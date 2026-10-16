"use client";

import { Check, ChevronDown, Minus, X } from "lucide-react";
import type { ClientQuestion, SessionView } from "@/lib/practice";
import { CaseText, Explanation, Options, QuestionMeta } from "./QuestionCard";

/** Revisió pregunta a pregunta amb la mateixa correcció que a la pràctica. */
export function ReviewList({ view, questions }: { view: SessionView; questions: ClientQuestion[] }) {
  return (
    <ul className="space-y-2">
      {questions.map((q) => {
        const o = q.result?.outcome;
        return (
          <li key={q.id}>
            <details className="group rounded-2xl bg-surface">
              <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                <span
                  className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                    o === "correct" ? "bg-glaze text-on-glaze" : o === "wrong" ? "bg-brick text-on-brick" : "bg-surface-2 text-ink-2"
                  }`}
                >
                  {o === "correct" ? <Check className="size-4" strokeWidth={3} aria-hidden /> : o === "wrong" ? <X className="size-4" strokeWidth={3} aria-hidden /> : <Minus className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1 text-[16px] leading-snug">
                  <span className="mr-2 text-ink-3">{view.questions.indexOf(q) + 1}.</span>
                  {q.stem}
                </span>
                <ChevronDown className="mt-1 size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="space-y-4 border-t-2 border-ground p-4">
                {q.caseId && view.cases[q.caseId] && <CaseText {...view.cases[q.caseId]} upTo="all" />}
                <QuestionMeta q={q} />
                {q.result && <Options q={q} selected={[]} result={q.result} />}
                {q.result && <Explanation q={q} result={q.result} />}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
