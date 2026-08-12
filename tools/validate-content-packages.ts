import { readFile, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { validateContentPackage } from '../src/domain/contentPackage'

function inputDirectory(argv: string[]): string {
  const index = argv.indexOf('--input')
  if (index < 0 || !argv[index + 1]) throw new Error('Usage: npm run content:validate -- --input <package-directory>')
  return resolve(argv[index + 1])
}

async function main(): Promise<void> {
  const directory = inputDirectory(process.argv.slice(2))
  const files = (await readdir(directory)).filter((name) => name.endsWith('.json') && name !== 'conversion-report.json').sort()
  if (!files.length) throw new Error(`No content-package JSON files found in ${directory}.`)
  let sets = 0
  let questions = 0
  for (const file of files) {
    const input = JSON.parse(await readFile(join(directory, file), 'utf8')) as unknown
    const result = validateContentPackage(input)
    if (!result.ok) throw new Error(`${file}: ${result.errors.join('; ')}`)
    sets += result.value.sets.length
    questions += result.value.sets.reduce((sum, set) => sum + set.questions.length, 0)
  }
  process.stdout.write(`${JSON.stringify({ validPackages: files.length, sets, questions })}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
