/**
 * In-browser demo stage. Seeded sample data only.
 * Nothing here opens a database, a session, or a real account.
 *
 * One loop joins the four people:
 * master adds a course, the portal posts a note, the teacher sets a prompt,
 * the learner writes back, the teacher replies, and the numbers move up.
 */

export const DEMO_CHANNEL = 'hearts-demo-stage'
export const CAST_FLOW = ['master', 'portal', 'teacher', 'learner'] as const
export type CastStep = (typeof CAST_FLOW)[number]
export type PortalKind = 'mosque' | 'school' | 'company'

export type DemoCast = {
  master: string
  portalAdmin: string
  portalName: string
  kind: PortalKind
  teacher: string
  learner: string
}

export function defaultCast(): DemoCast {
  return {
    master: 'Leon (HEARTS)',
    portalAdmin: 'Rafiq',
    portalName: 'Al-Noor Mosque',
    kind: 'mosque',
    teacher: 'Sami',
    learner: 'Abdallah',
  }
}

export const CAST_QUICK = {
  master: ['Leon (HEARTS)', 'Hana (HEARTS)', 'Yusuf (HEARTS)'],
  teacher: ['Sami', 'Sheikh Yusuf', 'Amina'],
  learner: ['Abdallah', 'Maryam', 'Idris', 'Layla'],
  portal: {
    mosque: [
      { person: 'Rafiq', place: 'Al-Noor Mosque' },
      { person: 'Yusuf', place: 'East London Mosque' },
      { person: 'Maryam', place: 'Green Lane Masjid' },
    ],
    school: [
      { person: 'Amira', place: 'Riverside School' },
      { person: 'Ken', place: 'Oakfield School' },
      { person: 'Sandra', place: 'Harbour School' },
    ],
    company: [
      { person: 'Noor', place: 'Crescent Studio' },
      { person: 'Idris', place: 'Baraka Co' },
      { person: 'Hana', place: 'Qiblah Ltd' },
    ],
  },
} as const

const MADE_UP = {
  master: ['Noor (HEARTS)', 'Idris (HEARTS)', 'Safiya (HEARTS)', 'Hamza (HEARTS)'],
  admin: ['Khalid', 'Zaynab', 'Imran', 'Aisha'],
  teacher: ['Sheikh Omar', 'Ustadh Bilal', 'Hana', 'Maryam'],
  learner: ['Yusuf', 'Aisha', 'Hamza', 'Safiya'],
  place: {
    mosque: ['Masjid An-Nur', 'The Crescent Mosque', 'Masjid Al-Huda', 'Quba Mosque'],
    school: ['Willow Academy', 'Northbridge School', 'Horizon School', 'Meadow School'],
    company: ['Amana Studio', 'Sakinah Ltd', 'Barakah Works', 'Nur & Co'],
  },
} as const

export function castPrompt(step: CastStep, kind: PortalKind) {
  if (step === 'master') return 'Who runs the whole system?'
  if (step === 'portal') {
    if (kind === 'school') return 'Who would look after your school?'
    if (kind === 'company') return 'Who would look after your company?'
    return 'Who would look after your mosque?'
  }
  if (step === 'teacher') return 'Who would guide the learners and reply to them?'
  return 'Pick one learner from your community'
}

export function castHeader(cast: DemoCast, panel: DemoPanel) {
  if (panel === 'master') return `${cast.master}, running the whole system`
  if (panel === 'portal') return `${cast.portalAdmin}, looking after ${cast.portalName}`
  if (panel === 'teacher') return `${cast.teacher}, guiding the learners`
  return `${cast.learner}, a learner at ${cast.portalName}`
}

export function welcomeLine(cast: DemoCast) {
  const name = cast.learner.trim() || defaultCast().learner
  return cast.kind === 'mosque' ? `Salaam ${name}` : `Hello ${name}`
}

export function fillCast(text: string, cast: DemoCast) {
  return text
    .replaceAll('{master}', cast.master)
    .replaceAll('{admin}', cast.portalAdmin)
    .replaceAll('{portal}', cast.portalName)
    .replaceAll('{teacher}', cast.teacher)
    .replaceAll('{learner}', cast.learner)
}

