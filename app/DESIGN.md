---
name: NoExcusesOpo
description: The ICS nursing oposició laid tile by tile, as a glazed Sant Pau hydraulic-tile floor.
colors:
  ground: "#eef2f0"
  surface: "#ffffff"
  surface-2: "#e2e9e6"
  ink: "#142b27"
  ink-2: "#3a554f"
  ink-3: "#5d736e"
  glaze: "#14695f"
  glaze-deep: "#0c4b44"
  glaze-edge: "#0a3f39"
  glaze-mid: "#6fae9f"
  glaze-soft: "#d6e9e3"
  on-glaze: "#ffffff"
  on-glaze-2: "#c9e3dc"
  ochre: "#d9a441"
  ochre-edge: "#a87a22"
  ochre-ink: "#7a5410"
  ochre-soft: "#f7ebcf"
  on-ochre: "#2a1d05"
  brick: "#a8432a"
  brick-soft: "#f6e1da"
  on-brick: "#ffffff"
  tile-empty: "#dde5e2"
  focus: "#0b57d0"
  ground-dark: "#0d1816"
  surface-dark: "#14221f"
  surface-2-dark: "#1c2e2a"
  ink-dark: "#e4eeeb"
  ink-2-dark: "#b2c6c1"
  ink-3-dark: "#8aa19b"
  glaze-dark: "#3eb3a0"
  glaze-deep-dark: "#2b8d7e"
  glaze-edge-dark: "#1f6a5f"
  glaze-mid-dark: "#2c6f64"
  glaze-soft-dark: "#173b35"
  on-glaze-dark: "#04201b"
  on-glaze-2-dark: "#0b3b33"
  ochre-dark: "#e3b45a"
  ochre-edge-dark: "#b2852f"
  ochre-ink-dark: "#e3b45a"
  ochre-soft-dark: "#3a2f17"
  on-ochre-dark: "#241802"
  brick-dark: "#e58a70"
  brick-soft-dark: "#3d1f17"
  on-brick-dark: "#2a0d06"
  tile-empty-dark: "#22332f"
  focus-dark: "#8ab4ff"
typography:
  display:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(30px, 5vw, 52px)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px (40px from 640px)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  question:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px (22px from 640px)"
    fontWeight: 700
    lineHeight: 1.375
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.625
  body-option:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.375
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.43
  figure:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\" 1"
rounded:
  tile: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  sheet: "24px"
  pill: "9999px"
spacing:
  gutter-phone: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "40px"
  mosaic-gap: "4px"
  panel-padding: "20px"
  stack: "24px"
  container: "1280px"
  rail: "256px"
  measure: "62ch"
components:
  button-glaze:
    backgroundColor: "{colors.glaze}"
    textColor: "{colors.on-glaze}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "48px"
  button-glaze-hover:
    backgroundColor: "{colors.glaze-deep}"
  button-glaze-disabled:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-3}"
  button-ochre:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.on-ochre}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "48px"
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "48px"
  button-quiet-hover:
    backgroundColor: "{colors.surface-2}"
  time-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
    height: "112px"
  time-tile-selected:
    backgroundColor: "{colors.glaze}"
    textColor: "{colors.on-glaze}"
  option-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-option}"
    rounded: "{rounded.xl}"
    padding: "14px 16px"
  option-card-selected:
    backgroundColor: "{colors.glaze-soft}"
  option-card-correct:
    backgroundColor: "{colors.glaze-soft}"
  option-card-wrong:
    backgroundColor: "{colors.brick-soft}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "20px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "48px"
  rail:
    backgroundColor: "{colors.glaze}"
    textColor: "{colors.on-glaze-2}"
    width: "256px"
  rail-item-active:
    backgroundColor: "{colors.glaze-deep}"
    textColor: "{colors.on-glaze}"
    rounded: "{rounded.lg}"
    height: "44px"
  tab-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-3}"
    height: "56px"
  tab-bar-item-active:
    textColor: "{colors.glaze}"
  resume-strip:
    backgroundColor: "{colors.ochre-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
---

# Design System: NoExcusesOpo

## Overview

