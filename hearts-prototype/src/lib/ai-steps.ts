/**
 * AI steps: the registry contract, prompt versions, the mock provider, and the rules for
 * what a re-run is allowed to touch. Nothing here talks to the database or the network.
 *
 * A platform key is never read. A live run uses only the client the caller passes in,
 * which is this portal's own account.
 */
import { draftPopupPrompt } from './draft-prompt'
import { dualExtract } from './extractor'
import { assessQuestion, themesFromAnswers } from './feedback'
import { ANSWER_VOICE, REWRITE_VOICE, TEACHER_REPLY_VOICE } from './human-voice'
import { harvestTranscript } from './harvest'
import { buildLineTidy, type TidyLine } from './tidy-caption'
import { draftTiers, sentencesOf, type TierDraft } from './tiers'

export type ProviderName = 'anthropic' | 'openai'

export type Placeholder = { token: string; meaning: string; required: boolean }

export type StepSpec = {
  slug: string
  name: string
  description: string
  placeholders: Placeholder[]
  prompt: string
  provider: ProviderName
  model: string
  temperature: number
  maxTokens: number
  outputSchema: Record<string, unknown>
  /** Plain English: where the result is kept. */
  fills: string
  pipelineOrder: number
  /** Rubric is shared text the critic reads. It is not run once per talk. */
  inPipeline: boolean
  fillsTier: 'hors' | 'appetiser' | null
  fillsPoints: 'popup' | 'reflection' | null
}

export type VersionState = {
  number: number
  prompt: string
  provider: ProviderName
  model: string
  temperature: number
  maxTokens: number
  note: string
  authorName: string
  live: boolean
}

export type ProtectReason = 'approved' | 'rejected' | 'human-edited' | null

const TOKEN = /\{\{([A-Za-z0-9_]+)\}\}/g

