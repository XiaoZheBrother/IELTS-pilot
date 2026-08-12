# IELTS Pilot Assistant 0.95 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the floating assistant into an evidence-validated learning coach with executable practice actions, persistent plans, writing trends, multi-conversation UX, and a verified Windows 0.9.5 build.

**Architecture:** TypeScript domain modules own all facts, evidence IDs, route resolution, plans, and response validation. The provider returns a bounded JSON `CoachAnswer`; Vue renders only validated data. Local repositories persist versioned conversations and plans, while the existing gateway and Tauri commands remain the only credential-bearing transports.

**Tech Stack:** Vue 3, TypeScript, Vue Router, Vitest, Vue Test Utils, native CSS, Node HTTP gateway, Tauri 2, Rust, Windows DPAPI, Playwright.

---

### Task 1: Evidence catalog and validated coach protocol

**Files:**
- Create: `src/domain/coachAnswer.ts`
- Modify: `src/domain/learningAssistant.ts`
- Create: `tests/unit/coachAnswer.test.ts`
- Modify: `tests/unit/learningAssistantDomain.test.ts`

- [ ] **Step 1: Write failing protocol tests**

Cover valid parsing, unknown evidence IDs, unsupported high-confidence conclusions, deterministic local fallback, bounded fields, forbidden certainty language under insufficient samples, and a prompt that requests JSON schema version 1.

- [ ] **Step 2: Run RED**

Run: `npm.cmd run test:unit -- tests/unit/coachAnswer.test.ts tests/unit/learningAssistantDomain.test.ts`

Expected: FAIL because `coachAnswer.ts`, the evidence catalog, and JSON prompt do not exist.

- [ ] **Step 3: Implement protocol and catalog**

Create `CoachEvidenceEntry`, `CoachAnswer`, `parseCoachAnswer`, `formatCoachAnswer`, `buildLocalCoachAnswer`, and `buildEvidenceCatalog`. Reject model-provided URLs and resolve only stable evidence IDs.

- [ ] **Step 4: Run GREEN**

Run the same focused command and require all tests to pass.

### Task 2: Practice actions and outcome measurement

**Files:**
- Create: `src/domain/learningPlan.ts`
- Create: `tests/unit/learningPlan.test.ts`
- Modify: `src/views/ErrorBookView.vue`
- Modify: `tests/unit/ErrorBookView.test.ts`

- [ ] **Step 1: Write failing action tests**

Assert that a weak question type resolves to the best matching set, errors resolve to `/errors?type=...&state=learning`, writing resolves to the latest report, and outcome comparison uses only attempts after the action creation timestamp.

- [ ] **Step 2: Run RED**

Run: `npm.cmd run test:unit -- tests/unit/learningPlan.test.ts tests/unit/ErrorBookView.test.ts`

Expected: FAIL because the action resolver and query initialization are absent.

- [ ] **Step 3: Implement local action resolution**

Add `resolveCoachActions`, `buildActionBaseline`, and `measureActionOutcome`. Read `route.query.type` and `route.query.state` in the error book with strict enum validation.

- [ ] **Step 4: Run GREEN**

Run the same tests and require all assertions to pass.

### Task 3: Persistent daily and weekly plans

**Files:**
- Create: `src/storage/learningPlanRepository.ts`
- Create: `tests/unit/learningPlanRepository.test.ts`
- Extend: `src/domain/learningPlan.ts`
- Extend: `tests/unit/learningPlan.test.ts`

- [ ] **Step 1: Write failing repository and refresh tests**

Cover corrupt storage, plan creation, completion persistence, deterministic refresh, preserved completed status, reading baselines, writing actions, estimated minutes, and sample-insufficient labels.

- [ ] **Step 2: Run RED**

Run: `npm.cmd run test:unit -- tests/unit/learningPlan.test.ts tests/unit/learningPlanRepository.test.ts`

Expected: FAIL because the plan repository and generators do not exist.

- [ ] **Step 3: Implement plan generation and storage**

Add `LearningPlan`, `LearningPlanItem`, `buildLearningPlan`, `refreshLearningPlan`, `togglePlanItem`, and `createBrowserLearningPlanRepository` using key `ielts-pilot:learning-plan:v1`.

- [ ] **Step 4: Run GREEN**

Run the focused tests and require all assertions to pass.

### Task 4: Writing trend and repeat-priority analysis

**Files:**
- Modify: `src/domain/learningAssistant.ts`
- Modify: `tests/unit/learningAssistantDomain.test.ts`
- Modify: `src/domain/demoProfile.ts`
- Modify: `tests/unit/demoProfile.test.ts`

- [ ] **Step 1: Write failing writing trend tests**

Create two reports and assert criterion averages, latest deltas, repeated priorities, report IDs, evidence counts, no raw essay in provider messages, and an explicit insufficient state for a single report.

- [ ] **Step 2: Run RED**

Run: `npm.cmd run test:unit -- tests/unit/learningAssistantDomain.test.ts tests/unit/demoProfile.test.ts`

Expected: FAIL because the expanded writing snapshot is absent and the demo installs only one report.

- [ ] **Step 3: Implement bounded writing analytics**

Aggregate at most five reports, expose no essay or quote text, and add a second fixed demonstration report so the full trend state can be walked through.

- [ ] **Step 4: Run GREEN**

Run the focused tests and require all assertions to pass.

