# v0.8 Signed Content Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit-trust remote catalogs, publisher signatures, verified package download and publisher tooling, then deliver a tested Windows v0.8.0 build.

**Architecture:** Pure catalog crypto validates canonical ECDSA signatures and package digests. Device-local trust storage prevents remote data from changing publisher trust. The content source view feeds verified packages into the existing package preview/install lifecycle.

**Tech Stack:** TypeScript Web Crypto ECDSA P-256, Vue 3, Node.js crypto CLI, Vitest, Playwright, Tauri 2.

---

### Task 1: Signed catalog domain

**Files:**
- Create: `src/domain/canonicalJson.ts`
- Create: `src/domain/signedCatalog.ts`
- Test: `tests/unit/signedCatalog.test.ts`

- [ ] **Step 1: Write failing catalog tests**

Cover schema validation, canonical key ordering, P-256 key fingerprint, valid signature, changed metadata failure, malformed JWK, duplicate package IDs, unsupported algorithm and non-HTTPS package URLs.

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/unit/signedCatalog.test.ts`
Expected: FAIL because catalog functions do not exist.

- [ ] **Step 3: Implement validation and verification**

Define `SignedContentCatalogV1`, canonicalize all signed fields except `signature`, import only EC P-256 verify keys, verify SHA-256 ECDSA signatures and calculate colon-grouped uppercase SHA-256 fingerprints.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/unit/signedCatalog.test.ts`
Expected: catalog tests pass.

### Task 2: Device-local trust and subscriptions

**Files:**
- Create: `src/storage/contentSourceRepository.ts`
- Test: `tests/unit/contentSourceRepository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Test empty defaults, adding a pending source, trusting an exact fingerprint, blocking key rotation, disabling/removing a source, revoking a publisher and persistence that is separate from practice backup.

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/unit/contentSourceRepository.test.ts`
Expected: FAIL because trust storage does not exist.

- [ ] **Step 3: Implement versioned trust storage**

Use `ielts-pilot:content-sources:v1`. Persist only catalog URL, last verified catalog metadata, public JWK, fingerprint, user trust decision and timestamps. Never persist fetched package bodies or private keys.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/unit/contentSourceRepository.test.ts`
Expected: repository tests pass.

### Task 3: Verified catalog and package client

**Files:**
- Create: `src/platform/contentSourceClient.ts`
- Modify: `src/domain/packageLifecycle.ts`
- Modify: `src/domain/models.ts`
- Test: `tests/unit/contentSourceClient.test.ts`
- Modify: `tests/unit/packageLifecycle.test.ts`

- [ ] **Step 1: Write failing client tests**

Inject fetch responses and assert catalog body limits, JSON validation, signature verification, exact raw package SHA-256, content package validation, publisher provenance and abort/timeout errors.

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/unit/contentSourceClient.test.ts tests/unit/packageLifecycle.test.ts`
Expected: FAIL on missing client and provenance metadata.

- [ ] **Step 3: Implement verified fetch**

Limit catalogs to 1 MiB and packages to 10 MiB, use `AbortController`, reject redirects from HTTPS to insecure schemes, verify trust before package fetch, verify raw bytes before JSON parsing and pass normalized content to the existing installer.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/unit/contentSourceClient.test.ts tests/unit/packageLifecycle.test.ts`
Expected: client and install provenance tests pass.

### Task 4: Content sources UI

**Files:**
- Create: `src/views/ContentSourcesView.vue`
- Create: `src/components/PublisherFingerprint.vue`
- Modify: `src/router.ts`
- Modify: `src/App.vue`
- Modify: `src/styles/library-tools.css`
- Test: `tests/unit/ContentSourcesView.test.ts`
- Test: `tests/e2e/contentSources.spec.ts`

- [ ] **Step 1: Write failing component tests**

Cover adding a signed catalog, explicit trust, key-change block, package status, verified download preview, install confirmation, source disable/remove and publisher revoke.

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/unit/ContentSourcesView.test.ts`
Expected: FAIL because the content source view is absent.

- [ ] **Step 3: Implement the content center**

Render source health, signature status and publisher fingerprint before package cards. Keep “下载并校验” separate from “确认安装”. Reuse package preview and lifecycle functions; never install on refresh.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/unit/ContentSourcesView.test.ts && npm run test:e2e -- tests/e2e/contentSources.spec.ts`
Expected: trust and install journeys pass.

### Task 5: Publisher CLI and signed example

**Files:**
- Create: `tools/publisher-keys.mjs`
- Create: `tools/sign-catalog.mjs`
- Create: `tools/verify-catalog.mjs`
- Create: `examples/signed-catalog/catalog.json`
- Create: `examples/signed-catalog/package.json`
- Modify: `.gitignore`
- Modify: `package.json`
- Create: `docs/signed-content-catalog.md`
- Test: `tests/integration/publisherCli.test.ts`

- [ ] **Step 1: Write failing CLI integration tests**

Run the CLIs in a temporary directory, assert generated JWK shapes, sign/verify success, changed package digest failure and private key paths excluded by `.gitignore` patterns.

- [ ] **Step 2: Verify red**

Run: `npm run test:integration -- tests/integration/publisherCli.test.ts`
Expected: FAIL because the CLIs are absent.

- [ ] **Step 3: Implement Node crypto tooling**

Use only built-in `node:crypto` and `node:fs`. Write private JWK with restricted local permissions when supported, emit public JWK and fingerprint, sign canonical catalog JSON and verify both signature and package digests.

- [ ] **Step 4: Generate the public example**

Generate a temporary key, sign the original sample package catalog, commit only the public catalog/package, delete the temporary private key and verify the example with the CLI.

- [ ] **Step 5: Verify green**

Run: `npm run test:integration`
Expected: sync server and publisher CLI integration suites pass.

### Task 6: Final version, UI QA and release package

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `README.md`
- Modify: `docs/ROADMAP.md`
- Modify: `tests/e2e/releaseScreenshots.spec.ts`

- [ ] **Step 1: Set version 0.8.0 and complete docs**

Synchronize npm and Tauri versions, document v0.6-v0.8 capabilities and limits, keep the original reference attribution unchanged, and move SRS/listening/writing/speaking to later candidates.

- [ ] **Step 2: Run full verification**

Run: `npm run check`, `npm run test:integration`, `npm run test:e2e`, and `cargo check --manifest-path src-tauri/Cargo.toml`.
Expected: all commands exit 0 with no failed tests.

- [ ] **Step 3: Build release artifacts**

Run the standard NSIS build and the updater-signed release build using the external key. Verify installer and `.sig` existence and calculate SHA-256.

- [ ] **Step 4: Perform visual QA**

Inspect desktop and mobile update, sync and content source pages; verify no horizontal overflow, clipped text, low contrast, inaccessible targets or generic nested-card layout. Save final screenshots in ignored `artifacts/`.

- [ ] **Step 5: Commit v0.8**

Run `git add` and then commit as `feat: AI complete secure content platform`.

- [ ] **Step 6: Merge and verify main**

Fast-forward local `main`, rerun `npm run check`, copy release artifacts to the main worktree and remove the temporary feature worktree after confirming it is clean.
