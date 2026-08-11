# IELTS Pilot Reading MVP Design

## 1. Goal

Build a locally runnable IELTS Reading practice MVP that lets a learner choose an original practice set, complete mixed question types under a timer, submit answers, review mistakes, receive a raw score and an explicitly approximate IELTS band estimate, and revisit saved attempts.

The MVP is deliberately limited to Reading. Writing, Speaking, accounts, cloud sync, payments, and copyrighted third-party question banks are outside this release.

## 2. Product Principles

- Local-first: attempts and in-progress answers persist in the browser without an account.
- Auditable scoring: every result shows the accepted answer and the exact matching decision.
- Copyright-safe sample content: bundled passages and questions are original project content, not copied IELTS material.
- Honest bands: band conversion is labelled as an estimate because official thresholds can vary by test version.
- Fast practice loop: a learner can move from dashboard to a question in two clicks.

## 3. User Flow

1. The learner opens the dashboard and sees available practice sets plus recent performance.
2. The learner starts a set, reads the passage, answers questions, and sees answered-state navigation.
3. Answers and remaining time are autosaved after each change.
4. The learner submits, or the timer submits automatically at zero.
5. The result screen shows raw score, percentage, approximate band, criterion-free answer review, and question-level explanations.
6. The learner returns to the dashboard and can reopen the saved result or retry the set.

## 4. Functional Scope

### Dashboard

- Product introduction and explicit MVP status.
- Practice-set cards with title, level, question count, and estimated duration.
- Summary of completed attempts, best approximate band, and average accuracy.
- Recent-attempt list with result and timestamp.

### Practice Session

- Split reading layout on desktop and stacked layout on mobile.
- Passage headings and paragraphs.
- Multiple choice, True/False/Not Given, and short-answer questions.
- Question palette with current, answered, and unanswered states.
- Countdown timer, progress indicator, previous/next controls, and explicit submit confirmation.
- Autosaved draft restoration.

### Results

- Correct count, total count, percentage, and approximate Academic Reading band.
- Per-question correct/incorrect state, learner answer, accepted answer, and explanation.
- Retry and dashboard actions.

### Persistence

- Browser localStorage stores drafts and immutable submitted attempts.
- Storage data is versioned so future migrations can be added without silently losing attempts.

## 5. Scoring Rules

- Each bundled question is worth one mark.
- Choice answers compare canonical option identifiers.
- True/False/Not Given accepts common abbreviations such as `T`, `F`, and `NG`.
- Short answers are trimmed, case-insensitive, normalize repeated whitespace and surrounding punctuation, and may define multiple accepted answers.
- Approximate Academic Reading conversion is a versioned table stored separately from answer matching.
- The UI and README state that estimates are for practice only and are not official IELTS results.

## 6. Architecture

Use Vue 3, TypeScript, Vite, and Vue Router. Domain logic remains framework-independent:

- `src/domain/`: question, test, draft, attempt, and scoring types.
- `src/scoring/`: answer normalization, deterministic scoring, and approximate band conversion.
- `src/data/`: original bundled practice sets.
- `src/storage/`: versioned localStorage repository.
- `src/stores/`: small composables coordinating sessions and history.
- `src/views/`: dashboard, practice, and result route views.
- `src/components/`: reusable interface pieces.

No backend is required for the MVP.

## 7. Visual Direction

The interface uses an editorial study-desk aesthetic: warm paper surfaces, deep ink text, exam-red accents, restrained navy, and a serif display face paired with a readable humanist sans-serif. The layout should feel like a carefully marked workbook rather than a generic SaaS dashboard.

Motion is limited to purposeful route and feedback transitions. Focus states, contrast, keyboard navigation, reduced-motion preferences, and mobile layouts are first-class requirements.

## 8. Error Handling

- Unknown test or attempt IDs route to a friendly not-found state with a dashboard action.
- Corrupt persisted data is ignored safely while bundled tests remain available.
- Empty submissions are allowed only after confirmation and score as zero.
- Expired timers submit the current draft once and prevent duplicate attempts.

## 9. Testing Strategy

- Vitest unit tests cover normalization, scoring, band conversion, storage recovery, and session state.
- Vue component tests cover answer entry, navigation, and result rendering.
- Playwright covers the full learner journey: start, answer, autosave/reload, submit, inspect result, and revisit history.
- `npm run check` runs type checking, unit tests, and production build.

## 10. Attribution and Content Policy

The README will state that the architecture and interaction research referenced [sallowayma-git/IELTS-practice](https://github.com/sallowayma-git/IELTS-practice). It will also state that attribution does not grant rights to third-party IELTS questions, audio, PDFs, images, or explanations. This repository will not copy or redistribute that project's question bank; bundled MVP content is original and should carry explicit provenance metadata.

## 11. MVP Acceptance Criteria

- `npm install` and `npm run dev` start the app locally.
- A learner can complete at least two original mixed-question practice sets.
- Draft answers survive a page reload.
- Submission produces deterministic reviewable scoring and an approximate band.
- Attempts appear on the dashboard and can be reopened.
- The app works at desktop and mobile viewport sizes.
- Unit tests, end-to-end tests, type checking, and production build pass.
- README documents setup, scope, scoring limitations, reference attribution, and content rights.
