/**
 * Turn a plain goal into one experiment setup.
 * A portal admin with that portal's own client may ask the designer.
 * With no client, the same goal is matched to a preset by keyword. No model is called.
 */
import type { LlmClient } from './llm'
import { BANDIT_MAX_WEEKS, BANDIT_WARMUP_PER_ARM } from './experiment-bandit'
import { isSafetyMetric, normaliseSafetyMetric, safetyLabel, type SafetyMetricKey } from './experiment-guard'
import { EXPERIMENT_PRESETS, presetOf, type ExperimentPreset } from './experiment-presets'
import { EXPERIMENT_SLOTS, isPrimaryMetric, payloadProblems, slotOf } from './experiment-slots'

export const DESIGNER_SYSTEM_PROMPT = 'You are the HEARTS experiment designer. Using only the portal\'s data and content, propose ONE experiment: 1) the single thing to change (clip length, first talk, reminder time, question wording, etc.) with 2-4 versions; 2) who\'s in it and the minimum sample; 3) one deciding metric plus one safety metric that must not drop (care alerts, drop-offs); 4) method: Thompson-sampling bandit after a 50/50 warm-up of 100 learners per version; 5) stop at a 95% probability of best, or after 4 weeks. Explain it in two plain sentences, then output JSON setup. Never change faith content or the sheikhs\' words, only how and when they\'re served.'

export const DESIGN_DAYS = BANDIT_MAX_WEEKS * 7
export const DESIGN_METHOD = 'Thompson-sampling bandit after a 50/50 warm-up of 100 learners per version'
export const DESIGN_STOP = 'Stop at a 95% probability of best, or after 4 weeks.'

export type DesignVersion = { key: string; label: string; payload: Record<string, unknown> }

export type ExperimentSetup = {
  explanation: string
  name: string
  slot: string
  who: string
  minimumSample: number
  versions: DesignVersion[]
  decidingMetric: string
  safetyMetric: SafetyMetricKey
  method: string
  durationDays: number
  source: 'portal-ai' | 'preset'
  presetKey: string
}

const HINTS: { key: string; phrases: string[] }[] = [
  { key: 'whole-talk', phrases: ['whole talk', 'full talk', 'entire talk', 'first talk', 'start this course', 'invitation into'] },
  { key: 'courses-tab', phrases: ['courses tab', 'course tab', 'lanes', 'explore', 'tab name', 'bottom bar'] },
  { key: 'clip-button', phrases: ['clip', 'short clip', 'button', 'ready for more', 'hear more', 'clip length', 'question', 'reminder', 'wording'] },
]

export function presetFromGoal(goal: string): ExperimentPreset {
  const text = goal.toLowerCase()
  let best: { key: string; score: number } | null = null
  for (const hint of HINTS) {
    for (const phrase of hint.phrases) {
      if (!text.includes(phrase)) continue
      const score = phrase.length
      if (!best || score > best.score) best = { key: hint.key, score }
    }
  }
  return presetOf(best?.key || 'clip-button') || EXPERIMENT_PRESETS[0]
}

function safetyFor(goal: string): SafetyMetricKey {
  return /care|alert|worry|distress|upset|unsafe/i.test(goal) ? 'care_alert' : 'drop_off'
}

function whoLine(portalName?: string | null) {
  const name = String(portalName || '').trim()
  if (!name) return 'Learners in every portal'
  return `Learners in ${name}`
}

function twoSentences(prose: string, fallback: string) {
  const clean = prose.replace(/\s+/g, ' ').trim()
  const parts = clean.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2 && clean.length >= 40) return `${parts[0].replace(/[.!?]*$/, '.')} ${parts[1].replace(/[.!?]*$/, '.')}`
  return fallback
}

function explainPreset(goal: string, preset: ExperimentPreset, safety: SafetyMetricKey) {
  const aim = goal.trim().replace(/[.?!]+$/g, '') || preset.name
  const detail = preset.description.replace(/\.\s+/g, ', ').replace(/\.+$/g, '')
  const first = `You want to solve “${aim}”, so this tries ${preset.name.toLowerCase()}: ${detail}.`
  const second = `People start on an even split until ${BANDIT_WARMUP_PER_ARM} have seen each version, then it leans toward what is working, and it stops when one version is about 95% likely to be best or after 4 weeks, while ${safetyLabel(safety).toLowerCase()} must not rise.`
  return `${first} ${second}`
}

export function setupFromGoal(goal: string, portalName?: string | null): ExperimentSetup {
  const preset = presetFromGoal(goal)
  const safety = safetyFor(goal)
  return {
    explanation: explainPreset(goal, preset, safety),
    name: preset.name,
    slot: preset.slot,
    who: whoLine(portalName),
    minimumSample: BANDIT_WARMUP_PER_ARM,
    versions: preset.variants.map((row) => ({ key: row.key, label: row.label, payload: { ...row.payload } })),
    decidingMetric: preset.primaryMetric,
    safetyMetric: safety,
    method: `${DESIGN_METHOD}. ${DESIGN_STOP}`,
    durationDays: DESIGN_DAYS,
    source: 'preset',
    presetKey: preset.key,
  }
}

