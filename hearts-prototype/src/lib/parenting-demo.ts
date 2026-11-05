import { SAMPLE_GAP_ANSWERS, SAMPLE_OPENING_ANSWERS, SAMPLE_PARENTS } from './sample-gap-data'

/**
 * Practice room for the Parenting course.
 * Films stay on the live course. Answers, notes and switches stay in this room.
 */

export const PARENTING_DEMO_CODE = 'PARENT-DEMO'
export const DEMO_PATH = '/demo'
export const DEMO_CHANNEL = 'hearts-parenting-demo'

export const DEMO_ROLES = ['master', 'portal', 'teacher', 'learner'] as const
export type DemoRole = (typeof DEMO_ROLES)[number]

export type ParentingCast = {
  master: string
  portalAdmin: string
  portalName: string
  teacher: string
  learner: string
}

export type DemoFeatures = {
  notes: boolean
  progress: boolean
  plan: boolean
  kinetic: boolean
  saved: boolean
}

export type DemoAnswer = {
  id: string
  learner: string
  film: string
  lessonId: number
  prompt: string
  body: string
  reply: string
  /** real rows are the sheet answers. sample rows fill questions the sheets do not cover. */
  source?: 'real' | 'sample'
  order?: number
  phaseLabel?: string
}

export type DemoNote = { id: string; body: string; from: string }

export type DemoWatch = {
  learner: string
  film: string
  lessonId: number
  seconds: number
  done: boolean
}

export type DemoPerson = {
  name: string
  role: 'learner' | 'teacher' | 'portal-admin'
  watched: number
  watching: string
}

export type DemoState = {
  features: DemoFeatures
  notes: DemoNote[]
  answers: DemoAnswer[]
  watches: DemoWatch[]
  people: DemoPerson[]
  seq: number
}

export type DemoAction =
  | { type: 'reset' }
  | { type: 'answer'; body: string; film: string; lessonId?: number; prompt: string }
  | { type: 'note'; body: string; from?: string }
  | { type: 'reply'; id: string; body: string }
  | { type: 'watch'; film: string; lessonId?: number; seconds?: number; done?: boolean }
  | { type: 'features'; features: DemoFeatures }

const FILM_1 = 'Home Learning Introduction 1: Why We Created This Course'
const FILM_2 = 'Home Learning Introduction 2: How To Use This Course'
const FILM_3 = 'Home Learning Introduction 3: Implementing Advice'
const FILM_4 = 'Home Learning Preparation 1: Introduction to Preparations'
const ASK_1 = 'How would you describe your experience of home learning so far?'

export function defaultParentingCast(): ParentingCast {
  return {
    master: 'Leon',
    portalAdmin: 'Rafiq Malik',
    portalName: 'Hady Home',
    teacher: 'Hannah Price',
    learner: 'Amina',
  }
}

export function isDemoRole(value: string | null | undefined): value is DemoRole {
  return Boolean(value && (DEMO_ROLES as readonly string[]).includes(value))
}

function cleanName(value: unknown, fallback: string) {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 48)
  return text || fallback
}

export function tidyParentingCast(input: Partial<ParentingCast> | null | undefined): ParentingCast {
  const base = defaultParentingCast()
  return {
    master: cleanName(input?.master, base.master),
    portalAdmin: cleanName(input?.portalAdmin, base.portalAdmin),
    portalName: cleanName(input?.portalName, base.portalName),
    teacher: cleanName(input?.teacher, base.teacher),
    learner: cleanName(input?.learner, base.learner),
  }
}

export function castReady(cast: ParentingCast) {
  return Boolean(cast.master.trim() && cast.portalAdmin.trim() && cast.portalName.trim() && cast.teacher.trim() && cast.learner.trim())
}

export function roleName(cast: ParentingCast, role: DemoRole) {
  if (role === 'master') return cast.master
  if (role === 'portal') return cast.portalAdmin
  if (role === 'teacher') return cast.teacher
  return cast.learner
}

export function roleLine(cast: ParentingCast, role: DemoRole) {
  if (role === 'master') return `${cast.master}, running the whole system`
  if (role === 'portal') return `${cast.portalAdmin}, looking after ${cast.portalName}`
  if (role === 'teacher') return `${cast.teacher}, guiding the learners`
  return `${cast.learner}, a learner at ${cast.portalName}`
}