export function rollCast(cast: DemoCast, step: CastStep, roll: number): DemoCast {
  const at = Math.abs(roll) % 4
  if (step === 'master') return { ...cast, master: MADE_UP.master[at] }
  if (step === 'portal') return { ...cast, portalAdmin: MADE_UP.admin[at], portalName: MADE_UP.place[cast.kind][at] }
  if (step === 'teacher') return { ...cast, teacher: MADE_UP.teacher[at] }
  return { ...cast, learner: MADE_UP.learner[at] }
}

export function castReady(cast: DemoCast, step: CastStep) {
  if (step === 'master') return Boolean(cast.master.trim())
  if (step === 'portal') return Boolean(cast.portalAdmin.trim() && cast.portalName.trim())
  if (step === 'teacher') return Boolean(cast.teacher.trim())
  return Boolean(cast.learner.trim())
}

export function castFilled(cast: DemoCast) {
  return CAST_FLOW.every((step) => castReady(cast, step))
}

export function tidyCast(cast: DemoCast): DemoCast {
  const base = defaultCast()
  return {
    master: cast.master.trim() || base.master,
    portalAdmin: cast.portalAdmin.trim() || base.portalAdmin,
    portalName: cast.portalName.trim() || base.portalName,
    kind: cast.kind,
    teacher: cast.teacher.trim() || base.teacher,
    learner: cast.learner.trim() || base.learner,
  }
}

export const DEMO_PANELS = ['master', 'portal', 'teacher', 'learner'] as const
export type DemoPanel = (typeof DEMO_PANELS)[number]
export type QueueKind = 'answer' | 'workbook' | 'comment'
export type PromptKind = 'question' | 'workbook'

export const LOOP_COURSE = 'Night walk'
export const LOOP_NOTE = 'Bring a notebook to the circle tonight.'
export const LOOP_QUESTION = 'What will you try before next week?'
export const LOOP_WORKBOOK = 'Write one kind thing you did.'
export const LOOP_ANSWER = 'I will try ten quiet minutes.'
export const LOOP_BOOK_LINE = 'I held the door for someone.'
export const LOOP_COMMENT = 'Can I ask about the last part?'
export const LOOP_REPLY = 'Ten quiet minutes is enough. I will look for it.'

export const SEED_COURSES = ['A quiet hour', 'Preparing for the circle', 'The doors of the week'] as const
export const SEED_NOTE = 'Circle meets after Maghrib tonight.'
export const SEED_QUESTION = 'Name three things you will carry from this sitting.'
export const SEED_LATER = 'How has this changed your week?'
export const SEED_WORKBOOK = 'Write one line about a moment you want to keep.'

export type DemoCourse = { id: string; title: string }
export type DemoNote = { id: string; body: string }
export type DemoPrompt = { id: string; kind: PromptKind; text: string; who: string }
export type DemoOpen = { id: string; learner: string; promptId: string; why: string }
export type DemoQueueItem = {
  id: string
  learner: string
  kind: QueueKind
  prompt: string
  body: string
  reply: string
  done: boolean
  promptId?: string
}
export type DemoActivity = { id: string; text: string }
export type DemoTicker = { id: number; text: string }

export type DemoState = {
  courses: DemoCourse[]
  notes: DemoNote[]
  prompts: DemoPrompt[]
  opens: DemoOpen[]
  queue: DemoQueueItem[]
  activity: DemoActivity[]
  ticker: DemoTicker[]
  fresh: string[]
  seq: number
}

export type DemoAction =
  | { type: 'reset' }
  | { type: 'add-course'; title: string }
  | { type: 'post-note'; body: string }
  | { type: 'set-prompt'; kind: PromptKind; text: string }
  | { type: 'write'; kind: QueueKind; body: string; promptId?: string }
  | { type: 'reply'; id: string; body: string }
  | { type: 'reply-latest'; kind?: QueueKind; body: string }

export type LoopStep = {
  id: string
  actor: DemoPanel
  receivers: DemoPanel[]
  say: string
  anchor: string
  action?: DemoAction
}

