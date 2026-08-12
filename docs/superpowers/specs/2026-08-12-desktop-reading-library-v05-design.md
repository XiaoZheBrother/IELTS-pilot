# IELTS Pilot v0.3–v0.5 Desktop Reading Library Design

## Goal

Evolve the existing v0.2 reading MVP into a polished offline Windows application with a deeper reading workflow and a safely manageable content library. The release remains local-first, requires no account or backend, and does not bundle unauthorized IELTS material.

## Chosen approach

The product keeps Vue 3 and Vite as the shared application and adds a thin Tauri 2 desktop shell. Web and desktop builds share all domain, storage, and interface code. Feature work is divided by capability boundaries rather than separate applications:

1. desktop delivery and environment detection;
2. reader preferences, annotations, navigation, and review workflow;
3. versioned content packages and a local authoring workspace.

This is preferred over Electron because the application has no Node-only runtime need and can use the Windows WebView2 runtime. It is preferred over a Windows-only native rewrite because the existing tested Vue application remains the source of truth.

## Product scope

### v0.3 — Windows desktop delivery

- Tauri 2 wraps the current Vite build and creates an NSIS `Setup.exe`.
- Application identity is `IELTS Pilot`, bundle identifier `com.xiaozhebrother.ieltspilot`, version `0.5.0` at the consolidated milestone.
- The installer creates Start menu and desktop shortcuts and installs per user without requiring administrator privileges.
- The application is usable entirely offline after installation.
- Browser and desktop editions use the same versioned local schema and exchange data through JSON backup files.
- An About view shows version, platform, local-data status, attribution, and non-official-product notice.
- Automatic update and paid code signing are outside this milestone. README documents that unsigned builds can trigger Windows SmartScreen.

### v0.4 — Reading workflow

- A settings view persists font size, line height, reading width, color theme (`paper`, `sepia`, `night`), and default timed/untimed practice mode.
- Selection inside passage paragraphs can be saved as one of three highlight colors or as a note. An annotation stores set ID, section and paragraph indexes, selected text, surrounding offsets, color, optional note, and timestamps.
- Practice mode can be paused. A paused timer does not decrement; leaving an active session displays a confirmation prompt. Mock mode remains strictly timed and cannot pause.
- Keyboard shortcuts work outside text fields: `J`/`K` next/previous question, `F` flag, `1`/`2` passage/questions mobile pane, and `Ctrl/Cmd+Enter` submission confirmation.
- Independent error-book and favorites views support filtering by set, question type, and date/state. Incorrect items can be marked mastered or retried as a generated local drill.
- Sets and individual questions can be favorited. Dashboard and library expose the state without turning every row into a card.
- Attempt details keep the current source-linked review. The result report has a print mode suitable for browser printing or PDF export.
- Accessibility remains WCAG-AA oriented with visible focus, semantic buttons, live feedback, keyboard-operable dialogs, and 44px mobile targets.

### v0.5 — Content library

- Content package schema v2 adds package version, description, created/updated timestamps, minimum app version, and changelog while retaining import compatibility for schema v1.
- Import is two-phase: parse/validate to an immutable preview, then explicit installation. The preview shows owner, license, version, set/question counts, topics, and conflicts.
- Installed packages are first-class records rather than a flattened set array. Package IDs and set IDs are unique across bundled and installed content.
- Installing a newer version upgrades the package atomically. Same/older versions are rejected; duplicate set IDs from another package are rejected. Removing a package never removes attempts or drafts, but its practice content becomes unavailable until reinstalled.
- Package integrity is computed from a deterministic canonical JSON representation using SHA-256 when the Web Crypto API is available. An optional declared digest must match before installation.
- The authoring workspace creates and edits complete packages locally. It supports passage metadata, sections/paragraphs, provenance, all existing question types, answer alternatives, explanations, and source references.
- Draft packages are stored locally, validated through the same package validator, previewed, and exported as schema-v2 JSON. No executable HTML is accepted.
- A sample package and a format guide document every required field, supported question type, version rule, integrity rule, and copyright boundary.

## Data model and migration

