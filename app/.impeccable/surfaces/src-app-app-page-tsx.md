---
version: 1
slug: "src-app-app-page-tsx"
primary_target: "src/app/(app)/page.tsx"
related_targets: ["src/app/(app)/sessio/[id]/page.tsx","src/app/(app)/progres/page.tsx","src/app/(app)/practicar/page.tsx"]
---

## Scope

Whole product UI of NoExcusesOpo (Operate mode): home "Què fem ara?", temari map, practice question flow with confidence + feedback, session complete, exam simulation, results, progress, admin, auth. Desktop first in priority (most study happens on a computer), equally solid on tablet and phone.

## Audience and job

Working nurses studying for the ICS oposició in spare time. Job: pick how much time they have, practise real exam questions with explained feedback, see what they master. UX patterns: docs/ux-research.md (one question per screen, sticky action bar, feedback sheet/panel, single completion screen, free navigation, no guilt).

## Direction contract

THESIS: The syllabus is a Catalan hydraulic-tile floor of 110 epígrafs laid tile by tile as the student masters them; it refuses the category default of a grey dashboard with one accent and the cartoon path.

OWN-WORLD: Glazed Sant Pau verdigris (#14695f family) owns the shell (rail, primary actions, mastered tiles) on a cool porcelain ground; ochre glaze is the single highlight (resume, celebration, "cal repassar"); Sant Pau brick red only for wrong answers; deep green-black ink. One grotesk (Hanken Grotesk), heavy display weight, tabular figures. Tiles are square-ish with small radii; geometric tile motifs live only in the progress mosaic and the completion moment.

STORY: The student sees immediately what to do now (choose time), why (the reason line), and how far the floor is laid; practises; each mastered epígraf lays a tile.

FIRST VIEWPORT: Desktop: verdigris left rail (wordmark, Què fem ara?, Temari, Simulacres, Fallades, Progrés, language toggle); main column: H1 greeting-question, three large time tiles (10 / 25 / 45+), the reason card, resume strip with ochre action; right column: "El teu paviment" mosaic (tile size = weight in official exams) with three proof figures. Phone: rail becomes bottom tab bar, mosaic moves below the time tiles.

FORM: Rajola de Sant Pau, position 6 of my ordered list. seed:2522070e23e9853b. Raises: tile size encodes official weight (star atlas); fixed ~62ch reading measure for questions and explanations (lexicon); session fills the chosen time, a row of tiles counts the remaining questions (cassette); every progress figure opens the attempts behind it (monochrome canon); one time control recomposes the suggested session live (specimen). Signature move: laying a tile — when an epígraf crosses into "dominat", its tile fills with the glaze pattern in the mosaic and on the completion screen.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
