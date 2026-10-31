import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import { filmTitles, loadRealAnswers, phaseLabel } from '@/lib/parent-feedback'
import {
  PARENTING_DEMO_CODE,
  demoFramePath,
  featuresFromChecks,
  isDemoRole,
  reduceParentingDemo,
  safeDemoNext,
  seedParentingDemo,
  tidyParentingCast,
  type DemoAnswer,
  type DemoRole,
  type DemoState,
  type ParentingCast,
} from '@/lib/parenting-demo'
import type { SessionUser } from './context'

const TOKEN = /^[A-Za-z0-9_-]{20,80}$/

export type DemoRoom = { token: string; cast: ParentingCast; state: DemoState }

type RoomMap = Record<string, { cast?: ParentingCast; state?: DemoState }>

async function parentingPortal(payload: Payload) {
  const found = await payload.find({
    collection: 'portals',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { slug: { equals: 'parenting' } },
  })
  return found.docs[0]
}

function roomsOf(raw: unknown): RoomMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as RoomMap
}

function realDemoAnswers(): DemoAnswer[] {
  const titles = filmTitles()
  return loadRealAnswers().map((row, index) => ({
    id: `real-${row.videoOrder}-${row.calloutSecond}-${index}`,
    learner: phaseLabel(row.phase),
    film: titles.get(row.videoOrder) || `Film ${row.videoOrder}`,
    lessonId: 0,
    prompt: row.question,
    body: row.text,
    reply: '',
    source: 'real' as const,
    order: row.videoOrder,
    phaseLabel: phaseLabel(row.phase),
  }))
}

function withRealAnswers(state: DemoState): DemoState {
  const own = state.answers.filter((row) => row.source !== 'real')
  return { ...state, answers: [...own, ...realDemoAnswers()] }
}

function withoutRealAnswers(state: DemoState): DemoState {
  return { ...state, answers: state.answers.filter((row) => row.source !== 'real') }
}

function readRoom(token: string, row: { cast?: ParentingCast; state?: DemoState } | undefined): DemoRoom | null {
  if (!TOKEN.test(token) || !row?.state || !Array.isArray(row.state.answers) || !Array.isArray(row.state.people) || !row.state.features) return null
  return { token, cast: tidyParentingCast(row.cast), state: withRealAnswers(row.state) }
}

async function writeRooms(payload: Payload, id: number, rooms: RoomMap) {
  const entries = Object.entries(rooms).slice(-24)
  await payload.update({
    collection: 'portals',
    id,
    overrideAccess: true,
    data: { demoRooms: Object.fromEntries(entries) },
  })
}

export async function loadDemoRoom(payload: Payload, token: string): Promise<DemoRoom | null> {
  if (!TOKEN.test(token)) return null
  const portal = await parentingPortal(payload)
  if (!portal) return null
  return readRoom(token, roomsOf(portal.demoRooms)[token])
}

export async function openDemoRoom(payload: Payload, castInput: Partial<ParentingCast>): Promise<DemoRoom> {
  const portal = await parentingPortal(payload)
  if (!portal) throw new Error('The Parenting course is not here.')
  const cast = tidyParentingCast(castInput)
  const state = seedParentingDemo(cast)
  const token = randomBytes(18).toString('base64url')
  const rooms = roomsOf(portal.demoRooms)
  rooms[token] = { cast, state: withoutRealAnswers(state) }
  await writeRooms(payload, portal.id, rooms)
  return { token, cast, state: withRealAnswers(state) }
}

export async function saveDemoRoom(payload: Payload, room: DemoRoom) {
  if (!TOKEN.test(room.token)) return
  const portal = await parentingPortal(payload)
  if (!portal) return
  const rooms = roomsOf(portal.demoRooms)
  if (!rooms[room.token]) return
  rooms[room.token] = { cast: room.cast, state: withoutRealAnswers(room.state) }
  await writeRooms(payload, portal.id, rooms)
}

