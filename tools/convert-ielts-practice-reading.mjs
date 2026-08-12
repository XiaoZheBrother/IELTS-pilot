import { createHash } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, parse, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

const SOURCE_URL = 'https://github.com/sallowayma-git/IELTS-practice'
const PERSONAL_USE_NOTE = 'Converted from a locally held IELTS Atlas/IELTS-practice reading asset for private study. The converter does not grant rights to redistribute third-party passages, questions, explanations, PDFs or media.'
const STOP_WORDS = new Set(['about', 'after', 'again', 'against', 'also', 'among', 'because', 'before', 'being', 'below', 'between', 'could', 'does', 'following', 'from', 'given', 'into', 'more', 'most', 'other', 'over', 'passage', 'question', 'should', 'some', 'than', 'that', 'their', 'there', 'these', 'they', 'this', 'through', 'under', 'which', 'with', 'would', 'write'])
const REGISTRIES = new Set(['__READING_EXAM_DATA__', '__READING_EXPLANATION_DATA__'])
const MATCHING_TYPES = new Set(['matching-headings', 'matching-information', 'matching-features', 'matching-sentence-endings'])

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function tidy(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function slug(value) {
  return tidy(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'
}

function questionIdsFromElement(element) {
  const ids = new Set()
  const inspect = (node) => {
    if (!node?.getAttribute) return
    for (const attribute of ['id', 'name', 'data-question']) {
      const value = node.getAttribute(attribute) ?? ''
      for (const match of value.matchAll(/\b(q\d+)\b/gi)) ids.add(match[1].toLowerCase())
    }
  }
  inspect(element)
  for (const node of element?.querySelectorAll?.('[id],[name],[data-question]') ?? []) inspect(node)
  let parent = element?.parentElement
  for (let depth = 0; parent && depth < 3; depth += 1, parent = parent.parentElement) inspect(parent)
  return [...ids]
}

function htmlSource(block) {
  const candidate = block?.html ?? block?.bodyHtml ?? block?.text ?? ''
  return typeof candidate === 'string' ? candidate : ''
}

export async function loadRegisteredPayload(filePath, registryName) {
  if (!REGISTRIES.has(registryName)) throw new Error(`Unsupported generated registry: ${registryName}`)
  const source = await readFile(filePath, 'utf8')
  let captured = null
  const registry = Object.freeze({
    register(id, data) {
      if (captured) throw new Error('Generated source registered more than one payload.')
      if (typeof id !== 'string' || !id.trim()) throw new Error('Generated source registered an invalid id.')
      captured = { id, data }
    },
  })
  const sandbox = { [registryName]: registry }
  sandbox.globalThis = sandbox
  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } })
  vm.runInContext(source, context, { filename: filePath, timeout: 1_000, displayErrors: true })
  if (!captured) throw new Error(`Generated source did not register ${registryName}.`)
  return JSON.parse(JSON.stringify(captured))
}

export function buildExplanationIndex(explanation) {
  const index = new Map()
  for (const section of explanation?.questionExplanations ?? []) {
    for (const item of section?.items ?? []) {
      const id = tidy(item?.questionId || (Number.isFinite(item?.questionNumber) ? `q${item.questionNumber}` : '')).toLowerCase()
      const text = tidy(item?.text)
      if (id && text && !index.has(id)) index.set(id, text)
    }
  }
  return index
}

function isBoilerplate(text, title) {
  const lower = text.toLowerCase()
  return !text
    || lower.startsWith('you should spend about')
    || /^questions?\s+\d/i.test(text)
    || lower === title.toLowerCase()
    || lower === 'reading passage 1'
    || lower === 'reading passage 2'
    || lower === 'reading passage 3'
}