export function seedParentingDemo(castInput?: Partial<ParentingCast>): DemoState {
  const cast = tidyParentingCast(castInput)
  const learner = cast.learner
  const classmates = ['Layla', 'Yusuf', 'Maryam'].filter((name) => name !== learner)
  const [first, second, third] = [...classmates, 'Idris', 'Hana', 'Noor']
  return {
    features: { notes: true, progress: true, plan: false, kinetic: true, saved: true },
    notes: [{ id: 'note-1', body: 'Start with the first film, then answer the question in your own words.', from: cast.teacher }],
    answers: [
      { id: 'ans-1', learner: first, film: FILM_1, lessonId: 0, prompt: ASK_1, body: 'It is busy, but a quiet hour after school helps.', reply: '' },
      { id: 'ans-2', learner: second, film: FILM_1, lessonId: 0, prompt: ASK_1, body: 'I want a clearer plan for the week.', reply: `${cast.teacher} will look at that plan with you.` },
      { id: 'ans-3', learner, film: FILM_2, lessonId: 0, prompt: 'What aspects of home learning would you like further guidance with?', body: 'How to keep the same time each day.', reply: '' },
      ...SAMPLE_OPENING_ANSWERS.map((row, index) => ({
        id: `open-${index + 1}`,
        learner: row.name,
        film: 'Opening questions',
        lessonId: 0,
        prompt: row.prompt,
        body: row.body,
        reply: '',
        source: 'sample' as const,
      })),
      ...SAMPLE_GAP_ANSWERS.map((row, index) => ({
        id: `gap-${index + 1}`,
        learner: row.name,
        film: row.film,
        lessonId: 0,
        prompt: row.prompt,
        body: row.body,
        reply: '',
        source: 'sample' as const,
        order: row.order,
        phaseLabel: 'Sample answer',
      })),
    ],
    watches: [
      { learner: first, film: FILM_1, lessonId: 0, seconds: 180, done: true },
      { learner: first, film: FILM_2, lessonId: 0, seconds: 90, done: true },
      { learner: first, film: FILM_3, lessonId: 0, seconds: 40, done: true },
      { learner: first, film: FILM_4, lessonId: 0, seconds: 20, done: false },
      { learner: second, film: FILM_1, lessonId: 0, seconds: 50, done: true },
      { learner: second, film: FILM_2, lessonId: 0, seconds: 15, done: false },
      { learner: third, film: FILM_1, lessonId: 0, seconds: 200, done: true },
      { learner, film: FILM_1, lessonId: 0, seconds: 120, done: true },
      { learner, film: FILM_2, lessonId: 0, seconds: 30, done: false },
    ],
    people: [
      { name: cast.portalAdmin, role: 'portal-admin', watched: 0, watching: '' },
      { name: cast.teacher, role: 'teacher', watched: 0, watching: '' },
      { name: learner, role: 'learner', watched: 1, watching: FILM_2 },
      { name: first, role: 'learner', watched: 3, watching: FILM_4 },
      { name: second, role: 'learner', watched: 1, watching: FILM_2 },
      { name: third, role: 'learner', watched: 1, watching: FILM_1 },
      ...SAMPLE_PARENTS.filter((name) => name !== learner).map((name, index) => ({
        name,
        role: 'learner' as const,
        watched: [2, 8, 15, 22, 40, 55, 70, 96][index] || 4,
        watching: '',
      })),
    ],
    seq: 4,
  }
}

