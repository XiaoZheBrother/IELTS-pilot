# IELTS Pilot v0.9 AI Writing Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an auditable AI-assisted IELTS writing workflow, secure browser and desktop model adapters, a locally deployed production build, complete demo walkthrough screenshots, product documentation, and a Windows v0.9 installer.

**Architecture:** Keep rubric math, prompt construction, response parsing, and evidence validation in a framework-independent TypeScript domain module. Persist writing drafts and validated reports in a separate local repository. Route browser production requests through a same-origin Node gateway and desktop requests through a Tauri Rust command, while keeping one client contract in the Vue application.

**Tech Stack:** Vue 3, TypeScript, Vitest, Playwright, Node.js built-in HTTP server, OpenAI-compatible Chat Completions, Tauri 2, Rust/reqwest, ReportLab, python-docx, Poppler/LibreOffice.

---

## File map

- `src/domain/writingAssessment.ts`: writing types, prompt version, word count, band calculation, JSON extraction and validation.
- `src/data/writingTasks.ts`: original Task 1/Task 2 prompts, chart data and demonstration essays.
- `src/storage/writingRepository.ts`: versioned drafts and assessment reports.
- `src/platform/writingAssessmentClient.ts`: browser/Tauri transport contract.
- `src/platform/writingViewDependencies.ts`: injectable view dependencies.
- `src/views/WritingStudioView.vue`: selection, editor, autosave, consent and request state.
- `src/views/WritingReportView.vue`: rubric, evidence and report metadata.
- `src/components/WritingRubric.vue`: accessible four-criterion score ledger.
- `src/styles/writing.css`: responsive writing and report surfaces.
- `tools/lib/ai-config.mjs`: external config/env parser with secret-safe errors.
- `tools/ai-writing-server.mjs`: static production server, health route and constrained AI proxy.
- `src-tauri/src/ai_writing.rs`: desktop HTTPS adapter.
- `src/domain/demoProfile.ts`: deterministic demo data installer.
- `tests/e2e/v09Walkthrough.spec.ts`: full production walkthrough and screenshots.
- `docs/product/IELTS-Pilot-v0.9-产品功能说明书.md`: source product manual.
- `tools/build-product-guide.py`: DOCX/PDF manual builder.

### Task 1: Writing rubric domain and original tasks

**Files:**
- Create: `src/domain/writingAssessment.ts`
- Create: `src/data/writingTasks.ts`
- Test: `tests/unit/writingAssessment.test.ts`
- Test: `tests/unit/writingTasks.test.ts`

- [ ] **Step 1: Write failing rubric tests**

Cover Unicode-aware English word counting, half-band normalization, overall-band calculation, fenced JSON extraction, missing criterion rejection, out-of-range score rejection, and evidence quote removal when the quote does not occur in the essay.

```ts
expect(calculateOverallBand([6, 6.5, 7, 7])).toBe(6.5)
expect(parseWritingAssessment(content, essay).evidence.every((item) => essay.includes(item.quote))).toBe(true)
```

- [ ] **Step 2: Verify RED**

Run `npx vitest run tests/unit/writingAssessment.test.ts tests/unit/writingTasks.test.ts`.
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the pure domain**

Define `WritingTask`, `WritingDraft`, `WritingCriterion`, `WritingEvidence`, `WritingAssessment`, `WRITING_PROMPT_VERSION = 'writing-v1'`, `countWritingWords`, `calculateOverallBand`, `buildWritingMessages`, and `parseWritingAssessment`. Require four named criteria, bands from 0 to 9 in 0.5 steps, bounded arrays and evidence quotes contained in the submitted essay.

- [ ] **Step 4: Add two original tasks and demonstration essays**

Task 1 uses an original fictional city-library visitor dataset rendered from structured values. Task 2 asks whether public libraries should balance digital services with quiet physical study space. Each task declares provenance as original IELTS Pilot material.

- [ ] **Step 5: Verify GREEN and commit**

Run the two test files and then `npm run typecheck`. Commit with `feat: AI add auditable writing rubric`.

### Task 2: Local writing repository

**Files:**
- Create: `src/storage/writingRepository.ts`
- Test: `tests/unit/writingRepository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Prove save/load/remove draft behavior, newest-first reports, corrupted storage recovery, strict report migration, and absence of fields named `apiKey`, `authorization`, `token`, or `rawResponse` in serialized data.

- [ ] **Step 2: Verify RED**

Run `npx vitest run tests/unit/writingRepository.test.ts`.
Expected: FAIL because the repository is absent.

- [ ] **Step 3: Implement version 1 repository**

Use key `ielts-pilot:writing:v1` with `{ version: 1, drafts, reports }`. Clone values on boundaries and discard invalid records rather than allowing malformed AI content into views.

- [ ] **Step 4: Verify GREEN and commit**

Run the repository and domain tests. Commit with `feat: AI persist local writing reports`.

### Task 3: Secure AI gateway and client contract

**Files:**
- Create: `tools/lib/ai-config.mjs`
- Create: `tools/ai-writing-server.mjs`
- Create: `src/platform/writingAssessmentClient.ts`
- Test: `tests/integration/aiWritingServer.test.ts`
- Test: `tests/unit/writingAssessmentClient.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing server and client tests**

