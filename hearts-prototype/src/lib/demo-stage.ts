/**
 * In-browser demo stage. Seeded sample data only.
 * Nothing here opens a database, a session, or a real account.
 *
 * One loop joins the four people:
 * master adds a course, the portal posts a note, the teacher sets a prompt,
 * the learner writes back, the teacher replies, and the numbers move up.
 */

export const DEMO_CHANNEL = 'hearts-demo-stage'

/** Words on the door. Practice data only, so this page does not ask for a login. */
export const DEMO_ENTRY_TITLE = 'Hady Core Demo stage: a live four-screen walk-through (master, portal admin, teacher, learner). Practice data only; nothing you do here changes real portals.'
export const DEMO_ENTRY_START = 'Start the Demo stage'
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
export type DemoAlert = { id: string; to: DemoPanel; text: string }
export type DemoEvent = { id: string; kind: 'calendar' | 'gathering' | 'night'; title: string }
export type DemoLine = { id: string; text: string }
export type DemoSafety = { id: string; body: string; reply: string }

export type DemoState = {
  courses: DemoCourse[]
  packs: DemoLine[]
  notes: DemoNote[]
  prompts: DemoPrompt[]
  opens: DemoOpen[]
  queue: DemoQueueItem[]
  events: DemoEvent[]
  plans: DemoLine[]
  codes: DemoLine[]
  missions: DemoLine[]
  lanes: DemoLine[]
  scenes: DemoLine[]
  joining: DemoLine[]
  review: { id: string; text: string; approved: boolean }[]
  diary: DemoLine[]
  safety: DemoSafety[]
  compass: DemoLine[]
  liveTitle: string
  garden: boolean
  paused: boolean
  activity: DemoActivity[]
  alerts: DemoAlert[]
  ticker: DemoTicker[]
  fresh: string[]
  seq: number
}