function tidy(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function bump(state: DemoState, patch: Partial<DemoState>): DemoState {
  return { ...state, ...patch, seq: state.seq + 1 }
}

export function watchedCount(state: DemoState, learner: string) {
  return state.watches.filter((row) => row.learner === learner && row.done).length
}

export function learnerAnswers(state: DemoState, learner: string) {
  return state.answers.filter((row) => row.learner === learner)
}

export function reduceParentingDemo(state: DemoState, action: DemoAction, castInput?: Partial<ParentingCast>): DemoState {
  const cast = tidyParentingCast(castInput)
  if (action.type === 'reset') {
    const fresh = seedParentingDemo(cast)
    return { ...fresh, seq: state.seq + 1 }
  }
  if (action.type === 'note') {
    const body = tidy(action.body).slice(0, 400)
    if (!body) return state
    const id = `note-${state.seq + 1}`
    return bump(state, { notes: [{ id, body, from: action.from || cast.teacher }, ...state.notes].slice(0, 12) })
  }
  if (action.type === 'answer') {
    const body = tidy(action.body).slice(0, 600)
    const film = tidy(action.film).slice(0, 240)
    const prompt = tidy(action.prompt).slice(0, 400)
    if (!body || !film) return state
    const id = `ans-${state.seq + 1}`
    const lessonId = Number(action.lessonId) || 0
    const kept = state.answers.filter((row) => row.source !== 'real')
    const answers: DemoAnswer[] = [{ id, learner: cast.learner, film, lessonId, prompt: prompt || ASK_1, body, reply: '' }, ...kept].slice(0, 400)
    const people = state.people.map((person) => person.name === cast.learner ? { ...person, watching: film, watched: watchedCount({ ...state, watches: markDone(state.watches, cast.learner, film, lessonId) }, cast.learner) } : person)
    return bump(state, { answers, people, watches: markDone(state.watches, cast.learner, film, lessonId) })
  }
  if (action.type === 'reply') {
    const body = tidy(action.body).slice(0, 400)
    if (!body || !state.answers.some((row) => row.id === action.id)) return state
    return bump(state, { answers: state.answers.map((row) => row.id === action.id ? { ...row, reply: body } : row) })
  }
  if (action.type === 'watch') {
    const film = tidy(action.film).slice(0, 240)
    if (!film) return state
    const lessonId = Number(action.lessonId) || 0
    const already = state.watches[watchIndex(state.watches, cast.learner, film, lessonId)]
    const person = state.people.find((row) => row.name === cast.learner)
    if (already && person?.watching === film && (action.done !== true || already.done)) return state
    const watches = upsertWatch(state.watches, cast.learner, film, lessonId, Number(action.seconds) || 0, action.done === true)
    const people = state.people.map((row) => row.name === cast.learner ? { ...row, watching: film, watched: watchedCount({ ...state, watches }, cast.learner) } : row)
    return bump(state, { watches, people })
  }
  if (action.type === 'features') return bump(state, { features: { ...action.features } })
  return state
}

function markDone(watches: DemoWatch[], learner: string, film: string, lessonId: number) {
  return upsertWatch(watches, learner, film, lessonId, 0, true)
}

function watchIndex(watches: DemoWatch[], learner: string, film: string, lessonId: number) {
  const byFilm = film ? watches.findIndex((row) => row.learner === learner && row.film === film) : -1
  if (byFilm >= 0) return byFilm
  if (!lessonId) return -1
  return watches.findIndex((row) => row.learner === learner && row.lessonId === lessonId)
}

function upsertWatch(watches: DemoWatch[], learner: string, film: string, lessonId: number, seconds: number, done: boolean): DemoWatch[] {
  const index = watchIndex(watches, learner, film, lessonId)
  const next = { learner, film, lessonId: lessonId || watches[index]?.lessonId || 0, seconds, done: done || watches[index]?.done === true }
  if (index < 0) return [next, ...watches]
  return watches.map((row, at) => (at === index ? { ...row, ...next, done: row.done || done } : row))
}

export function featuresFromChecks(on: Iterable<string>, kinetic: boolean): DemoFeatures {
  const chosen = new Set(on)
  return {
    notes: chosen.has('announcements'),
    progress: chosen.has('garden'),
    plan: chosen.has('planner'),
    kinetic: kinetic,
    saved: chosen.has('workbook'),
  }
}

export function featureChecks(features: DemoFeatures) {
  return {
    announcements: features.notes,
    garden: features.progress,
    planner: features.plan,
    workbook: features.saved,
    kinetic: features.kinetic,
  }
}

export function demoFramePath(role: DemoRole, token: string) {
  const q = `demo=${encodeURIComponent(token)}&as=${role}`
  if (role === 'master') return `/master/parenting-demo?${q}`
  if (role === 'portal') return `/p/parenting/admin?${q}`
  if (role === 'teacher') return `/p/parenting/admin/teach?${q}`
  return `/p/parenting?${q}`
}

export function demoBoardPath(token: string, step?: string) {
  const params = new URLSearchParams({ room: token })
  if (step && step !== 'all' && isDemoRole(step)) params.set('step', step)
  return `${DEMO_PATH}?${params}`
}

export function withDemoQuery(href: string, token: string, role: DemoRole) {
  const hashAt = href.indexOf('#')
  const hash = hashAt >= 0 ? href.slice(hashAt) : ''
  const path = hashAt >= 0 ? href.slice(0, hashAt) : href
  const [base, search = ''] = path.split('?')
  const params = new URLSearchParams(search)
  params.set('demo', token)
  params.set('as', role)
  return `${base}?${params}${hash}`
}

/** A practice frame must not write the real course, except through its own save path. */
export function demoWriteBlocked(method: string, url: string, referer: string | null | undefined) {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false
  if (!demoMarked(url) && !demoMarked(referer || '')) return false
  try {
    return new URL(url, 'http://demo.local').pathname !== '/api/hearts/demo'
  } catch {
    return true
  }
}

const ROOM_TOKEN = /^[A-Za-z0-9_-]{20,80}$/

function demoMarked(value: string) {
  if (!value) return false
  try {
    return ROOM_TOKEN.test(new URL(value, 'http://demo.local').searchParams.get('demo') || '')
  } catch {
    const match = value.match(/[?&]demo=([^&]+)/)
    return Boolean(match && ROOM_TOKEN.test(decodeURIComponent(match[1])))
  }
}

export function safeDemoNext(value: string, fallback: string) {
  const text = value.trim()
  if (!text.startsWith('/') || text.startsWith('//') || text.startsWith('/\\')) return fallback
  return text
}

export function demoLooksFull(state: DemoState) {
  return state.people.filter((person) => person.role === 'learner').length >= 4 && state.answers.length >= 3 && state.notes.length >= 1 && state.watches.some((row) => row.done)
}

const PLAIN_BANNED = ['payload', 'toggle', 'sandbox', 'iframe', 'endpoint', 'token']

export function demoCopyPlain(text: string) {
  const lower = text.toLowerCase()
  return PLAIN_BANNED.every((word) => !lower.includes(word))
}