**Creative North Star: "Rajola de Sant Pau"**

The syllabus is a Catalan hydraulic-tile floor of 110 epígrafs, laid tile by tile as the student masters them. The shell is glazed ceramic: a verdigris rail and verdigris primary actions on a cool porcelain ground, with deep green-black ink. Ochre glaze is the one warm highlight, and Sant Pau brick red appears only when an answer is wrong. Everything else stays quiet so that long Catalan clinical text can be read comfortably.

The material idea is literal but restrained. Buttons and choice cards have a darker bottom edge, like the fired edge of a tile, and they sink into the floor when pressed. The geometric tile motif (quarter-circle corners filling in, then a rosette) belongs to the progress mosaic, the session-complete moment and the sign-in floor. It never decorates ordinary panels. Density is calm: one question per screen, generous tap targets, a fixed reading measure.

The system refuses the category default of a grey dashboard with one accent and the gamified cartoon path. Progress is a floor being laid, not points or streaks.

**Key Characteristics:**
- Verdigris owns the frame (rail, primary actions, mastered tiles); porcelain owns the reading surface.
- One grotesk (Hanken Grotesk) at heavy display weight with tight tracking; tabular figures for every number.
- Glazed pressed-edge buttons and cards: a 4px darker bottom edge that collapses on press.
- Tile mastery motif encodes six states; tile size in the mosaic encodes official exam weight.
- Light and dark themes follow the system setting; every color is a CSS custom property with both values.

## Colors

A cool porcelain-and-verdigris ceramic palette with one warm glaze and one alarm.

### Primary
- **Sant Pau Verdigris** (glaze): the rail, primary buttons, selected time tile, selected and correct answer letters, mastered tile ground, links in sources, the session tile row for correct answers. Lightened to a turquoise glaze in dark mode.
- **Deep Verdigris** (glaze-deep): button hover, active rail item, "Per recordar" heading, correct feedback title.
- **Fired Edge** (glaze-edge): the 4px bottom edge of glaze buttons and the selected time tile.
- **Half Glaze** (glaze-mid): competent tile ground, answered-but-uncorrected cells, option hover border, scrollbar thumb.
- **Glaze Wash** (glaze-soft): selected/correct option background, "Per recordar" box, started/familiar tile ground, correct action bar.
- **On Glaze / On Glaze Muted** (on-glaze, on-glaze-2): text on verdigris; the muted one for inactive rail items, hints on the selected time tile, and the mastered tile's rosette.

### Secondary
- **Ochre Glaze** (ochre): the single warm highlight: resume action, "Repàs" practice action (btn-ochre), mastered tile corners and rosette centre, exam flag dot, estimate marker on the progress bar, text selection.
- **Ochre Edge** (ochre-edge): bottom edge of ochre buttons and warning icons only, never text (3.4:1).
- **Ochre Ink** (ochre-ink): ochre-family text that must pass AA: timer under 10 minutes, flagged state, pending-review counts.
- **Ochre Wash** (ochre-soft): resume strip, mistakes call-to-action panel, outdated/disputed notices, informational notes.
- **On Ochre** (on-ochre): text on ochre.

### Tertiary
- **Sant Pau Brick** (brick): wrong answers only: wrong option border and letter, wrong feedback title and icon, wrong cells in the session tile row, wrong action bar border.
- **Brick Wash** (brick-soft): wrong option background and wrong action bar.
- **On Brick** (on-brick): icon/text on brick.

### Neutral
- **Cool Porcelain** (ground): page background, focus-mode background, proof-figure wells, option letter wells.
- **White Glaze** (surface): panels, cards, option cards, tab bar, action bar.
- **Grout** (surface-2): borders at rest, quiet button edge, hover fill, case-text box (at 70%), disabled buttons.
- **Green-Black Ink** (ink), **Ink 2** (ink-2), **Ink 3** (ink-3): primary text; secondary text and labels; metadata, captions, inactive tabs.
- **Unlaid Tile** (tile-empty): untouched tiles, pending session cells, progress track, dashed outline of "no questions" tiles.
- **Focus Blue** (focus): the focus ring only. It is deliberately outside the world so keyboard focus is never confused with selection.