Start the gateway against a local fixture upstream and assert health, static SPA fallback, body limit, method rejection, upstream timeout mapping, Authorization injection, and secret-free logs/errors. Assert the browser client uses the same-origin API and converts gateway errors into typed recovery messages.

- [ ] **Step 2: Verify RED**

Run `npx vitest run tests/unit/writingAssessmentClient.test.ts` and `npm run test:integration -- aiWritingServer`.
Expected: FAIL because the gateway and client are absent.

- [ ] **Step 3: Implement external config parsing**

Support environment variables and the four non-empty lines in the supplied config format: base URL, secret key, model, full completion endpoint. Validate HTTPS, never echo the secret, and allow `--config`, `--port`, `--host`, and `--dist` arguments.

- [ ] **Step 4: Implement constrained production server**

Serve `dist`, expose `GET /api/v1/writing/health`, proxy only `POST /api/v1/writing/evaluate`, enforce 32 KiB bodies and a 90-second timeout, attach a request id, and return `{ content, model, requestId, usage }`.

- [ ] **Step 5: Implement browser/Tauri client contract**

Expose `checkAvailability()` and `evaluate(request, optionalEphemeralDesktopConfig)`. Use fetch on web and injected Tauri invoke on desktop. Never persist the optional config.

- [ ] **Step 6: Verify GREEN and commit**

Run client and integration tests. Commit with `feat: AI add secure assessment gateway`.

### Task 4: Tauri desktop adapter

**Files:**
- Create: `src-tauri/src/ai_writing.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Test: `tests/unit/desktopConfig.test.ts`

- [ ] **Step 1: Extend failing desktop config checks**

Assert the Rust module is registered, `evaluate_writing` is in the invoke handler, reqwest uses rustls, and no hard-coded key-like string exists in Tauri sources.

- [ ] **Step 2: Verify RED**

Run `npx vitest run tests/unit/desktopConfig.test.ts`.
Expected: FAIL on missing command and dependency.

- [ ] **Step 3: Implement the Rust command**

Accept endpoint/model/key/messages, require HTTPS, enforce input lengths, send a JSON Chat Completions request with reqwest, apply timeout, and return content/model/request id/usage. Error messages contain status and recovery category but never headers or response secrets.

- [ ] **Step 4: Verify GREEN and commit**

Run the unit test and `cargo check --manifest-path src-tauri/Cargo.toml`. Commit with `feat: AI connect desktop writing assessment`.

### Task 5: Writing studio and report interface

**Files:**
- Create: `src/platform/writingViewDependencies.ts`
- Create: `src/components/WritingRubric.vue`
- Create: `src/views/WritingStudioView.vue`
- Create: `src/views/WritingReportView.vue`
- Create: `src/styles/writing.css`
- Modify: `src/router.ts`
- Modify: `src/App.vue`
- Modify: `src/styles/main.css`
- Test: `tests/unit/WritingStudioView.test.ts`
- Test: `tests/unit/WritingReportView.test.ts`
- Test: `tests/unit/appShell.test.ts`

- [ ] **Step 1: Write failing view tests**

Assert task switching, demo essay loading, word count, autosave, explicit consent, loading state, recoverable error, report navigation, four criterion rows, evidence quotes, metadata and disclaimer.

- [ ] **Step 2: Verify RED**

Run the three view tests.
Expected: FAIL because routes and components are absent.

- [ ] **Step 3: Implement the editor workflow**

Build a 5/7 task/editor layout with semantic labels, 44 px controls, `aria-live` status, a consent dialog, ephemeral desktop connection fields and no silent send. Preserve the essay on every error.

- [ ] **Step 4: Implement the report**

Show overall band, four score ledgers, reasons, strengths, priorities and source-backed evidence. Use one electric-blue accent, tabular score numerals, balanced headings and responsive stacking.

- [ ] **Step 5: Run visual-preflight scans**

Use `rg` to prove no `transition: all`, no `will-change: all`, no tiny body text on mobile, visible focus selectors, and reduced-motion support.

- [ ] **Step 6: Verify GREEN and commit**

Run all new view tests, `npm run typecheck`, and a production build. Commit with `feat: AI build writing feedback studio`.

### Task 6: Demonstration profile and complete walkthrough

**Files:**
- Create: `src/domain/demoProfile.ts`
- Modify: `src/views/SettingsView.vue`
- Create: `tests/unit/demoProfile.test.ts`
- Create: `tests/e2e/v09Walkthrough.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Write failing demo profile tests**

