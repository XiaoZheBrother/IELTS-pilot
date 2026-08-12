# IELTS Pilot v0.3–v0.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a tested offline Windows application with a deeper reading workflow and a safely versioned, locally authorable content library.

**Architecture:** Keep one Vue/Vite application and add a minimal Tauri 2 shell. Advance persistence to a version-3 local envelope and place annotations, error-book derivation, and package lifecycle behind independently tested domain/repository interfaces.

**Tech Stack:** Vue 3, TypeScript, Vue Router, Vite, Vitest, Vue Test Utils, Playwright, Tauri 2, Rust, NSIS.

---

### Task 1: Version-3 persistence contract

**Files:**
- Modify: `src/domain/models.ts`
- Modify: `src/storage/practiceRepository.ts`
- Modify: `tests/unit/practiceRepository.test.ts`

- [ ] Write failing repository tests for v2 migration, preferences, annotations, favorites, error mastery, installed packages, author drafts, and v3 backup round trips.
- [ ] Run `npm run test:unit -- tests/unit/practiceRepository.test.ts` and confirm missing v3 methods fail.
- [ ] Add focused model types and implement atomic version-3 persistence with v2 backup compatibility.
- [ ] Re-run the repository test and the full unit suite.
- [ ] Commit with `feat: AI add version three local data model`.

### Task 2: Content package lifecycle

**Files:**
- Modify: `src/domain/contentPackage.ts`
- Create: `src/domain/packageLifecycle.ts`
- Create: `tests/unit/packageLifecycle.test.ts`
- Modify: `tests/unit/contentPackage.test.ts`

- [ ] Write failing tests for schema-v2 validation, schema-v1 normalization, canonical digest, preview, install, upgrade, conflict rejection, and uninstall.
- [ ] Run both content tests and verify failures identify the missing lifecycle API.
- [ ] Implement normalized package v2 types, deterministic canonicalization, integrity verification, and pure lifecycle functions.
- [ ] Re-run focused and complete unit tests.
- [ ] Commit with `feat: AI add versioned content package lifecycle`.

### Task 3: Reader preferences and annotations

**Files:**
- Create: `src/domain/annotations.ts`
- Create: `src/composables/useReaderPreferences.ts`
- Create: `src/composables/usePassageAnnotations.ts`
- Create: `src/components/PassageReader.vue`
- Create: `tests/unit/annotations.test.ts`
- Create: `tests/unit/PassageReader.test.ts`

- [ ] Write failing tests for valid ranges, invalid stale ranges, preference persistence, highlight creation, color change, note save, and deletion.
- [ ] Verify focused tests fail for missing modules/components.
- [ ] Implement annotation helpers, reactive preferences, selection capture, and the shared passage reader.
- [ ] Verify focused tests and run accessibility-oriented component assertions.
- [ ] Commit with `feat: AI add reader preferences and annotations`.

### Task 4: Session pause, navigation guard, and shortcuts

**Files:**
- Modify: `src/domain/models.ts`
- Modify: `src/composables/usePracticeSession.ts`
- Modify: `src/views/PracticeView.vue`
- Modify: `src/views/MockView.vue`
- Modify: `tests/unit/usePracticeSession.test.ts`
- Create: `tests/unit/PracticeView.test.ts`

- [ ] Write failing tests proving practice timers pause, mock timers do not, shortcuts ignore form fields, and dirty navigation requires confirmation.
- [ ] Run focused tests and confirm the new behavior is absent.
- [ ] Implement pause state persistence, before-unload/route guards, and keyboard navigation.
- [ ] Re-run focused tests and mock-session regressions.
- [ ] Commit with `feat: AI improve focused reading sessions`.

### Task 5: Error book, favorites, retry drills, and print report

