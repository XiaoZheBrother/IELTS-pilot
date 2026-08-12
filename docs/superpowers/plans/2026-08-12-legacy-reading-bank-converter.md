# Legacy Reading Bank Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all local IELTS Atlas `ReadingExamSourceV1` files into validated, privately transferable IELTS Pilot v2 JSON packages.

**Architecture:** A sandboxed Node ESM converter captures generated registries, uses JSDOM for deterministic HTML-to-domain extraction, and emits chunked v2 packages plus an auditable report. Tests import the pure conversion functions, while a TypeScript validation command exercises the application's actual `validateContentPackage` implementation.

**Tech Stack:** Node.js ESM, `node:vm`, JSDOM, TypeScript, Vitest, Playwright, existing IELTS Pilot content-package validator.

---

### Task 1: Define converter behavior with failing tests

**Files:**
- Create: `tests/unit/legacyReadingConverter.test.ts`
- Create: `tests/fixtures/legacy-reading/exam.js`
- Create: `tests/fixtures/legacy-reading/explanation.js`
- Create: `tools/convert-ielts-practice-reading.mjs`

- [ ] Write tests that import the converter API and assert sandbox capture, passage cleaning, TFNG conversion, matching options, alternative answers, source references and one valid package.
- [ ] Run `npx vitest run tests/unit/legacyReadingConverter.test.ts` and confirm failure because the converter module does not exist.
- [ ] Implement only the exported parsing and conversion functions needed by the tests.
- [ ] Re-run the targeted test and confirm all cases pass.
- [ ] Commit with `feat: AI add legacy reading conversion core`.

### Task 2: Add batch output and application validation

**Files:**
- Modify: `tools/convert-ielts-practice-reading.mjs`
- Create: `tools/validate-content-packages.ts`
- Create: `tests/integration/legacyReadingConverter.test.ts`
- Modify: `package.json`

- [ ] Write a failing integration test that executes the CLI on fixture directories and expects package JSON, `conversion-report.json`, and `SHA256SUMS.txt`.
- [ ] Run the integration test and confirm the missing batch behavior fails.
- [ ] Implement CLI arguments, stable category chunking, atomic output replacement, report generation and hash output.
- [ ] Add `content:convert:legacy` and `content:validate` scripts; the latter imports and calls the production validator for every JSON package except the report.
- [ ] Run unit and integration tests and confirm they pass.
- [ ] Commit with `feat: AI batch legacy reading packages`.

### Task 3: Convert and verify the complete local bank

**Files:**
- Output only: `artifacts/import/ielts-practice-reading/*`

- [ ] Run the converter against `D:/Users/yuqi.chen/CC/IELTS-practice` with package size 25.
- [ ] Assert the report contains 234 source sets and 3143 source questions, with equal converted totals and zero failed packages.
- [ ] Run `npm run content:validate -- --input artifacts/import/ielts-practice-reading` and require every package to pass the production validator.
- [ ] Inspect several packages and confirm no script elements, absolute local source paths or credentials are present.

### Task 4: Exercise the real import UI

**Files:**
- Create: `tests/e2e/legacyPackageImport.spec.ts`

- [ ] Write an E2E test that generates a fixture package, uploads it through the package manager file input, verifies preview metadata, confirms installation and finds the imported title in the library.
- [ ] Run the test first against an invalid fixture path to confirm it fails at upload.
- [ ] Point it to the generated fixture package and confirm it passes on desktop Chromium.
- [ ] Run `npm run check`, `npm run test:integration`, the targeted E2E test and `cargo check`.
- [ ] Commit with `test: AI verify converted package import`.

### Task 5: Document transfer and complete the branch

**Files:**
- Modify: `README.md`
- Modify: `docs/content-package-format.md`

- [ ] Document the local-only legacy conversion command, output directory, import steps and copyright boundary.
- [ ] Verify generated third-party content remains ignored and only converter code, tests and documentation are staged.
- [ ] Run the complete verification suite and inspect the final Git diff.
- [ ] Commit with `docs: AI explain private legacy bank migration`.
- [ ] Fast-forward the verified branch into `main`, copy ignored artifacts to the main worktree and keep the production deployment available.
