/**
 * In-browser demo stage. Seeded sample data only.
 * Nothing here opens a database, a session, or a real account.
 */

export const DEMO_CHANNEL = 'hearts-demo-stage'
export const DEMO_COURSE = 'A quiet hour'
export const DEMO_UNIT = 'The sitting'
export const DEMO_VIDEO = 'The quiet hour'
export const DEMO_THUMB = '/theme/evening-courtyard.jpg'
export const DEMO_QUESTION = 'Name three things you will carry from this sitting.'
export const DEMO_LATER = 'How has this changed your week?'
export const DEMO_ANSWER = 'I will keep one quiet hour this week.'
export const DEMO_REPLY = 'Keep that hour after Maghrib. I will look for it in your workbook.'
export const DEMO_ANNOUNCE = 'Circle meets after Maghrib tonight.'
export const DEMO_PAUSE_AT = 64
export const DEMO_VIDEO_SECONDS = 132
export const DEMO_LEARNER = 'Layla Khan'
export const DEMO_TEACHER = 'Yusuf Rahman'
export const DEMO_PORTAL_ADMIN = 'Nabil Hassan'
export const DEMO_PORTAL = 'HEARTS Demo'

export const DEMO_LIBRARY = [
  'Preparing for the circle',
  'A first night together',
  'The doors of the week',
] as const

export const DEMO_PANELS = ['master', 'portal', 'teacher', 'learner'] as const
export type DemoPanel = (typeof DEMO_PANELS)[number]

export type DemoVideo = {
  id: string
  title: string
  thumb: string
  seconds: number
}

export type DemoQuestion = {
  id: string
  videoId: string
  prompt: string
  at: number
  when: 'now' | 'later'
  contingentOn?: string
}

export type DemoAnswer = {
  id: string
  questionId: string
  body: string
  reply?: string
}

export type DemoTicker = {
  id: number
  slot: DemoPanel
  text: string
}

export type DemoState = {
  visibility: 'draft' | 'published'
  library: string[]
  videos: DemoVideo[]
  questions: DemoQuestion[]
  answers: DemoAnswer[]
  announcements: { id: string; body: string }[]
  features: { workbook: boolean; live: boolean }
  pausedAt: number | null
  ticker: DemoTicker[]
  seq: number
}

export type DemoAction =
  | { type: 'reset' }
  | { type: 'add-video' }
  | { type: 'pause'; at: number }
  | { type: 'add-question'; when: 'now' | 'later' }
  | { type: 'publish' }
  | { type: 'announce' }
  | { type: 'toggle'; feature: 'workbook' | 'live' }
  | { type: 'answer' }
  | { type: 'reply' }

export type DemoStep = {
  id: string
  say: string
  target: string
  panel: DemoPanel
  view: string
}

export type DemoScenario = {
  id: string
  title: string
  blurb: string
  steps: DemoStep[]
}

const VIEW_COMMANDS = new Set([
  'show-library',
  'show-imported',
  'open-content',
  'open-question',
  'open-home',
  'open-course',
  'open-player',
  'open-queue',
  'open-workbook',
  'open-announce',
  'open-features',
])

export function seedDemo(): DemoState {
  return {
    visibility: 'draft',
    library: [...DEMO_LIBRARY],
    videos: [],
    questions: [],
    answers: [],
    announcements: [],
    features: { workbook: true, live: false },
    pausedAt: null,
    ticker: [],
    seq: 0,
  }
}

function note(state: DemoState, slot: DemoPanel, text: string, patch: Partial<DemoState>): DemoState {
  const seq = state.seq + 1
  return {
    ...state,
    ...patch,
    seq,
    ticker: [{ id: seq, slot, text }, ...state.ticker].slice(0, 12),
  }
}

