import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, test } from 'vitest'
import { validateContentPackage } from '../../src/domain/contentPackage'

const execute = promisify(execFile)
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('legacy reading converter command', () => {
  test('writes validated packages, a quality report and checksums', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ielts-pilot-legacy-'))
    temporaryDirectories.push(root)
    const source = join(root, 'IELTS-practice')
    const exams = join(source, 'assets', 'generated', 'reading-exams')
    const explanations = join(source, 'assets', 'generated', 'reading-explanations')
    const output = join(root, 'output')
    await mkdir(exams, { recursive: true })
    await mkdir(explanations, { recursive: true })
    await copyFile(resolve('tests/fixtures/legacy-reading/exam.js'), join(exams, 'p1-high-demo.js'))
    await copyFile(resolve('tests/fixtures/legacy-reading/explanation.js'), join(explanations, 'p1-high-demo.js'))

    const result = await execute(process.execPath, [
      resolve('tools/convert-ielts-practice-reading.mjs'),
      '--source', source,
      '--output', output,
      '--package-size', '25',
      '--timestamp', '2026-08-12T00:00:00.000Z',
    ])

    expect(result.stderr).toBe('')
    const files = await readdir(output)
    expect(files).toEqual(expect.arrayContaining([
      'private-atlas-p1-001.json',
      'conversion-report.json',
      'SHA256SUMS.txt',
      'IMPORT-INSTRUCTIONS.txt',
    ]))
    const content = JSON.parse(await readFile(join(output, 'private-atlas-p1-001.json'), 'utf8')) as unknown
    expect(validateContentPackage(content).ok).toBe(true)
    const report = JSON.parse(await readFile(join(output, 'conversion-report.json'), 'utf8')) as {
      sourceSets: number
      sourceQuestions: number
      convertedSets: number
      convertedQuestions: number
      packages: Array<{ file: string }>
    }
    expect(report).toMatchObject({ sourceSets: 1, sourceQuestions: 7, convertedSets: 1, convertedQuestions: 7 })
    expect(report.packages.map(({ file }) => basename(file))).toEqual(['private-atlas-p1-001.json'])
    expect(await readFile(join(output, 'SHA256SUMS.txt'), 'utf8')).toMatch(/^[a-f0-9]{64}  private-atlas-p1-001\.json\r?\n$/)
    expect(await readFile(join(output, 'IMPORT-INSTRUCTIONS.txt'), 'utf8')).toContain('题库包管理')
    expect(await readFile(join(output, 'IMPORT-INSTRUCTIONS.txt'), 'utf8')).toContain('个人学习')
  })
})