Dark values are listed in the frontmatter under the `-dark` suffix; they are applied by redefining the same custom properties under `prefers-color-scheme: dark`. In dark mode the "on" colors invert to dark ink on lightened glazes.

### Named Rules
**The Brick Means Wrong Rule.** Brick red is reserved for wrong answers. Never use it for destructive actions, warnings, branding or emphasis; warnings and "may be outdated" notices are ochre.

**The One Warm Glaze Rule.** Ochre is the only warm color and marks the single thing worth returning to (resume, review mistakes, flags, the mastered rosette). One ochre action per screen.

## Typography

**Display Font:** Hanken Grotesk (with ui-sans-serif, system-ui)
**Body Font:** Hanken Grotesk
**Label/Mono Font:** Hanken Grotesk with tabular figures (`font-variant-numeric: tabular-nums`)

**Character:** One grotesk carries everything. Headlines go to weight 800 with negative tracking for a dense, confident glaze; body stays at 400 with relaxed leading for long clinical reading in Catalan, including l·l and diacritics (latin-ext subset loaded).

### Hierarchy
- **Display** (800, 30px to 52px, line-height 1.02, -0.035em): the sign-in floor statement only.
- **Headline** (800, 28px to 40px on home; 28px to 36px on other pages, -0.03em): one H1 per page, phrased as the page's question or state ("Hola, Laia. Quant temps tens?", "Sessió feta").
- **Time figure** (800, 24px to 32px, line-height 1, -0.03em): the minutes on the time tiles.
- **Title** (800, 18px to 20px, -0.01 to -0.02em): section heads ("El teu paviment", "Últimes sessions") and feedback titles.
- **Question** (700, 20px to 22px, line-height 1.375, max 62ch): the question stem in practice and exam.
- **Body** (400, 16px, line-height 1.625, max 62ch; case narrative 68ch): explanations and case text. Option text is 17px at 1.375.
- **Secondary body** (400 to 500, 15px): reason lines, explanations of other options, subtitles.
- **Label** (700, 14px, ink-2): small section heads inside panels ("Per què", "Les altres opcions"). Sentence case, never uppercase, never letter-spaced.
- **Caption** (400, 13px, ink-3): provenance notes, proof-figure labels.
- **Figure** (800, 20px to 24px, tabular): proof figures, scores, counts.

### Named Rules
**The Measure Rule.** Question stems and explanations never run wider than 62ch; case narratives 68ch. The page can be wide; the reading line cannot.

**The Tabular Figures Rule.** Every number that can change or be compared (scores, counts, timer, dates, answer grid) uses tabular figures.

## Layout

Three shells share one 1280px content container with gutters of 16px (phone), 24px (from 640px) and 40px (from 1024px).

- **App shell (verdigris rail).** From 1024px a fixed 256px verdigris rail holds the wordmark (22px, 800), the five destinations (Què fem ara?, Temari, Simulacres, Repàs, Progrés, plus Admin for admins) and, pinned to the bottom, the user name, the language toggle and sign out. Content sits to its right with 40px top padding.
- **Phone and tablet shell (tab bar).** Below 1024px the rail becomes a 56px verdigris top bar (wordmark, language, sign out) and a fixed white bottom tab bar of five items (icon plus 11px label, active in verdigris), respecting the safe-area inset. Main content gets 112px bottom padding to clear it.
- **Home composition.** From 1280px: main column (H1, time tiles, reason card, resume strip, recent sessions) and a 400px right column for "El teu paviment" with three proof figures. Below 1280px the mosaic panel stacks after the time tiles.
- **Focus mode (session).** No navigation. A sticky header with a 44px close button, the session title and the tile row (one cell per question, a progress bar above 40 questions) and a counter. Practice: question column plus a 420px feedback panel from 1024px; below, feedback stacks under the options. Exam: a 260px sticky answer sheet on the left from 1024px, a bottom sheet on phone. A fixed bottom action bar holds the confidence buttons or Continue, in the thumb zone.
- **Auth shell.** Split screen from 1024px: a verdigris half with the wordmark, a half-laid tile floor and the display statement; the form column max 384px. On phone the verdigris half shrinks to the top and shows two rows of tiles.

