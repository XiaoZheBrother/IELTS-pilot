# IELTS Pilot Assistant MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating, evidence-led IELTS learning assistant with secure desktop AI settings and a working browser gateway.

**Architecture:** Deterministic TypeScript code builds a bounded `LearningSnapshot` and local overview from existing repositories. A shared Vue assistant surface consumes the overview and sends explicit chat requests through a platform adapter: same-origin gateway on web, Tauri command on desktop. The desktop command reads a DPAPI-protected credential without returning it to JavaScript.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils, Node HTTP gateway, Tauri 2, Rust, Windows DPAPI, native CSS.

---

### Task 1: Learning snapshot and evidence

**Files:**
- Create: `src/domain/learningAssistant.ts`
- Test: `tests/unit/learningAssistant.test.ts`

- [ ] **Step 1: Write failing snapshot tests**

Test an empty profile, a three-attempt trend, a weak question type with at least five samples, open errors, and a writing report. Assert that every high-confidence diagnostic includes evidence labels and that insufficient samples are labelled as such.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:unit -- tests/unit/learningAssistant.test.ts`

Expected: FAIL because `src/domain/learningAssistant.ts` does not exist.

- [ ] **Step 3: Implement the minimal domain model**

Implement `buildLearningSnapshot`, `buildCoachOverview`, and `buildAssistantMessages`. Keep all numerical facts deterministic and cap serialized context size.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:unit -- tests/unit/learningAssistant.test.ts`

Expected: all learning assistant tests pass.

### Task 2: AI settings and transport

**Files:**
- Create: `src/storage/aiSettingsRepository.ts`
- Create: `src/platform/learningAssistantClient.ts`
- Modify: `tools/ai-writing-server.mjs`
- Modify: `src-tauri/src/ai_writing.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `tests/unit/aiSettingsRepository.test.ts`
- Test: `tests/unit/learningAssistantClient.test.ts`
- Modify: `tests/integration/aiWritingServer.test.ts`

- [ ] **Step 1: Write failing repository, client, and gateway tests**

Assert that the repository persists only Endpoint and Model, web requests contain no credential, desktop requests invoke Tauri without a key, the gateway exposes health/chat endpoints, and logs never contain the configured secret.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run test:unit -- tests/unit/aiSettingsRepository.test.ts tests/unit/learningAssistantClient.test.ts`

Run: `npm run test:integration -- tests/integration/aiWritingServer.test.ts`

Expected: FAIL because the new modules and endpoints do not exist.

- [ ] **Step 3: Implement settings, gateway, and desktop commands**

Add bounded request validation, provider error mapping, 90-second timeout, DPAPI credential protection, and Tauri commands for status/save/delete/test/chat. Never serialize or log the API key.

- [ ] **Step 4: Run focused tests and Rust check**

Run: `npm run test:unit -- tests/unit/aiSettingsRepository.test.ts tests/unit/learningAssistantClient.test.ts`

Run: `npm run test:integration -- tests/integration/aiWritingServer.test.ts`

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: all focused checks pass.

### Task 3: Settings user interface

**Files:**
- Modify: `src/views/SettingsView.vue`
- Modify: `tests/unit/SettingsView.test.ts`

- [ ] **Step 1: Write failing UI tests**

Assert that the AI settings section renders, loads current availability, saves non-sensitive settings, clears the password input, tests connectivity, and shows gateway-managed state on web.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:unit -- tests/unit/SettingsView.test.ts`

Expected: FAIL because the AI controls do not exist.

- [ ] **Step 3: Implement the settings section**

Add explicit labels, inline status/error feedback, password autocomplete protection, and a link between browser gateway state and desktop credential controls.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:unit -- tests/unit/SettingsView.test.ts`

Expected: all settings tests pass.

### Task 4: Floating assistant and conversation

**Files:**
- Create: `src/components/LearningAssistant.vue`
- Create: `src/storage/assistantConversationRepository.ts`
- Modify: `src/App.vue`
- Modify: `src/styles/main.css`
- Create: `src/styles/assistant.css`
- Modify: `tests/unit/appShell.test.ts`
- Create: `tests/unit/LearningAssistant.test.ts`
- Create: `tests/unit/assistantConversationRepository.test.ts`

- [ ] **Step 1: Write failing component and storage tests**

Assert the orb opens an accessible dialog, local diagnostics render with evidence, configured chat sends the bounded snapshot, messages persist without credentials, errors are recoverable, Escape closes the panel, and focus routes hide the orb.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run test:unit -- tests/unit/LearningAssistant.test.ts tests/unit/assistantConversationRepository.test.ts tests/unit/appShell.test.ts`

Expected: FAIL because the assistant component and repository do not exist.

- [ ] **Step 3: Implement the assistant surface**

Use a 52-pixel fixed orb, a 440-pixel anchored dialog, native CSS transitions, 40-pixel minimum hit targets, tabular numeric evidence, responsive bottom-sheet behavior, reduced-motion fallback, and explicit empty/loading/error states.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm run test:unit -- tests/unit/LearningAssistant.test.ts tests/unit/assistantConversationRepository.test.ts tests/unit/appShell.test.ts`

Expected: all assistant surface tests pass.

### Task 5: Product verification and screenshot

**Files:**
- Modify: `README.md`
- Create: `artifacts/screenshots/ielts-pilot-assistant-mvp.png`

- [ ] **Step 1: Document the assistant and AI configuration modes**

Document the floating assistant, lightweight evidence, secure desktop credential behavior, browser gateway configuration, and the non-official-score boundary without including real credentials.

- [ ] **Step 2: Run full automated verification**

Run: `npm run check`

Run: `npm run test:integration`

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: every command exits with code 0 and no test failures.

- [ ] **Step 3: Run the production gateway with the supplied local config**

Run the built app on loopback using `D:\Users\yuqi.chen\Desktop\新建 文本文档.txt`, install demonstration data through the UI, open IELTS Pilot, send “分析我最近的学习状态”, and verify a real provider response without exposing the key.

- [ ] **Step 4: Capture the final state**

Capture a screenshot showing the floating dialog, three local evidence-led diagnoses, and a successful AI reply. Confirm the screenshot contains no Endpoint or API Key.

- [ ] **Step 5: Commit**

Run `git add` separately, then commit with repository identity `XiaoZheBrother <958117002@qq.com>` and message `feat: AI add floating learning assistant MVP`.
