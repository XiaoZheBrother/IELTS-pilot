# IELTS Pilot v0.2 — Reading Studio Design

## Goal

Turn the v0.1 passage demo into a usable, local-first IELTS reading studio without copying the reference repository's UI or copyrighted question bank. The release must support a complete 3-passage, 40-question mock, richer IELTS question mechanics, searchable practice content, source-linked review, analytics, and portable local data.

## Product boundaries

### In scope

- A typed question engine for choice, judgment, matching, and completion families.
- Three original passages and 40 original questions in one complete mock.
- A searchable and filterable practice library.
- A versioned JSON content-package importer that requires explicit provenance and license metadata.
- A 60-minute mock workspace with passage switching, question navigation, autosave, flags, and submission.
- Source references for bundled questions and source-linked wrong-answer review.
- Local analytics by attempt and question type.
- Versioned JSON backup export/import for user data.
- Responsive, accessible UI for desktop and mobile.

### Deferred

- Listening audio, vocabulary notebook, AI writing/speaking scoring, accounts, cloud sync, subscriptions, and third-party content feeds.
- Copying or bundling the original project's 234 exam files. Content may only enter this project through original, public-domain, or explicitly authorized packages.

## Design synthesis

The chosen visual direction is an **asymmetric editorial index**. It combines the most applicable guidance from the available frontend skills:

- `frontend-design`, `high-end-visual-design`, and `minimalist-ui`: disciplined spacing, warm paper surfaces, crisp rules, one signal color, restrained depth.
- `industrial-brutalist-ui`: tabular numerals, strong information grids, status rails, and print-like hierarchy—softened for sustained reading.
- `make-interfaces-feel-better`: exact-property transitions, tactile active states, visible keyboard focus, stable hover geometry, and reduced-motion support.
- `ui-ux-pro-max`: route-level splitting, responsive checkpoints, accessible forms, and trend-oriented analytics.
- `design-taste-frontend` and `image-to-code`: image-first design references, anti-template composition, purposeful asymmetry, and direct translation of the selected visual language.
- `gpt-taste`: deterministic variance selection produced `asymmetric index`, density `6`, motion `3`, and electric blue as the active accent. Landing-page-only AIDA and heavy GSAP patterns are intentionally excluded from the study workspace because they would increase cognitive load.
- The legacy v1 taste skill and Google-Stitch-only skill are not runtime inputs: the current v2 taste skill supersedes v1, and this project is not a Stitch project.

### Design dials

- Visual variance: 6/10
- Motion intensity: 3/10
- Information density: 6/10
- Primary palette: paper `#F4F0E7`, ink `#161A18`, signal blue `#2155FF`, sage, restrained error red
- UI typography: local system grotesk stack; passage typography: Georgia/local serif stack
- Shape: mostly square corners with 1px rules; no glass, gradients, soft-UI shadows, or rounded-card grids
- Theme: light editorial mode is deliberate because the product emulates a printed examination desk

## Core information architecture

- `/` — study dashboard and the primary complete-mock entry.
- `/library` — searchable/filterable passages and content package import.
- `/practice/:testId` — focused single-passage practice.
- `/mock/:mockId` — 3-passage full mock.
- `/result/:attemptId` — score, result ledger, and source-linked review.
- `/analytics` — performance trends, type accuracy, recent attempts, and backup controls.

The global header contains only the product mark, Dashboard, Library, Analytics, and a local-data indicator. Mock mode uses its own compact exam toolbar.

## Domain model

`ReadingQuestion` is a discriminated union with these UI-capable families:

1. `multiple-choice`
2. `multiple-select`
3. `true-false-not-given`
4. `yes-no-not-given`
5. `matching-headings`
6. `matching-information`
7. `matching-features`
8. `matching-sentence-endings`
9. `short-answer`
10. `sentence-completion`
11. `summary-word-bank`
12. `diagram-label`

All questions contain an explanation and a `sourceRef` with a section index and paragraph index. The answer store uses `Record<string, string[]>`; single-value controls still serialize as one-element arrays. Scoring compares normalized unordered arrays for multi-select and normalized strings for all other types.

`PracticeSet` gains topics, difficulty, estimated band, and import-safe provenance metadata. `MockTest` points at exactly three practice-set IDs and defines a 60-minute duration.

## Content package safety

An imported package is declarative JSON, never executable JavaScript or HTML. The importer validates:

- schema version and unique IDs;
- supported question types and answer shapes;
- passage/question count consistency;
- source references within passage bounds;
- a non-empty content owner, source URL or note, and license identifier;
- no `<script>` content in imported strings.

Invalid packages are rejected without mutating local state. Imported packages are stored separately from bundled originals.

## Session and persistence

The repository migrates v1 local data into a v2 envelope. It persists drafts, attempts, flags, and imported sets. A practice attempt stores `mode: practice`; a full mock stores `mode: mock`, the mock ID, and all 40 question answers. Draft keys use the session ID so practice and mock drafts cannot collide.

Backup export produces a versioned JSON file. Import performs full validation before replacing persisted user data and reports counts to the UI.

## Scoring and analytics

Raw reading results are normalized to 40 and mapped to an explicitly approximate Academic Reading band. Analytics are derived locally:

- attempt count, average band, best band, and total focused time;
- last-five accuracy trend;
- accuracy by question type;
- error-book rows for incorrect answers;
- completion and unanswered counts.

No score is described as official IELTS scoring.

## Key screens

### Dashboard

An asymmetric three-zone desktop grid: current study state, a dominant complete-mock launch block, and recent results. Below it, a compact index of recommended passages. Mobile collapses to one ordered flow with the primary mock action first.

### Library

A single-line filter rail for search, type, difficulty, and status followed by a table-like passage index. Import is a clearly secondary action with a provenance warning.

### Mock workspace

A compact status rail contains passage tabs, answered count, flags, timer, and submit. The body is a 55/45 passage/questions split. Mobile uses sticky passage/question tabs. The 1–40 navigator communicates active, answered, and flagged states without relying on color alone.

### Results and analytics

Results use a large score figure, a 40-cell result ledger, type diagnostics, and a table-like wrong-answer list. Expanding a wrong answer reveals the cited passage paragraph and explanation. Analytics repeats the same diagnostic language for consistency.

## Accessibility and responsive behavior

- Semantic landmarks, fieldsets, labels, status text, and live timer updates.
- Visible `:focus-visible` outlines with sufficient offset.
- Minimum 44px mobile interaction targets.
- Keyboard-accessible dialogs and question navigation.
- Color-independent state labels and symbols.
- Contrast target WCAG AA.
- `prefers-reduced-motion` disables nonessential transitions.
- Verification widths: 375, 768, 1024, and 1440 pixels.

## Success criteria

- A new user can start and submit the full mock and see a 40-question report.
- At least eight question types are represented in bundled original content; all twelve renderers are test-covered.
- Practice and mock drafts survive reloads.
- Search/filter and valid/invalid package imports are test-covered.
- Incorrect answers can open the cited source paragraph.
- Analytics updates from stored attempts; backup round-trips without data loss.
- Unit tests, typecheck, production build, and Playwright journeys pass.

