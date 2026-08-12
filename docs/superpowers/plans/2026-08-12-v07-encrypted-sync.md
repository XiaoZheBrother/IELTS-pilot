# v0.7 Encrypted Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add portable end-to-end encrypted vaults, deterministic conflict resolution and optional REST synchronization while keeping credentials ephemeral.

**Architecture:** Storage migrates to a version 4 state with clocks and tombstones. Pure domain functions encrypt, decrypt and merge backups. A transport adapter handles ETag-based REST synchronization, while the Vue sync center coordinates manual and remote flows.

**Tech Stack:** TypeScript Web Crypto, Vue 3, Vitest, Playwright, Node.js built-in HTTP server.

---

### Task 1: Version 4 repository and mutation clocks

**Files:**
- Modify: `src/domain/models.ts`
- Modify: `src/storage/practiceRepository.ts`
- Modify: `tests/unit/practiceRepository.test.ts`

- [ ] **Step 1: Write failing migration and clock tests**

Cover v3 migration, per-entity clocks, removal tombstones, clock removal after a newer recreation and v4 backup import/export.

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/unit/practiceRepository.test.ts`
Expected: FAIL because storage version 4 and sync metadata are absent.

- [ ] **Step 3: Implement v4 state**

Add `clocks: Record<string,string>` and `tombstones: Record<string,string>`. Route every repository mutation through a helper that writes a strictly increasing ISO timestamp for keys such as `draft:<id>`, `annotation:<id>` and `favorite-set:<id>`.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/unit/practiceRepository.test.ts`
Expected: repository tests pass with v1-v4 migration coverage.

### Task 2: Deterministic backup merge

**Files:**
- Create: `src/domain/syncMerge.ts`
- Test: `tests/unit/syncMerge.test.ts`

- [ ] **Step 1: Write failing merge tests**

Test immutable attempt union, newer draft selection, tombstone deletion, newer recreation, stable tie-breaking, installed package selection and commutativity: `merge(a,b) === merge(b,a)`.

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/unit/syncMerge.test.ts`
Expected: FAIL because merge functions do not exist.

- [ ] **Step 3: Implement pure merge functions**

Parse normalized v4 backups, merge each entity namespace by clocks/tombstones, sort arrays and record keys deterministically, and return a `SyncMergePreview` plus serialized merged backup.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/unit/syncMerge.test.ts`
Expected: all merge tests pass.

### Task 3: Encrypted vault protocol

**Files:**
- Create: `src/domain/encryptedVault.ts`
- Test: `tests/unit/encryptedVault.test.ts`

- [ ] **Step 1: Write failing crypto tests**

Test production envelope fields, round trip with an injected low test iteration count, wrong passphrase rejection, ciphertext/IV/profile tampering rejection and minimum passphrase length.

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/unit/encryptedVault.test.ts`
Expected: FAIL because vault crypto is absent.

- [ ] **Step 3: Implement Web Crypto encryption**

Use random salt/IV, PBKDF2-HMAC-SHA-256, AES-256-GCM and profile-bound AAD. Encode binary fields as base64url and expose strict envelope validation before decrypting.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/unit/encryptedVault.test.ts`
Expected: all crypto tests pass.

### Task 4: Remote sync transport and reference server

**Files:**
- Create: `src/platform/vaultTransport.ts`
- Create: `tools/secure-sync-server.mjs`
- Modify: `package.json`
- Test: `tests/unit/vaultTransport.test.ts`
- Test: `tests/integration/secureSyncServer.test.ts`

- [ ] **Step 1: Write failing transport tests**

Inject `fetch` and assert HTTPS/local URL validation, bearer headers, 404 handling, ETag parsing, `If-Match`, 401 errors and 412 conflict mapping.

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/unit/vaultTransport.test.ts`
Expected: FAIL because the transport is absent.

- [ ] **Step 3: Implement transport and server**

The server stores only validated encrypted envelopes, hashes them into strong ETags, uses atomic temporary-file replacement, limits request bodies to 10 MiB, supports CORS and defaults to loopback. Add `sync:server` and `test:integration` scripts.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/unit/vaultTransport.test.ts && npm run test:integration`
Expected: transport and real HTTP server tests pass.

### Task 5: Sync center UI

**Files:**
- Create: `src/storage/syncSettingsRepository.ts`
- Create: `src/views/SyncView.vue`
- Modify: `src/router.ts`
- Modify: `src/App.vue`
- Modify: `src/styles/library-tools.css`
- Test: `tests/unit/SyncView.test.ts`
- Test: `tests/e2e/secureSync.spec.ts`

- [ ] **Step 1: Write failing view tests**

Cover saved non-secret settings, passphrase/token never persisted, manual export download, import preview, merge confirmation, first remote upload and conflict retry summary.

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/unit/SyncView.test.ts`
Expected: FAIL because the sync center is absent.

- [ ] **Step 3: Implement the sync center**

Use four explicit steps: profile, unlock, compare, commit. Keep secrets in component refs only, clear them on unmount, require confirmation before import or remote overwrite, and expose audit timestamps without plaintext content.

- [ ] **Step 4: Verify green and E2E**

Run: `npm run test:unit -- tests/unit/SyncView.test.ts && npm run test:e2e -- tests/e2e/secureSync.spec.ts`
Expected: component and desktop/mobile journeys pass.

### Task 6: Version and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/ROADMAP.md`
- Create: `docs/encrypted-sync-protocol.md`

- [ ] **Step 1: Document the complete protocol**

Document envelope JSON fields, KDF parameters, endpoint methods, ETag behavior, threat model, passphrase recovery limitation and reference server deployment.

- [ ] **Step 2: Verify the milestone**

Run: `npm run check && npm run test:integration`
Expected: all checks pass.

- [ ] **Step 3: Commit v0.7**

Run `git add` and then commit as `feat: AI add encrypted multi-device sync`.