export type DemoAction =
  | { type: 'reset' }
  | { type: 'add-course'; title: string; by?: 'master' | 'portal' }
  | { type: 'add-pack'; title: string }
  | { type: 'post-note'; body: string; by?: 'portal' | 'teacher' | 'master' }
  | { type: 'set-prompt'; kind: PromptKind; text: string; by?: 'teacher' | 'portal' | 'master' }
  | { type: 'add-event'; kind: DemoEvent['kind']; title: string }
  | { type: 'add-plan'; text: string }
  | { type: 'add-code'; text: string }
  | { type: 'add-mission'; text: string }
  | { type: 'add-lane'; text: string }
  | { type: 'set-scene'; text: string }
  | { type: 'add-joining'; text: string }
  | { type: 'approve-review' }
  | { type: 'start-live'; title: string }
  | { type: 'toggle-garden' }
  | { type: 'pause-learner' }
  | { type: 'add-diary'; text: string }
  | { type: 'add-safety'; text: string }
  | { type: 'answer-safety'; text: string }
  | { type: 'add-compass'; text: string }
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
    packs: [{ id: 'pack-seed', text: 'The first week' }],
    events: [
      { id: 'event-seed', kind: 'gathering', title: 'Thursday circle' },
      { id: 'night-seed', kind: 'night', title: 'Night of quiet' },
    ],
    plans: [{ id: 'plan-seed', text: 'One quiet hour after Maghrib' }],
    codes: [{ id: 'code-seed', text: 'NOOR-7K' }],
    missions: [{ id: 'mission-seed', text: 'Learn the names of the week' }],
    lanes: [{ id: 'lane-seed', text: 'The sitting' }],
    scenes: [{ id: 'scene-seed', text: 'Start with one still minute.' }],
    joining: [{ id: 'join-seed', text: 'What brought you here?' }],
    review: [{ id: 'rev-seed', text: 'Which name stayed with you?', approved: false }],
    diary: [{ id: 'diary-seed', text: 'I sat for ten minutes on Sunday.' }],
    safety: [{ id: 'safe-seed', body: 'I would like someone to check on me.', reply: '' }],
    compass: [{ id: 'compass-seed', text: 'Steady' }],
    liveTitle: '',
    garden: true,
    paused: false,
    activity: [
      { id: 'act-seed-1', text: 'Layla answered a question.' },
      { id: 'act-seed-2', text: 'Idris wrote a workbook line.' },
      { id: 'act-seed-3', text: 'Maryam sent a comment.' },
      { id: 'act-seed-4', text: '{teacher} wrote back to {learner}.' },
      { id: 'act-seed-5', text: 'Hamza has not answered yet.' },
    ],
    alerts: [
      { id: 'alert-seed', to: 'learner', text: 'You have a question waiting.' },
      { id: 'alert-seed-teacher', to: 'teacher', text: '3 notes are waiting for a reply.' },
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

function withNote(state: DemoState, text: string, patch: Partial<DemoState>, fresh: string[], to: DemoPanel[] = []): DemoState {
  const seq = state.seq + 1
  return {
    ...state,
    ...patch,
    seq,
    fresh,
    activity: [{ id: `act-${seq}`, text }, ...state.activity].slice(0, 24),
    alerts: [...to.map((panel, index) => ({ id: `alert-${seq}-${index}`, to: panel, text })), ...state.alerts].slice(0, 24),
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
  if (action.type === 'add-course' || action.type === 'add-pack') return ['portal', 'learner']
  if (action.type === 'post-note' || action.type === 'set-prompt') return ['learner']
  if (action.type === 'add-event' || action.type === 'add-plan' || action.type === 'add-code' || action.type === 'add-mission' || action.type === 'add-lane' || action.type === 'set-scene' || action.type === 'add-joining' || action.type === 'approve-review' || action.type === 'start-live' || action.type === 'toggle-garden' || action.type === 'pause-learner') return ['learner', 'portal', 'teacher', 'master']
  if (action.type === 'add-diary' || action.type === 'add-safety' || action.type === 'add-compass' || action.type === 'write') return ['teacher', 'portal', 'master']
  if (action.type === 'answer-safety' || action.type === 'reply' || action.type === 'reply-latest') return ['learner', 'portal', 'master']
  return []
}

export function reduceDemo(state: DemoState, action: DemoAction): DemoState {
  if (action.type === 'reset') return seedDemo()
  if (action.type === 'add-course') {
    const title = clean(action.title)
    if (!title) return state
    const id = `course-${state.seq + 1}`
    const who = action.by === 'portal' ? '{admin}' : '{master}'
    return withNote(state, `${who} added a course: ${title}.`, {
      courses: [{ id, title }, ...state.courses],
    }, [id], ['portal', 'learner'])
  }
  if (action.type === 'add-pack') {
    const title = clean(action.title)
    if (!title) return state
    const id = `pack-${state.seq + 1}`
    return withNote(state, `{master} added a course pack: ${title}.`, {
      packs: [{ id, text: title }, ...state.packs],
    }, [id], ['portal', 'learner'])
  }
  if (action.type === 'post-note') {
    const body = clean(action.body)
    if (!body) return state
    const id = `note-${state.seq + 1}`
    const who = action.by === 'teacher' ? '{teacher}' : action.by === 'master' ? '{master}' : '{admin}'
    return withNote(state, `${who} posted an announcement.`, {
      notes: [{ id, body }, ...state.notes],
    }, [id], ['learner'])
  }
  if (action.type === 'set-prompt') {
    const text = clean(action.text)
    if (!text) return state
    const id = `prompt-${state.seq + 1}`
    const why = action.kind === 'workbook' ? 'Has not written the workbook line yet' : 'Has not answered yet'
    const label = action.kind === 'workbook' ? 'a workbook prompt' : 'a question'
    const who = action.by === 'portal' ? '{admin}' : action.by === 'master' ? '{master}' : '{teacher}'
    return withNote(state, `${who} set ${label}.`, {
      prompts: [{ id, kind: action.kind, text, who: LEARNER }, ...state.prompts],
      opens: [{ id: `open-${id}`, learner: LEARNER, promptId: id, why }, ...state.opens],
    }, [id], ['learner'])
  }
  if (action.type === 'add-event') {
    const title = clean(action.title)
    if (!title) return state
    const id = `event-${state.seq + 1}`
    const label = action.kind === 'night' ? 'a night in person' : action.kind === 'gathering' ? 'a gathering' : 'an event'
    return withNote(state, `Added ${label}: ${title}.`, {
      events: [{ id, kind: action.kind, title }, ...state.events],
    }, [id], ['learner', 'teacher', 'portal'])
  }
  if (action.type === 'add-plan') {
    const text = clean(action.text)
    if (!text) return state
    const id = `plan-${state.seq + 1}`
    return withNote(state, `Added a study plan line.`, {
      plans: [{ id, text }, ...state.plans],
    }, [id], ['learner', 'teacher'])
  }
  if (action.type === 'add-code') {
    const text = clean(action.text)
    if (!text) return state
    const id = `code-${state.seq + 1}`
    return withNote(state, `Added a join code: ${text}.`, {
      codes: [{ id, text }, ...state.codes],
    }, [id], ['learner', 'portal', 'master'])
  }
  if (action.type === 'add-mission') {
    const text = clean(action.text)
    if (!text) return state
    const id = `mission-${state.seq + 1}`
    return withNote(state, `Added a mission: ${text}.`, {
      missions: [{ id, text }, ...state.missions],
    }, [id], ['learner'])
  }
  if (action.type === 'add-lane') {
    const text = clean(action.text)
    if (!text) return state
    const id = `lane-${state.seq + 1}`
    return withNote(state, `Named a lane: ${text}.`, {
      lanes: [{ id, text }, ...state.lanes],
    }, [id], ['learner'])
  }
  if (action.type === 'set-scene') {
    const text = clean(action.text)
    if (!text) return state
    const id = `scene-${state.seq + 1}`
    return withNote(state, `Set an opening line.`, {
      scenes: [{ id, text }, ...state.scenes],
    }, [id], ['learner'])
  }
  if (action.type === 'add-joining') {
    const text = clean(action.text)
    if (!text) return state
    const id = `joining-${state.seq + 1}`
    return withNote(state, `Added a joining question.`, {
      joining: [{ id, text }, ...state.joining],
    }, [id], ['learner'])
  }
  if (action.type === 'approve-review') {
    const waiting = state.review.find((row) => !row.approved)
    if (!waiting) return state
    const id = `prompt-${state.seq + 1}`
    return withNote(state, `{master} let a question through: ${waiting.text}`, {
      review: state.review.map((row) => (row.id === waiting.id ? { ...row, approved: true } : row)),
      prompts: [{ id, kind: 'question', text: waiting.text, who: LEARNER }, ...state.prompts],
      opens: [{ id: `open-${id}`, learner: LEARNER, promptId: id, why: 'Has not answered yet' }, ...state.opens],
    }, [id], ['learner', 'portal'])
  }
  if (action.type === 'start-live') {
    const title = clean(action.title)
    if (!title) return state
    return withNote(state, `Live is on: ${title}.`, { liveTitle: title }, ['live'], ['learner', 'teacher', 'master'])
  }
  if (action.type === 'toggle-garden') {
    return withNote(state, state.garden ? 'Garden path is off.' : 'Garden path is on.', { garden: !state.garden }, ['garden'], ['learner'])
  }
  if (action.type === 'pause-learner') {
    return withNote(state, state.paused ? '{learner} can come back in.' : '{learner} is paused.', { paused: !state.paused }, ['paused'], ['learner', 'portal'])
  }
  if (action.type === 'add-diary') {
    const text = clean(action.text)
    if (!text) return state
    const id = `diary-${state.seq + 1}`
    return withNote(state, `{learner} wrote in the diary.`, { diary: [{ id, text }, ...state.diary] }, [id], ['teacher', 'portal', 'master'])
  }
  if (action.type === 'add-safety') {
    const text = clean(action.text)
    if (!text) return state
    const id = `safe-${state.seq + 1}`
    return withNote(state, `{learner} asked for someone to look today.`, {
      safety: [{ id, body: text, reply: '' }, ...state.safety],
    }, [id], ['teacher', 'portal', 'master'])
  }
  if (action.type === 'answer-safety') {
    const text = clean(action.text)
    const open = state.safety.find((row) => !row.reply)
    if (!text || !open) return state
    return withNote(state, `Someone will look today.`, {
      safety: state.safety.map((row) => (row.id === open.id ? { ...row, reply: text } : row)),
    }, [open.id], ['learner'])
  }
  if (action.type === 'add-compass') {
    const text = clean(action.text)
    if (!text) return state
    const id = `compass-${state.seq + 1}`
    return withNote(state, `{learner} logged a feeling: ${text}.`, { compass: [{ id, text }, ...state.compass] }, [id], ['teacher', 'portal'])
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
    }, [id], ['teacher', 'portal', 'master'])
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
    }, [waiting.id], ['learner', 'portal', 'master'])
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