export function extractPassage(exam) {
  const title = tidy(exam?.meta?.title || exam?.examId || 'Imported reading passage')
  const source = (exam?.passage?.blocks ?? []).map(htmlSource).filter(Boolean).join('\n')
  const dom = new JSDOM(`<body>${source}</body>`)
  const document = dom.window.document
  const questionParagraphs = {}
  const questionLabels = {}
  const paragraphElements = []
  const paragraphs = []

  for (const element of document.querySelectorAll('script,style,noscript,iframe,button')) element.remove()
  for (const paragraph of document.querySelectorAll('p')) {
    const text = tidy(paragraph.textContent)
    if (text.length < 12 || isBoilerplate(text, title)) continue
    const paragraphIndex = paragraphs.length
    paragraphs.push(text)
    paragraphElements.push(paragraph)
    const related = new Set(questionIdsFromElement(paragraph))
    const wrapper = paragraph.closest('.paragraph-wrapper')
    for (const id of questionIdsFromElement(wrapper)) related.add(id)
    for (const id of related) questionParagraphs[id] = { sectionIndex: 0, paragraphIndex }
  }

  if (!paragraphs.length) {
    const text = tidy(document.body.textContent)
    if (text) paragraphs.push(text)
  }
  if (!paragraphs.length) paragraphs.push(`Imported passage text for ${title}.`)

  for (const node of document.querySelectorAll('[data-question]')) {
    const id = tidy(node.getAttribute('data-question')).toLowerCase()
    const label = tidy(node.getAttribute('data-paragraph'))
    if (id && label) questionLabels[id] = label
    if (id && !questionParagraphs[id]) {
      const wrapper = node.closest('.paragraph-wrapper') ?? node.parentElement
      const paragraph = wrapper?.querySelector('p') ?? node.closest('p')
      const paragraphIndex = paragraphElements.indexOf(paragraph)
      if (paragraphIndex >= 0) questionParagraphs[id] = { sectionIndex: 0, paragraphIndex }
    }
  }
  for (const node of document.querySelectorAll('[id]')) {
    const match = (node.getAttribute('id') ?? '').match(/\b(q\d+)(?:-anchor)?\b/i)
    if (!match || questionParagraphs[match[1].toLowerCase()]) continue
    const paragraph = node.closest('p') ?? node.closest('.paragraph-wrapper')?.querySelector('p') ?? node.parentElement?.querySelector('p')
    const paragraphIndex = paragraphElements.indexOf(paragraph)
    if (paragraphIndex >= 0) questionParagraphs[match[1].toLowerCase()] = { sectionIndex: 0, paragraphIndex }
  }

  const deck = tidy(exam?.meta?.category ? `${exam.meta.category} · ${exam.meta.frequency || 'reading practice'}` : 'Imported reading practice')
  return {
    title,
    deck,
    sections: [{ heading: title, paragraphs }],
    questionParagraphs,
    questionLabels,
  }
}

function groupDocument(group) {
  return new JSDOM(`<body>${group?.leadHtml ?? ''}${group?.bodyHtml ?? group?.html ?? ''}</body>`).window.document
}

function controlsFor(document, questionId) {
  return [...document.querySelectorAll('input,select,textarea,[data-question]')].filter((element) =>
    tidy(element.getAttribute('name')).toLowerCase() === questionId
    || tidy(element.getAttribute('data-question')).toLowerCase() === questionId)
}

function optionFromElement(element) {
  const key = tidy(element.getAttribute('data-heading') || element.getAttribute('data-option') || element.getAttribute('data-value') || element.getAttribute('value'))
  let label = tidy(element.textContent)
  if (!key || !label) return null
  label = label.replace(new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.、):\-]?\\s*`, 'i'), '').trim() || key
  return { key, label }
}

function extractOptions(document, questionId) {
  const options = []
  const add = (candidate) => {
    if (candidate && !options.some(({ key }) => key.toLowerCase() === candidate.key.toLowerCase())) options.push(candidate)
  }
  for (const control of controlsFor(document, questionId)) {
    if (control.tagName === 'SELECT') {
      for (const option of control.querySelectorAll('option')) {
        if (tidy(option.getAttribute('value'))) add(optionFromElement(option))
      }
      continue
    }
    if (!['radio', 'checkbox'].includes(String(control.getAttribute('type')).toLowerCase())) continue
    const label = control.closest('label')
    const key = tidy(control.getAttribute('value'))
    const labelText = tidy(label?.textContent || key).replace(new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.、):\-]?\\s*`, 'i'), '').trim() || key
    add(key ? { key, label: labelText } : null)
  }
  for (const element of document.querySelectorAll('.drag-item,[data-heading],[data-option]')) add(optionFromElement(element))
  return options
}

function displayNumber(exam, questionId) {
  return tidy(exam?.questionDisplayMap?.[questionId] || questionId.replace(/^q/i, '')) || questionId
}

