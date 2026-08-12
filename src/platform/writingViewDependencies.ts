import type { InjectionKey } from 'vue'
import type { WritingAssessmentClient } from './writingAssessmentClient'
import type { WritingRepository } from '../storage/writingRepository'

export interface WritingViewDependencies {
  repository: WritingRepository
  client: WritingAssessmentClient
  desktop: boolean
  now: () => Date
  createId: () => string
  navigate: (path: string) => Promise<unknown>
}

export const WRITING_VIEW_KEY: InjectionKey<WritingViewDependencies> = Symbol('ielts-pilot-writing-view')