export function placeholderProblems(prompt: string, declared: Placeholder[]) {
  const problems: string[] = []
  const found = [...prompt.matchAll(TOKEN)].map((match) => match[1])
  if (/\{\{/.test(prompt) && found.length !== (prompt.match(/\{\{/g) || []).length) {
    problems.push('A placeholder is incomplete. Write each one as {{LIKE_THIS}}.')
  }
  const allowed = new Set(declared.map((item) => item.token))
  for (const token of new Set(found)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(token)) problems.push(`{{${token}}} should be uppercase, like {{TRANSCRIPT}}.`)
    else if (!allowed.has(token)) problems.push(`{{${token}}} is not a placeholder this step uses.`)
  }
  for (const item of declared) {
    if (item.required && !found.includes(item.token)) problems.push(`The prompt has to include {{${item.token}}}. ${item.meaning}`)
  }
  return problems
}

export function fillPrompt(prompt: string, vars: Record<string, string>) {
  return prompt.replace(TOKEN, (whole, token: string) => (Object.prototype.hasOwnProperty.call(vars, token) ? vars[token] : whole))
}

export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string }

/** A line diff of two prompt versions. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n/g, '\n').split('\n')
  const b = after.replace(/\r\n/g, '\n').split('\n')
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'del', text: a[i] })
      i += 1
    } else {
      out.push({ kind: 'add', text: b[j] })
      j += 1
    }
  }
  while (i < a.length) out.push({ kind: 'del', text: a[i++] })
  while (j < b.length) out.push({ kind: 'add', text: b[j++] })
  return out
}

export function nextVersion(versions: VersionState[], draft: Omit<VersionState, 'number' | 'live'>): VersionState[] {
  const number = versions.reduce((max, version) => Math.max(max, version.number), 0) + 1
  return [...versions, { ...draft, number, live: false }]
}

export function markLive(versions: VersionState[], number: number): VersionState[] {
  if (!versions.some((version) => version.number === number)) throw new Error('That version is not in the history.')
  return versions.map((version) => ({ ...version, live: version.number === number }))
}

export function liveVersion(versions: VersionState[]) {
  return versions.find((version) => version.live) || null
}

export type Actor = { role?: string | null }

/** Portal admins can read. They can change a step only after the master grants it. */
export function canViewSteps(actor: Actor | null | undefined) {
  return actor?.role === 'master' || actor?.role === 'portal-admin'
}

export function canEditSteps(actor: Actor | null | undefined, portalMayEdit: boolean) {
  if (actor?.role === 'master') return true
  return actor?.role === 'portal-admin' && portalMayEdit
}

/** Live only when this portal's own connection is in use. A server environment key never counts. */
export function portalRun(connected: boolean): 'live' | 'mock' {
  return connected ? 'live' : 'mock'
}

export function pipelineStepCount() {
  return STEP_SPECS.filter((step) => step.inPipeline).length
}

export function jobNote(label: string, portalId: number | null) {
  return portalId ? `portal-ai:${portalId} ${label}` : label
}

export function portalFromNote(note: string | null | undefined) {
  const match = /^portal-ai:(\d+) /.exec(String(note || ''))
  return match ? Number(match[1]) : null
}

/** Approved clips already on the talk: do not write a tier that would hide them. */
export function tierWriteBlocked(approvedCuts: number) {
  return approvedCuts > 0 ? ('approved' as const) : null
}

export function mockBanner(input: { connected: boolean; master: boolean }) {
  if (input.master) return 'The master desk does not call a model. These steps use the built-in drafts. A portal admin connects their own AI account in that portal’s Settings, and that account is billed, not HEARTS.'
  if (input.connected) return 'This portal’s own AI account is connected. A run on this desk is billed to that account. Learners see nothing until a person approves a draft.'
  return 'AI is off. A portal admin connects this portal’s own account in Settings. Until then every step uses the built-in drafts, and nothing is sent out.'
}

/** One plain sentence for the steps list. */
const STEP_LINES: Record<string, string> = {
  'language-inference': 'Works out which language the speaker is teaching in.',
  'hors-doeuvre': 'Picks a short clip you can hear with no setup.',
  'appetiser-cut': 'Cuts a first sitting into a hook, a turn and a land.',
  'popup-drafter': 'Writes the questions that pause the full talk.',
  'tidy-caption-line': 'Adds capitals and stops so captions are easy to read.',
  'jibril-seat': 'Says which Hadith Jibril teaching this talk is about.',
  'quran-harvest': 'Finds every Qur’an quote and keeps the exact words.',
  'hadith-extraction': 'Finds the hadith the speaker quotes, in their words.',
  'reflection-prompts': 'Writes open questions with no right answer.',
  'clip-critic': 'Marks the short clips so you can see if they hold.',
  rubric: 'Holds the checklist the clip marker reads.',
  'feedback-summary': 'Jots the themes in answers people chose to share.',
  'question-value': 'Spots a question whose answers would not help a teacher.',
}

/** Three or four plain bullets for the step page. Say what it does, and why you would care. */
const STEP_DOES: Record<string, string[]> = {
  'language-inference': [
    'Listens to the words the speaker uses to explain.',
    'Ignores a verse in Arabic when the talk itself is in English.',
    'Writes the language down so later jobs can skip a muddled talk.',
    'Learners never see this.',
  ],
  'hors-doeuvre': [
    'Picks one clip of 15 to 30 seconds.',
    'It has to make sense if you hear it with no setup.',
    'It sits inside the longer first cut.',
    'A person checks it before anyone else sees it.',
  ],
  'appetiser-cut': [
    'Cuts a first sitting of about three minutes.',
    'Picks a hook, a turn and a landing line the speaker actually said.',
    'Writes down the minute each line is said.',
    'A person can approve it, change it, or throw it out.',
  ],
  'popup-drafter': [
    'Writes the questions and small tasks that pause the full talk.',
    'Each one waits until the line it is about has been said.',
    'They sit as drafts until a person says yes.',
    'A question someone already approved is left alone.',
  ],
  'tidy-caption-line': [
    'Takes captions that arrive in lowercase, with no full stops.',
    'Keeps the speaker’s words and adds capitals and punctuation.',
    'Uses British spelling, and capitalises Allah, the Prophet and the Qur’an.',
    'With no AI account, the same tidy-up runs here and nothing is sent out.',
  ],
  'jibril-seat': [
    'Says which of the 41 Hadith Jibril teachings this talk is about.',
    'Matches the teaching, not a word that happens to show up.',
    'Adds a Ghunya seat only when that teaching already prints one.',
    'It does not change what learners play on its own.',
  ],
  'quran-harvest': [
    'Finds every Qur’an quote in a talk and copies the exact words.',
    'Notes the minute.',
    'Adds the surah only if the sheikh says it.',
    'Waits as a draft for a person to check.',
  ],
  'hadith-extraction': [
    'Finds hadith the speaker quotes and copies their words.',
    'Notes the minute.',
    'Adds a book name only if the speaker says it.',
    'Waits as a draft, and does not invent a page or a chain of narrators.',
  ],
  'reflection-prompts': [
    'Writes two or three open questions.',
    'Each one hangs on a different line, and shows up after that line.',
    'There is no right answer, and it is not a quiz.',
    'They wait as drafts until a person checks them.',
  ],
  'clip-critic': [
    'Marks the short clip and the first sitting.',
    'It listens to the clip itself, not the title we stuck on it.',
    'An ordinary clip gets a 3.',
    'It does not rewrite the cut. The marks wait for a person.',
  ],
  rubric: [
    'This is the checklist the clip marker uses.',
    'It does not run on a talk by itself.',
    'When you make a new version live, the next marks use it.',
    'Older marks keep the checklist that made them.',
  ],
  'feedback-summary': [
    'Reads answers people chose to share on one question.',
    'Jots the main themes and copies a few of their words.',
    'It does not name anyone.',
    'It stays off the download until a person includes it.',
  ],
  'question-value': [
    'Spots a question that would only get yes or no.',
    'Suggests a rewrite that asks about the person’s own week.',
    'The rewrite is a draft.',
    'The question learners see stays as it is.',
  ],
}

/** Labels on the step page. Everyday words, including the collapsed technical card. */
export const STEP_PAGE_COPY = {
  doesTitle: 'What this does',
  lands: 'Where it lands',
  techies: 'For techies',
  instructions: 'Instructions',
  who: 'Who answers',
  helper: 'Which helper',
  stick: 'How closely it sticks to one answer',
  stickHint: '0 means the same answer every time. 1 lets it vary more.',
  length: 'How long the answer can be',
  blanks: 'Blanks the talk fills in',
  noBlanks: 'This step has no blanks.',
  shape: 'What the answer has to look like',
  order: 'When this job runs',
  orderNote: 'Smaller numbers go first.',
  runHint: 'A real run uses the helper saved with this portal’s own AI account. The boxes above are labels on this card. The master desk does not send the talk out.',
}

export function stepPlainLine(slug: string) {
  return STEP_LINES[slug] || ''
}

export function stepDoes(slug: string) {
  return STEP_DOES[slug] || []
}

/**
 * List badge for a step.
 * Ready when this desk can run it: the master desk’s built-in drafts, or a portal admin whose own AI account is connected.
 * A portal with no key of its own is not on. AI is admin-only and never uses a platform key.
 */
export function stepListBadge(input: { inPipeline: boolean; connected: boolean; master: boolean }) {
  if (!input.inPipeline) return 'Shared text'
  if (input.master || input.connected) return 'Ready'
  return 'Switch on by connecting your AI account'
}

export function tierProtect(
  tier: ({ status?: string | null; source?: string | null; checkedBy?: unknown } & Record<string, unknown>) | null,
  snapshot: Record<string, unknown> | null,
  fields: string[],
): ProtectReason {
  if (!tier) return null
  if (tier.status === 'checked') return 'approved'
  if (tier.status === 'rejected') return 'rejected'
  if (tier.checkedBy) return 'human-edited'
  if (tier.source === 'human') return 'human-edited'
  if (snapshot) {
    for (const field of fields) {
      if (!sameValue(tier[field], snapshot[field])) return 'human-edited'
    }
  }
  return null
}

export function pointProtect(point: { status?: string | null; author?: unknown; reviewedBy?: unknown; draftNote?: string | null } | null): ProtectReason {
  if (!point) return null
  if (point.status === 'published') return 'approved'
  if (point.status === 'rejected') return 'rejected'
  if (point.author || point.reviewedBy) return 'human-edited'
  const note = point.draftNote || ''
  if (note && !note.startsWith('AI draft from ')) return 'human-edited'
  return null
}

function sameValue(left: unknown, right: unknown) {
  if (typeof left === 'number' || typeof right === 'number') return Number(left) === Number(right)
  return String(left ?? '') === String(right ?? '')
}

export type JobItemResult = { id: number; ok: boolean; error?: string; detail?: unknown }

export type JobProgress = { total: number; finished: number; failed: number; results: JobItemResult[] }

/** Runs items one at a time and reports progress after each, including failures. */
export async function runQueue<T extends { id: number }>(
  items: T[],
  worker: (item: T) => Promise<{ ok: boolean; error?: string; detail?: unknown }>,
  onProgress: (progress: JobProgress) => Promise<void> | void,
) {
  const results: JobItemResult[] = []
  for (const item of items) {
    try {
      const result = await worker(item)
      results.push({ id: item.id, ok: result.ok, error: result.error, detail: result.detail })
    } catch (error) {
      results.push({ id: item.id, ok: false, error: error instanceof Error ? error.message : 'The step failed.' })
    }
    const failed = results.filter((result) => !result.ok).length
    await onProgress({ total: items.length, finished: results.length, failed, results: [...results] })
  }
  return { total: items.length, finished: results.length, failed: results.filter((result) => !result.ok).length, results }
}

type JsonSchema = {
  type?: string | string[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  enum?: unknown[]
}

export function schemaProblems(schema: JsonSchema, value: unknown, path = 'output'): string[] {
  const problems: string[] = []
  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : []
  if (types.length && !types.some((type) => typeOk(type, value))) {
    problems.push(`${path} should be ${types.join(' or ')}.`)
    return problems
  }
  if (schema.enum && !schema.enum.some((item) => item === value)) problems.push(`${path} is not one of the allowed values.`)
  if (value && typeof value === 'object' && !Array.isArray(value) && schema.properties) {
    const row = value as Record<string, unknown>
    for (const key of schema.required || []) {
      if (row[key] === undefined) problems.push(`${path}.${key} is missing.`)
    }
    for (const [key, child] of Object.entries(schema.properties)) {
      if (row[key] !== undefined) problems.push(...schemaProblems(child, row[key], `${path}.${key}`))
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => problems.push(...schemaProblems(schema.items as JsonSchema, item, `${path}[${index}]`)))
  }
  return problems
}

function typeOk(type: string, value: unknown) {
  if (type === 'null') return value === null
  if (type === 'array') return Array.isArray(value)
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (type === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  return typeof value === type
}

export function extractJson(reply: string): unknown {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('The model did not return a JSON object.')
  return JSON.parse(reply.slice(start, end + 1))
}

function salt(text: string, size: number) {
  if (!size) return 0
  let hash = 2166136261
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  return (hash >>> 0) % size
}

const HORSE_FIELDS = ['horsStart', 'horsEnd', 'horsQuote'] as const
const APPETISER_FIELDS = ['appetiserStart', 'appetiserEnd', 'hook', 'turn', 'land', 'hookAt', 'turnAt', 'landAt'] as const

export const TIER_FIELDS = { hors: HORSE_FIELDS, appetiser: APPETISER_FIELDS }

const obj = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({ type: 'object', properties, required })
const str = { type: 'string' }
const num = { type: 'number' }
const intOrNull = { type: ['integer', 'null'] }
const strOrNull = { type: ['string', 'null'] }

const horsSchema = obj(
  {
    start: num,
    end: num,
    quote: str,
    lines: { type: 'array', items: obj({ at: num, text: str }, ['at', 'text']) },
  },
  ['start', 'end', 'quote', 'lines'],
)

const appetiserSchema = obj(
  {
    start: num,
    end: num,
    hook: str,
    turn: str,
    land: str,
    hookAt: num,
    turnAt: num,
    landAt: num,
  },
  ['start', 'end', 'hook', 'turn', 'land', 'hookAt', 'turnAt', 'landAt'],
)

const pointSchema = obj(
  {
    second: num,
    kind: { type: 'string', enum: ['question', 'multiple_choice', 'reflection', 'task'] },
    prompt: str,
    options: { type: 'array', items: str },
  },
  ['second', 'kind', 'prompt', 'options'],
)

const mentionSchema = obj({ text: str, reference: str, timestamp: str, context: str }, ['text', 'reference', 'timestamp', 'context'])

export const STEP_SPECS: StepSpec[] = [
  {
    slug: 'language-inference',
    name: 'Language inference',
    description: 'Reads the words and names the language the speaker uses to explain, not the language of a quoted verse. That note stays on this talk so later jobs can skip a garbled or unexpected language. Learners never see it.',
    placeholders: [{ token: 'TRANSCRIPT', meaning: 'The words of the talk, with the minutes marked.', required: true }],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0,
    maxTokens: 200,
    pipelineOrder: 10,
    inPipeline: true,
    fillsTier: null,
    fillsPoints: null,
    fills: 'Kept on this talk’s notes. It does not fill a clip or a question.',
    outputSchema: obj({ language: { type: ['string', 'null'] } }, ['language']),
    prompt: `You determine the PRIMARY spoken language of a talk from its transcript. The user message is the transcript, with timestamps.

The primary language is the one the speaker uses for explanation and commentary, the language a listener must understand to follow the talk. Islamic lectures commonly quote Qur'an or hadith in Arabic while explaining in another language. Those quotations do not make the talk Arabic.

{{TRANSCRIPT}}

Return a single JSON object: {"language": "en"}
"language" is the ISO 639-1 code (en, ar, ur, fr). If the transcript is empty or genuinely ambiguous, return {"language": null}. No text outside the JSON.`,
  },
  {
    slug: 'hors-doeuvre',
    name: "Hors d'oeuvre picker",
    description: 'Picks one clip of 15 to 30 seconds that can be heard with no setup, from inside the first sitting. It fills the start, the end, the quote and the caption lines. A person still approves it on Review before learners see it.',
    placeholders: [
      { token: 'TITLE', meaning: 'The name of the talk.', required: true },
      { token: 'DURATION', meaning: 'How long the talk is, in seconds.', required: true },
      { token: 'APPETISER', meaning: 'Where the first sitting starts and ends. The short clip has to sit inside it.', required: false },
      { token: 'TRANSCRIPT', meaning: 'The words of the talk.', required: true },
    ],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0.2,
    maxTokens: 1200,
    pipelineOrder: 30,
    inPipeline: true,
    fillsTier: 'hors',
    fillsPoints: null,
    fills: 'The short clip: when it starts, when it ends, the quote and the caption lines. A person checks it on Review.',
    outputSchema: horsSchema,
    prompt: `You pick a single hors d'oeuvre from this talk: one clip of 15 to 30 seconds that a stranger can hear with no setup.

{{TITLE}} lasts {{DURATION}} seconds. The hors d'oeuvre is part of the appetiser, so it starts and ends inside the appetiser: {{APPETISER}}.
{{TRANSCRIPT}}

What to look for, in this order: a thesis the speaker repeats (about 8 to 15 words); a verse followed by one line of application; a contrast ("not this, but this"); a puzzle then its answer; the turn of a story, not the whole story. Laughter or "amen" is a label for the line just before it. The clip starts on the first words of a complete sentence and ends just after that sentence, not on the next one.

Leave out greetings, link phrases ("as I mentioned"), anything that needs the room (a named person, pair work, notices), a view the speaker only voices in order to reject it, and garbled stretches.

The quote and every caption line must be the speaker's words, copied from the transcript, not paraphrased. Times are seconds.

Return JSON: {"start": 0, "end": 18, "quote": "", "lines": [{"at": 0, "text": ""}]}
start and end are seconds inside the appetiser, and end - start is between 15 and 30. No text outside the JSON.`,
  },
  {
    slug: 'appetiser-cut',
    name: 'Appetiser cutter',
    description: 'Cuts the first sitting: up to about three minutes, with a hook, a turn and a landing line, each a sentence the speaker actually said. It writes those lines and the minute each is said. Review still has to approve it, change it, or reject it.',
    placeholders: [
      { token: 'TITLE', meaning: 'The name of the talk.', required: true },
      { token: 'DURATION', meaning: 'How long the talk is, in seconds.', required: true },
      { token: 'TRANSCRIPT', meaning: 'The words of the talk.', required: true },
    ],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0.2,
    maxTokens: 1500,
    pipelineOrder: 20,
    inPipeline: true,
    fillsTier: 'appetiser',
    fillsPoints: null,
    fills: 'The first sitting: start, end, hook, turn, landing line, and the minute each is said. A person checks it on Review.',
    outputSchema: appetiserSchema,
    prompt: `You cut one appetiser from this talk. It is at most about three minutes. It has three lines, each spoken in the talk, in this order:

- hook: a sentence that works cold
- turn: a later sentence that shifts or sharpens the hook (not the next few words of the same sentence)
- land: the line a listener would repeat

{{TITLE}} lasts {{DURATION}} seconds.
{{TRANSCRIPT}}

Start on the first words of the hook's sentence. End just after the land's sentence, not on the opening words of the next list. Walk back from laughter or "amen" to the line that earned it, and keep that line inside the cut. Skip greetings, sponsor lines, room-dependent stretches, and setup with no land.

Copy hook, turn and land word for word from the transcript. Do not join them with an ellipsis or write a label in their place. Times are seconds from the start of the talk.

Return JSON: {"start": 0, "end": 90, "hook": "", "turn": "", "land": "", "hookAt": 0, "turnAt": 40, "landAt": 80}
end - start is at most 195. hookAt, turnAt and landAt sit inside the cut, in that order. No text outside the JSON.`,
  },
  {
    slug: 'popup-drafter',
    name: 'Pop-up question drafter',
    description: 'Writes the questions and small tasks that pause the full talk. Each one is timed to a moment after the line it draws on. They wait on Review. A question someone already approved is left as it is, and the new draft is flagged beside it.',
    placeholders: [
      { token: 'LAND', meaning: 'The last line of the first sitting, when there is one.', required: true },
      { token: 'LAND_AT', meaning: 'The second that last line is said.', required: true },
      { token: 'TRANSCRIPT', meaning: 'The words of the talk.', required: true },
    ],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0.3,
    maxTokens: 1500,
    pipelineOrder: 70,
    inPipeline: true,
    fillsTier: null,
    fillsPoints: 'popup',
    fills: 'Questions and small tasks on the full talk. They wait on Review.',
    outputSchema: obj({ points: { type: 'array', items: pointSchema } }, ['points']),
    prompt: `You draft pop-up questions for the main sitting of a talk. Each pop-up pauses the film at one moment and asks one thing. The user message is the transcript.

The land line, when we have one, is: {{LAND}}
It is said at {{LAND_AT}} seconds.
{{TRANSCRIPT}}

Draw each question from one specific thing the speaker actually urges or lands on. Time it at or after that line has been said, never before. One of them may be a small task the listener can do in the body or the day (phone face down for one gathering, one harsh word not said). The task must stand on its own, with no mention of the video or the speaker.

Do not write a quiz, a score, a rating, or an agree-to-disagree scale. Those words are refused before a learner can see them. Prefer an open question. kind is "question" or "task". options is an empty list unless kind is "multiple_choice", and even then the options are concrete acts, not a scale.

Each prompt: ${REWRITE_VOICE}

Return JSON: {"points": [{"second": 120, "kind": "question", "prompt": "", "options": []}]}
Two or three points, each prompt a sentence the listener can answer from their own week. If the talk supports none, return {"points": []}. No text outside the JSON.`,
  },
  {
    slug: 'tidy-caption-line',
    name: 'Tidy caption line',
    description: 'Takes each short-clip and first-sitting caption, which arrives from YouTube in lowercase and without punctuation, and turns it into a line a learner can read. It keeps the speaker’s words, adds capitals and punctuation, and capitalises Allah, the Prophet, Qur’an, hadith names, names of Allah, the Day of Judgement, the speaker and I. British spelling. The original caption stays for timing. With no AI account connected, the same rules run here, and nothing is sent out.',
    placeholders: [
      { token: 'LINES', meaning: 'The caption lines to clean up, one per line, still in the speaker’s words.', required: true },
      { token: 'SPEAKER', meaning: 'The speaker’s name. It gets a capital when it shows up in a line.', required: false },
    ],
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0,
    maxTokens: 2000,
    pipelineOrder: 35,
    inPipeline: true,
    fillsTier: null,
    fillsPoints: null,
    fills: 'The cleaned short-clip lines, and the cleaned hook, turn and landing line. The original captions and their times stay as they are.',
    outputSchema: obj(
      {
        lines: {
          type: 'array',
          items: obj({ role: str, raw: str, text: str, at: num }, ['role', 'raw', 'text']),
        },
      },
      ['lines'],
    ),
    prompt: `You tidy caption lines for a learner. The lines are YouTube auto-captions: often all lowercase, and often with no punctuation. The speaker is {{SPEAKER}}.

{{LINES}}

For each line, return the same words in the same order. You may add capitals, full stops, question marks, commas and apostrophes. You may not add, drop or swap a word, and you may not translate.

Capitalise Allah, the Prophet, Qur'an, hadith collections (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah), names of Allah (Ar-Rabb, Al-Nur, Ar-Rahman and the rest), the Day of Judgement, the Last Day, the speaker's name, and the word I. Use British spelling (judgement, honour, colour).

Return JSON: {"lines": [{"role": "hors", "raw": "the line you were given", "text": "The tidied line.", "at": 0}]}
role is hors, hook, turn, land or quote. raw is the line exactly as given. text is the tidied line. Copy at from the input when it is present. No text outside the JSON.`,
  },
  {
    slug: 'jibril-seat',
    name: 'Jibril and Ghunya tagger',
    description: 'Says which of the 41 Hadith Jibril teachings this talk is about, and which Ghunya seat that teaching already prints. It matches the teaching, not a shared word. It never invents a page. The note stays on this talk for the reviewer, and it does not by itself change what learners play.',
    placeholders: [
      { token: 'HOOK', meaning: 'The opening line of the first sitting.', required: true },
      { token: 'TURN', meaning: 'The line where the first sitting shifts.', required: true },
      { token: 'LAND', meaning: 'The last line of the first sitting.', required: true },
      { token: 'CLAUSE_CARDS', meaning: 'The 41 teachings, each with its line and the seats already printed.', required: true },
      { token: 'TRANSCRIPT', meaning: 'The words of the talk.', required: true },
    ],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0,
    maxTokens: 800,
    pipelineOrder: 40,
    inPipeline: true,
    fillsTier: null,
    fillsPoints: null,
    fills: 'A note on this talk: which teaching, how strong the match is, a one-line reason, and a seat only when the card already prints one.',
    outputSchema: obj(
      {
        clause: intOrNull,
        hangStrength: { type: 'string', enum: ['strong', 'medium', 'stretch', 'no_clean_hang'] },
        why: str,
        seat: strOrNull,
        seatPosition: intOrNull,
      },
      ['clause', 'hangStrength', 'why', 'seat', 'seatPosition'],
    ),
    prompt: `You tag one talk against Hadith Jibril and al-Ghunya.

Hook: {{HOOK}}
Turn: {{TURN}}
Land: {{LAND}}

Clause cards, copied from the curriculum map. A seat may be used only when it is printed here. Otherwise the seat is null and the reason says it is still to be decided. Never write a page number.

{{CLAUSE_CARDS}}

{{TRANSCRIPT}}

Hang by the teaching a teacher would be using this passage to teach, not by a word the line happens to share. Clauses 22 and 25 are not leftover bins. Clause 41 is rare and is not a bin either. no_clean_hang is a proper answer. Judgement, gathering, Fire and Gardens hang on 26 even when the English says Hour. Clauses 32 to 35 are only for the Hour as a question, the limits of knowing it, and the two signs.

Return JSON: {"clause": 30, "hangStrength": "medium", "why": "", "seat": null, "seatPosition": null}
clause is 1 to 41 or null. hangStrength is strong, medium, stretch or no_clean_hang. why names the teaching in one sentence. seat is the printed seat text or null. No text outside the JSON.`,
  },
  {
    slug: 'quran-harvest',
    name: "Qur'an harvest",
    description: 'Finds the Qur’an the speaker actually quotes, with the minute of that line and a surah only when the speaker names one. The rows stay on this talk as a draft for a person to read. They are not written into a learner’s own harvest.',
    placeholders: [{ token: 'TRANSCRIPT', meaning: 'The words of the talk.', required: true }],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0,
    maxTokens: 2000,
    pipelineOrder: 50,
    inPipeline: true,
    fillsTier: null,
    fillsPoints: null,
    fills: 'A list on this talk: the speaker’s words, a surah only if they named one, the minute, and the line around it. Not the learner’s own harvest.',
    outputSchema: obj({ mentions: { type: 'array', items: mentionSchema } }, ['mentions']),
    prompt: `You catalogue Qur'an the speaker quotes in this talk. The user message is the transcript, with timestamps.

{{TRANSCRIPT}}

Capture only what the speaker says. Copy the words from the transcript. Do not reconstruct a verse from memory, do not correct Arabic, and do not add a translation of your own. A reference (a surah name, or a surah and ayah) is kept only when the speaker says it. One continuous recitation is one mention. A recitation, then an explanation, then another recitation, are separate mentions. Garbled spans where no verse is actually readable are skipped, not repaired.

Do not add a clause number or any curriculum label. That is a later step.

Return JSON: {"mentions": [{"text": "", "reference": "", "timestamp": "0:12", "context": ""}]}
reference is "" when the speaker did not name one. context is one or two sentences of what the speaker says around the quotation. If there is no quotation, return {"mentions": []}. No text outside the JSON.`,
  },
  {
    slug: 'hadith-extraction',
    name: 'Hadith extraction',
    description: 'Finds hadith the speaker quotes, copied from the words of the talk, with a book name or a grade only when the speaker states it. A Hadith Jibril match is noted when the wording is unmistakable. The rows stay on this talk. No chain and no page is invented.',
    placeholders: [{ token: 'TRANSCRIPT', meaning: 'The words of the talk.', required: true }],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0,
    maxTokens: 2000,
    pipelineOrder: 60,
    inPipeline: true,
    fillsTier: null,
    fillsPoints: null,
    fills: 'A list on this talk: the speaker’s words, a book name only if they named one, the minute, and the line around it.',
    outputSchema: obj({ mentions: { type: 'array', items: mentionSchema } }, ['mentions']),
    prompt: `You catalogue hadith the speaker quotes in this talk. The user message is the transcript, with timestamps.

{{TRANSCRIPT}}

Copy the speaker's words from the transcript. Do not reconstruct a matn, a grading, a collection number or a chain. reference stays "" unless the speaker names a collection (Bukhari, Muslim, and so on). Garbled Arabic is left out, not repaired. Qur'an quotations are not hadith.

Only when the wording is unmistakably Hadith Jibril (the stranger who asks about Islam, iman, ihsan and the Hour), end context with one bracket such as [Hadith Jibril: 30]. If you are not sure which of the 41 clauses, write [Hadith Jibril] only. Never add that note to any other hadith. There are 41 clauses, not 43.

Return JSON: {"mentions": [{"text": "", "reference": "", "timestamp": "1:02", "context": ""}]}
If there is no such quotation, return {"mentions": []}. No text outside the JSON.`,
  },
  {
    slug: 'reflection-prompts',
    name: 'Reflection prompts',
    description: 'Writes two or three open questions. Each one hangs on a different line and shows up after that line has been said. They wait on Review. They are not a quiz and they have no right answer.',
    placeholders: [
      { token: 'LAND', meaning: 'The last line of the first sitting.', required: true },
      { token: 'LAND_AT', meaning: 'The second that last line is said.', required: true },
      { token: 'TRANSCRIPT', meaning: 'The words of the talk.', required: true },
    ],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0.3,
    maxTokens: 1200,
    pipelineOrder: 80,
    inPipeline: true,
    fillsTier: null,
    fillsPoints: 'reflection',
    fills: 'Open questions on the full talk. They wait on Review.',
    outputSchema: obj(
      {
        questions: {
          type: 'array',
          items: obj({ prompt: str, second: num, topic: str }, ['prompt', 'second', 'topic']),
        },
      },
      ['questions'],
    ),
    prompt: `You write open reflection prompts for a listener, drawn from this talk. Each one is a free-text question with no options and no right answer. Answers may later be read anonymously by other learners and summarised for the teacher, so ask for a lived moment rather than an opinion about the speaker.

The land line is: {{LAND}}
It is said at {{LAND_AT}} seconds. A question that draws on it appears at or after that second.
{{TRANSCRIPT}}

Anchor each prompt on a different line the speaker actually develops. Quote the speaker only with words that appear in the transcript. Do not write a knowledge question, a leading question, or anything that shames. Do not use the words of a quiz, a score, a rating or a scale.

Each prompt: ${REWRITE_VOICE}

Return JSON: {"questions": [{"prompt": "", "second": 90, "topic": "a short theme"}]}
Two or three prompts. If the talk supports none, return {"questions": []}. No text outside the JSON.`,
  },
  {
    slug: 'clip-critic',
    name: 'Clip critic',
    description: 'Marks the short clip and the first sitting against the live checklist. It checks the clip as heard, not the title we attached to it, and an ordinary clip is a 3. The marks stay on this talk. The marker does not rewrite the cut.',
    placeholders: [
      { token: 'RUBRIC', meaning: 'The live checklist the marker reads.', required: true },
      { token: 'CLIP', meaning: 'The short clip and the first sitting, with each sentence numbered.', required: true },
      { token: 'TRANSCRIPT', meaning: 'The words of the talk, so the marker can check them.', required: true },
    ],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0,
    maxTokens: 1200,
    pipelineOrder: 90,
    inPipeline: true,
    fillsTier: null,
    fillsPoints: null,
    fills: 'Four marks for the cut already drafted. The cut itself stays as it is.',
    outputSchema: obj(
      {
        axes: {
          type: 'array',
          items: obj(
            {
              axis: { type: 'string', enum: ['standalone', 'hook', 'payoff', 'quotability'] },
              score: { type: 'integer' },
              justification: str,
              evidence_unit_ids: { type: 'array', items: str },
            },
            ['axis', 'score', 'justification', 'evidence_unit_ids'],
          ),
        },
      },
      ['axes'],
    ),
    prompt: `You score one candidate clip. You are a critic, not an editor. Do not propose a new cut.

Judge only the words in the clip. A title or a single idea written by the clipper is a claim to check, not evidence, and never raises a score. If a line is garbled, score it as it reads. Context outside the clip is not part of the clip: a referent that only resolves out there is a failure.

A 3 is a normal score. Most candidates are 3s. A 5 has to be pointed at in the sentence ids. Each justification is one sentence.

{{RUBRIC}}

The clip, with sentence ids:
{{CLIP}}

The transcript, so you can see what was actually said:
{{TRANSCRIPT}}

Return JSON with exactly four axes, in this order: standalone, hook, payoff, quotability.
{"axes": [{"axis": "standalone", "score": 3, "justification": "", "evidence_unit_ids": ["s1"]}]}
Every evidence id is one of the clip's sentence ids. No text outside the JSON.`,
  },
  {
    slug: 'rubric',
    name: 'Clip rubric',
    description: 'The shared checklist the clip marker reads. It is not run on a talk. When you edit it and mark a version live, the marker’s next run reads that version. Older marks keep the checklist that produced them.',
    placeholders: [],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0,
    maxTokens: 200,
    pipelineOrder: 5,
    inPipeline: false,
    fillsTier: null,
    fillsPoints: null,
    fills: 'No clip and no question. The live checklist is read by the clip marker.',
    outputSchema: obj({ note: str }, ['note']),
    prompt: `# Clip rubric

A clip is watched on its own, with sound on, by someone who did not choose it and will leave if the opening does not hold. Nothing outside the clip earns patience. A weak opening cannot be rescued by a strong ending. A title or a stated idea is the clipper's claim and never raises a score.

Judge the hors d'oeuvre (15 to 30 seconds, inside the appetiser) and the appetiser (hook, turn and land, up to about three minutes) with the same four axes.

### 1. Standalone
Would a stranger take away only what the speaker said?
1: opens on a pronoun, a link phrase ("as I mentioned"), or something that needs the room (a named person, pair work, notices). Or, heard alone, it could be taken as a claim the speaker did not make.
3: mostly self-contained; one reference can be guessed from the tone.
5: a viewer with no context understands it, and what they understand is what the speaker meant.

### 2. Hook
Do the first words stop a scroll?
1: greeting, filler, or a sentence that starts in the middle.
3: clear, but no tension or surprise.
5: a question, a counterintuitive claim, a contrast, or a story with stakes in the opening sentence.
An opening that is only recitation, with no point yet in the language of the explanation, scores no higher than 2.

### 3. Payoff
Are the setup, the turn and the land all inside the clip?
1: the point arrives after the clip, or the clip ends on laughter or "amen" without the line that earned it.
3: the land is there but the clip trails into the next sentence.
5: setup, turn and land are inside, and it ends just after the land sentence.

### 4. Quotability
Is there a line a viewer would repeat?
1: no memorable line, or the key line is garbled.
3: one good line, buried or flat.
5: a sharp sentence, often 8 to 15 words. Strongest forms, in order: a repeated thesis; a verse plus one line of application; a contrast; a puzzle and its answer; the turn of a story; a question and its answer.

Score each axis on its own. Do not average as you go. Most clips are 3s. The clause hang is not an axis and cannot rescue a weak clip.`,
  },
  {
    slug: 'feedback-summary',
    name: 'Feedback summary',
    description: 'Reads the answers a community chose to share on one question and drafts the top themes, with a few quotes copied from those answers. The draft is labelled as a summary and stays off the download until a person includes it. It does not name learners.',
    placeholders: [
      { token: 'TALK', meaning: 'The name of the talk.', required: true },
      { token: 'QUESTION', meaning: 'The question people answered.', required: true },
      { token: 'ANSWERS', meaning: 'The answers people chose to share, one on each line. Private answers are left out.', required: true },
    ],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0.2,
    maxTokens: 800,
    pipelineOrder: 100,
    inPipeline: false,
    fillsTier: null,
    fillsPoints: null,
    fills: 'A draft summary under one question on the feedback desk. It stays out of a download until a person includes it.',
    outputSchema: obj({ themes: { type: 'array', items: str }, quotes: { type: 'array', items: str } }, ['themes', 'quotes']),
    prompt: `You jot what a sheikh would notice in answers learners chose to share. Do not invent answers. Do not name people. Do not add advice. ${ANSWER_VOICE}

The talk is: {{TALK}}
The question is: {{QUESTION}}
The answers, one per line:
{{ANSWERS}}

Return JSON: {"themes": ["a few uneven notes, not a tidy set of three"], "quotes": ["up to three short quotes copied from the answers"]}
themes has 3 to 5 items when there are answers, or one item saying there is nothing to read. Write them as notes, not a polished summary. quotes are copied from the answers, not paraphrased, and may be an empty list. No text outside the JSON.`,
  },
  {
    slug: 'question-value',
    name: 'Check question for teacher value',
    description: 'Flags a question whose answers would be yes or no, vague, or of little use to a teacher, and suggests a rewrite that asks for something specific from the person’s own week. The rewrite is a draft on the weak-questions list. The question learners see is left as it is.',
    placeholders: [
      { token: 'TALK', meaning: 'The talk this question belongs to.', required: true },
      { token: 'FAMILY', meaning: 'A question, a reflection, or a small task.', required: true },
      { token: 'QUESTION', meaning: 'The question as it is written now.', required: true },
    ],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0,
    maxTokens: 600,
    pipelineOrder: 110,
    inPipeline: false,
    fillsTier: null,
    fillsPoints: null,
    fills: 'A draft rewrite on the weak-questions list. It never replaces the live question.',
    outputSchema: obj(
      { weak: { type: 'boolean' }, reasons: { type: 'array', items: str }, rewrite: str },
      ['weak', 'reasons', 'rewrite'],
    ),
    prompt: `You check one question that learners answer after a talk. A sheikh, imam or teacher will read the answers to understand their community.

The talk is: {{TALK}}
The question family is: {{FAMILY}}
The question is: {{QUESTION}}

Flag it when the answers would be yes or no, generic, or unhelpful to a sheikh. A useful question asks for something specific from the person's own week.

When you rewrite, follow this: ${REWRITE_VOICE}
A teacher replying to an answer would follow this: ${TEACHER_REPLY_VOICE}

Return JSON: {"weak": true, "reasons": ["one plain sentence"], "rewrite": "one question"}
weak is false when the question already does that work. reasons is an empty list when it is not weak. rewrite is "" when it is not weak, otherwise the one question. No text outside the JSON.`,
  },
]

export function stepBySlug(slug: string) {
  return STEP_SPECS.find((step) => step.slug === slug) || null
}

export type TalkContext = {
  title: string
  speaker: string
  duration: number
  transcript: string
  hook: string
  turn: string
  land: string
  landAt: number
  /** The tier's appetiser, when the talk has one. The hors d'oeuvre is drafted inside it. */
  appetiser?: { start: number; end: number } | null
  clauseCards: string
  rubric: string
  clip: string
  /** Caption lines for the tidy step, one per line. */
  captionLines?: string
  /** Set when the feedback summary or the question check runs. The ingest pipeline leaves these empty. */
  question?: string
  answers?: string
  family?: string
}

export function mockOutput(step: StepSpec, talk: TalkContext, prompt: string): unknown {
  if (step.slug === 'rubric') return { note: prompt.trim().slice(0, 280) || 'The rubric is empty.' }
  if (step.slug === 'question-value') {
    const checked = assessQuestion({ prompt: talk.question || talk.land || talk.title, talk: talk.title })
    return { weak: checked.weak, reasons: checked.reasons, rewrite: checked.rewrite }
  }
  if (step.slug === 'feedback-summary') return themesFromAnswers(talk.answers || talk.transcript)
  if (!talk.transcript.trim()) {
    if (step.slug === 'language-inference') return { language: null }
    throw new Error('This talk has no transcript yet, so the step has nothing to read.')
  }
  const drafted = draftTiers(talk.transcript, talk.duration || null)
  if (step.slug === 'language-inference') return { language: languageOf(talk.transcript) }
  if (!drafted) throw new Error('There is not enough speech in this transcript to draft from.')
  // Browsers submit textarea newlines as CR LF. Fold them so the same words always pick the same cut.
  const shift = salt(`${step.slug}\n${prompt.replace(/\r\n/g, '\n')}`, 97)
  if (step.slug === 'hors-doeuvre') return horsOf(talk.transcript, drafted, shift, talk.appetiser)
  if (step.slug === 'appetiser-cut') return appetiserOf(drafted, shift)
  if (step.slug === 'popup-drafter') return { points: popupPoints(drafted, shift, 'question') }
  if (step.slug === 'reflection-prompts') return { questions: reflectionsOf(drafted, shift) }
  if (step.slug === 'quran-harvest') return { mentions: mentionsOf(talk.transcript, 'quran') }
  if (step.slug === 'hadith-extraction') return { mentions: mentionsOf(talk.transcript, 'hadith') }
  if (step.slug === 'jibril-seat') return tagOf(talk, shift)
  if (step.slug === 'clip-critic') return criticOf(talk, drafted, shift)
  if (step.slug === 'tidy-caption-line') return tidyOf(talk, drafted)
  throw new Error(`There is no mock for ${step.slug}.`)
}

function tidyOf(talk: TalkContext, draft: TierDraft) {
  const stored = buildLineTidy({
    speaker: talk.speaker,
    quote: draft.hors.quote,
    hook: draft.hook || talk.hook,
    turn: draft.turn || talk.turn,
    land: draft.land || talk.land,
    horsLines: draft.horsLines,
  })
  const lines: TidyLine[] = [stored.quote, stored.hook, stored.turn, stored.land, ...stored.horsLines]
  return { lines: lines.filter((line) => line.raw.trim()).map((line) => ({ role: line.role || 'hors', raw: line.raw, text: line.text, at: line.at || 0 })) }
}

function languageOf(transcript: string) {
  const arabic = (transcript.match(/[\u0600-\u06FF]/g) || []).length
  const latin = (transcript.match(/[A-Za-z]/g) || []).length
  if (arabic + latin < 40) return null
  if (arabic > latin) return 'ar'
  return 'en'
}

function horsOf(transcript: string, draft: TierDraft, shift: number, appetiser?: { start: number; end: number } | null) {
  const windows = horsWindows(transcript, draft, appetiser)
  return windows[shift % windows.length]
}

function horsWindows(transcript: string, draft: TierDraft, within?: { start: number; end: number } | null) {
  const base = {
    start: draft.hors.start,
    end: draft.hors.end,
    quote: draft.hors.quote,
    lines: draft.horsLines.length ? draft.horsLines.map((line) => ({ at: line.at, text: line.text })) : [{ at: draft.hors.start, text: draft.hors.quote }],
  }
  const appetiser = within || draft.appetiser
  const fits = (start: number, end: number) => start >= appetiser.start && end <= appetiser.end
  const windows = fits(base.start, base.end) ? [base] : []
  for (const sentence of sentencesOf(transcript)) {
    if (sentence.words < 5 || !sentence.complete) continue
    if (!fits(round1(sentence.start), round1(sentence.start + 17))) continue
    if (windows.some((window) => window.quote === sentence.text)) continue
    windows.push({
      start: round1(sentence.start),
      end: round1(sentence.start + 17),
      quote: sentence.text,
      lines: [{ at: round1(sentence.start), text: sentence.text }],
    })
    if (windows.length >= 6) break
  }
  return windows.length ? windows : [base]
}

function appetiserOf(draft: TierDraft, shift: number) {
  return {
    start: draft.appetiser.start,
    end: draft.appetiser.end,
    hook: draft.hook,
    turn: draft.turn,
    land: draft.land,
    hookAt: draft.hookAt,
    turnAt: round1(draft.turnAt + (shift === 0 ? 0 : 0)),
    landAt: draft.landAt,
  }
}

function popupPoints(draft: TierDraft, shift: number, kind: 'question' | 'reflection') {
  const rows = draft.popups.length ? draft.popups : [{ second: Math.min(draft.landAt + 1, Math.max(0, draft.duration - 1)), quote: draft.land, prompt: '' }]
  const picked = rows.slice(0, 3)
  const start = shift % picked.length
  const ordered = picked.slice(start).concat(picked.slice(0, start))
  return ordered.map((row) => ({
    second: row.second,
    kind,
    prompt: row.prompt || draftPopupPrompt(row.quote, ordered.indexOf(row)),
    options: [] as string[],
  }))
}

function reflectionsOf(draft: TierDraft, shift: number) {
  return popupPoints(draft, shift, 'reflection').map((point) => ({
    prompt: point.prompt,
    second: point.second,
    topic: 'the line just spoken',
  }))
}

function mentionsOf(transcript: string, kind: 'quran' | 'hadith') {
  return harvestTranscript(transcript)
    .filter((hit) => hit.kind === kind)
    .map((hit) => ({ text: hit.text, reference: hit.reference, timestamp: hit.timestamp, context: hit.context }))
}

function tagOf(talk: TalkContext, shift: number) {
  const clauses = parseCards(talk.clauseCards)
  const result = dualExtract(talk.transcript, clauses)
  const cut = result.cuts[shift % Math.max(1, result.cuts.length)] || result.cuts[0]
  if (!cut || cut.bestClause == null) {
    return { clause: null, hangStrength: 'no_clean_hang' as const, why: 'No clean hang. The line does not teach one clause clearly enough to tag.', seat: null, seatPosition: null }
  }
  return {
    clause: cut.bestClause,
    hangStrength: cut.hangStrength,
    why: cut.whyHang || 'The teaching of the line is the clause, not a word it shares.',
    seat: null,
    seatPosition: null,
  }
}

function parseCards(text: string): { number: number; fragment: string; core: string; teaching: string }[] {
  if (!text.trim()) return []
  return text
    .split(/\n(?=\d+\. )/)
    .map((block) => {
      const heading = block.match(/^(\d+)\.\s+([^\n]+)/)
      if (!heading) return null
      const teaching = block.match(/TEACHING\.\s*([^\n]+)/)?.[1] || ''
      return { number: Number(heading[1]), fragment: heading[2].trim(), core: '', teaching: teaching.trim() }
    })
    .filter((row): row is { number: number; fragment: string; core: string; teaching: string } => Boolean(row))
}

function criticOf(talk: TalkContext, draft: TierDraft, shift: number) {
  const ids = clipIds(talk.clip)
  const evidence = ids.length ? [ids[shift % ids.length]] : ['s1']
  const axes = ['standalone', 'hook', 'payoff', 'quotability'] as const
  const base = draft.hook && draft.turn && draft.land && draft.hook !== draft.land ? 3 : 2
  return {
    axes: axes.map((axis) => ({
      axis,
      score: base,
      justification: axis === 'hook' ? 'The opening is clear and holds a point, which is an ordinary score.' : 'Heard on its own, the cut is complete enough for an ordinary score and no more.',
      evidence_unit_ids: evidence,
    })),
  }
}

function clipIds(clip: string) {
  return [...clip.matchAll(/\b(s\d+)\b/g)].map((match) => match[1])
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

export function clipText(hook: string, turn: string, land: string) {
  const lines = [hook, turn, land].map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return 's1 (no cut drafted yet)'
  return lines.map((line, index) => `s${index + 1}: ${line}`).join('\n')
}

/** A label stored on a prompt version. A live call uses the model on the portal’s own account. */
export function defaultModel(provider: ProviderName) {
  if (provider === 'openai') return 'gpt-4o-mini'
  return 'claude-sonnet-4-5'
}

export function roleWords(role: string | null | undefined) {
  if (role === 'portal-admin') return 'portal admin'
  if (role === 'master') return 'master'
  if (role === 'teacher') return 'teacher'
  if (role === 'learner') return 'learner'
  if (!role) return ''
  return role.replace(/-/g, ' ')
}

/** Calendar day in London, as YYYY-MM-DD. The bell groups a portal’s changes by this day. */
export function londonDay(date: Date) {
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function sameVersions(left: VersionState[], right: VersionState[]) {
  if (left.length !== right.length) return false
  return left.every((version, index) => version.number === right[index].number && version.prompt === right[index].prompt && version.live === right[index].live)
}

/**
 * A portal save adds a version only on that portal’s list, and makes it the one that portal uses.
 * The HEARTS list is copied through unchanged.
 */
export function forkSave(master: VersionState[], portal: VersionState[], draft: Omit<VersionState, 'number' | 'live'>) {
  const next = nextVersion(portal, draft)
  const created = next[next.length - 1]
  return { master: master.map((version) => ({ ...version })), portal: markLive(next, created.number) }
}

/** Keep means this portal version is the one that portal uses. HEARTS is not written. */
export function forkKeep(master: VersionState[], portal: VersionState[], number: number) {
  return { master: master.map((version) => ({ ...version })), portal: markLive(portal, number) }
}

/**
 * Roll back the version the portal is using now.
 * An older saved version comes back. If this was their only change, the portal uses HEARTS again.
 * Rolling back a version that is not the one in use only records the decision. HEARTS is not written.
 */
export function forkRollback(master: VersionState[], portal: VersionState[], number: number) {
  const target = portal.find((version) => version.number === number)
  if (!target) throw new Error('That version is not in the history.')
  const untouched = master.map((version) => ({ ...version }))
  if (!target.live) return { master: untouched, portal: portal.map((version) => ({ ...version })), fellBackToMaster: false, changedLive: false }
  const older = portal.filter((version) => version.number < number)
  if (!older.length) {
    return { master: untouched, portal: portal.map((version) => ({ ...version, live: false })), fellBackToMaster: true, changedLive: true }
  }
  const previous = older.reduce((best, version) => (version.number > best.number ? version : best))
  return { master: untouched, portal: markLive(portal, previous.number), fellBackToMaster: false, changedLive: true }
}

/** The instructions a portal run should read. Their live fork wins. Otherwise HEARTS. */
export function promptForPortal(master: VersionState[], portal: VersionState[]) {
  return liveVersion(portal) || liveVersion(master)
}

export function bellKey(portalId: number, day: string) {
  return `ai-portal-change:${portalId}:${day}`
}

/** One bell line per portal per day, however many steps they changed. */
export function bellText(portalName: string, count: number) {
  const name = portalName.trim() || 'A portal'
  const label = /portal$/i.test(name) ? name : `${name} portal`
  const total = Math.max(0, Math.round(count))
  const steps = total === 1 ? '1 step' : `${total} steps`
  return {
    title: `${label} changed ${steps} today`,
    body:
      total === 1
        ? 'A portal admin changed one AI step. Open AI steps to read what it said before and what it says now.'
        : `A portal admin changed ${total} AI steps today. They are grouped into this one note so the bell does not fill up.`,
  }
}

export function countNewSince(times: Array<string | null | undefined>, seenAt: string | null | undefined) {
  const seen = seenAt ? new Date(seenAt).getTime() : null
  return times.filter((time) => {
    if (!time) return false
    const at = new Date(time).getTime()
    if (Number.isNaN(at)) return false
    if (seen == null || Number.isNaN(seen)) return true
    return at > seen
  }).length
}

export function filterActivity<T extends { portalId: number; stepSlug: string; at: string }>(
  rows: T[],
  filter: { portalId?: number | null; stepSlug?: string | null; day?: string | null },
) {
  return rows.filter((row) => {
    if (filter.portalId && row.portalId !== filter.portalId) return false
    if (filter.stepSlug && row.stepSlug !== filter.stepSlug) return false
    if (filter.day && londonDay(new Date(row.at)) !== filter.day) return false
    return true
  })
}

export function groupPortalChanges<T extends { portalId: number; portalName: string; at: string }>(rows: T[]) {
  const map = new Map<number, T[]>()
  for (const row of rows) {
    const list = map.get(row.portalId) || []
    list.push(row)
    map.set(row.portalId, list)
  }
  return [...map.entries()]
    .map(([portalId, items]) => {
      const sorted = [...items].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      return { portalId, portalName: sorted[0]?.portalName || 'A portal', count: sorted.length, lastAt: sorted[0]?.at || '', items: sorted }
    })
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0))
}

export type SideLine = { kind: 'same' | 'add' | 'del' | 'gap' | 'skip'; text: string }

/** Before on the left, after on the right. A changed line is highlighted on the side it belongs to. */
export function sideBySide(before: string, after: string): { before: SideLine[]; after: SideLine[] } {
  const diff = diffLines(before, after)
  const left: SideLine[] = []
  const right: SideLine[] = []
  for (const line of diff) {
    if (line.kind === 'same') {
      left.push({ kind: 'same', text: line.text })
      right.push({ kind: 'same', text: line.text })
    } else if (line.kind === 'del') {
      left.push({ kind: 'del', text: line.text })
      right.push({ kind: 'gap', text: '' })
    } else {
      left.push({ kind: 'gap', text: '' })
      right.push({ kind: 'add', text: line.text })
    }
  }
  return { before: left, after: right }
}

/** Changed lines, plus a little context. Long stretches that did not change collapse to one skip. */
export function compactSide(before: string, after: string, context = 1) {
  const full = sideBySide(before, after)
  const interesting = new Set<number>()
  full.before.forEach((line, index) => {
    if (line.kind === 'same' && full.after[index]?.kind === 'same') return
    for (let cursor = Math.max(0, index - context); cursor <= Math.min(full.before.length - 1, index + context); cursor++) interesting.add(cursor)
  })
  if (!interesting.size) {
    const sample = full.before.slice(0, 2)
    return { before: sample, after: full.after.slice(0, 2), omitted: Math.max(0, full.before.length - sample.length) }
  }
  const left: SideLine[] = []
  const right: SideLine[] = []
  let omitted = 0
  let skipping = false
  for (let index = 0; index < full.before.length; index++) {
    if (!interesting.has(index)) {
      omitted += 1
      skipping = true
      continue
    }
    if (skipping) {
      left.push({ kind: 'skip', text: '…' })
      right.push({ kind: 'skip', text: '…' })
      skipping = false
    }
    left.push(full.before[index])
    right.push(full.after[index])
  }
  return { before: left, after: right, omitted }
}

export function editAudit(input: { actorId: number; actorRole: string; portalId: number | null; slug: string; version: number; note: string; authorName: string }) {
  return {
    event: 'ai.step.version',
    fields: {
      actor: input.actorId,
      actorRole: input.actorRole,
      portal: input.portalId || undefined,
      reason: input.note,
      detail: {
        slug: input.slug,
        version: input.version,
        authorName: input.authorName,
        authorRole: input.actorRole,
        portalId: input.portalId,
        forked: Boolean(input.portalId),
      },
    },
  }
}

export function deniedAudit(input: { actorId: number; actorRole: string; portalId?: number | null; reason: string }) {
  return {
    event: 'ai.step.denied',
    fields: {
      actor: input.actorId,
      actorRole: input.actorRole,
      portal: input.portalId || undefined,
      reason: input.reason,
      detail: { role: input.actorRole, portalId: input.portalId || null },
    },
  }
}

export function runAudit(input: { actorId: number; actorRole: string; portalId: number | null; slug: string; lessonId: number; ok: boolean; error?: string }) {
  return {
    event: 'ai.step.run',
    fields: {
      actor: input.actorId,
      actorRole: input.actorRole,
      portal: input.portalId || undefined,
      reason: input.ok ? `Ran ${input.slug}.` : input.error || `The run of ${input.slug} did not work.`,
      detail: { slug: input.slug, lessonId: input.lessonId, ok: input.ok, portalId: input.portalId },
    },
  }
}