function questionPrompt(document, group, questionId, number, passage) {
  const controls = controlsFor(document, questionId)
  const target = controls[0] ?? document.getElementById(`${questionId}-anchor`) ?? document.getElementById(questionId)
  let container = target?.closest('.question-text,.question-item,.question-row,.match-question-item,tr,li,p')
  if (container?.tagName === 'LABEL') container = container.parentElement
  if (container) {
    const clone = container.cloneNode(true)
    for (const input of clone.querySelectorAll('input,select,textarea')) {
      const type = String(input.getAttribute('type')).toLowerCase()
      if (type === 'radio' || type === 'checkbox') input.closest('label')?.remove() ?? input.remove()
      else input.replaceWith(clone.ownerDocument.createTextNode(' ____ '))
    }
    for (const pool of clone.querySelectorAll('.drag-item,.options-pool,.headings-pool,.radio-options,.tfng-options,.radio-group')) pool.remove()
    const text = tidy(clone.textContent).replace(new RegExp(`^${number}[.、):\-]?\\s*`), '').trim()
    if (text.length > 2) return text
  }
  const label = passage.questionLabels[questionId]
  const instruction = tidy(document.querySelector('p')?.textContent)
  if (/heading/i.test(`${group?.kind} ${instruction}`)) return `Choose the correct heading for Paragraph ${label || number}.`
  return instruction ? `Question ${number}: ${instruction}` : `Question ${number} from ${passage.title}.`
}

function wordLimit(group) {
  const text = tidy(`${group?.leadHtml ?? ''} ${group?.bodyHtml ?? group?.html ?? ''}`).toUpperCase()
  const words = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
  const match = text.match(/NO MORE THAN\s+(ONE|TWO|THREE|FOUR|FIVE|\d+)\s+WORDS?/) || text.match(/\b(ONE|TWO|THREE|FOUR|FIVE|\d+)\s+WORDS?\s+ONLY/)
  if (match) return words[match[1]] ?? Number(match[1])
  return /WORD\s+AND\/OR\s+A\s+NUMBER/.test(text) ? 2 : 3
}

function inferMatchingType(text) {
  if (/heading/i.test(text)) return 'matching-headings'
  if (/sentence\s+ending|endings/i.test(text)) return 'matching-sentence-endings'
  if (/which\s+paragraph|contains.*information|paragraph.*information/i.test(text)) return 'matching-information'
  return 'matching-features'
}

function inferType(group, rawAnswer, options) {
  const kind = tidy(group?.kind).toLowerCase()
  const text = tidy(`${group?.leadHtml ?? ''} ${group?.bodyHtml ?? group?.html ?? ''}`)
  if (kind === 'true_false_not_given') return 'true-false-not-given'
  if (kind === 'yes_no_not_given') return 'yes-no-not-given'
  if (kind === 'multi_choice' && Array.isArray(rawAnswer) && rawAnswer.length > 1 && rawAnswer.every((value) => /^[A-Z]$/i.test(String(value)))) return 'multiple-select'
  if (['single_choice', 'multi_choice', 'multiple_choice'].includes(kind)) return 'multiple-choice'
  if (kind === 'matching' || kind === 'classification') return inferMatchingType(text)
  if (kind === 'short_answer') return 'short-answer'
  if (kind === 'diagram_completion') return 'diagram-label'
  if (kind === 'summary_completion' && options.length >= 2) return 'summary-word-bank'
  return 'sentence-completion'
}

function normalizeJudgment(value) {
  const compact = tidy(value).toLowerCase().replace(/[\s_-]+/g, '')
  if (['true', 't', 'yes', 'y'].includes(compact)) return 'true'
  if (['false', 'f', 'no', 'n'].includes(compact)) return 'false'
  if (['notgiven', 'ng'].includes(compact)) return 'not given'
  return tidy(value)
}

function acceptedAnswers(type, rawAnswer) {
  const values = Array.isArray(rawAnswer) ? rawAnswer.map((value) => tidy(value)).filter(Boolean) : [tidy(rawAnswer)].filter(Boolean)
  if (type === 'multiple-select') return [values]
  if (type === 'true-false-not-given' || type === 'yes-no-not-given') return values.map(normalizeJudgment)
  return values
}

