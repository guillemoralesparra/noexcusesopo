# Temari v2: contingut literal, preguntes reassociades i cerca (20/10/2026)

Canvi de disseny i d'estructura de NoExcusesOpo. Substitueix el temari v1 (110 epígrafs amb una fitxa resum
redactada per la plataforma) i el material de FUDEN separat, que només veien les comptes amb accés FUDEN.

## Decisió

La plataforma s'associa amb FUDEN. Des d'ara **tothom amb compte veu tot el material**: no hi ha accés per
compte ni lector de PDFs a part. El temari és el text real del curs (no una síntesi), ordenat segons el
temari oficial de la convocatòria 100-2025. Els comptes els reparteix l'administradora (codis d'invitació).

## Què ha canviat

| Abans (v1) | Ara (v2) |
|---|---|
| 110 epígrafs | 146 epígrafs sobre els 19 temes oficials (`content-pipeline/data/temario.json`; la v1 és a `temario_v1.json`) |
| Una fitxa resum per epígraf | El text literal del material, en l'ordre de lectura; la fitxa resum es manté com a apartat «Fitxa resum» |
| Material FUDEN en un lector a part (`/fuden/[doc]`), només per a comptes amb `fuden_access` | Integrat dins de cada epígraf i visible per a tothom; el lector, les taules `fuden_docs`/`fuden_pages` i la columna `users.fuden_access` s'han eliminat |
| Preguntes FUDEN i simulacres FUDEN amagats sense accés | Visibles per a tothom; continuen etiquetats d'origen FUDEN i no compten per als pesos de prioritat |
| Cerca: fitxes, preguntes, normativa i pàgines FUDEN (amb filtre d'accés) | Cerca: **temari** (text de cada epígraf i fitxes) i **preguntes**; el temari surt sempre primer |
| Preguntes classificades amb els epígrafs v1 | Les 4.639 preguntes (385 oficials, 1.477 històriques, 2.777 FUDEN) reassociades als epígrafs v2 |

## Organització del temari

**Temes:** els 11 transversals (annex 3) i els 8 específics (annex 35.3), amb el text oficial literal.

**Epígrafs:** cada frase del text oficial té un epígraf que la cobreix; dins de cada tema s'han separat on el
material ho demanava (p. ex. E3 té 20 epígrafs: anatomia i valoració, patologia i procediments de cada aparell).
El camp `abast` de cada epígraf fixa les fronteres quan un contingut podria anar a dos llocs (úlceres
vasculars a E5.4 i no a E3.10, transfusió segura a E7.9, tabaquisme a E5.15, codi ictus a E3.1…).

**Contingut de cada epígraf,** en aquest ordre (taula `topic_blocks`, camp `part`):

1. `temari` — els temes del curs
2. `resum` — els resums que dona el curs
3. `suport` — guies, protocols i manuals (plans de cures, guies ERC, manual de vacunacions…)
4. `presentacio` — el text de les diapositives de les sessions
5. `normativa` — els articles de llei que cita el temari oficial (BOE, Portal Jurídic, EUR-Lex)
6. `bibliografia`

El material es reparteix **per contingut, no per document**: cada tros va a l'epígraf que tracta, encara que
vingui d'un altre tema del curs. Els documents repetits només surten una vegada. Les parts llargues es
parteixen en pàgines de ~4.000 paraules. El text és en l'idioma original (català o castellà) i sense imatges.

## Pantalles

- `/temari` — temes i epígrafs en l'ordre oficial, amb el domini de cada epígraf.
- `/temari/[epígraf]` — lector: índex del contingut per parts (a la dreta en ordinador, desplegable en mòbil),
  una pàgina cada vegada amb la font (document i pàgines, o la norma amb enllaç), anterior/següent,
  «Fitxa resum» i el botó de practicar l'epígraf. Paràmetres: `?b=<ordre>` o `?vista=fitxa`.
- `/cerca` — paraules clau (diccionaris català i castellà, "frase exacta", -excloure). Filtres Tot / Temari /
  Preguntes amb el recompte. Com a màxim dos fragments per pàgina de contingut; l'enllaç obre la pàgina i el
  navegador salta a la paraula buscada (fragment de text `#:~:text=`).

## Dades i càrrega

```
content-pipeline/
  data/temario.json                 estructura v2 (al repositori)
  data/classification/v2.json       epígraf v2 de les preguntes oficials i històriques (al repositori)
  data/notes/*.json                 fitxes resum amb els ids v2 (les v1 a data/notes_v1/)
  data/fuden/                       material del curs (fora del repositori, .gitignore)
    temari/assign/*.json            a quin epígraf va cada tros de cada document
    temari/guia/                    guia en Markdown: 00-GUIA.md + un fitxer per epígraf
    temari/blocs.json               el contingut per a l'app (el llegeix el seed)
    questions/*.json                preguntes FUDEN amb l'epígraf v2 (epigraf_v1 guarda l'anterior)
  scripts/temari_segments.py        trosseja el Markdown del curs per títols o pàgines
  scripts/temari_build.py           check / build: guia + blocs.json
  scripts/reclass_v2.py             reassociació de preguntes (lots, check, apply)
  scripts/notes_v2.py               fitxes v1 → v2
```

El material del curs **no és al repositori**: es carrega a la base de dades amb el seed des de la còpia local
(`pnpm db:seed` amb `DATABASE_URL` de producció; vegeu `app/README.md`). Per canviar on va un tros: editar
`data/fuden/temari/assign/*.json`, `python -I scripts/temari_build.py check` i `build`, i tornar a fer el seed.

El seed, a més d'actualitzar, **esborra** el que ja no és al temari: temes i epígrafs v1 que no existeixen
(T3.5, T9.3), fitxes antigues, tot `topic_blocks` i l'índex de cerca (es reconstrueixen). No toca usuàries,
intents ni repassos: el progrés va lligat a les preguntes, que conserven l'id.

## Migracions

- `0007_temari_v2_blocs` — crea `topic_blocks`.
- `0008_sense_fuden_privat` — elimina `fuden_docs`, `fuden_pages`, `search_docs.restricted` i `users.fuden_access`.

## Preguntes pròpies (20/10/2026)

Per als 45 epígrafs que tenien menys de 10 preguntes s'han redactat **232 preguntes pròpies** (origen
`generated`, etiqueta «Pregunta pròpia de la plataforma»), fins a arribar a 10 per epígraf. No compten per als
pesos de prioritat. Procés (`content-pipeline/scripts/gen_questions.py`):

