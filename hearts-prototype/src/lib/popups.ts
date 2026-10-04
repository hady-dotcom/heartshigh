// Pop-up questions over the player (spec 7A.11). Triggers are a small registry keyed by type, so a new kind of
// trigger (a chapter mark, a transcript phrase) can be added beside 'timestamp' without touching the players.

export type PopupPoint = {
  id: number
  number: number
  triggerType: 'timestamp'
  /** Source-video seconds, so the same question fires in a Hors, its Appetiser and the full lesson. */
  atSecond: number
  prompt: string
  kind: 'reflection' | 'question' | 'multiple_choice' | 'task'
  options: string[]
  state: 'open' | 'waiting' | 'countdown'
  unlocksAt: string | null
  contingentPrompt?: string
  timeLimitSec?: number | null
  answered: boolean
  myAnswer?: string
  lessonId: number
}

export type Tick = { prev: number; now: number; viewingId: string }

export type Trigger = {
  /** Points that should fire on this tick. `fired` holds the ids already shown in this viewing. */
  due(points: PopupPoint[], tick: Tick, fired: Set<number>): PopupPoint[]
}

/** Fires when prev < atSecond <= now + 0.3, which also catches a forward seek across an open question. */
export const timestampTrigger: Trigger = {
  due(points, tick, fired) {
    if (tick.now < tick.prev) return []
    return points
      .filter((point) => point.triggerType === 'timestamp' && !fired.has(point.id) && tick.prev < point.atSecond && point.atSecond <= tick.now + 0.3)
      .sort((a, b) => a.atSecond - b.atSecond || a.number - b.number)
  },
}

export const TRIGGERS: Record<PopupPoint['triggerType'], Trigger> = { timestamp: timestampTrigger }

export const POLL_MS = 250

/** Keeps the fired set per viewing. A new viewing id starts clean; replaying in the same viewing does not refire. */
export class PopupWatcher {
  private fired = new Set<number>()
  private viewing = ''
  private prev = -1

  constructor(private points: PopupPoint[]) {}

  setPoints(points: PopupPoint[]) {
    this.points = points
  }

  startViewing(viewingId: string, at: number) {
    if (viewingId !== this.viewing) this.fired = new Set()
    this.viewing = viewingId
    this.prev = at - 0.001
  }

  /** Call every POLL_MS while playing. Returns the points to show, in order. */
  tick(now: number): PopupPoint[] {
    const tick = { prev: this.prev, now, viewingId: this.viewing }
    this.prev = now
    const due: PopupPoint[] = []
    for (const trigger of Object.values(TRIGGERS)) due.push(...trigger.due(this.points, tick, this.fired))
    for (const point of due) this.fired.add(point.id)
    return due
  }

  /** A backward seek moves the window back without clearing what already fired. */
  seek(to: number) {
    this.prev = to - 0.001
  }
}

export function newViewingId() {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
