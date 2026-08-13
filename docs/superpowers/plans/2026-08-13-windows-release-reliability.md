# Windows Release Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a reliable v0.9.10 Windows release after the v0.9.9 NSIS download failure.

**Architecture:** Keep GitHub Actions as the release orchestrator and Tauri as the sole NSIS/updater packager. Modernize action majors, add bounded retries around Tauri build/upload, and preserve default artifact naming so public links remain deterministic.

**Tech Stack:** GitHub Actions, Tauri 2, NSIS, Vitest, Rust/Cargo

---

### Task 1: Lock the workflow contract with a failing test

**Files:**
- Modify: `tests/unit/desktopConfig.test.ts`

- [x] Update the expected application version to `0.9.10`.
- [x] Require `actions/checkout@v7`, `actions/setup-node@v7`, `tauri-apps/tauri-action@v1`, and `retryAttempts: 3`.
- [x] Reject both obsolete and custom asset naming inputs so Tauri's default filenames remain compatible with README links.
- [x] Run `npm run test:unit -- tests/unit/desktopConfig.test.ts` and confirm it fails against the v0.9.9 workflow.

### Task 2: Implement the release workflow fix

**Files:**
- Modify: `.github/workflows/windows-release.yml`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `README.md`

- [x] Upgrade the action majors and add three retry attempts.
- [x] Remove the custom asset-name input.
- [x] Synchronize all application versions to `0.9.10`.
- [x] Point README installer links at the default v0.9.10 NSIS filename.
- [x] Run the focused unit test and confirm it passes.

### Task 3: Verify and publish

**Files:**
- Modify: `docs/superpowers/plans/2026-08-13-windows-release-reliability.md`

- [x] Run `npm run check`.
- [x] Run `cargo check --manifest-path src-tauri/Cargo.toml`.
- [x] Review `git diff --check`, status, and the complete staged diff for secrets.
- [ ] Commit as `fix: AI harden Windows release pipeline`.
- [ ] Push `main`, create and push annotated tag `v0.9.10`, then verify the GitHub Actions run and all three required release assets.