/**
 * A join code that always opens the Parenting course.
 * It does not create a person. Safe to run on a live boot.
 */
export async function ensureParentingDemoCode(payload: Payload, portalId: number, courseId: number | number[], packId: number) {
  const found = await payload.find({
    collection: 'access-codes',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { code: { equals: PARENTING_DEMO_CODE } },
  })
  const courseIds = (Array.isArray(courseId) ? courseId : [courseId]).filter((id) => Number.isFinite(id) && id > 0)
  const data = {
    code: PARENTING_DEMO_CODE,
    label: 'Parenting demo',
    role: 'learner' as const,
    portal: portalId,
    packs: [packId],
    courses: courseIds,
    disabled: false,
    maxUses: null,
    expiresAt: null,
  }
  if (found.docs[0]) {
    await payload.update({
      collection: 'access-codes',
      id: found.docs[0].id,
      overrideAccess: true,
      data,
    })
    return found.docs[0]
  }
  return payload.create({ collection: 'access-codes', overrideAccess: true, data: { ...data, uses: 0 } })
}

export function demoUser(role: DemoRole, cast: ParentingCast, portalId: number): SessionUser {
  const name = role === 'master' ? cast.master : role === 'portal' ? cast.portalAdmin : role === 'teacher' ? cast.teacher : cast.learner
  const appRole = role === 'portal' ? 'portal-admin' : role === 'teacher' ? 'teacher' : role === 'master' ? 'master' : 'learner'
  return {
    id: role === 'master' ? -1 : role === 'portal' ? -2 : role === 'teacher' ? -3 : -4,
    email: `${role}@parenting-demo.invalid`,
    name,
    role: appRole,
    tenants: [{ tenant: portalId }],
    onboarded: true,
    seenWelcome: true,
    courseList: [],
    keepPlace: true,
  }
}

export function portalWithDemoFeatures<T extends { features?: unknown; kineticOn?: boolean | null }>(portal: T, state: DemoState): T {
  return {
    ...portal,
    kineticOn: state.features.kinetic,
    features: {
      announcements: state.features.notes,
      garden: state.features.progress,
      planner: state.features.plan,
      workbook: state.features.saved,
      feedback: true,
    },
  }
}

export function applyDemoForm(room: DemoRoom, action: string, form: FormData) {
  const text = (name: string) => String(form.get(name) || '')
  if (action === 'reset') return reduceParentingDemo(room.state, { type: 'reset' }, room.cast)
  if (action === 'answer') {
    return reduceParentingDemo(room.state, {
      type: 'answer',
      body: text('body'),
      film: text('film'),
      lessonId: Number(text('lessonId')) || 0,
      prompt: text('prompt'),
    }, room.cast)
  }
  if (action === 'note' || action === 'announce' || action === 'announce-create') {
    return reduceParentingDemo(room.state, { type: 'note', body: text('body'), from: text('from') }, room.cast)
  }
  if (action === 'reply') return reduceParentingDemo(room.state, { type: 'reply', id: text('id'), body: text('body') }, room.cast)
  if (action === 'watch') {
    return reduceParentingDemo(room.state, {
      type: 'watch',
      film: text('film'),
      lessonId: Number(text('lessonId')) || 0,
      seconds: Number(text('seconds')) || 0,
      done: text('done') === 'yes',
    }, room.cast)
  }
  if (action === 'sequence-features' || action === 'demo-features') {
    return reduceParentingDemo(room.state, {
      type: 'features',
      features: featuresFromChecks(form.getAll('feature').map(String), form.get('kinetic') === 'on'),
    }, room.cast)
  }
  return room.state
}

export function demoRedirect(action: string, step: string, token: string, next: string) {
  if (action === 'open') {
    if (isDemoRole(step)) return demoFramePath(step, token)
    return `/demo?room=${encodeURIComponent(token)}`
  }
  return safeDemoNext(next, demoFramePath('learner', token))
}
