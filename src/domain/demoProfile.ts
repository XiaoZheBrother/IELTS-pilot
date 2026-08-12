import { practiceSets } from '../data/practiceSets'
import { writingTasks } from '../data/writingTasks'
import type { Attempt, PracticeSet, ReadingAnswers } from './models'
import { scoreReadingTest } from './readingScorer'
import type { PracticeRepository } from '../storage/practiceRepository'
import type { WritingRepository } from '../storage/writingRepository'

export interface DemoProfileResult {
  readingAttempts: number
  writingReports: number
  message: string
}

function acceptedAnswer(set: PracticeSet, questionIndex: number): string[] {
  const accepted = set.questions[questionIndex]!.acceptedAnswers[0]
  return Array.isArray(accepted) ? [...accepted] : [accepted]
}

function demonstrationAnswers(set: PracticeSet, wrongIndexes: number[]): ReadingAnswers {
  return Object.fromEntries(set.questions.map((question, index) => [
    question.id,
    wrongIndexes.includes(index) ? ['demonstration-wrong-answer'] : acceptedAnswer(set, index),
  ]))
}

function demonstrationAttempt(set: PracticeSet, sequence: number, now: Date): Attempt {
  const wrongPatterns = [[1, 5, 9], [0, 6, 11], [2, 4, 8, 12]]
  const answers = demonstrationAnswers(set, wrongPatterns[sequence] ?? [0])
  return {
    id: `demo-reading-${sequence + 1}`,
    testId: set.id,
    mode: 'practice',
    answers,
    score: scoreReadingTest(set, answers),
    submittedAt: new Date(now.getTime() - sequence * 86_400_000).toISOString(),
    durationSeconds: 1_260 + sequence * 180,
    submissionReason: 'manual',
  }
}

export function installDemoProfile(
  practice: PracticeRepository,
  writing: WritingRepository,
  now: () => Date = () => new Date(),
): DemoProfileResult {
  const installedAt = now()
  practiceSets.slice(0, 3).forEach((set, index) => practice.saveAttempt(demonstrationAttempt(set, index, installedAt)))

  const firstSet = practiceSets[0]!
  practice.saveDraft({
    testId: firstSet.id,
    answers: Object.fromEntries(firstSet.questions.slice(0, 4).map((question, index) => [question.id, acceptedAnswer(firstSet, index)])),
    currentIndex: 4,
    remainingSeconds: 1_080,
    updatedAt: installedAt.toISOString(),
    flags: [firstSet.questions[4]!.id],
    isPaused: true,
  })
  if (!practice.listFavoriteSetIds().includes(firstSet.id)) practice.toggleFavoriteSet(firstSet.id)
  if (!practice.listFavoriteQuestionIds().includes('shade_q2')) practice.toggleFavoriteQuestion('shade_q2')
  practice.setErrorMastered('shade-networks:shade_q6', true)

  const paragraph = firstSet.passage.sections[0]!.paragraphs[0]!
  const selectedText = 'same journey can feel radically longer'
  const startOffset = paragraph.indexOf(selectedText)
  practice.saveAnnotation({
    id: 'demo-annotation-heat-route', setId: firstSet.id, sectionIndex: 0, paragraphIndex: 0,
    startOffset, endOffset: startOffset + selectedText.length, selectedText, color: 'sage',
    note: '核心对比：地图距离不变，但体感难度会随热浪变化。',
    createdAt: installedAt.toISOString(), updatedAt: installedAt.toISOString(),
  })

  const writingTask = writingTasks[1]!
  writing.saveReport({
    id: 'demo-writing-balanced-library-baseline', taskId: writingTask.id, taskType: writingTask.type,
    essay: writingTask.demoEssay, wordCount: writingTask.demoEssay.trim().split(/\s+/u).length,
    overallBand: 6.5,
    summary: '文章立场清晰，能够回应双方观点，但论证细节和段落之间的自然衔接仍有提升空间。',
    criteria: [
      { criterion: 'task-response', band: 6.5, rationale: '回应了主要观点，但预算权衡的例证仍偏概括。' },
      { criterion: 'coherence-cohesion', band: 6, rationale: '结构清楚，部分段首连接词使用较显性。' },
      { criterion: 'lexical-resource', band: 6.5, rationale: '议题词汇准确，但个别搭配可以更自然。' },
      { criterion: 'grammatical-range-accuracy', band: 7, rationale: '复合句使用稳定，少量长句可以进一步拆分。' },
    ],
    strengths: ['立场明确并覆盖题目双方观点。'],
    priorities: ['减少段首显性连接词，改用关键词复现与指代形成衔接。', '在数字投入段补充一个更具体的预算权衡例子。'],
    evidence: [], model: 'IELTS Pilot 演示报告', promptVersion: 'writing-v1',
    generatedAt: new Date(installedAt.getTime() - 7 * 86_400_000).toISOString(), requestId: 'local-demo-profile-baseline',
  })
  writing.saveReport({
    id: 'demo-writing-balanced-library', taskId: writingTask.id, taskType: writingTask.type,
    essay: writingTask.demoEssay, wordCount: writingTask.demoEssay.trim().split(/\s+/u).length,
    overallBand: 7,
    summary: '文章完整讨论了数字服务与实体自习空间，并以“消除不同学习障碍”为主线给出明确、平衡的立场。',
    criteria: [
      { criterion: 'task-response', band: 7, rationale: '双方观点均得到充分回应，作者立场贯穿全文，结论与论证一致。' },
      { criterion: 'coherence-cohesion', band: 6.5, rationale: '段落推进清晰，但个别连接方式较为显性，可以增加指代与语义衔接。' },
      { criterion: 'lexical-resource', band: 7, rationale: '词汇选择准确且与公共服务议题匹配，搭配总体自然。' },
      { criterion: 'grammatical-range-accuracy', band: 7.5, rationale: '能够稳定使用复合句与让步结构，错误极少且不影响阅读。' },
    ],
    strengths: ['明确解释了两类图书馆服务分别解决的学习障碍。', '例证与主张紧密对应，没有偏离题目。'],
    priorities: ['减少段首显性连接词，改用关键词复现与指代形成衔接。', '在数字投入段补充一个更具体的预算权衡例子。'],
    evidence: [
      { criterion: 'task-response', quote: 'The best policy is consequently a balanced one.', observation: '该句直接给出折中立场，并与开头观点呼应。', revision: 'A balanced funding model is therefore the most defensible policy.' },
      { criterion: 'lexical-resource', quote: 'a form of educational infrastructure', observation: '将自习空间定义为教育基础设施，表达精确且具有概括力。', revision: 'an essential part of a city’s educational infrastructure' },
    ],
    model: 'IELTS Pilot 演示报告', promptVersion: 'writing-v1', generatedAt: installedAt.toISOString(), requestId: 'local-demo-profile',
  })

  return { readingAttempts: 3, writingReports: 2, message: '演示数据已准备完成，可从概览、分析、错题本与写作报告开始走查。' }
}
