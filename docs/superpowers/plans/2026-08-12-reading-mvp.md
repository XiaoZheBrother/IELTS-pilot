# IELTS Pilot Reading MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a polished local-first IELTS Reading practice application with original sample content, deterministic scoring, approximate bands, autosave, history, and verified desktop/mobile flows.

**Architecture:** A Vue 3 single-page application keeps domain and scoring logic in framework-independent TypeScript modules. A versioned localStorage repository persists drafts and attempts, while route views coordinate dashboard, practice, and results without a backend.

**Tech Stack:** Vue 3, TypeScript, Vite, Vue Router, Vitest, Vue Test Utils, Playwright, CSS

---

## File Structure

- `package.json`, `vite.config.ts`, `tsconfig*.json`: build, type-check, test, and E2E commands.
- `src/domain/models.ts`: stable test, question, answer, draft, and attempt contracts.
- `src/scoring/answerMatcher.ts`: canonical answer normalization and matching.
- `src/scoring/readingScorer.ts`: score aggregation and approximate Academic Reading bands.
- `src/storage/practiceRepository.ts`: versioned localStorage drafts and attempts.
- `src/data/practiceSets.ts`: two original practice sets with provenance.
- `src/composables/usePracticeSession.ts`: session state, autosave, timer, and idempotent submission.
- `src/views/*.vue`: dashboard, practice, result, and not-found routes.
- `src/components/*.vue`: shell, timer, palette, questions, and score presentation.
- `src/styles/main.css`: responsive editorial study-desk visual system.
- `tests/unit/*.test.ts`: domain, scoring, storage, and component tests.
- `tests/e2e/practice.spec.ts`: learner journey and reload persistence.
- `README.md`: setup, scope, attribution, scoring caveat, and content policy.

### Task 1: Scaffold the tested Vue application

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `vite.config.ts`
- Create: `playwright.config.ts`
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/router.ts`
- Test: `tests/unit/appShell.test.ts`

- [ ] **Step 1: Write the failing shell test**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../../src/App.vue'

describe('App shell', () => {
  it('renders the IELTS Pilot identity and routed content', () => {
    const wrapper = mount(App, { global: { stubs: { RouterView: { template: '<main>route</main>' } } } })
    expect(wrapper.text()).toContain('IELTS Pilot')
    expect(wrapper.text()).toContain('route')
  })
})
```

- [ ] **Step 2: Install dependencies and verify the test fails**

Run: `npm install && npm run test:unit -- appShell.test.ts`

Expected: FAIL because `src/App.vue` does not exist.

- [ ] **Step 3: Add the minimal Vue/Vite shell**

Create scripts for `dev`, `build`, `typecheck`, `test:unit`, `test:e2e`, and `check`; configure Vue, jsdom, and the router; render a header containing `IELTS Pilot` and `<RouterView />`.

- [ ] **Step 4: Verify the shell test passes**

Run: `npm run test:unit -- appShell.test.ts`

