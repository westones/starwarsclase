# Feature: Star Wars Universe — accessible themed site

## Objective
Adapt the existing Pokemon class project (`TrabajoPokemon`) into a Star Wars Universe
website that keeps the same 3-column layout, uses a Star Wars color palette, and
satisfies every criterion of the class rubric "Diseño de Interfaz Gráfica Web".

## Problem
The original project is HTML + hand-written CSS + vanilla JS. It has no Bootstrap,
no Tailwind, no jQuery/React, no `<canvas>`, no screen-reader (TTS) support and no
accessibility audit. The rubric requires all of these.

## Why
The deliverable is a graded team assignment (2 people). Reusing the proven layout
minimizes design risk while the rubric additions guarantee the grade.

## Scope (in)
- Reuse the 3-column grid layout (235px nav | content | 270px sidebar) and the
  header / nav / aside / footer skeleton.
- Star Wars palette + original Star Wars-themed SVG artwork and audio.
- Bootstrap 5 (responsive grid/components) + Tailwind (utility layer) via CDN.
- 3+ jQuery-driven interactive elements.
- Multimedia: images, sound, video, canvas.
- Read-speaker (Web Speech API) + alternate text everywhere.
- Accessibility audit with pa11y (before/after reports) and WAI-AA statement.
- LICENSE (GPL-3.0, derivative) + WAI conformance badge.
- Storyboard page, 10-slide presentation page, README.

## Scope (out)
- Figma design file (user explicitly waived it).
- Backend/build tooling. Everything runs from CDN + static files.

## Constraints
- Pure static site; must open via `file://` or Live Server.
- No copyrighted third-party artwork is shipped: all images are original SVGs
  generated for this project. Star Wars is a trademark of Disney/Lucasfilm; a
  non-commercial educational disclaimer is shown in the footer.
- WCAG 2.1 AA (WAI-AA) target.

## Authorized scope
New repository at `/home/westones/Proyectos/TrabajoStarWars`. Authorized to create
files and commits inside it. No push / no remote creation.

## Acceptance criteria
1. Five core pages mirror the original set: Inicio, Personajes, Facciones,
   Historia, Enlaces. Plus Accesibilidad, Storyboard, Presentación.
2. Bootstrap 5 + Tailwind both loaded and demonstrably used.
3. >= 3 functional jQuery interactive elements.
4. `<canvas>` with a working animation; image/audio/video present.
5. Read-speaker button works (SpeechSynthesis) with stop control.
6. Every `<img>` has meaningful `alt`; skip-link, focus-visible and aria-live present.
7. pa11y WCAG2AA "after" report shows 0 errors (or every remaining issue is
   documented and justified).
8. LICENSE + accessibility statement reachable from every page.

## Checks
- Functional: open each page in Chromium; console must be error-free.
- Accessibility: `npx pa11y --standard WCAG2AA --reporter json <page>` before/after.
- HTML validity: pa11y + manual landmark review.

## Task list
| ID | Task | Route | Trigger evidence |
|----|------|-------|------------------|
| T1 | Scaffold repo, design tokens, LICENSE, README | inline | mechanical, already understood |
| T2 | Core site: 5 pages + css + js + SVG/audio assets | delegated writer | 2+ non-trivial files |
| T3 | jQuery interactive elements (3) wired + documented | delegated writer | 2+ non-trivial files |
| T4 | Read-speaker (TTS) module | delegated writer | new non-trivial file + integration |
| T5 | Accessibility audit before/after + report | parent (bounded action) | tool run + doc |
| T6 | Docs: accesibilidad, storyboard, presentación | delegated writer | 2+ non-trivial files |
| T7 | Fixes from audit + final verification | delegated writer | bounded correction |

## Progress
- [x] Explore original project (mapped by explore agent)
- [x] T1 Scaffold + git init + LICENSE — commit e223660
- [x] T2 Core site (theme + shell + Inicio + assets) — commit c83cf24
- [x] T3 jQuery elements — commits e4cc192 (explorer) + 088bf0a (picker/hyperspace/music/back-to-top)
- [x] T4 Read speaker (Web Speech API) — commit 088bf0a
- [x] T5 Accessibility audit before/after — axe-core 4.14.0, 88 (original) -> 8 -> 0 violations
- [x] T6 Docs (historia, enlaces, accesibilidad, storyboard, presentacion, README, NOTICE) — commit 28f3927
- [x] T7 Fixes + final verification — commit a4eea77 (0 violations on 8 pages)

## Verification evidence
- axe-core 4.14.0 WCAG 2.1 AA, Chromium 153 headless, page served over http:
  - original Pokemon project: 88 violation nodes
  - Star Wars initial (28f3927): 8 violation nodes, 77 incomplete
  - Star Wars after fixes (a4eea77): 0 violation nodes, 51 incomplete (SVG-text / hero gradient, manually verified AA)
- Reports: docs/informe-accesibilidad-antes.md, docs/informe-accesibilidad-despues.md
- Contrast verified: #5aa9e6 on #0e1524 = 7.17:1, on #16203a = 6.34:1
- All 8 pages keep the shared shell (`grep -L contenido-principal` -> none)

## Next step
Done. Optional: fill presentation slide 1 team names; verify VTT captions over http.

## Known limitations
- VTT captions require an HTTP server (blocked under file://).
- YouTube iframe content is third-party and not audited (frame-tested).
- Figma deliverable intentionally waived by the user (rubric criterion 2).

## Rationale log
- Chose original SVG artwork over third-party photos to avoid shipping copyrighted
  assets while still satisfying the "images" requirement.
- Chose jQuery (not React) for the 3 interactive elements: no build step, matches
  "React/JQuery" rubric wording, keeps the static-file constraint.
