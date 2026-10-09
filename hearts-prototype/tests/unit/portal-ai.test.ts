import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { draftCircle } from '../../src/server/circle'
import { tafsirSummary } from '../../src/server/scripture'
import { suggestWording } from '../../src/lib/experiment-copy'
import { extractWithFallback, suggestReflection } from '../../src/lib/llm'
import {
  assembleConnection,
  canSpendPortalAi,
  clientFromConnection,
  completeOpenAiCompatible,
  estimatePortalCalls,
  mcpConnectorStatus,
  openPortalKey,
  portalAiGate,
  publicAi,
} from '../../src/lib/portal-ai'
import { questionCheckCallCount } from '../../src/server/feedback'

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '../..')
const secret = 'portal-ai-test-secret-32-characters'

function filesUnder(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'migrations' || name === 'node_modules') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) filesUnder(full, out)
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !name.includes('.test.')) out.push(full)
  }
  return out
}

test('no running module imports an LLM SDK or names a platform key or endpoint', () => {
  const banned = [/api\.openai\.com/, /api\.anthropic\.com/, /@anthropic-ai\/sdk/, /from ['"]openai['"]/, /OPENAI_API_KEY/, /ANTHROPIC_API_KEY/]
  const hits: string[] = []
  for (const file of [...filesUnder(path.join(root, 'src')), ...filesUnder(path.join(root, 'scripts'))]) {
    const text = readFileSync(file, 'utf8')
    for (const pattern of banned) {
      if (pattern.test(text)) hits.push(`${path.relative(root, file)} matches ${pattern}`)
    }
  }
  assert.deepEqual(hits, [])
})

test('a server environment key and no portal connection makes zero AI calls', async () => {
  const previousOpen = process.env.OPENAI_API_KEY
  const previousAnthropic = process.env.ANTHROPIC_API_KEY
  process.env.OPENAI_API_KEY = 'platform-openai-key'
  process.env.ANTHROPIC_API_KEY = 'platform-anthropic-key'
  const hits: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    hits.push(String(input))
    return new Response('{}', { status: 500 })
  }) as typeof fetch
  try {
    const extracted = await extractWithFallback('A short line with a full stop. Another line follows it here today.', [])
    assert.equal(extracted.engine, 'deterministic')
    const wording = await suggestWording('lanes-tab-label', 'Lanes', 3)
    assert.match(wording.engine, /built-in/)
    const circle = await draftCircle({ prompt: 'What stayed with you?', kind: 'reflection' }, 1, ['warm'], ['short'], 1)
    assert.match(circle.engine, /built-in/)
    process.env.HEARTS_SCRIPTURE_OFFLINE = '1'
    const summary = await tafsirSummary({ find: async () => ({ docs: [] }), create: async () => ({}), update: async () => ({}) } as never, 25, 63)
    assert.equal(summary?.ai, false)
    const questions = await suggestReflection('A talk about patience and a hard week.')
    assert.equal(questions.length, 2)
    assert.deepEqual(hits, [])
  } finally {
    globalThis.fetch = original
    if (previousOpen === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousOpen
    if (previousAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = previousAnthropic
  }
})

test('each portal calls only its own endpoint with its own key', async () => {
  process.env.OPENAI_API_KEY = 'platform-openai-key'
  process.env.ANTHROPIC_API_KEY = 'platform-anthropic-key'
  const a = assembleConnection({ baseUrl: 'https://portal-a.test/v1', model: 'model-a', apiKey: 'portal-a-key-value' }, secret)
  const b = assembleConnection({ baseUrl: 'https://portal-b.test/v1', model: 'model-b', apiKey: 'portal-b-key-value' }, secret)
  assert.equal(a.ok && b.ok, true)
  if (!a.ok || !b.ok) return
  assert.equal(publicAi(a.stored).keyHint, 'alue')
  assert.equal(JSON.stringify(publicAi(a.stored)).includes('portal-a-key'), false)
  assert.equal(openPortalKey(a.stored.keyCipher, secret), 'portal-a-key-value')
  const calls: { url: string; auth: string; model: string }[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const body = JSON.parse(String(init?.body || '{}')) as { model?: string }
    calls.push({ url: String(input), auth: headers.get('authorization') || '', model: body.model || '' })
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })
  }) as typeof fetch
  await completeOpenAiCompatible(a.stored, { system: 's', user: 'u' }, { secret, fetchImpl })
  await clientFromConnection(b.stored, { secret, fetchImpl })!.complete({ system: 's', user: 'other' })
  assert.deepEqual(calls, [
    { url: 'https://portal-a.test/v1/chat/completions', auth: 'Bearer portal-a-key-value', model: 'model-a' },
    { url: 'https://portal-b.test/v1/chat/completions', auth: 'Bearer portal-b-key-value', model: 'model-b' },
  ])
  assert.equal(calls.some((call) => call.auth.includes('platform-')), false)
  assert.equal(calls.some((call) => call.url.includes('api.openai.com') || call.url.includes('api.anthropic.com')), false)
  delete process.env.OPENAI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
})

test('learners and the master desk cannot spend, and MCP is only a seam', () => {
  assert.equal(canSpendPortalAi('portal-admin'), true)
  assert.equal(canSpendPortalAi('teacher'), false)
  assert.equal(canSpendPortalAi('master'), false)
  assert.equal(canSpendPortalAi('learner'), false)
  assert.equal(mcpConnectorStatus().ready, false)
  assert.equal(clientFromConnection(null), null)
  const refused = assembleConnection({ baseUrl: 'http://portal-a.test/v1', model: 'model-a', apiKey: 'portal-a-key-value' }, secret)
  assert.equal(refused.ok, false)
})

test('a portal AI run shows the call count and spends only after a portal admin confirms', () => {
  const estimate = estimatePortalCalls(91)
  assert.equal(estimate.calls, 91)
  assert.match(estimate.label, /91 calls/)
  assert.match(estimate.label, /rough estimate/)
  assert.match(estimate.label, /\$/)
  assert.equal(portalAiGate({ role: 'portal-admin', usePortalAi: true, confirmed: false }).error, 'Confirm the call count before this run on your portal’s AI account. Nothing was sent.')
  assert.equal(portalAiGate({ role: 'portal-admin', usePortalAi: true, confirmed: true }).spend, true)
  assert.equal(portalAiGate({ role: 'teacher', usePortalAi: true, confirmed: true }).error, 'AI runs are for the portal admin.')
  assert.equal(portalAiGate({ role: 'teacher', usePortalAi: false, confirmed: false }).spend, false)
  assert.equal(portalAiGate({ role: 'portal-admin', realRole: 'master', usePortalAi: true, confirmed: true }).spend, false)
  assert.equal(portalAiGate({ role: 'learner', usePortalAi: true, confirmed: true }).spend, false)
  assert.equal(questionCheckCallCount(
    [{ id: 1, prompt: 'One' }, { id: 2, prompt: 'Two' }, { id: 3, prompt: '' }],
    [{ point: 1, prompt: 'One' }],
  ), 1)
})