function tokens(value) {
  return new Set((tidy(value).toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((token) => !STOP_WORDS.has(token)))
}

function locateQuestion(questionId, prompt, rawAnswer, explanation, passage) {
  if (passage.questionParagraphs[questionId]) return { sourceRef: passage.questionParagraphs[questionId], confidence: 'exact' }
  const needle = tokens(`${prompt} ${Array.isArray(rawAnswer) ? rawAnswer.join(' ') : rawAnswer} ${explanation}`)
  let bestIndex = -1
  let bestScore = 0
  passage.sections[0].paragraphs.forEach((paragraph, index) => {
    const haystack = tokens(paragraph)
    const score = [...needle].reduce((sum, token) => sum + (haystack.has(token) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; bestIndex = index }
  })
  if (bestIndex >= 0 && bestScore >= 2) return { sourceRef: { sectionIndex: 0, paragraphIndex: bestIndex }, confidence: 'inferred' }
  return { sourceRef: { sectionIndex: 0, paragraphIndex: 0 }, confidence: 'fallback' }
}

function splitCompletion(prompt) {
  const [before, ...rest] = prompt.split('____')
  return { beforeBlank: tidy(before || prompt), ...(rest.length ? { afterBlank: tidy(rest.join('____')) } : {}) }
}

function difficulty(examId) {
  if (/-high-/i.test(examId)) return 'advanced'
  if (/-medium-/i.test(examId)) return 'medium'
  return 'foundation'
}

export function convertExam(exam, explanations = new Map(), sourceFile = '') {
  if (exam?.schemaVersion !== 'ReadingExamSourceV1') throw new Error(`${sourceFile || exam?.examId}: unsupported reading source schema.`)
  const passage = extractPassage(exam)
  const groupsByQuestion = new Map()
  for (const group of exam?.questionGroups ?? []) for (const id of group?.questionIds ?? []) groupsByQuestion.set(tidy(id).toLowerCase(), group)
  const stats = {
    dedicatedExplanations: 0, fallbackExplanations: 0,
    exactLocations: 0, inferredLocations: 0, fallbackLocations: 0,
    downgradedOptionQuestions: 0,
    questionTypes: {}, warnings: [],
  }
  const questions = []

  for (const [rawId, rawAnswer] of Object.entries(asObject(exam.answerKey))) {
    const questionId = tidy(rawId).toLowerCase()
    const group = groupsByQuestion.get(questionId) ?? { kind: 'short_answer', questionIds: [questionId], bodyHtml: '' }
    const document = groupDocument(group)
    const options = extractOptions(document, questionId)
    const number = displayNumber(exam, questionId)
    const prompt = questionPrompt(document, group, questionId, number, passage)
    const dedicated = explanations.get(questionId)
    const explanation = dedicated || `Converted answer from the local reference bank (${sourceFile || exam.examId}); no dedicated per-question explanation was available.`
    if (dedicated) stats.dedicatedExplanations += 1
    else stats.fallbackExplanations += 1
    const location = locateQuestion(questionId, prompt, rawAnswer, explanation, passage)
    stats[`${location.confidence}Locations`] += 1
    let type = inferType(group, rawAnswer, options)
    if ((MATCHING_TYPES.has(type) || ['multiple-choice', 'multiple-select', 'summary-word-bank'].includes(type)) && options.length < 2) {
      stats.downgradedOptionQuestions += 1
      stats.warnings.push(`${exam.examId}:${questionId} lacked two extractable options and was downgraded to short-answer.`)
      type = 'short-answer'
    }
    const base = {
      id: `atlas-${slug(exam.examId)}-${slug(questionId)}`,
      type,
      prompt,
      acceptedAnswers: acceptedAnswers(type, rawAnswer),
      explanation,
      sourceRef: location.sourceRef,
    }
    let question = base
    if (type === 'multiple-choice' || MATCHING_TYPES.has(type) || type === 'summary-word-bank') question = { ...base, options }
    else if (type === 'multiple-select') question = { ...base, options, selectLimit: base.acceptedAnswers[0].length }
    else if (type === 'short-answer') question = { ...base, wordLimit: wordLimit(group) }
    else if (type === 'sentence-completion') question = { ...base, wordLimit: wordLimit(group), ...splitCompletion(prompt) }
    else if (type === 'diagram-label') question = { ...base, wordLimit: wordLimit(group), diagramDescription: prompt }
    questions.push(question)
    stats.questionTypes[type] = (stats.questionTypes[type] ?? 0) + 1
  }

  if (!questions.length) throw new Error(`${sourceFile || exam.examId}: no answer-key questions were found.`)
  const category = tidy(exam?.meta?.category || 'Reading').toUpperCase()
  const frequency = tidy(exam?.meta?.frequency || 'reference')
  return {
    set: {
      id: `atlas-${slug(exam.examId)}`,
      sequence: category,
      eyebrow: `Private legacy import · ${category}`,
      title: passage.title,
      summary: `Converted private-study reading practice from ${tidy(sourceFile || exam.examId)}.`,
      level: category === 'P3' ? 'C1' : category === 'P2' ? 'B2-C1' : 'B2',
      durationMinutes: 20,
      topics: [category, frequency],
      difficulty: difficulty(exam.examId),
      estimatedBand: category === 'P3' ? 7 : category === 'P2' ? 6.5 : 6,
      passage: { title: passage.title, deck: passage.deck, sections: passage.sections },
      provenance: {
        kind: 'licensed',
        author: 'Third-party source rights holders',
        license: 'Private study only; redistribution rights not granted by this conversion',
        sourceUrl: SOURCE_URL,
        note: PERSONAL_USE_NOTE,
      },
      questions,
    },
    stats,
  }
}

export function buildContentPackage(sets, options) {
  const timestamp = options.timestamp ?? new Date().toISOString()
  return {
    schemaVersion: 2,
    packageId: options.packageId,
    version: '1.0.0',
    name: options.name,
    description: `Private-study ${options.category} reading package converted from a local IELTS Atlas/IELTS-practice data set.`,
    owner: 'Third-party source rights holders',
    license: 'Private study only; no redistribution permission granted',
    sourceUrl: options.sourceUrl ?? SOURCE_URL,
    note: PERSONAL_USE_NOTE,
    createdAt: timestamp,
    updatedAt: timestamp,
    minimumAppVersion: '0.9.0',
    changelog: 'Initial private local conversion.',
    sets,
  }
}

function parseArguments(argv) {
  const values = {}
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith('--')) throw new Error(`Unexpected argument: ${current}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${current}.`)
    values[current.slice(2)] = value
    index += 1
  }
  const packageSize = Number(values['package-size'] ?? 25)
  if (!Number.isInteger(packageSize) || packageSize < 1 || packageSize > 100) throw new Error('--package-size must be an integer from 1 to 100.')
  const timestamp = values.timestamp ?? new Date().toISOString()
  if (Number.isNaN(Date.parse(timestamp))) throw new Error('--timestamp must be an ISO date.')
  return {
    source: resolve(values.source ?? join(process.cwd(), '..', 'IELTS-practice')),
    output: resolve(values.output ?? join(process.cwd(), 'artifacts', 'import', 'ielts-practice-reading')),
    packageSize,
    timestamp,
  }
}

