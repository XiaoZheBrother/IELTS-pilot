# Context-aware assistant implementation plan

1. Add failing domain tests for reading practice, reading result, writing draft, writing report and prompt bounds.
2. Implement bounded page-context builders and context evidence entries.
3. Wire route-aware context into `LearningAssistant`, including persisted evidence summaries and contextual quick questions.
4. Keep the floating assistant available in practice/mock focus mode and add transparent send-boundary copy.
5. Run unit, integration, Rust, E2E and desktop builds; validate a real AI explanation with the configured provider.
6. Bump to v0.9.9, update documentation, commit, push, publish, and capture desktop/browser screenshots.
