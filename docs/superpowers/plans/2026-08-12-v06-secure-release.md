# v0.6 Secure Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a signed Tauri updater flow, release-ready Windows signing pipeline and a usable update center without breaking unsigned local builds.

**Architecture:** A small platform adapter hides Tauri APIs from the browser build. The base Tauri config enables updater verification while a release config overlay enables updater artifacts. GitHub Actions supplies updater and optional Authenticode secrets.

**Tech Stack:** Vue 3, TypeScript, Vitest, Playwright, Tauri 2 updater/process plugins, GitHub Actions.

---

### Task 1: Update platform adapter

**Files:**
- Create: `src/platform/appUpdater.ts`
- Test: `tests/unit/appUpdater.test.ts`

- [ ] **Step 1: Write the failing adapter tests**

Test a browser adapter returning `unsupported`, a desktop adapter mapping `check()` metadata, progress accumulation, install and relaunch, and thrown errors mapped to Chinese messages. Inject plugin functions so tests never require Tauri.

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/unit/appUpdater.test.ts`
Expected: FAIL because `appUpdater.ts` does not exist.

- [ ] **Step 3: Implement the adapter**

Expose `createAppUpdater(runtime, bindings)` with `check()` and `install(update, onProgress)`. Define explicit states `unsupported | idle | checking | current | available | downloading | ready | error`. Dynamically import Tauri bindings only inside the desktop factory.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/unit/appUpdater.test.ts`
Expected: all adapter tests pass.

### Task 2: Update center UI

**Files:**
- Create: `src/views/UpdatesView.vue`
- Modify: `src/router.ts`
- Modify: `src/App.vue`
- Modify: `src/styles/library-tools.css`
- Test: `tests/unit/UpdatesView.test.ts`

- [ ] **Step 1: Write the failing view tests**

Mount with injected adapters and assert browser explanation, desktop current state, available version metadata, download percentage, confirmation button and error recovery.

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/unit/UpdatesView.test.ts`
Expected: FAIL because the view and route are absent.

- [ ] **Step 3: Implement the view and navigation**

Add `/updates`, put “更新” in the utility navigation and render a three-stage status rail: verify channel, review release, install/restart. Never start installation without an explicit click.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/unit/UpdatesView.test.ts tests/unit/appShell.test.ts`
Expected: both files pass.

### Task 3: Tauri plugin and release configuration

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/tauri.conf.json`
- Create: `src-tauri/tauri.release.conf.json`
- Test: `tests/unit/desktopConfig.test.ts`

- [ ] **Step 1: Extend the config test and verify red**

Assert updater/process dependencies, permissions, GitHub `latest.json` endpoint, embedded minisign public key, passive current-user updater mode, base artifact generation disabled and release overlay enabled.

Run: `npm run test:unit -- tests/unit/desktopConfig.test.ts`
Expected: FAIL on missing updater configuration.

- [ ] **Step 2: Install official plugins**

Run: `npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process`

Add matching Rust crates, register both plugins, grant only updater default and process restart permissions, and add `desktop:release` using `tauri build --bundles nsis --config src-tauri/tauri.release.conf.json`.

- [ ] **Step 3: Generate the updater key outside the repository**

Create `D:\Users\yuqi.chen\.Codex\IELTS-pilot\updater.key` with Tauri signer generation, keep its public counterpart in configuration, and verify neither private file nor password is tracked by Git.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/unit/desktopConfig.test.ts && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: config tests and Rust check pass.

### Task 4: Release workflow and documentation

**Files:**
- Modify: `.github/workflows/windows-release.yml`
- Create: `docs/releasing-windows.md`
- Modify: `README.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Add workflow verification**

Extend the static config test to assert `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `updaterJsonPreferNsis`, release config args and guarded Authenticode certificate import.

- [ ] **Step 2: Implement the workflow**

Use updater secrets on every tagged release. Import `WINDOWS_CERTIFICATE` only when present, derive the certificate thumbprint, pass it through a generated CI config overlay and keep unsigned builds functional when those commercial secrets are absent.

- [ ] **Step 3: Document the trust boundary**

Document key backup, key rotation limitations, GitHub secrets, Authenticode requirements, SmartScreen behavior and recovery when an updater key is lost.

- [ ] **Step 4: Verify the milestone**

Run: `npm run check`
Expected: typecheck, all unit tests and production build pass.

- [ ] **Step 5: Commit v0.6**

Run `git add` and then commit as `feat: AI add secure desktop updates`.