export function learnerVisible(state: DemoState) {
  return [
    ...state.courses.map((row) => row.title),
    ...state.packs.map((row) => row.text),
    ...state.notes.map((row) => row.body),
    ...learnerPrompts(state).map((row) => row.text),
    ...state.events.map((row) => row.title),
    ...state.plans.map((row) => row.text),
    ...state.codes.map((row) => row.text),
    ...state.missions.map((row) => row.text),
    ...state.lanes.map((row) => row.text),
    ...state.scenes.map((row) => row.text),
    ...state.joining.map((row) => row.text),
    ...state.diary.map((row) => row.text),
    ...state.compass.map((row) => row.text),
    ...state.safety.flatMap((row) => [row.body, row.reply]),
    state.liveTitle,
    state.garden ? 'Garden path is on' : '',
    state.paused ? 'Your place is paused' : '',
  ].filter(Boolean)
}

export type CoverageStatus = 'works' | 'shown' | 'na'
export type CoverageRole = 'master' | 'portal' | 'teacher'

export type CoverageRow = {
  role: CoverageRole
  group: string
  key: string
  nav: string
  creates: string
  down: string
  back: string
  status: CoverageStatus
  reason: string
  sample?: string
  check?: 'garden' | 'paused' | 'approve'
  make?: (text: string) => DemoAction
}