### Task 5: Conversation v2 and cancelable progressive output

**Files:**
- Modify: `src/storage/assistantConversationRepository.ts`
- Modify: `tests/unit/assistantConversationRepository.test.ts`
- Modify: `src/platform/learningAssistantClient.ts`
- Modify: `tests/unit/learningAssistantClient.test.ts`
- Modify: `tools/ai-writing-server.mjs`
- Modify: `tests/integration/aiWritingServer.test.ts`

- [ ] **Step 1: Write failing storage and client tests**

Cover v1 migration, 12-conversation and 40-message bounds, create/switch/delete, validated structured answers only, abort signals, progressive semantic blocks, gateway abort handling, and no secret in requests or logs.

- [ ] **Step 2: Run RED**

Run unit client/repository tests and `npm.cmd run test:integration -- tests/integration/aiWritingServer.test.ts`.

Expected: FAIL because v2 conversations and cancelable progressive APIs do not exist.

- [ ] **Step 3: Implement v2 storage and transport**

Persist version 2 conversations, migrate legacy messages, accept an `AbortSignal`, and emit validated answer blocks in order. Keep the Tauri full-response fallback cancelable at the UI token level.

- [ ] **Step 4: Run GREEN**

Run the focused unit and integration commands and require all tests to pass.

### Task 6: Three-view assistant UI

**Files:**
- Create: `src/components/CoachAnswerView.vue`
- Create: `src/components/LearningPlanView.vue`
- Create: `src/components/ConversationHistory.vue`
- Modify: `src/components/LearningAssistant.vue`
- Modify: `src/components/learningAssistantDependencies.ts`
- Modify: `src/styles/assistant.css`
- Modify: `tests/unit/learningAssistant.test.ts`
- Create: `tests/unit/CoachAnswerView.test.ts`
- Create: `tests/unit/LearningPlanView.test.ts`

- [ ] **Step 1: Write failing component tests**

Assert diagnosis/plan/chat tab semantics, evidence expansion, local action links, today/week switching, completion toggles, copy feedback, stop, retry, regenerate, safe legacy text, delete message, new conversation, history switching and keyboard focus restoration.

- [ ] **Step 2: Run RED**

Run the three focused component test files.

Expected: FAIL because the components and interactions are absent.

- [ ] **Step 3: Implement the UI**

Keep the 470-pixel floating panel and sharp editorial language. Use a compact three-tab rail, semantic skeleton blocks, minimum 40-pixel targets, tabular numbers, explicit hover/focus/active states, exact-property transitions, and reduced-motion fallbacks.

- [ ] **Step 4: Run GREEN and UI audit**

Run the focused tests, scan CSS for `transition: all`, verify visible Chinese strings, and test paper/night themes plus a mobile viewport.

### Task 7: Version, documentation, desktop and release build

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `README.md`
- Modify: `docs/ROADMAP.md`
- Create: `docs/IELTS-Pilot-v0.95-产品功能说明书.md`

- [ ] **Step 1: Add release consistency tests**

Extend desktop configuration tests to require version `0.9.5` in package, Cargo, and Tauri config and to verify the README does not claim a nonexistent installer before release.

- [ ] **Step 2: Run RED, then update version and docs**

Run the focused version test, update all manifests with normal package tooling where applicable, and document features, privacy, AI boundaries, desktop configuration and upgrade behavior.

- [ ] **Step 3: Verify web, Rust, desktop and installer**

Run `npm.cmd run check`, `npm.cmd run test:integration`, `npm.cmd run test:e2e`, `cargo test --manifest-path src-tauri/Cargo.toml --lib`, `cargo check --manifest-path src-tauri/Cargo.toml`, and `npm.cmd run desktop:build`.

- [ ] **Step 4: Real AI walkthrough and screenshots**

Start the production gateway with `D:\Users\yuqi.chen\Desktop\新建 文本文档.txt`, install demo data, validate one structured answer, exercise a plan action and history operation, confirm no key appears, and save screenshots under `docs/assets/v0.95-walkthrough/`.

### Task 8: Final review, commit and release

**Files:**
- Review all changed files and generated release artifacts.

- [ ] **Step 1: Run the complete verification matrix again**

Require fresh zero-exit results for every command in Task 7, confirm Git status contains no credential/config file, and compute SHA-256 for the NSIS installer.

- [ ] **Step 2: Commit using repository rules**

Run `git add` separately, then commit with `feat: AI ship evidence-led assistant 0.95` using `XiaoZheBrother <958117002@qq.com>`.

- [ ] **Step 3: Publish only after evidence is complete**

Push `main`, create and push annotated tag `v0.9.5`, wait for the Windows release workflow, verify the Release contains Setup.exe, updater signature and `latest.json`, and confirm the public download URL returns successfully.

- [ ] **Step 4: Final handoff**

Report the commit, Release URL, installer checksum, automated test totals, real AI model used and final screenshots without exposing the API Key.

## Plan self-review

- Spec coverage: every 0.95 checklist item maps to Tasks 1-8.
- Placeholder scan: no TBD, TODO or deferred implementation language remains.
- Type consistency: `CoachAnswer`, evidence IDs, `LearningPlan`, v2 conversations and action kinds use the same names across tasks.
- Scope: provider presets, accounts, cloud history and proactive background reminders remain outside 0.95.

