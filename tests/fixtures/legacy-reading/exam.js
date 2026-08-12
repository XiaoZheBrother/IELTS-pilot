(function registerFixture(global) {
  'use strict'
  global.__READING_EXAM_DATA__.register('p1-high-demo', {
    schemaVersion: 'ReadingExamSourceV1',
    examId: 'p1-high-demo',
    meta: {
      title: 'A Demonstration Passage',
      category: 'P1',
      frequency: 'high',
      legacyFilename: 'demo.html',
    },
    passage: {
      blocks: [{
        blockId: 'passage-main',
        kind: 'html',
        html: '<h2>READING PASSAGE 1</h2><p>You should spend about 20 minutes on Questions 1-4.</p><h3>A Demonstration Passage</h3><div class="paragraph-wrapper"><span data-question="q2" data-paragraph="A"></span><p id="q1-anchor"><strong>A</strong> Urban gardens can lower summer temperatures and provide quiet places for residents.</p></div><p><strong>B</strong> Volunteers maintain the gardens every Friday and record the insects they observe.</p>',
      }],
    },
    questionGroups: [
      {
        groupId: 'group-1', kind: 'true_false_not_given', questionIds: ['q1'],
        bodyHtml: '<p>Do the following statements agree with the passage?</p><div class="question-item"><p><strong>1</strong> Urban gardens may reduce heat.</p><label><input type="radio" name="q1" value="TRUE">TRUE</label><label><input type="radio" name="q1" value="FALSE">FALSE</label><label><input type="radio" name="q1" value="NOT GIVEN">NOT GIVEN</label></div>',
      },
      {
        groupId: 'group-2', kind: 'matching', questionIds: ['q2'],
        bodyHtml: '<p>Choose the correct heading for each paragraph.</p><div class="headings-pool"><div class="drag-item" data-heading="i">i. Community maintenance</div><div class="drag-item" data-heading="ii">ii. Environmental benefits</div></div>',
      },
      {
        groupId: 'group-3', kind: 'sentence_completion', questionIds: ['q3'],
        bodyHtml: '<p>Complete the sentence below. Choose NO MORE THAN TWO WORDS.</p><div class="question-item"><p><strong>3</strong> Volunteers visit the gardens every <input name="q3" type="text">.</p></div>',
      },
      {
        groupId: 'group-4', kind: 'multi_choice', questionIds: ['q4'],
        bodyHtml: '<p>Choose TWO letters.</p><div class="question-item"><p><strong>4</strong> Which TWO benefits are mentioned?</p><label><input type="checkbox" name="q4" value="A">A Cooler streets</label><label><input type="checkbox" name="q4" value="B">B More parking</label><label><input type="checkbox" name="q4" value="C">C Quiet places</label></div>',
      },
      {
        groupId: 'group-5', kind: 'matching', questionIds: ['q5'],
        bodyHtml: '<p>Complete the summary using the list of places, A-C, below.</p><div data-question="q5"></div><div class="options-pool"><div class="drag-item" data-word="A">A America</div><div class="drag-item" data-word="B">B Bahrain</div><div class="drag-item" data-word="C">C China</div></div>',
      },
      {
        groupId: 'group-6', kind: 'multi_choice', questionIds: ['q6', 'q7'],
        bodyHtml: '<p>Choose TWO letters, A-C.</p><p>Which TWO benefits are mentioned?</p><label><input type="checkbox" name="q6_7" value="A">A Cooler streets</label><label><input type="checkbox" name="q6_7" value="B">B More parking</label><label><input type="checkbox" name="q6_7" value="C">C Quiet places</label>',
      },
    ],
    answerKey: {
      q1: 'TRUE',
      q2: 'ii',
      q3: ['Friday', 'each Friday'],
      q4: ['A', 'C'],
      q5: 'B',
      q6: 'A',
      q7: 'C',
    },
    questionDisplayMap: { q1: '1', q2: '2', q3: '3', q4: '4', q5: '5', q6: '6', q7: '7' },
    sourceRefs: { ieltsHtml: 'IELTS/P1/Demonstration.html' },
  })
})(typeof window !== 'undefined' ? window : globalThis)
