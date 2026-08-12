import type { InjectionKey } from 'vue'
import type { ContentSourceClient } from '../platform/contentSourceClient'
import type { ContentSourceRepository } from '../storage/contentSourceRepository'
import type { PracticeRepository } from '../storage/practiceRepository'

export interface ContentSourcesDependencies {
  sourceRepository: ContentSourceRepository
  practiceRepository: PracticeRepository
  client: ContentSourceClient
}

export const CONTENT_SOURCES_KEY: InjectionKey<ContentSourcesDependencies> = Symbol('ielts-pilot-content-sources')