async function exists(path) {
  try { await access(path, fsConstants.F_OK); return true } catch { return false }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function addStats(target, source) {
  for (const key of ['dedicatedExplanations', 'fallbackExplanations', 'exactLocations', 'inferredLocations', 'fallbackLocations', 'downgradedOptionQuestions']) {
    target[key] += source[key]
  }
  for (const [type, count] of Object.entries(source.questionTypes)) target.questionTypes[type] = (target.questionTypes[type] ?? 0) + count
  target.warnings.push(...source.warnings)
}

async function replaceGeneratedDirectory(staging, output) {
  const root = parse(output).root
  if (output === root || output === resolve(process.cwd())) throw new Error('Refusing to replace a broad output directory.')
  if (await exists(output)) {
    const entries = await readdir(output)
    if (entries.length && !entries.includes('conversion-report.json')) throw new Error(`Output directory is not empty and was not created by this converter: ${output}`)
    await rm(output, { recursive: true, force: true })
  }
  await mkdir(dirname(output), { recursive: true })
  await rename(staging, output)
}

export async function runConversion(options) {
  const source = resolve(options.source)
  const output = resolve(options.output)
  const packageSize = options.packageSize ?? 25
  const timestamp = options.timestamp ?? new Date().toISOString()
  if (source === output || output.startsWith(`${source}\\`) || output.startsWith(`${source}/`)) throw new Error('Output directory must not be inside the source project.')
  const examDirectory = join(source, 'assets', 'generated', 'reading-exams')
  const explanationDirectory = join(source, 'assets', 'generated', 'reading-explanations')
  const examFiles = (await readdir(examDirectory)).filter((name) => /^p.+\.js$/i.test(name)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  if (!examFiles.length) throw new Error(`No generated reading exam files were found in ${examDirectory}.`)
  const explanationFiles = await exists(explanationDirectory)
    ? new Set((await readdir(explanationDirectory)).filter((name) => /^p.+\.js$/i.test(name)))
    : new Set()
  const setsByCategory = new Map()
  const totals = {
    dedicatedExplanations: 0, fallbackExplanations: 0,
    exactLocations: 0, inferredLocations: 0, fallbackLocations: 0,
    downgradedOptionQuestions: 0,
    questionTypes: {}, warnings: [],
  }
  let sourceQuestions = 0

  for (const file of examFiles) {
    const { data: exam } = await loadRegisteredPayload(join(examDirectory, file), '__READING_EXAM_DATA__')
    sourceQuestions += Object.keys(asObject(exam.answerKey)).length
    let explanations = new Map()
    if (explanationFiles.has(file)) {
      const { data } = await loadRegisteredPayload(join(explanationDirectory, file), '__READING_EXPLANATION_DATA__')
      explanations = buildExplanationIndex(data)
    }
    const converted = convertExam(exam, explanations, file)
    addStats(totals, converted.stats)
    const category = converted.set.sequence.toLowerCase()
    if (!setsByCategory.has(category)) setsByCategory.set(category, [])
    setsByCategory.get(category).push(converted.set)
  }

  const staging = `${output}.tmp-${process.pid}-${Date.now()}`
  await mkdir(staging, { recursive: true })
  const packages = []
  try {
    for (const category of [...setsByCategory.keys()].sort()) {
      const sets = setsByCategory.get(category).sort((left, right) => left.id.localeCompare(right.id, 'en', { numeric: true }))
      for (let index = 0; index < sets.length; index += packageSize) {
        const sequence = String(Math.floor(index / packageSize) + 1).padStart(3, '0')
        const file = `private-atlas-${category}-${sequence}.json`
        const content = buildContentPackage(sets.slice(index, index + packageSize), {
          packageId: `private-atlas-${category}-${sequence}`,
          name: `Private Atlas ${category.toUpperCase()} ${sequence}`,
          category: category.toUpperCase(),
          sourceUrl: SOURCE_URL,
          timestamp,
        })
        const bytes = Buffer.from(`${JSON.stringify(content, null, 2)}\n`, 'utf8')
        await writeFile(join(staging, file), bytes)
        packages.push({
          file,
          category: category.toUpperCase(),
          sets: content.sets.length,
          questions: content.sets.reduce((sum, set) => sum + set.questions.length, 0),
          bytes: bytes.length,
          sha256: sha256(bytes),
        })
      }
    }
    const convertedSets = packages.reduce((sum, item) => sum + item.sets, 0)
    const convertedQuestions = packages.reduce((sum, item) => sum + item.questions, 0)
    const report = {
      schemaVersion: 1,
      generatedAt: timestamp,
      sourceProject: SOURCE_URL,
      sourceSets: examFiles.length,
      sourceQuestions,
      convertedSets,
      convertedQuestions,
      ...totals,
      packages,
      rightsNotice: PERSONAL_USE_NOTE,
    }
    if (convertedSets !== examFiles.length || convertedQuestions !== sourceQuestions) throw new Error('Conversion totals do not match the source registry totals.')
    await writeFile(join(staging, 'conversion-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    await writeFile(join(staging, 'SHA256SUMS.txt'), `${packages.map((item) => `${item.sha256}  ${item.file}`).join('\n')}\n`, 'utf8')
    await replaceGeneratedDirectory(staging, output)
    return report
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const report = await runConversion(options)
  process.stdout.write(`${JSON.stringify({
    output: options.output,
    packages: report.packages.length,
    sets: report.convertedSets,
    questions: report.convertedQuestions,
    warnings: report.warnings.length,
  })}\n`)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