export const LOOP_PLAY: LoopStep[] = [
  {
    id: 'course',
    actor: 'master',
    receivers: ['portal', 'learner'],
    say: '{master} adds a new course. It shows in the library and on {learner}’s phone.',
    anchor: 'demo-feed',
    action: { type: 'add-course', title: LOOP_COURSE },
  },
  {
    id: 'note',
    actor: 'portal',
    receivers: ['learner'],
    say: '{admin} posts an announcement. {learner} sees it on the phone.',
    anchor: 'demo-phone-notes',
    action: { type: 'post-note', body: LOOP_NOTE },
  },
  {
    id: 'question',
    actor: 'teacher',
    receivers: ['learner'],
    say: '{teacher} sets a question. It reaches {learner}.',
    anchor: 'demo-learner-prompts',
    action: { type: 'set-prompt', kind: 'question', text: LOOP_QUESTION },
  },
  {
    id: 'workbook',
    actor: 'teacher',
    receivers: ['learner'],
    say: '{teacher} sets a workbook prompt. It reaches {learner} too.',
    anchor: 'demo-learner-prompts',
    action: { type: 'set-prompt', kind: 'workbook', text: LOOP_WORKBOOK },
  },
  {
    id: 'answer',
    actor: 'learner',
    receivers: ['teacher', 'portal', 'master'],
    say: '{learner} answers the question. It lands in {teacher}’s reply queue, and the numbers move.',
    anchor: 'demo-queue',
    action: { type: 'write', kind: 'answer', body: LOOP_ANSWER },
  },
  {
    id: 'book',
    actor: 'learner',
    receivers: ['teacher', 'portal', 'master'],
    say: '{learner} writes a workbook line. That lands in the queue as well.',
    anchor: 'demo-queue',
    action: { type: 'write', kind: 'workbook', body: LOOP_BOOK_LINE },
  },
  {
    id: 'comment',
    actor: 'learner',
    receivers: ['teacher', 'portal', 'master'],
    say: '{learner} writes a comment. {teacher} can see it in the same stream.',
    anchor: 'demo-queue',
    action: { type: 'write', kind: 'comment', body: LOOP_COMMENT },
  },
  {
    id: 'reply',
    actor: 'teacher',
    receivers: ['learner', 'portal', 'master'],
    say: '{teacher} writes back. {learner} gets it, and that note is marked done.',
    anchor: 'demo-learner-replies',
    action: { type: 'reply-latest', kind: 'answer', body: LOOP_REPLY },
  },
  {
    id: 'rollup',
    actor: 'portal',
    receivers: ['master'],
    say: 'Who is stuck shows for {admin}. The same numbers show for {master}.',
    anchor: 'demo-master-numbers',
  },
]

const LEARNER = '{learner}'

