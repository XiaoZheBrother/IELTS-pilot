import { writingTasks } from '../../src/data/writingTasks'

describe('original writing tasks', () => {
  it('ships one Task 1 and one Task 2 exercise with original provenance and demo essays', () => {
    expect(writingTasks.map(({ type }) => type)).toEqual(['task-1', 'task-2'])
    writingTasks.forEach((task) => {
      expect(task.provenance.kind).toBe('original')
      expect(task.provenance.author).toBe('IELTS Pilot')
      expect(task.demoEssay.split(/\s+/).length).toBeGreaterThanOrEqual(task.minimumWords)
      expect(task.prompt.length).toBeGreaterThan(80)
    })
    expect(writingTasks[0]?.visualData?.series).toHaveLength(3)
    expect(writingTasks[1]?.visualData).toBeUndefined()
  })
})
