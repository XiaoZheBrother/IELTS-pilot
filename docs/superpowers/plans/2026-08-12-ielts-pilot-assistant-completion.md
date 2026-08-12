# IELTS Pilot Assistant Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete every remaining assistant, learning-loop, writing, desktop and release acceptance item for IELTS Pilot 0.9.6.

**Architecture:** Domain modules own versioned prompts, validated evidence, plan reconciliation, weekly summaries and local writing exercises. Web and Tauri transports stream provider SSE through bounded event APIs. Vue renders only typed structures or safely parsed Markdown, while repositories persist versioned local state.

**Tech Stack:** Vue 3, TypeScript, Vitest, Node HTTP/SSE, Tauri 2, Rust, Windows DPAPI, Playwright, GitHub Actions.

---

### Task 1: Versioned prompt and regression corpus

**Files:** `src/domain/learningAssistant.ts`, `src/domain/coachAnswer.ts`, `src/storage/assistantConversationRepository.ts`, `tests/fixtures/assistant/coach-regressions.json`, related unit tests.

- [ ] Add failing tests for prompt metadata, persisted response metadata and every regression fixture.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Add `assistant-v2`, metadata persistence and fixture validation.
- [ ] Run focused tests until green.

### Task 2: Automatic plan lifecycle

**Files:** `src/domain/learningPlan.ts`, `src/components/LearningPlanView.vue`, `src/components/LearningAssistant.vue`, related unit tests.

- [ ] Add failing tests for priorities, activity reconciliation, next-round generation, dynamic refresh and weekly summary.
- [ ] Confirm RED, implement the minimal domain APIs, then confirm GREEN.
- [ ] Render explicit priority, execution state, comparison and weekly summary.

### Task 3: Streaming and safe conversation rendering

**Files:** `tools/ai-writing-server.mjs`, `src-tauri/src/ai_assistant.rs`, `src/platform/learningAssistantClient.ts`, `src/domain/safeMarkdown.ts`, `src/components/SafeMarkdown.vue`, `src/components/LearningAssistant.vue`, related tests.

- [ ] Add failing unit, integration and Rust tests for SSE parsing, deltas, cancellation, safe Markdown and usage display.
- [ ] Implement the gateway and Tauri stream commands and client callback API.
- [ ] Render a live, non-persistent preview and only save the validated final response.
- [ ] Run all focused tests until green.

### Task 4: Writing coaching depth

**Files:** `src/domain/learningAssistant.ts`, `src/domain/learningPlan.ts`, `src/domain/writingCoach.ts`, `src/components/LearningAssistant.vue`, `src/views/WritingReportView.vue`, related tests.

- [ ] Add failing tests for bounded summaries, report evidence deep links, task recommendation and rewrite exercises.
- [ ] Confirm RED, implement local-only writing coach APIs, then confirm GREEN.
- [ ] Add the writing coach panel without exposing essay or evidence quotes to the provider.

### Task 5: Desktop and release verification

**Files:** manifests, updater/release config, README, roadmap, product manual, release workflow and walkthrough assets.

- [ ] Bump all versions to 0.9.6 and extend release consistency tests.
- [ ] Run full unit, integration, E2E, Rust, web and NSIS verification.
- [ ] Save/read a real DPAPI credential, restart the desktop app and complete a real AI chat.
- [ ] Exercise offline, timeout, rate-limit and invalid-key paths; install and cover-upgrade Windows builds.
- [ ] Publish and verify the Release, updater metadata and in-app update check.
- [ ] Capture final product screenshots, update documentation, review the diff, commit and push.

## Plan self-review

- Every incomplete or partial item from the strict 43-item audit maps to Tasks 1-5.
- No placeholder or deferred implementation remains.
- Sensitive credentials are excluded from artifacts, logs, tests, screenshots and Git.
