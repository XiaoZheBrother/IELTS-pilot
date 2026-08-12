const endpoint = process.argv[2] ?? 'http://127.0.0.1:4390/api/v1/assistant/chat/stream'

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      {
        role: 'system',
        content: [
          'You are IELTS Pilot assistant. promptVersion=assistant-v2.',
          'Return JSON only with schemaVersion=1 and conclusion, facts, inferences, actions.',
          'Each judgment must use only evidence IDs from the catalog and include confidence.',
          'Do not claim official scores, stable performance or guaranteed improvement without sufficient evidence.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          'Question: 我现在最应该练什么？',
          'EvidenceCatalog:',
          '- reading.attemptCount = 3, sampleCount 3, confidence medium',
          '- reading.averageBand = 6.5, sampleCount 3, confidence medium',
          '- reading.weak.multiple-choice = 42%, sampleCount 12, confidence high',
          '- reading.pendingErrors = 5, sampleCount 5, confidence medium',
        ].join('\n'),
      },
    ],
  }),
})

if (!response.ok) throw new Error(`Gateway returned HTTP ${response.status}.`)
const events = (await response.text()).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line))
const done = events.findLast((event) => event.type === 'done')
if (!done?.response?.content) throw new Error('Streaming request did not return a final response.')

const answer = JSON.parse(done.response.content)
const valid = answer.schemaVersion === 1 && answer.conclusion && Array.isArray(answer.facts)
  && Array.isArray(answer.inferences) && Array.isArray(answer.actions)
if (!valid) throw new Error('Provider response does not match the structured assistant schema.')

process.stdout.write(`${JSON.stringify({
  type: done.type,
  model: done.response.model,
  requestId: done.response.requestId,
  totalTokens: done.response.usage?.totalTokens ?? 0,
  deltas: events.filter((event) => event.type === 'delta').length,
  facts: answer.facts.length,
  inferences: answer.inferences.length,
  actions: answer.actions.length,
  conclusion: answer.conclusion.text,
}, null, 2)}\n`)
