"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { AnswerOutcome } from "@/lib/scoring";
import { useT } from "./LangProvider";

/**
 * Capçalera de sessió: sortir, filera de rajoles (una per pregunta: es col·loquen a mesura que
 * respons, verdes si encertes i de maó si falles) i comptador.
 */
export function SessionTop({
  title,
  outcomes,
  current,
  right,
  onJump,
}: {
  title: string;
  outcomes: (AnswerOutcome | "pending" | "answered")[];
  current: number;
  right?: React.ReactNode;
  onJump?: (i: number) => void;
}) {
  const t = useT();
  const many = outcomes.length > 40;
  return (
    <header className="sticky top-0 z-20 bg-ground">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
          aria-label={t.q.close}
          title={t.q.closeConfirm}
        >
          <X className="size-6" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 truncate text-sm font-semibold text-ink-2">{title}</p>
          {many ? (
            <div className="h-2.5 overflow-hidden rounded-full bg-tile-empty">
              <div
                className="h-full rounded-full bg-glaze transition-[width] duration-300"
                style={{ width: `${(outcomes.filter((o) => o !== "pending").length / outcomes.length) * 100}%` }}
              />
            </div>
          ) : (
            <ol className="flex gap-1" aria-label={t.q.of(current + 1, outcomes.length)}>
              {outcomes.map((o, i) => (
                <li key={i} className="h-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={!onJump}
                    onClick={() => onJump?.(i)}
                    aria-label={`${i + 1}`}
                    className={`block h-full w-full rounded-[3px] transition-colors ${
                      o === "correct"
                        ? "bg-glaze"
                        : o === "wrong"
                          ? "bg-brick"
                          : o === "blank"
                            ? "bg-ink-3"
                            : o === "answered"
                              ? "bg-glaze-mid"
                              : "bg-tile-empty"
                    } ${i === current ? "outline-2 outline-offset-1 outline-ink" : ""}`}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="tabular shrink-0 text-sm font-bold text-ink-2">{right ?? t.q.of(current + 1, outcomes.length)}</div>
      </div>
    </header>
  );
}