Expected: 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json index.html tsconfig.json tsconfig.app.json vite.config.ts playwright.config.ts src tests/unit/appShell.test.ts
git commit -m "build: AI scaffold Vue reading application"
```

### Task 2: Implement deterministic answer matching and scoring

**Files:**
- Create: `src/domain/models.ts`
- Create: `src/scoring/answerMatcher.ts`
- Create: `src/scoring/readingScorer.ts`
- Test: `tests/unit/answerMatcher.test.ts`
- Test: `tests/unit/readingScorer.test.ts`

- [ ] **Step 1: Write failing answer-matcher tests**

```ts
it('accepts normalized short answers and TFNG aliases', () => {
  expect(matchesAnswer('  Solar   panels. ', ['solar panels'])).toBe(true)
  expect(matchesAnswer('NG', ['not given'])).toBe(true)
  expect(matchesAnswer('false', ['F'])).toBe(true)
})
```

- [ ] **Step 2: Run the matcher tests to verify RED**

Run: `npm run test:unit -- answerMatcher.test.ts`

Expected: FAIL because `matchesAnswer` does not exist.

- [ ] **Step 3: Implement canonical tokens and matching**

Normalize case, repeated whitespace, smart punctuation, surrounding punctuation, and TFNG aliases. Compare against every accepted answer without fuzzy edit distance.

- [ ] **Step 4: Verify matcher GREEN**

Run: `npm run test:unit -- answerMatcher.test.ts`

Expected: all matcher cases passing.

- [ ] **Step 5: Write failing scorer tests**

```ts
it('returns reviewable item results and an approximate band', () => {
  const result = scoreReadingTest(testFixture, { q1: 'B', q2: 'NG' })
  expect(result.correct).toBe(2)
  expect(result.total).toBe(2)
  expect(result.items[0].acceptedAnswers).toEqual(['B'])
  expect(result.approximateBand).toBe(9)
})
```

- [ ] **Step 6: Run scorer test to verify RED**

Run: `npm run test:unit -- readingScorer.test.ts`

Expected: FAIL because `scoreReadingTest` does not exist.

- [ ] **Step 7: Implement score aggregation and versioned band table**

Return correct, total, percentage, approximate band, scoring version, and one review record per question. Use an Academic Reading 40-mark approximation table and proportional raw-score normalization for shorter practice sets.

- [ ] **Step 8: Run all scoring tests and commit**

Run: `npm run test:unit -- answerMatcher.test.ts readingScorer.test.ts`

Expected: all scoring tests passing.

```bash
git add src/domain src/scoring tests/unit/answerMatcher.test.ts tests/unit/readingScorer.test.ts
git commit -m "feat: AI add auditable reading scoring"
```

### Task 3: Add original practice content and versioned persistence

**Files:**
- Create: `src/data/practiceSets.ts`
- Create: `src/storage/practiceRepository.ts`
- Test: `tests/unit/practiceSets.test.ts`
- Test: `tests/unit/practiceRepository.test.ts`

- [ ] **Step 1: Write failing content and repository tests**

```ts
it('ships two original mixed-question sets with provenance', () => {
  expect(practiceSets).toHaveLength(2)
  expect(practiceSets.every((set) => set.provenance.kind === 'original')).toBe(true)
  expect(new Set(practiceSets.flatMap((set) => set.questions.map((q) => q.type))).size).toBeGreaterThan(2)
})

