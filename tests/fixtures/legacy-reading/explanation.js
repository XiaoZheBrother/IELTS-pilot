(function registerFixture(global) {
  'use strict'
  global.__READING_EXPLANATION_DATA__.register('p1-high-demo', {
    schemaVersion: 'ReadingExplanationV1',
    examId: 'p1-high-demo',
    questionExplanations: [{
      sectionTitle: 'Questions 1-4',
      items: [{ questionId: 'q1', questionNumber: 1, text: 'The first paragraph states that gardens can lower summer temperatures.' }],
    }],
  })
})(typeof window !== 'undefined' ? window : globalThis)
