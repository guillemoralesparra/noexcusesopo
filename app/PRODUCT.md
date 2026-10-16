# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A small invited group of nurses preparing the ICS (Institut Català de la Salut) nursing oposició,
category Infermeria A2-129, convocatòria 100-2025 (exam expected from January 2027). They work, often
in shifts, and study when they can: there is no fixed calendar. They study **mostly on a computer**
(longer sessions at home, full exam simulations), and also on phone and tablet/iPad, so every screen
must work well on all three.

## Product Purpose

NoExcusesOpo is a self-guided study platform that acts as the tutor: it decides what is most useful
to study next, lets the student practise with real exam questions and immediate feedback, simulates
the real exam, and shows progress. Success = the student reaches the exam able to pass both exercises
(minimum 25/50 each), having worked the highest-yield topics first.

## Positioning

Built on the real thing: the four official ICS nursing exams (2015, 2016 PI, 2019, 2024: 385 questions
with official answer keys), the official syllabus split into 110 epígrafs weighted by how often each
appeared in those exams, and the official legal texts split by article. Explanations cite the exact
article when a law applies. It suggests, it never imposes a schedule.

## Operating Context

- Sessions start from "how much time do I have now" (≈10, 25, 45+ minutes), not from a calendar.
- Question flow: answer → say how sure you were ("Ho sé / Dubto / A l'atzar") → immediate correction
  with explanation per option → next.
- Exam simulation: official format (2024: 70 test + 25 case questions, 2 h, no penalty so far; −¼
  and −⅓ selectable because the 2025 criteria are not yet published), timer, answer grid, flags.
- Case studies (supòsits) reveal their narrative progressively, as in the printed exam.
- Progress is shown per tema/epígraf and as calibration (how often "Ho sé" is really right).

## Capabilities and Constraints

- Next.js 15 + Tailwind v4 + Drizzle/Postgres; invite-code accounts; small group, no payments.
- Exam questions are always in Catalan (the exam language). The interface is **Catalan by default
  with a Spanish toggle**; explanations are written in Catalan, Spanish versions are an open decision.
- Questions flagged "may be outdated" and user error reports must stay visible.
- No clinical reviewer exists: correctness signals (official source, verification status) must be
  honest and never overstated.

## Brand Commitments

- Name: **NoExcusesOpo**.
- Not an official ICS product: never use ICS/Generalitat branding; state it is unofficial.
- Voice: direct, warm, encouraging, never guilt-inducing (no punishment for missed days).

## Evidence on Hand

- Official exams and answer keys in `../content-pipeline/data/` (official_bank.json, exams/).
- Frequency map of topics in exams (`../content-pipeline/data/frequency_map.md`).
- Legal corpus by article (`../content-pipeline/data/sources/`).
- No testimonials, pass rates or user numbers exist: never fabricate them.

## Product Principles

1. The platform decides the next best step; the student only decides how much time she has.
2. Retrieval with immediate, explained feedback beats reading.
3. Honesty over polish: show sources, uncertainty and outdated flags.
4. Encourage, never punish: progress is celebrated, absences are not penalised.
5. Same exam conditions when simulating: format, timing and scoring as the tribunal.

## Accessibility & Inclusion

Long reading of clinical text in Catalan (diacritics incl. l·l): comfortable body size and measure.
Large tap targets on phone/tablet, full keyboard use on desktop (options and confidence by key),
reduced-motion support, WCAG AA contrast, light and dark themes.