Spacing rhythm is 4px-based: 4px mosaic and tile-row gaps, 8 to 12px between choice cards, 16 to 24px inside panels, 24 to 32px between sections.

## Elevation & Depth

The system is flat and tonal: no box-shadows anywhere. Depth comes from three things only. Porcelain ground against white surfaces separates panels. A 4px darker bottom border (the fired edge) gives buttons, time tiles and option cards their thickness. And on press that edge collapses to 1px while the element moves down 3px, so the tile sinks into the floor. Modal and bottom-sheet scrims use ink at 40%.

### Named Rules
**The Fired Edge Rule.** Thickness is a bottom border in the darker shade of the same glaze, never a drop shadow. Pressable things have it; static panels do not.

## Shapes

Tiles are square with small radii; containers are softer. The mosaic and tile glyphs use a 3 to 4px corner (rx 3 on a 40 unit tile), session tile-row cells 3px. Small badges (answer letters, explanation letters) use 6 to 8px. Buttons, fields, rail items and info boxes use 12px. Panels, time tiles, option cards and the resume strip use 16px. The mobile answer sheet uses 24px top corners. Pills (9999px) only for the exam confidence chips and the flag dot. Borders are 2px when they carry state (option cards, fields, action bar top); the dashed 2px border marks an empty placeholder (feedback panel before answering, "no questions" tiles).

## Components

### Buttons
Tactile glazed tiles that sink when pressed.
- **Shape:** gently rounded (12px), minimum height 48px, 20px horizontal padding, 16px bold label, icon gap 8px.
- **Glaze (primary):** verdigris with a 4px fired-edge bottom border; hover darkens to deep verdigris; disabled turns grout with ink-3 text and no visible edge.
- **Ochre:** ochre with ochre-edge bottom border, on-ochre text. Used for the one return-to action (practise mistakes, practise a chosen epígraf).
- **Quiet:** white with a grout bottom edge; hover fills grout. Secondary actions, exam navigation, Continue after a wrong answer.
- **Press:** translateY(3px) with the bottom edge collapsing from 4px to 1px (100ms); compensating 3px margin keeps layout still.
- **Text links/buttons:** 14px bold ink-2 or ink-3, underline offset 3 to 4px, minimum 44px hit height.

### Time Tiles (signature)
Three large radio tiles (10 / 25 / 45+ min), min height 96px (112px from 640px), 16px radius, 4px bottom edge. Rest: white with grout edge, hover glaze wash. Selected: verdigris with fired edge, hint text in on-glaze-2. Changing the selection recomposes the reason card live (aria-live polite). Focus ring is drawn on an overlay span so it sits outside the tile.

### Option Cards
Large answer cards: 2px border plus 4px bottom border, 16px radius, 14px by 16px padding, 17px text, with a 32px letter well (8px radius, 800 uppercase letter). States: rest (grout border, hover half-glaze border), selected (glaze border, glaze wash, glaze letter well), correct (same as selected with a check), wrong (brick border, brick wash, brick well with a cross), others after correction (75% opacity). Keyboard hint numbers 1 to 4 show at the right from 1024px.

### Cards / Containers
- **Corner Style:** 16px (panel), 12px (notes and inner boxes).
- **Background:** white on porcelain; proof figures and option letter wells use porcelain inside white.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none at rest; lists divide rows with 2px porcelain dividers.
- **Internal Padding:** 16px to 24px.

### Inputs / Fields
48px tall, 12px radius, 2px grout border on white, 16px text. Focus turns the border verdigris (the global focus ring also applies to keyboard focus).

### Navigation
- **Rail items:** 44px tall, 12px radius, 15px semibold with a 20px icon (stroke 2.2). Inactive on-glaze-2, hover deep verdigris at 60%; active deep verdigris fill with white text and `aria-current="page"`.
- **Tab bar items:** 56px tall, 22px icon above an 11px semibold label; inactive ink-3, active verdigris with a heavier icon stroke.
- **Icons:** Lucide line icons, decorative and `aria-hidden`.