function clean(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export function seedDemo(): DemoState {
  return {
    courses: SEED_COURSES.map((title, index) => ({ id: `course-seed-${index}`, title })),
    notes: [{ id: 'note-seed', body: SEED_NOTE }],
    prompts: [
      { id: 'prompt-now', kind: 'question', text: SEED_QUESTION, who: '*' },
      { id: 'prompt-later', kind: 'question', text: SEED_LATER, who: 'Hamza' },
      { id: 'prompt-book', kind: 'workbook', text: SEED_WORKBOOK, who: LEARNER },
    ],
    opens: [
      { id: 'open-hamza', learner: 'Hamza', promptId: 'prompt-later', why: 'Has not answered yet' },
      { id: 'open-book', learner: LEARNER, promptId: 'prompt-book', why: 'Has not written the workbook line yet' },
    ],
    queue: [
      {
        id: 'wait-layla',
        learner: 'Layla',
        kind: 'answer',
        prompt: SEED_QUESTION,
        body: 'I carried the quiet, the names, and one promise.',
        reply: '',
        done: false,
        promptId: 'prompt-now',
      },
      {
        id: 'wait-idris',
        learner: 'Idris',
        kind: 'workbook',
        prompt: SEED_WORKBOOK,
        body: 'I missed two days. I want to start again after Maghrib.',
        reply: '',
        done: false,
        promptId: 'prompt-book',
      },
      {
        id: 'wait-maryam',
        learner: 'Maryam',
        kind: 'comment',
        prompt: 'A comment',
        body: 'Can we sit with this again on Friday?',
        reply: '',
        done: false,
      },
      {
        id: 'done-learner',
        learner: LEARNER,
        kind: 'answer',
        prompt: SEED_QUESTION,
        body: 'I will keep one quiet hour this week.',
        reply: 'Keep that hour after Maghrib. I will look for it next week.',
        done: true,
        promptId: 'prompt-now',
      },
      {
        id: 'done-yusuf',
        learner: 'Yusuf',
        kind: 'answer',
        prompt: SEED_QUESTION,
        body: 'I tried the quiet hour on Sunday.',
        reply: 'That Sunday hour counts. Keep it short and keep it.',
        done: true,
        promptId: 'prompt-now',
      },
    ],
    activity: [
      { id: 'act-seed-1', text: 'Layla answered a question.' },
      { id: 'act-seed-2', text: 'Idris wrote a workbook line.' },
      { id: 'act-seed-3', text: 'Maryam sent a comment.' },
      { id: 'act-seed-4', text: '{teacher} wrote back to {learner}.' },
      { id: 'act-seed-5', text: 'Hamza has not answered yet.' },
    ],
    ticker: [
      { id: 1, text: 'Layla answered a question.' },
      { id: 2, text: 'Idris wrote a workbook line.' },
      { id: 3, text: 'Maryam sent a comment.' },
    ],
    fresh: [],
    seq: 3,
  }
}

function withNote(state: DemoState, text: string, patch: Partial<DemoState>, fresh: string[]): DemoState {
  const seq = state.seq + 1
  return {
    ...state,
    ...patch,
    seq,
    fresh,
    activity: [{ id: `act-${seq}`, text }, ...state.activity].slice(0, 16),
    ticker: [{ id: seq, text }, ...state.ticker].slice(0, 12),
  }
}

function promptKind(kind: QueueKind): PromptKind | null {
  if (kind === 'answer') return 'question'
  if (kind === 'workbook') return 'workbook'
  return null
}

function newestOpenPrompt(state: DemoState, kind: QueueKind) {
  const wanted = promptKind(kind)
  if (!wanted) return undefined
  return state.prompts.find((prompt) => prompt.kind === wanted && state.opens.some((row) => row.learner === LEARNER && row.promptId === prompt.id))
}

export function kindLabel(kind: QueueKind | PromptKind) {
  if (kind === 'workbook') return 'Workbook'
  if (kind === 'comment') return 'Comment'
  return 'Answer'
}

export function receiversFor(action: DemoAction): DemoPanel[] {
  if (action.type === 'add-course') return ['portal', 'learner']
  if (action.type === 'post-note') return ['learner']
  if (action.type === 'set-prompt') return ['learner']
  if (action.type === 'write') return ['teacher', 'portal', 'master']
  if (action.type === 'reply' || action.type === 'reply-latest') return ['learner', 'portal', 'master']
  return []
}

export function reduceDemo(state: DemoState, action: DemoAction): DemoState {
  if (action.type === 'reset') return seedDemo()
  if (action.type === 'add-course') {
    const title = clean(action.title)
    if (!title) return state
    const id = `course-${state.seq + 1}`
    return withNote(state, `{master} added a course: ${title}.`, {
      courses: [{ id, title }, ...state.courses],
    }, [id])
  }
  if (action.type === 'post-note') {
    const body = clean(action.body)
    if (!body) return state
    const id = `note-${state.seq + 1}`
    return withNote(state, `{admin} posted an announcement.`, {
      notes: [{ id, body }, ...state.notes],
    }, [id])
  }
  if (action.type === 'set-prompt') {
    const text = clean(action.text)
    if (!text) return state
    const id = `prompt-${state.seq + 1}`
    const why = action.kind === 'workbook' ? 'Has not written the workbook line yet' : 'Has not answered yet'
    const label = action.kind === 'workbook' ? 'a workbook prompt' : 'a question'
    return withNote(state, `{teacher} set ${label}.`, {
      prompts: [{ id, kind: action.kind, text, who: LEARNER }, ...state.prompts],
      opens: [{ id: `open-${id}`, learner: LEARNER, promptId: id, why }, ...state.opens],
    }, [id])
  }
  if (action.type === 'write') {
    const body = clean(action.body)
    if (!body) return state
    const prompt = action.kind === 'comment'
      ? null
      : state.prompts.find((row) => row.id === action.promptId) || newestOpenPrompt(state, action.kind)
    if (action.kind !== 'comment' && !prompt) return state
    const id = `item-${state.seq + 1}`
    const item: DemoQueueItem = {
      id,
      learner: LEARNER,
      kind: action.kind,
      prompt: prompt?.text || 'A comment',
      body,
      reply: '',
      done: false,
      promptId: prompt?.id,
    }
    const wrote = action.kind === 'comment' ? 'sent a comment' : action.kind === 'workbook' ? 'wrote a workbook line' : 'answered a question'
    return withNote(state, `{learner} ${wrote}.`, {
      queue: [item, ...state.queue],
      opens: prompt ? state.opens.filter((row) => !(row.learner === LEARNER && row.promptId === prompt.id)) : state.opens,
    }, [id])
  }
  if (action.type === 'reply' || action.type === 'reply-latest') {
    const body = clean(action.body)
    if (!body) return state
    const waiting = state.queue.find((row) => {
      if (row.done) return false
      if (action.type === 'reply') return row.id === action.id
      if (row.learner !== LEARNER) return false
      return action.kind ? row.kind === action.kind : true
    })
    if (!waiting) return state
    return withNote(state, `{teacher} wrote back to ${waiting.learner}.`, {
      queue: state.queue.map((row) => (row.id === waiting.id ? { ...row, reply: body, done: true } : row)),
    }, [waiting.id])
  }
  return state
}

export function playAll(state: DemoState = seedDemo()) {
  return LOOP_PLAY.reduce((current, step) => (step.action ? reduceDemo(current, step.action) : current), state)
}

export function loopStepPlays(id: string) {
  const index = LOOP_PLAY.findIndex((step) => step.id === id)
  const step = LOOP_PLAY[index]
  if (!step?.action) return index >= 0
  const before = LOOP_PLAY.slice(0, index).reduce((current, item) => (item.action ? reduceDemo(current, item.action) : current), seedDemo())
  return reduceDemo(before, step.action) !== before
}

export function stuckRows(state: DemoState) {
  const waiting = state.queue.filter((row) => !row.done).map((row) => ({
    id: `stuck-${row.id}`,
    name: row.learner,
    why: 'Waiting for a reply',
  }))
  const open = state.opens
    .filter((row) => !state.queue.some((item) => item.promptId === row.promptId && item.learner === row.learner))
    .map((row) => ({ id: row.id, name: row.learner, why: row.why }))
  return [...waiting, ...open]
}

export function loopCounts(state: DemoState) {
  const waiting = state.queue.filter((row) => !row.done).length
  const done = state.queue.filter((row) => row.done).length
  return {
    courses: state.courses.length,
    notes: state.notes.length,
    waiting,
    done,
    stuck: stuckRows(state).length,
  }
}

export function learnerPrompts(state: DemoState) {
  return state.prompts.filter((prompt) => prompt.who === '*' || prompt.who === LEARNER)
}

export function learnerThread(state: DemoState) {
  return state.queue.filter((row) => row.learner === LEARNER)
}

export function demoChannelMessage(state: DemoState) {
  return { channel: DEMO_CHANNEL, type: 'replace' as const, state }
}

export function readChannelMessage(current: DemoState, message: unknown): DemoState {
  if (!message || typeof message !== 'object') return current
  const row = message as { type?: string; state?: DemoState }
  if (row.type !== 'replace' || !row.state || !Array.isArray(row.state.courses) || !Array.isArray(row.state.queue)) return current
  return row.state
}
