# IELTS Pilot v0.2 Reading Studio Implementation Plan

> **For Codex:** Execute this plan task by task with test-driven development. Keep the bundled content original and preserve the existing copyright attribution.

**Goal:** Deliver a complete local-first reading studio with 12 renderable IELTS question mechanics, an original 40-question mock, content import, source-linked review, analytics, and data backup.

**Architecture:** Keep Vue views thin. Place question modeling/scoring/import validation/analytics in pure TypeScript domain modules; session state in composables; versioned browser persistence behind repository interfaces. Reuse one generic reading workspace for practice and mock sessions where practical, while keeping routes explicit.

**Tech Stack:** Vue 3, TypeScript, Vue Router, Vite, Vitest, Vue Test Utils, Playwright, CSS custom properties.

---

### Task 1: Expand the typed question engine

**Files:**
- Modify: `src/domain/models.ts`
- Modify: `src/domain/answerMatcher.ts`
- Modify: `src/domain/readingScorer.ts`
- Modify: `src/components/QuestionRenderer.vue`
- Test: `tests/unit/answerMatcher.test.ts`
- Test: `tests/unit/readingScorer.test.ts`
- Test: `tests/unit/QuestionRenderer.test.ts`

1. Add failing matcher/scorer tests for string-array answers, order-insensitive multi-select, and all discriminants.
2. Run the focused tests and confirm type/behavior failures.
3. Implement the question union, answer normalization, and scoring metadata.
4. Add failing renderer tests for judgment, select, matching, free-text, word-bank, and diagram families.
5. Implement accessible controls for each family.
6. Run focused tests, typecheck, and commit.

### Task 2: Add content validation and original mock data

**Files:**
- Create: `src/domain/contentPackage.ts`
- Create: `src/data/fullMock.ts`
- Modify: `src/data/practiceSets.ts`
- Test: `tests/unit/contentPackage.test.ts`
- Test: `tests/unit/practiceSets.test.ts`

1. Write failing tests for valid packages, unsupported versions, missing licenses, duplicate IDs, script strings, and bad source references.
2. Implement pure package validation and normalization.
3. Expand the two original passages and add a third original passage so the bundled mock has 40 questions and represents at least eight families.
4. Attach verified source references and richer catalog metadata.
5. Run tests/typecheck and commit.

### Task 3: Upgrade persistence, backup, and analytics

**Files:**
- Modify: `src/storage/practiceRepository.ts`
- Create: `src/domain/analytics.ts`
- Test: `tests/unit/practiceRepository.test.ts`
- Create: `tests/unit/analytics.test.ts`

1. Write failing tests for v1 migration, imported sets, flags, backup export/import, and malformed backup rejection.
2. Implement the version-2 repository envelope with immutable reads/writes.
3. Write failing aggregate tests for recent trend, type accuracy, time, and error rows.
4. Implement pure analytics derivation.
5. Run tests/typecheck and commit.

### Task 4: Implement generic practice and complete mock sessions

**Files:**
- Modify: `src/composables/usePracticeSession.ts`
- Create: `src/composables/useMockSession.ts`
- Modify: `src/views/PracticeView.vue`
- Create: `src/views/MockView.vue`
- Modify: `src/router.ts`
- Test: `tests/unit/usePracticeSession.test.ts`
- Create: `tests/unit/useMockSession.test.ts`

1. Add failing tests for array answers, flags, draft restoration, passage switching, expiry, and 40-question scoring.
2. Implement the practice compatibility layer and mock session.
3. Build the mock view with tabs, timer, 1–40 navigation, mobile pane switch, flagging, and confirmation dialog.
4. Add lazy-loaded routes and verify focused tests/typecheck.
5. Commit.

### Task 5: Build library, results, and analytics screens

**Files:**
- Create: `src/views/LibraryView.vue`
- Create: `src/views/AnalyticsView.vue`
- Modify: `src/views/DashboardView.vue`
- Modify: `src/views/ResultView.vue`
- Modify: `src/App.vue`
- Modify: `src/router.ts`
- Create/modify component tests under `tests/unit/`

1. Write failing component tests for search/filter, import feedback, dashboard mock CTA, analytics metrics, and source-review expansion.
2. Implement the views and global navigation.
3. Add safe file download/upload helpers and accessible feedback regions.
4. Run component tests/typecheck and commit.

### Task 6: Translate the approved original visual direction

**Files:**
- Split/modify: `src/styles/main.css`
- Create: `src/styles/tokens.css`
- Create: `src/styles/base.css`
- Create: `src/styles/shell.css`
- Create: `src/styles/workspace.css`
- Create: `src/styles/reports.css`
- Modify: `src/main.ts`

1. Introduce paper/ink/signal tokens and type scales.
2. Implement the asymmetric dashboard/library/report layouts from the generated references.
3. Implement exact-property transitions, active press states, focus-visible rules, and reduced-motion behavior.
4. Verify 375/768/1024/1440 layouts in the browser and fix overflow/overlap.
5. Commit.

### Task 7: End-to-end verification and documentation

**Files:**
- Modify: `tests/e2e/readingJourney.spec.ts`
- Modify: `README.md`
- Create: final screenshots under ignored `artifacts/screenshots/`

1. Add Playwright journeys for library filtering/import rejection, complete mock submission, source review, analytics, and mobile workspace.
2. Update README with v0.2 capabilities, JSON content package guidance, data limitations, commands, and existing reference attribution.
3. Run unit tests, typecheck, build, and E2E tests.
4. Inspect final desktop and mobile screenshots at original resolution.
5. Run a final diff/status audit, commit, merge into `main`, and push with the configured author identity.

