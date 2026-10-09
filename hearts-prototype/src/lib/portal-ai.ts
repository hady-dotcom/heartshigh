import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { payloadSecret } from './env'

export type LlmRequest = { system: string; user: string }

export interface LlmClient {
  name: string
  complete(request: LlmRequest): Promise<string>
}

/**
 * Seam for a later MCP-style connector. Nothing in the app speaks MCP yet.
 * A saved connection is always OpenAI-compatible (any gateway that accepts
 * POST {baseUrl}/chat/completions with a Bearer key).
 */
export const MCP_CONNECTOR = 'mcp' as const
export const OPENAI_COMPATIBLE = 'openai-compatible' as const

export type StoredAiConnection = {
  kind: typeof OPENAI_COMPATIBLE
  baseUrl: string
  model: string
  keyCipher: string
  keyHint: string
}

export type PublicAiConnection = {
  connected: boolean
  kind: typeof OPENAI_COMPATIBLE | null
  baseUrl: string
  model: string
  keyHint: string
  /** Always false until an MCP connector is built. */
  mcpReady: false
}

const MODEL = /^[A-Za-z0-9._:/@-]{1,80}$/

export function mcpConnectorStatus() {
  return {
    ready: false as const,
    kind: MCP_CONNECTOR,
    note: 'An MCP connector is not built yet. Connect an OpenAI-compatible address and your own key.',
  }
}

function keyMaterial(secret: string) {
  return createHash('sha256').update(`hearts-portal-ai:${secret}`).digest()
}

export function sealPortalKey(plain: string, secret = payloadSecret()) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyMaterial(secret), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${data.toString('base64url')}`
}

export function openPortalKey(packed: string, secret = payloadSecret()) {
  const [iv, tag, data] = String(packed || '').split('.')
  if (!iv || !tag || !data) throw new Error('The saved AI key could not be read.')
  const decipher = createDecipheriv('aes-256-gcm', keyMaterial(secret), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}

/** https origin plus an optional path, with no query, hash, or embedded password. */
export function normaliseBaseUrl(raw: string) {
  let url: URL
  try {
    url = new URL(String(raw || '').trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (url.search || url.hash) return null
  const path = url.pathname.replace(/\/+$/, '')
  return `${url.origin}${path && path !== '/' ? path : ''}`
}

export function assembleConnection(input: { baseUrl: string; model: string; apiKey: string }, secret = payloadSecret()): { ok: true; stored: StoredAiConnection } | { ok: false; error: string } {
  const baseUrl = normaliseBaseUrl(input.baseUrl)
  if (!baseUrl) return { ok: false, error: 'The address needs to start with https:// and have no password in it.' }
  const model = String(input.model || '').trim()
  if (!MODEL.test(model)) return { ok: false, error: 'The model name looks wrong. Use the name your provider gave you, such as gpt-4o-mini.' }
  const apiKey = String(input.apiKey || '').trim()
  if (apiKey.length < 8 || apiKey.length > 400 || /[\r\n]/.test(apiKey)) return { ok: false, error: 'Paste the API key from your own account. It is stored encrypted and is not shown again.' }
  return {
    ok: true,
    stored: {
      kind: OPENAI_COMPATIBLE,
      baseUrl,
      model,
      keyCipher: sealPortalKey(apiKey, secret),
      keyHint: apiKey.slice(-4),
    },
  }
}

export function parseStored(raw: unknown): StoredAiConnection | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<StoredAiConnection>
  if (row.kind !== OPENAI_COMPATIBLE) return null
  const baseUrl = normaliseBaseUrl(String(row.baseUrl || ''))
  const model = String(row.model || '').trim()
  const keyCipher = String(row.keyCipher || '')
  const keyHint = String(row.keyHint || '').slice(0, 8)
  if (!baseUrl || !MODEL.test(model) || !keyCipher.includes('.')) return null
  return { kind: OPENAI_COMPATIBLE, baseUrl, model, keyCipher, keyHint }
}

export function publicAi(raw: unknown): PublicAiConnection {
  const stored = parseStored(raw)
  if (!stored) return { connected: false, kind: null, baseUrl: '', model: '', keyHint: '', mcpReady: false }
  return { connected: true, kind: stored.kind, baseUrl: stored.baseUrl, model: stored.model, keyHint: stored.keyHint, mcpReady: false }
}

/** Learners and the master desk never spend. Portal staff may, on their own connection. */
export function canSpendPortalAi(role: string | null | undefined) {
  return role === 'portal-admin' || role === 'teacher'
}

export async function completeOpenAiCompatible(
  connection: StoredAiConnection,
  request: LlmRequest,
  options: { secret?: string; fetchImpl?: typeof fetch } = {},
) {
  const key = openPortalKey(connection.keyCipher, options.secret)
  const url = `${connection.baseUrl}/chat/completions`
  const fetchImpl = options.fetchImpl || fetch
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: connection.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!response.ok) throw new Error(`The portal AI account returned ${response.status}.`)
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  return body.choices?.[0]?.message?.content || ''
}

export function clientFromConnection(connection: StoredAiConnection | null, options: { secret?: string; fetchImpl?: typeof fetch } = {}): LlmClient | null {
  if (!connection) return null
  return {
    name: 'portal',
    complete(request) {
      return completeOpenAiCompatible(connection, request, options)
    },
  }
}