function versionKey(label: string, index: number, used: Set<string>) {
  let base = label.toLowerCase().replace(/\{n\}/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
  if (!/^[a-z]/.test(base)) base = `v-${base || 'line'}`
  let key = base || `v${index + 1}`
  let n = 2
  while (used.has(key)) {
    key = `${base}-${n}`.slice(0, 32)
    n += 1
  }
  used.add(key)
  return key
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readVersions(raw: unknown, slot: string): DesignVersion[] | null {
  if (!Array.isArray(raw)) return null
  const used = new Set<string>()
  const versions: DesignVersion[] = []
  for (const item of raw) {
    if (versions.length >= 4) break
    const row = asRecord(item)
    const label = row ? String(row.label || row.text || '').trim() : typeof item === 'string' ? item.trim() : ''
    if (!label) continue
    const slotDef = slotOf(slot)
    const payload = row && asRecord(row.payload) ? { ...asRecord(row.payload) } : {}
    if (slotDef?.fields.some((field) => field.name === 'label') && typeof payload.label !== 'string') payload.label = label
    if (slotDef?.fields.some((field) => field.name === 'framing') && typeof payload.framing !== 'string' && typeof row?.framing === 'string') payload.framing = row.framing
    const keyRaw = row ? String(row.key || '').trim() : ''
    let key = versionKey(label, versions.length, used)
    if (/^[a-z][a-z0-9-]{0,40}$/.test(keyRaw) && !used.has(keyRaw)) {
      used.delete(key)
      used.add(keyRaw)
      key = keyRaw
    }
    if (payloadProblems(slot, payload).length) return null
    versions.push({ key, label: label.slice(0, 80), payload })
  }
  if (versions.length < 2 || versions.length > 4) return null
  return versions
}

export function parseDesignerReply(raw: string, goal: string, portalName?: string | null): ExperimentSetup | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
  const slotText = String(parsed.slot || parsed.change || parsed.thing || '')
  const slot = slotOf(slotText) ? slotText : presetFromGoal(`${slotText} ${goal}`).slot
  if (!slotOf(slot)) return null
  const versions = readVersions(parsed.versions || parsed.variants, slot)
  if (!versions) return null
  const metricRaw = String(parsed.decidingMetric || parsed.primaryMetric || parsed.metric || '')
  const decidingMetric = isPrimaryMetric(metricRaw) ? metricRaw : (EXPERIMENT_PRESETS.find((row) => row.slot === slot)?.primaryMetric || 'clip_cta_tap')
  if (!isPrimaryMetric(decidingMetric) || isSafetyMetric(decidingMetric)) return null
  const safety = normaliseSafetyMetric(String(parsed.safetyMetric || parsed.safety || '')) || safetyFor(goal)
  const preset = EXPERIMENT_PRESETS.find((row) => row.slot === slot) || presetFromGoal(goal)
  const fallback = explainPreset(goal, preset, safety)
  const name = String(parsed.name || preset.name).trim().slice(0, 80) || preset.name
  const who = String(parsed.who || parsed.audience || whoLine(portalName)).trim().slice(0, 160) || whoLine(portalName)
  return {
    explanation: twoSentences(raw.slice(0, start), fallback),
    name,
    slot,
    who,
    minimumSample: BANDIT_WARMUP_PER_ARM,
    versions,
    decidingMetric,
    safetyMetric: safety,
    method: `${DESIGN_METHOD}. ${DESIGN_STOP}`,
    durationDays: DESIGN_DAYS,
    source: 'portal-ai',
    presetKey: preset.key,
  }
}

function designerUser(goal: string, portalName?: string | null) {
  const slots = EXPERIMENT_SLOTS.map((slot) => `${slot.key}: ${slot.description}`).join('\n')
  const metrics = ['clip_cta_tap', 'full_talk_start', 'lanes_tab_tap', 'return_next_day', 'plan_created'].join(', ')
  return [
    `Goal: ${goal.trim()}`,
    `Portal: ${portalName || 'this portal'}`,
    'Use only that portal’s content. Change how or when something is served, never the words of a talk.',
    'Allowed slots:',
    slots,
    `Deciding metric must be one of: ${metrics}`,
    'Safety metric must be care_alert or drop_off.',
    'JSON setup shape: {"slot":"...","name":"...","who":"...","minimumSample":100,"decidingMetric":"...","safetyMetric":"care_alert","versions":[{"key":"...","label":"..."}]}',
  ].join('\n')
}

export async function designExperiment(goal: string, options: { client?: LlmClient | null; portalName?: string | null } = {}): Promise<ExperimentSetup> {
  const keyword = setupFromGoal(goal, options.portalName)
  const client = options.client || null
  if (!client) return keyword
  try {
    const reply = await client.complete({ system: DESIGNER_SYSTEM_PROMPT, user: designerUser(goal, options.portalName) })
    return parseDesignerReply(reply, goal, options.portalName) || keyword
  } catch {
    return keyword
  }
}
