import type { InjectionKey } from 'vue'
import { createLearningAssistantClient, type LearningAssistantClient } from '../platform/learningAssistantClient'
import { isDesktopRuntime } from '../platform/runtime'
import { createBrowserAiSettingsRepository, type AiSettingsRepository } from '../storage/aiSettingsRepository'

export interface AiSettingsViewDependencies {
  desktop: boolean
  repository: AiSettingsRepository
  client: LearningAssistantClient
}

export const DEFAULT_AI_SETTINGS_VIEW_DEPENDENCIES: AiSettingsViewDependencies = {
  desktop: isDesktopRuntime(),
  repository: createBrowserAiSettingsRepository(),
  client: createLearningAssistantClient(),
}

export const AI_SETTINGS_VIEW_KEY: InjectionKey<AiSettingsViewDependencies> = Symbol('ai-settings-view')