### Feedback Panel and Action Bar
After answering, a white panel rises in (rise, 240ms) with a 40px square state badge (verdigris check, brick cross, grout for blank), an 18px 800 title tinted by outcome, then "Per què", a glaze-wash "Per recordar" box, the other options with letter badges, sources and a provenance caption. The fixed bottom action bar takes the outcome color: glaze wash with verdigris top border for correct, brick wash with brick top border for wrong, white otherwise. Focus moves to the feedback title.

### Tile Mastery Motif (signature)
A 40 unit square SVG tile whose motif completes with mastery:
- **none** (no questions): transparent with a dashed unlaid-tile outline.
- **untouched** ("Per posar"): plain unlaid tile.
- **started:** glaze wash ground, one verdigris quarter-circle corner.
- **familiar:** glaze wash ground, two opposite corners.
- **competent:** half-glaze ground, all four corners.
- **mastered** ("Dominat"): verdigris ground, four ochre corners, an on-glaze-2 four-point rosette and an ochre centre.

In the mosaic each epígraf is one tile in syllabus order, 4px gap, ten columns, dense flow; epígrafs with high official exam weight span 2 by 2. Every tile links to its topic and carries a full aria-label (id, title, state, correct/available). A legend sits beneath.

### Session Tile Row
One cell per question in the focus header (10px tall, 3px radius, 4px gap): unlaid until answered, verdigris correct, brick wrong, ink-3 blank, half-glaze answered in exam mode; the current cell gets a 2px ink outline. Above 40 questions it becomes a rounded progress bar.

### Motion
- **lay** (the signature moment): a tile drops in from translateY(-10px), rotate(-6deg), scale(0.7) and opacity 0 to rest. 600ms staggered 45ms per diagonal on the sign-in floor, 700ms for newly highlighted mosaic tiles, 900ms for the completion hero tile.
- **rise:** translateY(16px) and opacity 0 to rest, 240ms, for the feedback panel.
- **Easing:** ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1). State transitions 100 to 150ms; tile-row width 300ms; mosaic tile hover lifts 2px.
- **Reduced motion:** under `prefers-reduced-motion: reduce` all animation and transition durations collapse to 1ms; elements arrive at their final state.

### Accessibility and Keyboard
- Global focus ring: 3px solid focus blue, 2px offset, on `:focus-visible` everywhere.
- Minimum targets 44px (nav, icon buttons), 48px for buttons and fields.
- Answer options use radio/checkbox roles with `aria-checked`; feedback and the reason card are `aria-live="polite"`.
- Practice shortcuts: 1 to 4 or A to D choose; Q, W, E submit with "Ho sé", "Dubto", "A l'atzar"; Enter continues. Hints shown in `kbd` from 1024px.
- Exam shortcuts: 1 to 4 or A to D choose; Left and Right arrows move between questions; M flags.
- Shortcuts ignore typing in inputs and textareas and any Cmd/Ctrl chord.

## Do's and Don'ts

### Do:
- **Do** give every pressable control the fired edge: a 4px bottom border in the darker shade of its own fill, collapsing to 1px with a 3px drop on press.
- **Do** keep verdigris for the frame and the primary action, and limit each screen to one ochre action.
- **Do** use the tile motif to show mastery, and let tile size carry official exam weight.
- **Do** keep question stems and explanations within 62ch and set numbers in tabular figures.
- **Do** define every new color as a custom property with both light and dark values.
- **Do** keep focus blue as the only focus indicator so focus never looks like selection.

### Don't:
- **Don't** use brick red for anything other than a wrong answer.
- **Don't** use box-shadows for depth; use porcelain against white and the fired edge.
- **Don't** put the geometric tile motif on ordinary panels, buttons or headers; it lives in the mosaic, the completion moment and the sign-in floor.
- **Don't** add a second typeface; hierarchy comes from Hanken Grotesk weight, size and tracking.
- **Don't** set labels in uppercase with letter-spacing; small heads are 14px bold sentence case.
