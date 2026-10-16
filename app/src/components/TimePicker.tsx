"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { SuggestionPreview } from "@/lib/practice";
import { startSuggested } from "@/app/(app)/actions";
import { useT } from "./LangProvider";

/** Tria de temps: un sol control que recompon en viu la sessió proposada. */
export function TimePicker({ previews, firstTime }: { previews: Record<string, SuggestionPreview>; firstTime: boolean }) {
  const t = useT();
  const [minutes, setMinutes] = useState("25");
  const p = previews[minutes];
  return (
    <form action={startSuggested} className="space-y-4">
      <fieldset>
        <legend className="sr-only">{t.home.sub}</legend>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {t.home.times.map((o) => {
            const on = o.minutes === minutes;
            return (
              <label
                key={o.minutes}
                className={`group relative flex min-h-24 cursor-pointer flex-col justify-between rounded-2xl border-b-4 p-3 transition-colors sm:min-h-28 sm:p-4 ${
                  on ? "border-glaze-edge bg-glaze text-on-glaze" : "border-surface-2 bg-surface text-ink hover:bg-glaze-soft"
                }`}
              >
                <input
                  type="radio"
                  name="minutes"
                  value={o.minutes}
                  checked={on}
                  onChange={() => setMinutes(o.minutes)}
                  className="peer sr-only"
                />
                <span className="text-2xl font-extrabold leading-none tracking-[-0.03em] sm:text-[32px]">{o.label}</span>
                <span className={`text-sm font-medium ${on ? "text-on-glaze-2" : "text-ink-2"}`}>{o.hint}</span>
                <span className="pointer-events-none absolute inset-0 rounded-2xl peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]" />
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5" aria-live="polite">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-lg font-bold">
            {t.home.questions(p.count)}
            <span className="font-medium text-ink-2"> · {t.home.preview(p.due, p.fresh, p.extra)}</span>
          </p>
          <p className="text-[15px] leading-snug text-ink-2">
            {firstTime || !p.focus[0] ? t.home.firstTime : t.home.reason(p.due, p.focus[0].id, p.focus[0].title.split(":")[0], p.focus[0].weight, p.focus[0].seen)}
          </p>
        </div>
        <button className="btn-glaze w-full shrink-0 sm:w-auto">
          {t.home.start} <ArrowRight className="size-5" aria-hidden />
        </button>
      </div>
    </form>
  );
}