it('recovers from corrupt browser data', () => {
  storage.setItem(STORAGE_KEY, '{broken')
  expect(repository.listAttempts()).toEqual([])
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run test:unit -- practiceSets.test.ts practiceRepository.test.ts`

Expected: FAIL because content and repository modules do not exist.

- [ ] **Step 3: Add two original practice sets**

Write original passages about urban shade networks and community repair libraries. Each set contains eight mixed questions, accepted answers, explanations, level, duration, and `original` provenance metadata.

- [ ] **Step 4: Implement versioned localStorage repository**

Store `{ version: 1, drafts, attempts }`; validate record shapes while reading; expose get/save/delete draft plus list/get/save attempt; sort attempts newest first and safely reset only malformed data.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit -- practiceSets.test.ts practiceRepository.test.ts`

Expected: all content and persistence tests passing.

```bash
git add src/data src/storage tests/unit/practiceSets.test.ts tests/unit/practiceRepository.test.ts
git commit -m "feat: AI add original tests and local persistence"
```

### Task 4: Build the practice session state machine

**Files:**
- Create: `src/composables/usePracticeSession.ts`
- Test: `tests/unit/usePracticeSession.test.ts`

- [ ] **Step 1: Write failing session tests**

```ts
it('restores a draft and submits only once', () => {
  const session = usePracticeSession(testSet, repository, clock)
  session.setAnswer('q1', 'B')
  const first = session.submit('manual')
  const second = session.submit('manual')
  expect(second.id).toBe(first.id)
  expect(repository.listAttempts()).toHaveLength(1)
})
```

- [ ] **Step 2: Run to verify RED**

Run: `npm run test:unit -- usePracticeSession.test.ts`

Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Implement session state**

Expose current index, answers, remaining seconds, answered count, set/go/next/previous methods, autosave, timer tick, and idempotent manual/timeout submission. Delete the draft after successful submission.

- [ ] **Step 4: Verify and commit**

Run: `npm run test:unit -- usePracticeSession.test.ts`

Expected: all session tests passing.

```bash
git add src/composables tests/unit/usePracticeSession.test.ts
git commit -m "feat: AI add autosaved reading sessions"
```

### Task 5: Build dashboard, practice, and result interfaces

**Files:**
- Create: `src/views/DashboardView.vue`
- Create: `src/views/PracticeView.vue`
- Create: `src/views/ResultView.vue`
- Create: `src/views/NotFoundView.vue`
- Create: `src/components/PracticeCard.vue`
- Create: `src/components/QuestionRenderer.vue`
- Create: `src/components/QuestionPalette.vue`
- Create: `src/components/ExamTimer.vue`
- Create: `src/components/ScorePanel.vue`
- Modify: `src/router.ts`
- Test: `tests/unit/questionRenderer.test.ts`
- Test: `tests/unit/resultView.test.ts`

- [ ] **Step 1: Write failing interaction tests**

Test that each question type emits a normalized answer model, palette navigation emits the selected index, and the result view renders accepted answers and the `练习估分` caveat.

- [ ] **Step 2: Run the component tests to verify RED**

Run: `npm run test:unit -- questionRenderer.test.ts resultView.test.ts`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement route views and components**

Build accessible controls with labels, keyboard focus, submit confirmation, unknown-ID handling, recent history, retry actions, and the complete desktop/mobile learner flow.

- [ ] **Step 4: Verify component tests and commit**

Run: `npm run test:unit -- questionRenderer.test.ts resultView.test.ts`

Expected: all component tests passing.

```bash
git add src/views src/components src/router.ts tests/unit/questionRenderer.test.ts tests/unit/resultView.test.ts
git commit -m "feat: AI build reading practice workflow"
```

### Task 6: Apply the editorial study-desk design

**Files:**
- Create: `src/styles/main.css`
- Modify: `src/main.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: Add visual contract assertions**

Extend `appShell.test.ts` to require a skip link, navigation landmark, and application status label before styling.

- [ ] **Step 2: Run the visual contract test to verify RED**

Run: `npm run test:unit -- appShell.test.ts`

Expected: FAIL because the accessibility landmarks are missing.

- [ ] **Step 3: Implement the visual system**

Use warm paper, ink, navy and exam-red variables; editorial typography; tactile borders; restrained shadows; responsive split layouts; clear focus rings; reduced motion; and print-inspired result annotations.

- [ ] **Step 4: Verify unit suite and commit**

Run: `npm run test:unit`

Expected: all unit tests passing.

```bash
git add src/styles src/main.ts src/App.vue tests/unit/appShell.test.ts
git commit -m "style: AI craft editorial study interface"
```

### Task 7: Add end-to-end coverage and documentation

**Files:**
- Create: `tests/e2e/practice.spec.ts`
- Create: `README.md`

- [ ] **Step 1: Write the failing Playwright journey**

```ts
test('learner can resume, submit, review, and reopen an attempt', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /开始练习/ }).first().click()
  await page.getByLabel(/选择 B/).click()
  await page.reload()
  await expect(page.getByLabel(/选择 B/)).toBeChecked()
  await page.getByRole('button', { name: /交卷/ }).click()
  await page.getByRole('button', { name: /确认交卷/ }).click()
  await expect(page.getByText(/练习估分/)).toBeVisible()
  await page.getByRole('link', { name: /返回首页/ }).click()
  await page.getByRole('link', { name: /查看结果/ }).first().click()
  await expect(page.getByText(/答案复盘/)).toBeVisible()
})
```

- [ ] **Step 2: Install Chromium and verify E2E RED**

Run: `npx playwright install chromium && npm run test:e2e`

Expected: FAIL until selectors and complete route flow are wired.

- [ ] **Step 3: Finish selectors and write README**

Document setup, scripts, MVP scope, data location, approximate scoring, original content provenance, and the reference to `sallowayma-git/IELTS-practice`. Explicitly explain that attribution is not a substitute for permission and no third-party question bank is redistributed.

- [ ] **Step 4: Verify E2E and commit**

Run: `npm run test:e2e`

Expected: learner journey passing in Chromium.

```bash
git add tests/e2e README.md
git commit -m "test: AI verify complete reading journey"
```

### Task 8: Final quality gate and visual evidence

**Files:**
- Modify only files required by failures discovered in this task.

- [ ] **Step 1: Run the complete quality gate**

Run: `npm run check && npm run test:e2e`

Expected: typecheck, unit tests, production build, and Playwright all exit 0.

- [ ] **Step 2: Inspect desktop and mobile screenshots**

Run the Vite server, capture dashboard, practice, and result at 1440×1000 plus practice at 390×844, and inspect every image for overflow, clipping, unreadable text, broken focus/controls, or generic placeholder presentation.

- [ ] **Step 3: Re-run verification after visual fixes**

Run: `npm run check && npm run test:e2e`

Expected: all checks still pass.

- [ ] **Step 4: Commit final adjustments**

```bash
git add .
git commit -m "fix: AI finalize MVP quality gate"
```