const course = (by: 'master' | 'portal') => (text: string): DemoAction => ({ type: 'add-course', title: text, by })
const note = (by: 'master' | 'portal' | 'teacher') => (text: string): DemoAction => ({ type: 'post-note', body: text, by })
const ask = (by: 'master' | 'portal' | 'teacher', kind: PromptKind = 'question') => (text: string): DemoAction => ({ type: 'set-prompt', kind, text, by })
const event = (kind: DemoEvent['kind']) => (text: string): DemoAction => ({ type: 'add-event', kind, title: text })

export const COVERAGE: CoverageRow[] = [
  { role: 'master', group: 'People', key: 'portals', nav: 'Portals', creates: 'Looks at this place', down: 'Nothing new is sent', back: 'Course, waiting, done and stuck numbers move when people write', status: 'shown', reason: 'This demo is one place. The page shows its live numbers.' },
  { role: 'master', group: 'People', key: 'learners', nav: 'Learners', creates: 'Pause a learner', down: 'The phone says the place is paused. The admin sees it too.', back: 'Stuck and waiting numbers stay on this page', status: 'works', reason: '', sample: 'paused', check: 'paused', make: () => ({ type: 'pause-learner' }) },
  { role: 'master', group: 'People', key: 'diaries', nav: 'Diaries', creates: 'Reads diary lines', down: 'Nothing new is sent', back: 'A line the learner writes on the phone shows here', status: 'shown', reason: 'The learner writes the diary. This page reads it.' },
  { role: 'master', group: 'People', key: 'codes', nav: 'Codes', creates: 'A join code', down: 'The admin and the phone show the code', back: 'The same code is listed for the admin', status: 'works', reason: '', sample: 'NOOR-NEW', make: (text) => ({ type: 'add-code', text }) },
  { role: 'master', group: 'People', key: 'safety', nav: 'Care and safety', creates: 'A reply that someone will look today', down: 'The phone shows that reply', back: 'The learner’s ask is already on this page', status: 'works', reason: '', sample: 'Someone will look today', make: (text) => ({ type: 'answer-safety', text }) },
  { role: 'master', group: 'People', key: 'announcements', nav: 'Announcements', creates: 'An announcement', down: 'The phone and the admin show it', back: 'Nothing comes back from an announcement', status: 'works', reason: '', sample: 'Master note for tonight', make: note('master') },
  { role: 'master', group: 'Teaching', key: 'library', nav: 'Library', creates: 'A course', down: 'The admin library and the phone show it', back: 'Answers to that course land in the queue and the numbers', status: 'works', reason: '', sample: 'Library course', make: course('master') },
  { role: 'master', group: 'Teaching', key: 'bring-in', nav: 'Bring in', creates: 'A film from outside', down: 'A real film would join the library', back: 'Nothing, until a film is actually brought in', status: 'shown', reason: 'Bringing in a film needs a real video, so the sample film is already on the shelf.' },
  { role: 'master', group: 'Teaching', key: 'packs', nav: 'Course packs', creates: 'A pack of courses', down: 'The admin library and the phone show the pack', back: 'Nothing extra until someone studies it', status: 'works', reason: '', sample: 'Pack of nights', make: (text) => ({ type: 'add-pack', title: text }) },
  { role: 'master', group: 'Teaching', key: 'plans', nav: 'Study plans', creates: 'A line on the study plan', down: 'The phone and the teacher show today’s line', back: 'Nothing until the learner writes about it', status: 'works', reason: '', sample: 'Read one page tonight', make: (text) => ({ type: 'add-plan', text }) },
  { role: 'master', group: 'Teaching', key: 'live', nav: 'Live recordings', creates: 'Watches live sessions', down: 'Nothing new is sent from here', back: 'When the admin or teacher goes live, this list shows the title', status: 'shown', reason: 'The master watches. Starting a session is on the admin and teacher desks.' },
  { role: 'master', group: 'Teaching', key: 'nights', nav: 'Live in person', creates: 'A night in person', down: 'The phone and the admin show the night', back: 'Nothing until someone writes about it', status: 'works', reason: '', sample: 'Friday night circle', make: event('night') },
  { role: 'master', group: 'Teaching', key: 'circle', nav: 'Circle answers', creates: 'Reads answers', down: 'Nothing new is sent', back: 'Answers the learner sends show in this list', status: 'shown', reason: 'Circle answers are what the learner already sent.' },
  { role: 'master', group: 'Teaching', key: 'missions', nav: 'Missions', creates: 'A mission', down: 'The phone shows the mission', back: 'Nothing until the learner writes about it', status: 'works', reason: '', sample: 'Learn one new name', make: (text) => ({ type: 'add-mission', text }) },
  { role: 'master', group: 'Teaching', key: 'opening', nav: 'Scenes', creates: 'An opening line', down: 'The phone shows the line', back: 'Nothing until the learner answers', status: 'works', reason: '', sample: 'Begin with the people beside you.', make: (text) => ({ type: 'set-scene', text }) },
  { role: 'master', group: 'Teaching', key: 'lanes', nav: 'Lanes', creates: 'A lane name', down: 'The phone shows the lane', back: 'Nothing until someone walks it', status: 'works', reason: '', sample: 'The night lane', make: (text) => ({ type: 'add-lane', text }) },
  { role: 'master', group: 'Look closer', key: 'insights', nav: 'Insights', creates: 'Reads what people did', down: 'Nothing new is sent', back: 'Activity and stuck numbers are the insight', status: 'shown', reason: 'Insights reads the same activity. It does not create a new thing.' },
  { role: 'master', group: 'Look closer', key: 'trends', nav: 'Network trends', creates: 'Compares many places', down: 'Nothing new is sent', back: 'This one place’s counts are shown', status: 'shown', reason: 'Network trends compare many places. This demo has one place, so the page shows its counts.' },
  { role: 'master', group: 'Look closer', key: 'simulator', nav: 'Simulator', creates: 'A preview of the phone', down: 'Nothing new is sent', back: 'The preview is the same phone', status: 'shown', reason: 'The simulator plays the same phone the learner panel already shows.' },
  { role: 'master', group: 'Look closer', key: 'personas', nav: 'Scales', creates: 'Words for a scale', down: 'Nothing new is sent', back: 'Feelings the learner logs show on Compass', status: 'shown', reason: 'Scales are words for staff. The learner already logs a feeling on the phone.' },
  { role: 'master', group: 'Look closer', key: 'experiments', nav: 'Experiments', creates: 'The garden path switch', down: 'The phone shows whether the garden path is on', back: 'Nothing comes back from a switch', status: 'works', reason: '', sample: 'garden', check: 'garden', make: () => ({ type: 'toggle-garden' }) },
  { role: 'master', group: 'Look closer', key: 'calendar', nav: 'Event Calendar', creates: 'An event', down: 'The phone and the admin calendar show it', back: 'Nothing until someone writes about it', status: 'works', reason: '', sample: 'Open evening', make: event('calendar') },
  { role: 'master', group: 'Look closer', key: 'review', nav: 'Review', creates: 'Lets a held question through', down: 'The phone shows the question', back: 'An answer then lands in the reply queue', status: 'works', reason: '', sample: 'Which name stayed with you?', check: 'approve', make: () => ({ type: 'approve-review' }) },
  { role: 'master', group: 'Look closer', key: 'tiers', nav: 'Talk tiers', creates: 'A group for talks', down: 'Nothing new is sent', back: 'The learner already sees the course', status: 'shown', reason: 'A tier groups talks. The learner already sees the course.' },
  { role: 'master', group: 'Look closer', key: 'questions', nav: 'Placing questions', creates: 'A question on a course', down: 'The phone shows the question', back: 'An answer lands in the reply queue and the numbers', status: 'works', reason: '', sample: 'Where did you pause?', make: ask('master') },
  { role: 'master', group: 'Look closer', key: 'ai', nav: 'AI steps', creates: 'An AI rewrite', down: 'Not sent in this demo', back: 'Not sent in this demo', status: 'na', reason: 'AI change buttons are left off this demo.' },
  { role: 'master', group: 'Look closer', key: 'framing', nav: 'Framing director', creates: 'How a clip is cropped', down: 'A real film would change shape on the phone', back: 'Nothing', status: 'shown', reason: 'Framing crops a film, and this demo has no film file to recrop.' },
  { role: 'master', group: 'Look closer', key: 'see-how', nav: 'See how', creates: 'A help clip for staff', down: 'Staff watch it. A learner does not receive it.', back: 'Nothing', status: 'na', reason: 'These are help clips for staff, not something a learner receives.' },
  { role: 'master', group: 'Look closer', key: 'sheet', nav: 'Master sheet', creates: 'A course from a sample row', down: 'The admin library and the phone show the course', back: 'Answers later land in the queue', status: 'works', reason: '', sample: 'Sheet course', make: course('master') },
  { role: 'master', group: 'Look closer', key: 'transcripts', nav: 'Transcripts', creates: 'The words of a film', down: 'A playing film would show the words', back: 'Nothing', status: 'shown', reason: 'A transcript is the words of a film, and this demo has no playing film.' },
  { role: 'master', group: 'Look closer', key: 'create', nav: 'Sheet creator', creates: 'An AI draft of a sheet', down: 'Not sent in this demo', back: 'Not sent in this demo', status: 'na', reason: 'The sheet creator asks an AI to draft a sheet, and AI buttons are left off this demo.' },

  { role: 'portal', group: 'People', key: 'overview', nav: 'Overview', creates: 'Reads the place', down: 'Nothing new is sent', back: 'Activity, who is stuck, and the numbers stay on this page', status: 'shown', reason: 'Overview reads who is here and what just happened.' },
  { role: 'portal', group: 'People', key: 'teach', nav: 'Learners', creates: 'Pause a learner', down: 'The phone says the place is paused', back: 'Who is stuck stays on this page', status: 'works', reason: '', sample: 'paused', check: 'paused', make: () => ({ type: 'pause-learner' }) },
  { role: 'portal', group: 'People', key: 'diaries', nav: 'Diaries', creates: 'Reads diary lines', down: 'Nothing new is sent', back: 'A line the learner writes shows here', status: 'shown', reason: 'The learner writes the diary. This page reads it.' },
  { role: 'portal', group: 'People', key: 'access', nav: 'Codes', creates: 'A join code', down: 'The phone and the master show the code', back: 'The same code is on the master desk', status: 'works', reason: '', sample: 'DOOR-4', make: (text) => ({ type: 'add-code', text }) },
  { role: 'portal', group: 'People', key: 'feedback', nav: 'Feedback', creates: 'A reply', down: 'The phone shows the reply and the note is marked done', back: 'The queue is the learner’s answers and comments', status: 'works', reason: '', sample: 'Yes, Friday.', make: () => ({ type: 'reply', id: 'wait-maryam', body: 'Yes, Friday.' }) },
  { role: 'portal', group: 'People', key: 'safety', nav: 'Care and safety', creates: 'A reply that someone will look today', down: 'The phone shows that reply', back: 'The learner’s ask shows here', status: 'works', reason: '', sample: 'We will sit with you today', make: (text) => ({ type: 'answer-safety', text }) },
  { role: 'portal', group: 'People', key: 'announcements', nav: 'Announcements', creates: 'An announcement', down: 'The phone shows it', back: 'Nothing comes back from an announcement', status: 'works', reason: '', sample: 'Bring water tonight', make: note('portal') },
  { role: 'portal', group: 'Teaching', key: 'library', nav: 'Library', creates: 'Offers a course from the shelf', down: 'The phone shows the course', back: 'Answers land in the queue and the numbers', status: 'works', reason: '', sample: 'Offered course', make: course('portal') },
  { role: 'portal', group: 'Teaching', key: 'content', nav: 'Content', creates: 'The place’s own course', down: 'The phone and the master library show it', back: 'Answers land in the queue and the numbers', status: 'works', reason: '', sample: 'Our own course', make: course('portal') },
  { role: 'portal', group: 'Teaching', key: 'bring-in', nav: 'Bring in', creates: 'A film from outside', down: 'A real film would join the library', back: 'Nothing, until a film is actually brought in', status: 'shown', reason: 'Bringing in a film needs a real video, so the sample film is already on the shelf.' },
  { role: 'portal', group: 'Teaching', key: 'plans', nav: 'Study plans', creates: 'A line on the study plan', down: 'The phone and the teacher show today’s line', back: 'Nothing until the learner writes about it', status: 'works', reason: '', sample: 'Sit for five minutes', make: (text) => ({ type: 'add-plan', text }) },
  { role: 'portal', group: 'Teaching', key: 'gather', nav: 'Gatherings', creates: 'A gathering', down: 'The phone and the teacher show it', back: 'Nothing until someone writes about it', status: 'works', reason: '', sample: 'Sisters’ circle', make: event('gathering') },
  { role: 'portal', group: 'Teaching', key: 'nights', nav: 'Live in person', creates: 'A night in person', down: 'The phone shows the night', back: 'Nothing until someone writes about it', status: 'works', reason: '', sample: 'Saturday night', make: event('night') },
  { role: 'portal', group: 'Teaching', key: 'live', nav: 'Live recordings', creates: 'A live session', down: 'The phone says it is live. The master and the teacher see the title.', back: 'Nothing until the session ends', status: 'works', reason: '', sample: 'Tonight’s circle', make: (text) => ({ type: 'start-live', title: text }) },
  { role: 'portal', group: 'Teaching', key: 'circle', nav: 'Circle answers', creates: 'Reads answers', down: 'Nothing new is sent', back: 'Answers the learner sends show here', status: 'shown', reason: 'Circle answers are what the learner already sent.' },
  { role: 'portal', group: 'Teaching', key: 'missions', nav: 'Missions', creates: 'A mission', down: 'The phone shows the mission', back: 'Nothing until the learner writes about it', status: 'works', reason: '', sample: 'Ask one good question', make: (text) => ({ type: 'add-mission', text }) },
  { role: 'portal', group: 'Look closer', key: 'insights', nav: 'Insights', creates: 'Reads what people did', down: 'Nothing new is sent', back: 'Activity and who is stuck are the insight', status: 'shown', reason: 'Insights reads the same activity. It does not create a new thing.' },
  { role: 'portal', group: 'Look closer', key: 'compass', nav: 'Compass', creates: 'Reads feelings', down: 'Nothing new is sent', back: 'A feeling the learner logs shows here', status: 'shown', reason: 'The learner logs the feeling. This page reads it.' },
  { role: 'portal', group: 'Look closer', key: 'experiments', nav: 'Experiments', creates: 'The garden path switch', down: 'The phone shows whether the garden path is on', back: 'Nothing comes back from a switch', status: 'works', reason: '', sample: 'garden', check: 'garden', make: () => ({ type: 'toggle-garden' }) },
  { role: 'portal', group: 'Look closer', key: 'calendar', nav: 'Event Calendar', creates: 'An event', down: 'The phone shows the event', back: 'Nothing until someone writes about it', status: 'works', reason: '', sample: 'Community breakfast', make: event('calendar') },
  { role: 'portal', group: 'Look closer', key: 'ai', nav: 'AI steps', creates: 'An AI rewrite', down: 'Not sent in this demo', back: 'Not sent in this demo', status: 'na', reason: 'AI change buttons are left off this demo.' },
  { role: 'portal', group: 'Look closer', key: 'opening', nav: 'Opening questions', creates: 'An opening question', down: 'The phone shows the question', back: 'An answer lands in the reply queue', status: 'works', reason: '', sample: 'What do you want from this week?', make: ask('portal') },
  { role: 'portal', group: 'Look closer', key: 'questions', nav: 'Joining questions', creates: 'A question asked at the door', down: 'The phone shows it next to the join code', back: 'An answer can be sent like any other question', status: 'works', reason: '', sample: 'Who invited you?', make: (text) => ({ type: 'add-joining', text }) },
  { role: 'portal', group: 'Look closer', key: 'sheet', nav: 'Master sheet', creates: 'Reads the sheet', down: 'Nothing new is sent from the portal copy', back: 'Courses the master adds from the sheet show in the library', status: 'shown', reason: 'The portal reads the sheet the master keeps.' },
  { role: 'portal', group: 'Look closer', key: 'create', nav: 'Sheet creator', creates: 'An AI draft of a sheet', down: 'Not sent in this demo', back: 'Not sent in this demo', status: 'na', reason: 'The sheet creator asks an AI to draft a sheet, and AI buttons are left off this demo.' },
  { role: 'portal', group: 'Look closer', key: 'settings', nav: 'Settings', creates: 'The garden path switch', down: 'The phone shows whether the garden path is on', back: 'The master numbers do not change for a switch', status: 'works', reason: '', sample: 'garden', check: 'garden', make: () => ({ type: 'toggle-garden' }) },

  { role: 'teacher', group: 'Teaching', key: 'overview', nav: 'Overview', creates: 'Reads the class', down: 'Nothing new is sent', back: 'Waiting and done counts stay on this page', status: 'shown', reason: 'Overview reads who is waiting. Setting a question is on Feedback.' },
  { role: 'teacher', group: 'Teaching', key: 'teach', nav: 'Learners', creates: 'Reads who is waiting', down: 'Nothing new is sent', back: 'Who is stuck, and the reply queue, stay in view', status: 'shown', reason: 'The teacher sees who is waiting. A pause is done by the admin.' },
  { role: 'teacher', group: 'Teaching', key: 'diaries', nav: 'Diaries', creates: 'Reads diary lines', down: 'Nothing new is sent', back: 'A line the learner writes shows here', status: 'shown', reason: 'The learner writes the diary. This page reads it.' },
  { role: 'teacher', group: 'Teaching', key: 'feedback', nav: 'Feedback', creates: 'A question, a workbook prompt, or a reply', down: 'The phone shows the question and, later, the reply', back: 'Answers, workbook lines and comments land in the reply queue', status: 'works', reason: '', sample: 'What will you keep?', make: ask('teacher') },
  { role: 'teacher', group: 'Teaching', key: 'compass', nav: 'Compass', creates: 'Reads feelings', down: 'Nothing new is sent', back: 'A feeling the learner logs shows here', status: 'shown', reason: 'The learner logs the feeling. This page reads it.' },
  { role: 'teacher', group: 'Teaching', key: 'plans', nav: 'Study plans', creates: 'A line on the study plan', down: 'The phone shows today’s line', back: 'Nothing until the learner writes about it', status: 'works', reason: '', sample: 'Write one line before sleep', make: (text) => ({ type: 'add-plan', text }) },
  { role: 'teacher', group: 'Teaching', key: 'gather', nav: 'Gatherings', creates: 'A gathering', down: 'The phone shows the gathering', back: 'Nothing until someone writes about it', status: 'works', reason: '', sample: 'Morning gathering', make: event('gathering') },
  { role: 'teacher', group: 'Teaching', key: 'nights', nav: 'Live in person', creates: 'A night in person', down: 'The phone shows the night', back: 'Nothing until someone writes about it', status: 'works', reason: '', sample: 'Teacher’s night', make: event('night') },
  { role: 'teacher', group: 'Teaching', key: 'live', nav: 'Live recordings', creates: 'A live session', down: 'The phone says it is live. The master sees the title.', back: 'Nothing until the session ends', status: 'works', reason: '', sample: 'Sami is live', make: (text) => ({ type: 'start-live', title: text }) },
  { role: 'teacher', group: 'Teaching', key: 'safety', nav: 'Care and safety', creates: 'Reads an ask for help', down: 'Nothing new is sent from this page', back: 'The learner’s ask shows here. A reply is sent from the admin or the master.', status: 'shown', reason: 'The teacher sees the ask. Telling them someone will look is on the admin and master desks.' },
  { role: 'teacher', group: 'Teaching', key: 'announcements', nav: 'Announcements', creates: 'An announcement', down: 'The phone shows it', back: 'Nothing comes back from an announcement', status: 'works', reason: '', sample: 'Bring your book', make: note('teacher') },
]

