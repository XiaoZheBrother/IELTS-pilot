import type { InjectionKey } from 'vue'
import { createLearningAssistantClient, type LearningAssistantClient } from '../platform/learningAssistantClient'
import { createBrowserAiSettingsRepository, type AiSettingsRepository } from '../storage/aiSettingsRepository'
import {
  createBrowserAssistantConversationRepository,
  type AssistantConversationRepository,
} from '../storage/assistantConversationRepository'
import { createBrowserPracticeRepository, type PracticeRepository } from '../storage/practiceRepository'
import { createBrowserWritingRepository, type WritingRepository } from '../storage/writingRepository'

export interface LearningAssistantDependencies {
  practice: Pick<PracticeRepository, 'listAttempts' | 'listMasteredErrorKeys'>
  writing: Pick<WritingRepository, 'listReports'>
  settings: Pick<AiSettingsRepository, 'get'>
  conversation: AssistantConversationRepository
  client: LearningAssistantClient
  now: () => Date
}

export const LEARNING_ASSISTANT_KEY: InjectionKey<LearningAssistantDependencies> = Symbol('learning-assistant')

export function createLearningAssistantDependencies(): LearningAssistantDependencies {
  return {
    practice: createBrowserPracticeRepository(),
    writing: createBrowserWritingRepository(),
    settings: createBrowserAiSettingsRepository(),
    conversation: createBrowserAssistantConversationRepository(),
    client: createLearningAssistantClient(),
    now: () => new Date(),
  }
}
