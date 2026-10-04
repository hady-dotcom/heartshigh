/**
 * Draft wording variants for a copy slot. Uses the same LLM helper as the rest of
 * the desk; without a key it returns deterministic mock lines.
 */
import { getLlmClient } from './llm'
import { formatSlotLabel, payloadProblems, slotOf, type ExperimentSlot } from './experiment-slots'

export type DraftVariant = { key: string; label: string; payload: Record<string, unknown>; source: 'ai' | 'mock' }

const MOCK: Record<string, string[]> = {
  'feed-cta-label': [
    'Stay with this a little longer',
    'Hear the next few minutes',
    'Keep going with this talk',
    'There is a little more here',
    'Open the longer cut',
  ],
  'full-talk-cta-label': [
    'Sit with the whole talk ({n} min)',
    'Open the full sitting',
    'Watch from the start ({n} min)',
    'Go to the whole lesson',
    'Begin the full talk',
  ],
  'lanes-tab-label': [
    'Explore',
    'Paths',
    'Courses',
    'Browse',
    'Find a talk',
  ],
}

function slugify(value: string, index: number) {
  const base = value
    .toLowerCase()
    .replace(/\{n\}/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28)
  return `${base || 'line'}-${index + 1}`
}

function linesFor(slot: ExperimentSlot): string[] {
  if (slot.kind !== 'copy') return []
  return MOCK[slot.key] || ['A shorter line', 'A warmer line', 'A clearer line', 'A quieter line']
}

export function mockWording(slotKey: string, count = 4): DraftVariant[] {
  const slot = slotOf(slotKey)
  if (!slot || slot.kind !== 'copy') return []
  const want = Math.min(5, Math.max(3, count))
  return linesFor(slot)
    .slice(0, want)
    .map((label, index) => ({
      key: slugify(label, index),
      label,
      payload: { label },
      source: 'mock' as const,
    }))
}

function parseReply(raw: string, slot: ExperimentSlot): DraftVariant[] {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return []
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { variants?: { label?: string; text?: string }[] }
    const labels = (parsed.variants || []).map((row) => String(row.label || row.text || '').trim()).filter(Boolean)
    return labels.map((label, index) => ({
      key: slugify(label, index),
      label,
      payload: { label },
      source: 'ai' as const,
    })).filter((row) => !payloadProblems(slot.key, row.payload).length)
  } catch {
    return []
  }
}

export async function suggestWording(slotKey: string, current: string, count = 4): Promise<{ drafts: DraftVariant[]; engine: string }> {
  const slot = slotOf(slotKey)
  const fallback = mockWording(slotKey, count)
  if (!slot || slot.kind !== 'copy') return { drafts: [], engine: 'that slot is not wording' }
  const client = getLlmClient()
  if (!client) return { drafts: fallback, engine: 'mock' }
  try {
    const reply = await client.complete({
      system: [
        'You write short button labels for HEARTS, a gentle Islamic learning app.',
        'Return JSON only: {"variants":[{"label":"..."}]}',
        slot.key === 'lanes-tab-label'
          ? 'Each label is one or two short words, like a bottom-bar tab name. Plain text, no emoji, no HTML.'
          : 'Each label is 2 to 8 words, plain text, no emoji, no HTML, no scripture, no quiz language.',
        'Do not quote a sheikh. Do not mention a test or experiment.',
        `Write ${Math.min(5, Math.max(3, count))} alternatives for this ${slot.key === 'lanes-tab-label' ? 'tab' : 'button'}.`,
        slot.key === 'full-talk-cta-label' ? 'You may use {n} where the talk length in minutes will be filled in.' : '',
      ].filter(Boolean).join('\n'),
      user: `Slot: ${slot.name}\nWhat it does: ${slot.description}\nCurrent line: ${current || formatSlotLabel(String(slot.fallback.label || ''))}`,
    })
    const drafts = parseReply(reply, slot)
    if (drafts.length >= 3) return { drafts: drafts.slice(0, 5), engine: client.name }
    return { drafts: fallback, engine: `mock (${client.name} reply did not pass the checks)` }
  } catch {
    return { drafts: fallback, engine: 'mock (the AI call failed)' }
  }
}
