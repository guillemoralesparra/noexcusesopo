import Link from "next/link";
import { LogOut, Search } from "lucide-react";
import { RailNav, TabBar } from "@/components/AppNav";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/lang";
import { logout } from "../(auth)/actions";
import { setLangAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, t] = await Promise.all([requireUser(), getDict()]);
  const otherLang = t.lang === "Castellano" ? "es" : "ca";
  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Carril vidrat (escriptori) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-glaze px-4 py-6 text-on-glaze lg:flex">
        <Link href="/" className="mb-8 px-3 text-[22px] font-extrabold tracking-[-0.02em]">
          NoExcusesOpo
        </Link>
        <form action="/cerca" role="search" className="mb-4 px-1">
          <input
            name="q"
            placeholder={t.lang === "Castellano" ? "Cerca al temari…" : "Buscar en el temario…"}
            aria-label={t.lang === "Castellano" ? "Cerca al temari" : "Buscar en el temario"}
            className="min-h-11 w-full rounded-xl border-2 border-glaze-deep bg-glaze-deep px-3 text-[15px] text-on-glaze placeholder:text-on-glaze-2 outline-none focus:border-on-glaze-2"
          />
        </form>
        <RailNav admin={user.role === "admin"} />
        <div className="mt-auto space-y-3 px-3 text-sm text-on-glaze-2">
          <p className="font-semibold text-on-glaze">{user.displayName}</p>
          <form action={setLangAction}>
            <input type="hidden" name="lang" value={otherLang} />
            <button className="underline decoration-on-glaze-2/60 hover:text-on-glaze">{t.lang}</button>
          </form>
          <form action={logout}>
            <button className="inline-flex items-center gap-2 hover:text-on-glaze">
              <LogOut className="size-4" aria-hidden /> {t.nav.logout}
            </button>
          </form>
        </div>
      </aside>

      {/* Capçalera mínima (mòbil i tauleta) */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-glaze px-4 text-on-glaze lg:hidden">
        <Link href="/" className="text-lg font-extrabold tracking-[-0.02em]">
          NoExcusesOpo
        </Link>
        <Link href="/cerca" className="ml-auto grid size-11 place-items-center text-on-glaze-2" aria-label={t.lang === "Castellano" ? "Cerca al temari" : "Buscar en el temario"}>
          <Search className="size-5" aria-hidden />
        </Link>
        <form action={setLangAction}>
          <input type="hidden" name="lang" value={otherLang} />
          <button className="min-h-11 px-2 text-sm font-semibold text-on-glaze-2">{t.lang}</button>
        </form>
        <form action={logout}>
          <button className="grid size-11 place-items-center text-on-glaze-2" aria-label={t.nav.logout}>
            <LogOut className="size-5" aria-hidden />
          </button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      <TabBar />
    </div>
  );
}