export function reduceDemo(state: DemoState, action: DemoAction): DemoState {
  if (action.type === 'reset') return seedDemo()
  if (action.type === 'add-video') {
    if (state.videos.some((video) => video.id === 'quiet')) return state
    return note(state, 'portal', `Video added: ${DEMO_VIDEO}`, {
      videos: [...state.videos, { id: 'quiet', title: DEMO_VIDEO, thumb: DEMO_THUMB, seconds: DEMO_VIDEO_SECONDS }],
    })
  }
  if (action.type === 'pause') {
    if (state.pausedAt === action.at) return state
    return { ...state, pausedAt: action.at }
  }
  if (action.type === 'add-question') {
    const video = state.videos[0]
    if (!video) return state
    if (action.when === 'now') {
      if (state.questions.some((question) => question.when === 'now')) return state
      const at = state.pausedAt ?? DEMO_PAUSE_AT
      return note(state, 'portal', `Question added at ${clock(at)}`, {
        questions: [...state.questions, { id: 'q-now', videoId: video.id, prompt: DEMO_QUESTION, at, when: 'now' }],
      })
    }
    const first = state.questions.find((question) => question.when === 'now')
    if (!first || state.questions.some((question) => question.when === 'later')) return state
    return note(state, 'portal', 'Question added for two weeks later', {
      questions: [
        ...state.questions,
        {
          id: 'q-later',
          videoId: video.id,
          prompt: DEMO_LATER,
          at: Math.min(video.seconds - 4, first.at + 58),
          when: 'later',
          contingentOn: first.id,
        },
      ],
    })
  }
  if (action.type === 'publish') {
    if (state.visibility === 'published') return state
    return note(state, 'portal', `Course published: ${DEMO_COURSE}`, { visibility: 'published' })
  }
  if (action.type === 'announce') {
    if (state.announcements.some((row) => row.body === DEMO_ANNOUNCE)) return state
    return note(state, 'portal', `Announcement posted: ${DEMO_ANNOUNCE}`, {
      announcements: [...state.announcements, { id: 'a-circle', body: DEMO_ANNOUNCE }],
    })
  }
  if (action.type === 'toggle') {
    return note(state, 'portal', 'Feature toggled', {
      features: { ...state.features, [action.feature]: !state.features[action.feature] },
    })
  }
  if (action.type === 'answer') {
    const question = state.questions.find((row) => row.when === 'now')
    if (!question || state.visibility !== 'published') return state
    if (state.answers.some((row) => row.questionId === question.id)) return state
    return note(state, 'learner', `Learner answered: ${DEMO_ANSWER}`, {
      answers: [...state.answers, { id: 'ans-1', questionId: question.id, body: DEMO_ANSWER }],
    })
  }
  if (action.type === 'reply') {
    const waiting = state.answers.find((row) => !row.reply)
    if (!waiting) return state
    return note(state, 'teacher', 'Teacher replied', {
      answers: state.answers.map((row) => (row.id === waiting.id ? { ...row, reply: DEMO_REPLY } : row)),
    })
  }
  return state
}

export function runDemoCommand(state: DemoState, id: string): DemoState {
  switch (id) {
    case 'add-video':
      return reduceDemo(state, { type: 'add-video' })
    case 'pause-moment':
      return reduceDemo(state, { type: 'pause', at: DEMO_PAUSE_AT })
    case 'save-question':
      return reduceDemo(state, { type: 'add-question', when: 'now' })
    case 'save-later':
      return reduceDemo(state, { type: 'add-question', when: 'later' })
    case 'publish':
      return reduceDemo(state, { type: 'publish' })
    case 'post-announce':
      return reduceDemo(state, { type: 'announce' })
    case 'toggle-live':
      return reduceDemo(state, { type: 'toggle', feature: 'live' })
    case 'toggle-workbook':
      return reduceDemo(state, { type: 'toggle', feature: 'workbook' })
    case 'send-answer':
      return reduceDemo(state, { type: 'answer' })
    case 'send-reply':
      return reduceDemo(state, { type: 'reply' })
    default:
      return state
  }
}

export function commandChangesState(id: string) {
  return !VIEW_COMMANDS.has(id) && id !== 'unknown'
}

export function isViewCommand(id: string) {
  return VIEW_COMMANDS.has(id)
}

export function ownStats(state: DemoState) {
  return {
    courses: 1,
    videos: state.videos.length,
    questions: state.questions.length,
    answers: state.answers.length,
    published: state.visibility === 'published' ? 1 : 0,
  }
}

export function learnerSeesCourse(state: DemoState) {
  return state.visibility === 'published'
}

export function teacherQueue(state: DemoState) {
  return state.answers.filter((row) => !row.reply)
}

export function workbookEntries(state: DemoState) {
  if (!state.features.workbook) return []
  return state.answers.map((row) => ({
    prompt: state.questions.find((question) => question.id === row.questionId)?.prompt || '',
    body: row.body,
    reply: row.reply || '',
  }))
}

export function glowFor(slot: DemoPanel): DemoPanel[] {
  return [slot]
}

export function clock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function demoChannelMessage(state: DemoState) {
  return { channel: DEMO_CHANNEL, type: 'replace' as const, state }
}

export function readChannelMessage(current: DemoState, message: unknown): DemoState {
  if (!message || typeof message !== 'object') return current
  const row = message as { type?: string; state?: DemoState }
  if (row.type !== 'replace' || !row.state || !Array.isArray(row.state.library)) return current
  return row.state
}

const PRELUDE: Record<string, DemoAction[]> = {
  library: [],
  hold: [],
  upload: [],
  question: [{ type: 'add-video' }],
  later: [{ type: 'add-video' }, { type: 'add-question', when: 'now' }],
  publish: [
    { type: 'add-video' },
    { type: 'add-question', when: 'now' },
    { type: 'add-question', when: 'later' },
  ],
  workbook: [
    { type: 'add-video' },
    { type: 'pause', at: DEMO_PAUSE_AT },
    { type: 'add-question', when: 'now' },
    { type: 'publish' },
  ],
  announce: [],
  feature: [],
}

