/** Progress, notes and a week plan for a signed-out visitor. They stay on this phone. */

export type GuestProgress = {
  lessonId: number
  courseId: number
  courseTitle: string
  title: string
  place: number
  seconds: number | null
  done: boolean
  at: string
}

export type GuestAnswer = {
  lessonId: number
  title: string
  body: string
  at: string
  pointId?: number
  shareWithTeacher?: boolean
  shareWithLearners?: boolean
}

export type GuestDeviceState = {
  progress: GuestProgress[]
  answers: GuestAnswer[]
  name: string
  weekdays: number[]
  offerDismissed: boolean
}

export const GUEST_DEVICE_KEY = 'hearts.guest.v1'

const EMPTY: GuestDeviceState = { progress: [], answers: [], name: '', weekdays: [], offerDismissed: false }

function store(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readGuestDevice(): GuestDeviceState {
  const box = store()
  if (!box) return { ...EMPTY }
  try {
    const raw = JSON.parse(box.getItem(GUEST_DEVICE_KEY) || 'null') as Partial<GuestDeviceState> | null
    if (!raw || typeof raw !== 'object') return { ...EMPTY }
    return {
      progress: Array.isArray(raw.progress) ? raw.progress.filter((row) => row && Number(row.lessonId) > 0) : [],
      answers: Array.isArray(raw.answers) ? raw.answers.filter((row) => row && Number(row.lessonId) > 0 && String(row.body || '').trim()) : [],
      name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : '',
      weekdays: Array.isArray(raw.weekdays) ? raw.weekdays.map(Number).filter((day) => day >= 0 && day <= 6) : [],
      offerDismissed: raw.offerDismissed === true,
    }
  } catch {
    return { ...EMPTY }
  }
}

function writeGuestDevice(state: GuestDeviceState) {
  const box = store()
  if (!box) return
  try {
    box.setItem(GUEST_DEVICE_KEY, JSON.stringify(state))
  } catch {
    // Private browsing: this visit still works.
  }
}

export function rememberGuestProgress(row: Omit<GuestProgress, 'at'> & { at?: string }) {
  const state = readGuestDevice()
  const next: GuestProgress = { ...row, at: row.at || new Date().toISOString() }
  state.progress = [next, ...state.progress.filter((item) => item.lessonId !== row.lessonId)].slice(0, 200)
  writeGuestDevice(state)
  return state
}

export function rememberGuestAnswer(row: Omit<GuestAnswer, 'at'> & { at?: string }) {
  const state = readGuestDevice()
  const body = row.body.trim()
  const same = (item: GuestAnswer) => (row.pointId ? item.pointId === row.pointId : !item.pointId && item.lessonId === row.lessonId)
  state.answers = body
    ? [{ ...row, body, at: row.at || new Date().toISOString() }, ...state.answers.filter((item) => !same(item))].slice(0, 200)
    : state.answers.filter((item) => !same(item))
  writeGuestDevice(state)
  return state
}

export function rememberGuestName(name: string) {
  const state = readGuestDevice()
  state.name = name.trim().slice(0, 80)
  writeGuestDevice(state)
  return state
}

export function rememberGuestWeekdays(weekdays: number[]) {
  const state = readGuestDevice()
  state.weekdays = [...new Set(weekdays.map(Number).filter((day) => day >= 0 && day <= 6))].sort()
  writeGuestDevice(state)
  return state
}

export function guestOfferDismissed() {
  return readGuestDevice().offerDismissed
}

export function dismissGuestOffer() {
  const state = readGuestDevice()
  state.offerDismissed = true
  writeGuestDevice(state)
}