The persistence envelope advances to version 3:

- `drafts`: practice/mock answers, flags, timer, current question, pause state;
- `attempts`: immutable submitted results;
- `installedPackages`: package metadata plus contained sets and integrity;
- `authorDrafts`: unfinished local packages;
- `preferences`: reader and practice preferences;
- `annotations`: highlights and notes;
- `favoriteSetIds` and `favoriteQuestionIds`;
- `masteredErrorKeys`: `${attemptId}:${questionId}` markers.

Version-2 storage migrates automatically: imported flat sets become a legacy package, drafts and attempts are normalized, and reader preferences use defaults. Backup export uses schema version 3; import accepts both v2 and v3 and validates fully before writing.

The browser repository remains synchronous over `localStorage`. This is deliberate for the current data size and keeps web/desktop behavior identical. The storage interface isolates a future SQLite or filesystem adapter.

## Architecture

- `src/platform/`: desktop/web environment and application metadata.
- `src/domain/contentPackage.ts`: schema v1/v2 parsing, validation, canonicalization, compatibility checks, and preview model.
- `src/domain/annotations.ts`: normalized selection ranges and annotation helpers.
- `src/domain/errorBook.ts`: filters and generated retry practice sets.
- `src/storage/practiceRepository.ts`: version-3 migration and persistence facade.
- `src/composables/useReaderPreferences.ts`: reactive preferences applied through root data attributes and CSS variables.
- `src/composables/usePassageAnnotations.ts`: selection capture and repository synchronization.
- `src/components/PassageReader.vue`: shared passage rendering, typography, selection toolbar, highlights, and notes.
- `src/components/ExamWorkspace.vue`: shared practice/mock reading and question workspace behaviors.
- `src/views/ErrorBookView.vue`, `FavoritesView.vue`, `SettingsView.vue`, `AboutView.vue`: focused workflow views.
- `src/views/PackageManagerView.vue`, `PackageEditorView.vue`: installation management and authoring.
- `src-tauri/`: minimal Rust shell, capabilities, configuration, icons, and NSIS bundle settings.

## Error handling

- Invalid backups, packages, author drafts, selection ranges, and unsupported versions return typed results and never partially mutate persisted state.
- Package installation uses copy-on-write: validate conflicts and compatibility, create the next state, then perform one storage write.
- Corrupt local storage recovers to safe defaults while preserving the raw value under a recovery key when possible.
- Missing content referenced by an old attempt shows a durable “content package unavailable” message; the attempt remains in history.
- Desktop build failures are surfaced by `npm run desktop:check`; installation is not claimed until an actual NSIS artifact exists.

## Visual direction

The existing asymmetric editorial system remains. v0.4–v0.5 add utility-dense side rails, compact segmented controls, and print-quality reports without introducing gradients, glass effects, nested cards, or decorative dashboard charts. Paper, sepia, and night themes alter reading surfaces; the global brand retains signal blue and square rules.

## Testing and acceptance

- Domain tests cover v2 package validation, v1 migration, conflict/upgrade/uninstall, integrity, annotations, error filters, and retry generation.
- Repository tests cover the v2-to-v3 migration, preference/annotation/favorite persistence, package lifecycle, author drafts, and backup round trips.
- Component tests cover selection toolbar behavior, preferences, pause state, shortcuts, route guards, print action, package preview, and editor validation.
- Playwright covers a complete practice, pause/resume, preference persistence, favorite/error workflows, package install/uninstall, author/export flow, and desktop-sized responsive layout.
- `npm run check`, `npm run test:e2e`, `cargo check`, and `npm run desktop:build` pass.
- A Windows NSIS `Setup.exe` exists and a production screenshot set demonstrates Dashboard, annotated Practice, Error Book, Package Manager, and Package Editor.

## Explicitly deferred

- Accounts, cloud sync, subscriptions, remote content feeds, automatic updates, code-signing procurement, listening, vocabulary SRS, writing AI scoring, and speaking AI scoring.
- Copying Cambridge IELTS, IELTS-practice, or other third-party passages, questions, audio, images, or PDFs without specific permission.
