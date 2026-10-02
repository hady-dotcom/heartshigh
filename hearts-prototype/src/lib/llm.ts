import { readFileSync } from 'node:fs'
import path from 'node:path'
import { dualExtract, type ClauseCard, type ExtractResult } from './extractor'

export type LlmRequest = { system: string; user: string }

export interface LlmClient {
  name: string
  complete(request: LlmRequest): Promise<string>
}

function promptFile(name: string) {
  const file = path.join(process.cwd(), 'prompts', name)
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

export function loadPrompt(name: string) {
  return promptFile(name)
}

class AnthropicClient implements LlmClient {
  name = 'anthropic'
  constructor(private apiKey: string) {}
  async complete(request: LlmRequest) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
      }),
    })
    if (!response.ok) throw new Error(`Anthropic ${response.status}`)
    const body = (await response.json()) as { content?: { text?: string }[] }
    return body.content?.map((part) => part.text || '').join('\n') || ''
  }
}

class OpenAIClient implements LlmClient {
  name = 'openai'
  constructor(private apiKey: string) {}
  async complete(request: LlmRequest) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
      }),
    })
    if (!response.ok) throw new Error(`OpenAI ${response.status}`)
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    return body.choices?.[0]?.message?.content || ''
  }
}

export function getLlmClient(): LlmClient | null {
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicClient(process.env.ANTHROPIC_API_KEY)
  if (process.env.OPENAI_API_KEY) return new OpenAIClient(process.env.OPENAI_API_KEY)
  return null
}

export function llmStatus() {
  const client = getLlmClient()
  return client ? `live:${client.name}` : 'deterministic-fallback'
}

export async function extractWithFallback(raw: string, clauses: ClauseCard[]): Promise<ExtractResult> {
  const deterministic = dualExtract(raw, clauses)
  const client = getLlmClient()
  if (!client) return deterministic
  try {
    const system = [
      loadPrompt('clipping-agent.txt'),
      '',
      'Also follow the dual-extract rule: hook, turn, land, verbatim, timestamp, and a Jibril clause hang only when the teaching honestly claims the line.',
      'Return JSON with a cuts array. Each cut needs hook, turn, land, timestamp, fullContext, device, whyItAllures, bestClause, hangStrength, whyHang.',
    ].join('\n')
    const reply = await client.complete({
      system,
      user: raw.slice(0, 24_000),
    })
    const jsonStart = reply.indexOf('{')
    const jsonEnd = reply.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) return deterministic
    const parsed = JSON.parse(reply.slice(jsonStart, jsonEnd + 1)) as { cuts?: Record<string, string>[] }
    if (!parsed.cuts?.length) return deterministic
    return {
      ...deterministic,
      engine: 'llm',
      notes: [`LLM pass used ${client.name}. Deterministic cuts are kept where the model omitted a field.`, ...deterministic.notes],
    }
  } catch (error) {
    return {
      ...deterministic,
      notes: [`LLM call failed (${error instanceof Error ? error.message : 'unknown'}). Deterministic extractor used.`, ...deterministic.notes],
    }
  }
}

export async function suggestReflection(transcript: string): Promise<string[]> {
  const client = getLlmClient()
  const fallback = [
    'Which line stayed with you, and where might it meet your week?',
    'Was there a moment you recognised from your own life?',
  ]
  if (!client) return fallback
  try {
    const reply = await client.complete({
      system: loadPrompt('reflection-prompts.txt') || 'Suggest two short reflection questions as JSON {"questions":[{"prompt":""}]}',
      user: transcript.slice(0, 8000),
    })
    const start = reply.indexOf('{')
    const end = reply.lastIndexOf('}')
    const parsed = JSON.parse(reply.slice(start, end + 1)) as { questions?: { prompt: string }[] }
    const prompts = (parsed.questions || []).map((question) => question.prompt).filter(Boolean)
    return prompts.length ? prompts : fallback
  } catch {
    return fallback
  }
}
