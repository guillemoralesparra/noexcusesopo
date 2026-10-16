import { Tile } from "@/components/Tile";
import { getLang } from "@/lib/lang";
import type { MasteryState } from "@/lib/mastery";

const COPY = {
  ca: {
    lead: "L'oposició d'infermeria de l'ICS, rajola a rajola.",
    facts: "385 preguntes dels exàmens oficials del 2015 al 2024, explicades opció per opció, i el temari en 110 epígrafs.",
    unofficial: "Plataforma no oficial, per a un grup d'estudi.",
  },
  es: {
    lead: "La oposición de enfermería del ICS, baldosa a baldosa.",
    facts: "385 preguntas de los exámenes oficiales de 2015 a 2024, explicadas opción por opción, y el temario en 110 epígrafes.",
    unofficial: "Plataforma no oficial, para un grupo de estudio.",
  },
};

// Un paviment a mig col·locar: de dominat (a dalt a l'esquerra) a per posar
const FLOOR: MasteryState[] = Array.from({ length: 48 }, (_, i) => {
  const r = Math.floor(i / 8), c = i % 8, d = r + c;
  return d < 3 ? "mastered" : d < 5 ? "competent" : d < 7 ? "familiar" : d < 8 ? "started" : "untouched";
});

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const c = COPY[await getLang()];
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,1fr)]">
      <section className="flex flex-col justify-between gap-6 bg-glaze px-6 py-6 text-on-glaze sm:px-10 md:gap-8 md:py-8 lg:px-14 lg:py-14">
        <p className="text-xl font-extrabold tracking-[-0.02em]">NoExcusesOpo</p>
        <div className="space-y-6">
          <ul className="grid max-w-[520px] grid-cols-8 gap-1 max-md:[&>li:nth-child(n+17)]:hidden" aria-hidden>
            {FLOOR.map((s, i) => (
              <li key={i} className="aspect-square animate-[lay_600ms_var(--ease-out-expo)_both]" style={{ animationDelay: `${(Math.floor(i / 8) + (i % 8)) * 45}ms` }}>
                <Tile state={s} />
              </li>
            ))}
          </ul>
          <h1 className="max-w-[16ch] text-[30px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[52px]">{c.lead}</h1>
          <p className="hidden max-w-[46ch] text-lg text-on-glaze-2 md:block">{c.facts}</p>
        </div>
        <p className="hidden text-sm text-on-glaze-2 md:block">{c.unofficial}</p>
      </section>
      <section className="flex items-center justify-center px-4 py-10 sm:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