1. Redacció per agents a partir només del contingut de l'epígraf (`guia/<tema>/<epígraf>.md`), sense repetir
   les preguntes que ja hi havia. Cada pregunta porta l'explicació de cada opció, la font (article o document i
   pàgina) i un fragment literal del temari que demostra la resposta (`evidence`).
2. Comprovació automàtica: format, 4 opcions diferents i que l'`evidence` surti literal al temari de l'epígraf.
3. Resolució a cegues per altres agents (sense la clau) amb el mateix temari: només es queden les que coincideixen.
   Resultat: 232 de 233; se'n va descartar 1, i abans 2 de T6.2 basades en xifres del II Acord (2007-2010).

Resultat a `content-pipeline/data/generated/questions.json` (al repositori); el seed les carrega.

## Material afegit (20/10/2026)

- **T7.4**: *Protocol per a la prevenció, la detecció, l'actuació i la resolució de situacions d'assetjament
  sexual, per raó del sexe, de l'orientació sexual i/o de la identitat sexual a l'Administració de la Generalitat*
  (Direcció General de Funció Pública), el text que cita el temari oficial. FUDEN només l'esmentava a l'índex.
- **T5.3**: Resolució EMT/74/2024 (DOGC 9085, 23/01/2024), text publicat del III Acord.
- **E1.9**: «Situaciones de violencia» (riscos laborals) i «Agressions» (annex del tema 7), que abans eren a T7.3.
- Els PDF són a `content-pipeline/raw/normativa/` i es passen a `data/sources/` amb `scripts/pdf_sources.py`.

## Format d'estudi (20/10/2026)

El text convertit dels PDF tenia defectes de conversió que en dificultaven la lectura. `content-pipeline/scripts/temari_format.py`
els corregeix de manera determinista (sense cap model i sense reescriure res), dins de `temari_build.py build`:

- **Símbols de fonts Wingdings/Symbol** (caràcters de la zona privada d'Unicode, que es veien com a quadrats) → el
  caràcter que representen (•, ■, ✓, →, ↓…).
- **Vinyetes escrites com a text** (■ • ● ▪ ►), a l'inici o enmig del paràgraf → llistes de Markdown, amb els sagnats
  recalculats segons l'estructura (el PDF en deixava de 6 o més espais, que es mostrarien com a codi).
- **Lligadures perdudes** ("planifcació", "efciència", "difcultats") → la paraula sencera, només si aquesta forma surt
  al mateix temari.
- **Majúscules soltes de les versaletes** ("caTalà", "funDamentos") i majúscules amb l'accent en minúscula
  ("INSUFICIèNCIA") → la forma normal, només si surt al temari (es respecten dTpa, mmHg, McGraw…).
- **Paraules partides a final de línia** ("inter- vención") → unides si la paraula unida surt al temari.
- **Text espaiat lletra a lletra** i capçaleres repetides així ("P L A N S D E C U R E S …").
- **Punts de farciment dels índexs** ("Introducció ........ 6") i línies de punts dels formularis ("……").
- **Subtítols numerats enganxats al paràgraf** ("… **4.1.2. Clasificación** De manera …") → línia pròpia.
- **Marca de descàrrega d'una altra persona** a la presentació de la sessió 3 (nom, correu, IP i número de descàrrega):
  eliminada; són dades personals d'un tercer.

Verificació: per a cada epígraf es compara el vocabulari abans i després; les úniques paraules que desapareixen són
les formes deformades que s'han corregit i els trossos de la marca de descàrrega.

A la web, el text es mostra amb un estil de lectura propi (`.temari-text` a `app/src/app/globals.css`): títols
destacats amb el cantell vidrat, llistes amb vinyetes de color, taules amb capçalera i files alternes, ressaltats en
ocre, i un índex "En aquesta pàgina" amb enllaços als apartats de la pàgina i el temps de lectura.

## Buits coneguts

Només normativa (sense temari del curs): T1.1, T2.2, T4.3-T4.5 i T11.3. Detall complet a
`data/fuden/temari/guia/00-GUIA.md` (secció «Buits i punts febles»). Després de les preguntes pròpies, tots els
epígrafs tenen almenys 10 preguntes, excepte T11.3 (9).
