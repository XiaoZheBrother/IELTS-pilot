import { ref } from 'vue'
import type { PassageAnnotation } from '../domain/models'
import type { PracticeRepository } from '../storage/practiceRepository'

export function usePassageAnnotations(setId: string, repository: PracticeRepository) {
  const annotations = ref<PassageAnnotation[]>(repository.listAnnotations(setId))
  function refresh(): void { annotations.value = repository.listAnnotations(setId) }
  function save(annotation: PassageAnnotation): void { repository.saveAnnotation(annotation); refresh() }
  function remove(id: string): void { repository.removeAnnotation(id); refresh() }
  return { annotations, save, remove }
}