export function coverageWorks(row: CoverageRow) {
  if (row.status !== 'works' || !row.make) return false
  const before = seedDemo()
  const next = reduceDemo(before, row.make(row.sample || 'Sample line'))
  if (next === before) return false
  if (row.check === 'garden') return next.garden !== before.garden && learnerVisible(next).includes('Garden path is on') === next.garden
  if (row.check === 'paused') return next.paused && learnerVisible(next).includes('Your place is paused')
  if (row.check === 'approve') return next.review.some((item) => item.approved) && learnerPrompts(next).some((item) => item.text === 'Which name stayed with you?')
  return JSON.stringify(next).includes(row.sample || '___missing___')
}

/** Lines from the other desks, drawn on top of the real learner app. */
export function phoneToasts(state: DemoState): { id: string; text: string }[] {
  const rows: { id: string; text: string }[] = []
  const push = (id: string, text: string) => {
    if (!text || rows.some((row) => row.id === id)) return
    rows.push({ id, text })
  }
  const fresh = new Set(state.fresh)
  const lines = (list: { id: string; text: string }[]) => {
    for (const row of list) if (fresh.has(row.id)) push(row.id, row.text)
  }
  if (fresh.size) {
    for (const note of state.notes) if (fresh.has(note.id)) push(note.id, note.body)
    for (const event of state.events) if (fresh.has(event.id)) push(event.id, event.title)
    for (const course of state.courses) if (fresh.has(course.id)) push(course.id, course.title)
    for (const prompt of state.prompts) if (fresh.has(prompt.id)) push(prompt.id, prompt.text)
    lines(state.packs)
    lines(state.plans)
    lines(state.codes)
    lines(state.missions)
    lines(state.lanes)
    lines(state.scenes)
    lines(state.joining)
    for (const item of state.queue) if (fresh.has(item.id) && item.reply) push(`${item.id}-reply`, item.reply)
    for (const row of state.safety) if (fresh.has(row.id) && row.reply) push(row.id, row.reply)
    if (fresh.has('paused') && state.paused) push('paused', 'Your place is paused')
    if (fresh.has('garden')) push('garden', state.garden ? 'Garden path is on' : 'Garden path is off')
    if (fresh.has('live') && state.liveTitle) push('live', state.liveTitle)
  }
  if (!rows.length && state.notes[0]) push(state.notes[0].id, state.notes[0].body)
  return rows.slice(0, 3)
}

export function alertsFor(state: DemoState, panel: DemoPanel) {
  return state.alerts.filter((row) => row.to === panel)
}

export function coverageMarkdown() {
  const lines = [
    '| Nav item | What flows down | What comes back | Demo status |',
    '| --- | --- | --- | --- |',
  ]
  for (const row of COVERAGE) {
    const who = row.role === 'master' ? 'Master' : row.role === 'portal' ? 'Portal admin' : 'Teacher'
    const status = row.status === 'works' ? 'works' : row.status === 'shown' ? `shown — ${row.reason}` : `not applicable — ${row.reason}`
    lines.push(`| ${who} · ${row.nav} | ${row.down} | ${row.back} | ${status} |`)
  }
  return lines.join('\n')
}

export function readChannelMessage(current: DemoState, message: unknown): DemoState {
  if (!message || typeof message !== 'object') return current
  const row = message as { type?: string; state?: DemoState }
  if (row.type !== 'replace' || !row.state || !Array.isArray(row.state.courses) || !Array.isArray(row.state.queue)) return current
  return row.state
}
