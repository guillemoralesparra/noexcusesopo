"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, Compass, LayoutGrid, RotateCcw, ShieldCheck, Timer } from "lucide-react";
import { useT } from "./LangProvider";

const ITEMS = [
  { href: "/", key: "home", Icon: Compass },
  { href: "/temari", key: "syllabus", Icon: LayoutGrid },
  { href: "/simulacres", key: "exams", Icon: Timer },
  { href: "/fallades", key: "mistakes", Icon: RotateCcw },
  { href: "/progres", key: "progress", Icon: ChartColumn },
] as const;

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

/** Navegació del carril lateral (escriptori). */
export function RailNav({ admin }: { admin: boolean }) {
  const t = useT();
  const path = usePathname();
  const items = admin ? [...ITEMS, { href: "/admin", key: "admin", Icon: ShieldCheck } as const] : ITEMS;
  return (
    <ul className="space-y-1">
      {items.map(({ href, key, Icon }) => {
        const on = isActive(path, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors ${
                on ? "bg-glaze-deep text-on-glaze" : "text-on-glaze-2 hover:bg-glaze-deep/60 hover:text-on-glaze"
              }`}
            >
              <Icon className="size-5 shrink-0" strokeWidth={2.2} aria-hidden />
              {t.nav[key]}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Barra de pestanyes inferior (mòbil i tauleta vertical). */
export function TabBar() {
  const t = useT();
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-2 bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Principal">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {ITEMS.map(({ href, key, Icon }) => {
          const on = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${on ? "text-glaze" : "text-ink-3"}`}
              >
                <Icon className="size-[22px]" strokeWidth={on ? 2.5 : 2} aria-hidden />
                <span className="max-w-full truncate px-1">{t.nav[key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
