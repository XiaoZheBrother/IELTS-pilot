import type { QuestionType } from './models'

export const questionTypeLabels: Record<QuestionType, string> = {
  'multiple-choice': '单项选择',
  'multiple-select': '多项选择',
  'true-false-not-given': '事实判断',
  'yes-no-not-given': '观点判断',
  'matching-headings': '标题配对',
  'matching-information': '信息配对',
  'matching-features': '特征配对',
  'matching-sentence-endings': '句尾配对',
  'short-answer': '简短回答',
  'sentence-completion': '句子填空',
  'summary-word-bank': '摘要选词',
  'diagram-label': '图示填空',
}