Require deterministic attempts, one active draft, favorites, annotation, reader preferences and a valid writing report without changing signed-source trust or storing any credential.

- [ ] **Step 2: Verify RED**

Run `npx vitest run tests/unit/demoProfile.test.ts`.
Expected: FAIL because the installer is absent.

- [ ] **Step 3: Implement an idempotent demo installer**

Add a Settings action with confirmation. Re-running updates known demo IDs without duplicating records and reports exactly what was installed.

- [ ] **Step 4: Add production walkthrough**

Use the production server, install the demo profile through the UI, exercise dashboard, library, practice draft, result, error book, favorites, analytics, annotations/settings, package manager/editor, content source, sync, updates, writing editor and writing report. Save readable 1440x900 screenshots under `artifacts/v0.9-walkthrough/`.

- [ ] **Step 5: Verify and commit**

Run the demo unit test and the walkthrough with a deterministic intercepted AI response. Commit with `test: AI add complete product walkthrough`.

### Task 7: Real AI smoke test and local production deployment

**Files:**
- Create: `tools/ai-writing-smoke.mjs`
- Create: `docs/deploying-v09.md`
- Modify: `.gitignore`
- Modify: `package.json`
- Test: `tests/integration/aiWritingSmokeContract.test.ts`

- [ ] **Step 1: Write the failing smoke-contract test**

Assert the script reads only `--config`/environment, prints redacted JSON containing success/model/criteria/evidence counts, and never prints the key or Authorization value.

- [ ] **Step 2: Verify RED and implement**

Run the contract test, then implement a real Task 2 call through the local gateway and validate it with `parseWritingAssessment` via the built application module or a shared runtime-compatible validator.

- [ ] **Step 3: Deploy production locally**

Build the SPA, launch the configured server on an available loopback port, verify health, navigate the actual writing UI, submit the demonstration essay, and retain the validated report for the walkthrough screenshot. Record the exact launch and recovery commands without recording secrets.

- [ ] **Step 4: Commit**

Commit with `chore: AI document writing service deployment`.

### Task 8: Product guide in Markdown, DOCX and PDF

**Files:**
- Create: `docs/product/IELTS-Pilot-v0.9-产品功能说明书.md`
- Create: `tools/build-product-guide.py`
- Generate: `artifacts/IELTS-Pilot-v0.9-产品功能说明书.docx`
- Generate: `artifacts/IELTS-Pilot-v0.9-产品功能说明书.pdf`

- [ ] **Step 1: Draft the full manual**

Cover positioning, audience, architecture, start/install, all reading workflows, scoring, packages, signed sources, encrypted sync, updates, writing AI workflow, demo profile, storage/security, troubleshooting, known limits and copyright attribution. Reference every walkthrough screenshot with a descriptive caption.

- [ ] **Step 2: Build DOCX and PDF**

Use one compact reference-guide style: Letter portrait, 1-inch margins, 11 pt body, consistent blue headings, fixed-width tables, running header/footer and embedded screenshot outlines. Generate both formats from the same structured content.

- [ ] **Step 3: Render and visually inspect every page**

Use the bundled DOCX renderer with `--emit_pdf`, render the final PDF to PNG, check page count, clipped text, tables, captions, screenshot legibility, headers and page numbers. Revise until all pages pass.

- [ ] **Step 4: Commit source documentation**

Commit tracked source and builder with `docs: AI publish complete product guide`. Generated `artifacts/` remain ignored delivery outputs.

### Task 9: Version, full verification and release

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/platform/runtime.ts`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `README.md`
- Modify: `docs/ROADMAP.md`
- Modify: `.github/workflows/windows-release.yml`

- [ ] **Step 1: Set version 0.9.0 and document the milestone**

Keep the existing reference attribution unchanged. Explain that AI scoring is assistive, model-dependent and not official, and document browser gateway versus desktop ephemeral configuration.

- [ ] **Step 2: Run the complete quality gate**

Run `npm run check`, `npm run test:integration`, `npm run test:e2e`, `cargo check --manifest-path src-tauri/Cargo.toml`, signed-catalog verification, secret scans and `git diff --check`.

- [ ] **Step 3: Build release artifacts**

Build the v0.9 NSIS installer, sign the updater artifact with the existing external updater key, compute SHA-256, and copy installer/signature/screenshots/manuals into the main repository `artifacts/` directory.

- [ ] **Step 4: Commit, fast-forward and verify main**

Commit with `feat: AI complete version zero point nine`, fast-forward local `main`, run the final check from `main`, confirm a clean worktree, and remove the feature worktree/branch.
