# Investigació UX — apps d'aprenentatge (17/10/2026)

Resum de l'informe d'investigació (Duolingo, Brilliant, Khan Academy, Anki, Mochi, Quizlet, Babbel,
Drops, Busuu, OpositaTest, GoKoan, UWorld, AMBOSS). Les mesures marcades [obs] són observació directa
sense font oficial: cal contrastar-les.

## Patrons que adoptem

- **Un sol "següent pas" evident** a l'inici (Duolingo path) però amb **llibertat total de saltar** a
  qualsevol tema (crítica forta a la linealitat forçada de Duolingo 2022).
- **Pantalla de pregunta:** barra superior (tancar, progrés segmentat, menú), enunciat 18/500,
  opcions a amplada completa ≥56px amb lletra en cercle, **barra d'acció fixa a baix** (zona del
  polze), botó "Comprovar" desactivat fins a triar.
- **Confiança** "Ho sé / Dubto / A l'atzar" com a control segmentat opcional sobre el botó.
- **Full de correcció** que puja des de la barra (≤100ms després de comprovar, 240ms d'animació):
  color per resultat, "Per què", "Per què no les altres" (UWorld), **"Per recordar"** (Educational
  objective), font citada, accions marcar / reportar. A escriptori: panell lateral.
- **Missatges per hipercorrecció:** error amb "Ho sé" → "és la que més s'aprèn".
- **Sessió completada en UNA pantalla**: 3 xifres (encerts, temps, nota neta), insight de
  calibratge, llista "Per repassar", "5 min més" / "Acabar per avui". Res de cadenes de pantalles.
- **Mapa del temari:** llista per bloc i tema amb barra segmentada per epígrafs; 5 estats de domini
  (Khan): sense començar, iniciat, familiar, competent, dominat + avís "cal repassar". Estat sempre amb
  forma/icona, no només color. Master-detail a tauleta/escriptori.
- **Simulacre:** temporitzador tabular ocultable, avisos suaus (ambre, mai parpelleig vermell),
  graella de respostes amb filtres (totes / en blanc / marcades), sense feedback fins a lliurar.
- **Casos clínics:** text 17-18px a ≤65 caràcters; a tauleta/escriptori pantalla dividida cas | preguntes.
- **Progrés:** preparació estimada amb interval honest, mapa de calor del temari, constància en
  setmanes (no ratxa diària), calibratge, punts febles.
- **Escriptori:** dreceres 1-4/A-D opcions, Q/W/E confiança, Enter comprovar, M marcar, ←/→ navegar.

## Gamificació sense culpa

Constància setmanal (dies actius / setmana), cap pèrdua visible, benvinguda suau en tornar, repassos
pendents limitats per dia, objectiu en minuts, recompenses lligades a domini real, calibratge com a
competència, social opcional i no competitiu, cap recurs que bloquegi estudiar (ni vides ni energia).

## Accessibilitat

Targets ≥44-48px, contrast AA (el verd #58CC02 de Duolingo amb text blanc NO compleix), estats amb
icona + text, prefers-reduced-motion, radiogroup per a opcions, aria-live per al resultat, focus al
títol del full de correcció, text fins a 200%, temps addicional al simulacre, `lang="ca"`.

## Fonts citades

blog.duolingo.com (new-duolingo-home-screen-design, how-duolingo-streak-builds-habit, core-tabs-redesign,
copy-testing-experiments, shape-language), design.duolingo.com/illustration, support.khanacademy.org
(5548760867853), docs.ankiweb.net, mochi.cards/docs, nursing.uworld.com, amboss.com/us/features,
udel.edu (Silverman 2024), thedecisionlab.com (streak creep).
