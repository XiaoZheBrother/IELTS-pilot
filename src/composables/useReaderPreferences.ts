import { ref } from 'vue'
import type { ReaderPreferences } from '../domain/models'
import type { PracticeRepository } from '../storage/practiceRepository'

export function applyReaderPreferences(preferences: ReaderPreferences, root = document.documentElement): void {
  root.dataset.readerTheme = preferences.theme
  root.style.setProperty('--reader-font-scale', String(preferences.fontScale))
  root.style.setProperty('--reader-line-height', String(preferences.lineHeight))
  root.style.setProperty('--reader-width', `${preferences.readingWidth}px`)
}

export function useReaderPreferences(repository: PracticeRepository) {
  const preferences = ref<ReaderPreferences>(repository.getPreferences())
  applyReaderPreferences(preferences.value)
  function save(next: ReaderPreferences): void {
    repository.savePreferences(next)
    preferences.value = repository.getPreferences()
    applyReaderPreferences(preferences.value)
  }
  return { preferences, save }
}