export function stageFor(scenarioId: string): DemoState {
  const folded = (PRELUDE[scenarioId] || []).reduce(reduceDemo, seedDemo())
  return { ...folded, ticker: [], seq: 0 }
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'library',
    title: 'The library is already here',
    blurb: 'The master has already put the HEARTS courses on this portal. The school picks what people see.',
    steps: [
      { id: 'lib-1', say: 'Open the shared library on the master desk.', target: 'show-library', panel: 'master', view: 'portals' },
      { id: 'lib-2', say: 'On the portal, these stay read-only. Your own course is separate.', target: 'show-imported', panel: 'portal', view: 'overview' },
    ],
  },
  {
    id: 'hold',
    title: 'Hold the course until it is ready',
    blurb: 'Build it in private. Staff do not see a course while you are still making it.',
    steps: [
      { id: 'hold-1', say: 'Open the draft. A quiet hour is not published yet.', target: 'open-content', panel: 'portal', view: 'overview' },
      { id: 'hold-2', say: 'Look at the learner’s phone. The course is not there.', target: 'open-home', panel: 'learner', view: 'home' },
    ],
  },
  {
    id: 'upload',
    title: 'Upload a video',
    blurb: 'Drop in a film the way you would from the computer. This one uses a sample thumbnail.',
    steps: [
      { id: 'up-1', say: 'Open the sitting.', target: 'open-content', panel: 'portal', view: 'overview' },
      { id: 'up-2', say: 'Add the sample video. The thumbnail stands in for the upload.', target: 'add-video', panel: 'portal', view: 'content' },
    ],
  },
  {
    id: 'question',
    title: 'A question where you pause',
    blurb: 'Play the film, stop it, and the question sits on that moment.',
    steps: [
      { id: 'q-1', say: 'Open the film.', target: 'open-question', panel: 'portal', view: 'overview' },
      { id: 'q-2', say: 'Pause at 1:04. The timestamp fills in from the pause.', target: 'pause-moment', panel: 'portal', view: 'question' },
      { id: 'q-3', say: 'Save the question: name three things you will carry from this sitting.', target: 'save-question', panel: 'portal', view: 'question' },
    ],
  },
  {
    id: 'later',
    title: 'A question two weeks later',
    blurb: 'The second question waits, so you can show the training made a difference.',
    steps: [
      { id: 'later-1', say: 'Save the later question. It unlocks two weeks after the first answer.', target: 'save-later', panel: 'portal', view: 'question' },
    ],
  },
  {
    id: 'publish',
    title: 'Publish, and the phone shows it',
    blurb: 'When the course is ready, publish it. The learner’s phone gains it straight away.',
    steps: [
      { id: 'pub-1', say: 'Publish A quiet hour.', target: 'publish', panel: 'portal', view: 'content' },
      { id: 'pub-2', say: 'Open it on the phone.', target: 'open-course', panel: 'learner', view: 'home' },
    ],
  },
  {
    id: 'workbook',
    title: 'Follow the answer into the workbook',
    blurb: 'The learner answers, the teacher’s queue lights up, the reply lands in the workbook.',
    steps: [
      { id: 'wb-1', say: 'Open the film on the phone.', target: 'open-player', panel: 'learner', view: 'course' },
      { id: 'wb-2', say: 'Send the answer.', target: 'send-answer', panel: 'learner', view: 'player' },
      { id: 'wb-3', say: 'Open the teacher’s queue. The answer is waiting.', target: 'open-queue', panel: 'teacher', view: 'queue' },
      { id: 'wb-4', say: 'Reply.', target: 'send-reply', panel: 'teacher', view: 'queue' },
      { id: 'wb-5', say: 'Open the workbook on the phone.', target: 'open-workbook', panel: 'learner', view: 'player' },
    ],
  },
  {
    id: 'announce',
    title: 'Post an announcement',
    blurb: 'A note from the portal admin shows on the learner’s home.',
    steps: [
      { id: 'an-1', say: 'Open announcements.', target: 'open-announce', panel: 'portal', view: 'overview' },
      { id: 'an-2', say: 'Post the circle note.', target: 'post-announce', panel: 'portal', view: 'announce' },
      { id: 'an-3', say: 'Look at the phone home.', target: 'open-home', panel: 'learner', view: 'home' },
    ],
  },
  {
    id: 'feature',
    title: 'Switch a feature on',
    blurb: 'Go live is a portal switch. The phone follows it.',
    steps: [
      { id: 'ft-1', say: 'Open features.', target: 'open-features', panel: 'portal', view: 'overview' },
      { id: 'ft-2', say: 'Turn Go live on.', target: 'toggle-live', panel: 'portal', view: 'features' },
      { id: 'ft-3', say: 'The phone home shows the circle is live.', target: 'open-home', panel: 'learner', view: 'home' },
    ],
  },
]

export function scenarioById(id: string) {
  return DEMO_SCENARIOS.find((scenario) => scenario.id === id) || null
}

/** A click-through can run from its prelude without a dead button. */
export function scenarioPlays(id: string) {
  const scenario = scenarioById(id)
  if (!scenario) return false
  let state = stageFor(id)
  for (const step of scenario.steps) {
    if (!isViewCommand(step.target) && runDemoCommand(state, step.target) === state) return false
    state = runDemoCommand(state, step.target)
  }
  return true
}