**Files:**
- Create: `src/domain/errorBook.ts`
- Create: `src/views/ErrorBookView.vue`
- Create: `src/views/FavoritesView.vue`
- Modify: `src/views/ResultView.vue`
- Modify: `src/views/DashboardView.vue`
- Modify: `src/views/LibraryView.vue`
- Modify: `src/router.ts`
- Create: `tests/unit/errorBook.test.ts`
- Create: `tests/unit/ErrorBookView.test.ts`
- Create: `tests/unit/FavoritesView.test.ts`

- [ ] Write failing tests for filters, mastery, generated retry sets, favorite persistence/display, and report print action.
- [ ] Verify the tests fail before implementation.
- [ ] Implement focused domain derivation and the two new views; add navigation and print-safe result controls.
- [ ] Re-run focused tests and route/app-shell regressions.
- [ ] Commit with `feat: AI add error book and favorites workflows`.

### Task 6: Package manager and authoring workspace

**Files:**
- Create: `src/views/PackageManagerView.vue`
- Create: `src/views/PackageEditorView.vue`
- Create: `src/components/PackagePreview.vue`
- Create: `src/components/QuestionEditor.vue`
- Modify: `src/views/LibraryView.vue`
- Modify: `src/router.ts`
- Create: `tests/unit/PackageManagerView.test.ts`
- Create: `tests/unit/PackageEditorView.test.ts`

- [ ] Write failing component tests for preview-before-install, conflicts, upgrades, uninstall, draft editing, validation, and JSON export.
- [ ] Verify the new view tests fail for missing components/routes.
- [ ] Implement the package management index and accessible multi-section editor using the shared validator.
- [ ] Re-run focused tests and complete component suite.
- [ ] Commit with `feat: AI add package management and authoring`.

### Task 7: Settings, About, themes, and editorial polish

**Files:**
- Create: `src/views/SettingsView.vue`
- Create: `src/views/AboutView.vue`
- Modify: `src/App.vue`
- Modify: `src/router.ts`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/shell.css`
- Modify: `src/styles/workspace.css`
- Modify: `src/styles/reports.css`
- Create: `src/styles/library-tools.css`
- Create: `tests/unit/SettingsView.test.ts`
- Create: `tests/unit/AboutView.test.ts`

- [ ] Write failing tests for all preferences, platform metadata, attribution, navigation, and theme root attributes.
- [ ] Verify failures are caused by missing views and controls.
- [ ] Implement views and polish the shared editorial design at 375, 768, 1024, and 1440 widths.
- [ ] Re-run focused tests and the full unit suite.
- [ ] Commit with `feat: AI add settings and application information`.

### Task 8: Tauri desktop shell

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `src/platform/runtime.ts`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/icons/*`
- Create: `.github/workflows/windows-release.yml`

- [ ] Add a static configuration test that checks identifier, frontend build hooks, NSIS target, and package scripts; run it and verify failure.
- [ ] Install official Tauri dependencies and initialize the minimal shell with WebView2-compatible settings.
- [ ] Add CI release construction for tagged Windows builds without publishing secrets.
- [ ] Run the configuration test, `cargo check`, and `npm run desktop:build`; verify an NSIS executable exists.
- [ ] Commit with `build: AI package Windows desktop application`.

### Task 9: Documentation, sample content, and full verification

**Files:**
- Modify: `README.md`
- Create: `docs/content-package-format.md`
- Create: `examples/sample-content-package-v2.json`
- Modify: `tests/e2e/readingJourney.spec.ts`
- Create: `tests/e2e/libraryManagement.spec.ts`

- [ ] Add E2E journeys for preferences, annotation, error/favorite workflows, package lifecycle, and author export.
- [ ] Document browser startup, desktop installation, unsigned-app warning, backups, authoring, package format, upgrade rules, attribution, and copyright limits.
- [ ] Validate the sample package through the production validator test.
- [ ] Run `npm run check`, `npm run test:e2e`, `cargo check`, and `npm run desktop:build` from a clean tree.
- [ ] Capture production screenshots for Dashboard, Practice annotation, Error Book, Package Manager, and Package Editor.
- [ ] Commit with `test: AI verify desktop reading library release` and merge to `main`.
