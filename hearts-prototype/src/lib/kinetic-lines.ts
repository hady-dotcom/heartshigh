/** Which hook, turn or land is being said, from the talk's own times. No paraphrase. */

export type KineticRole = 'hook' | 'turn' | 'land'

export type KineticLine = { role: KineticRole; text: string; at: number }

function at(value: number | null | undefined, fallback: number) {
  if (value == null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** Times are the saved caption points. Missing ones are laid across the appetiser. */
export function kineticLines(input: {
  hook: string
  turn: string
  land: string
  hookAt?: number | null
  turnAt?: number | null
  landAt?: number | null
  appetiserStart: number
  appetiserEnd: number
}): KineticLine[] {
  const start = at(input.appetiserStart, 0)
  const end = Math.max(start + 0.4, at(input.appetiserEnd, start + 12))
  const span = end - start
  const hookAt = at(input.hookAt, start)
  const landAt = at(input.landAt, start + span * 0.75)
  const turnAt = at(input.turnAt, (hookAt + landAt) / 2)
  return [
    { role: 'hook', text: input.hook, at: hookAt },
    { role: 'turn', text: input.turn, at: turnAt },
    { role: 'land', text: input.land, at: landAt },
  ]
}

/** The line whose audio has started, and no later line has. One at a time. */
export function activeRole(lines: { role: string; at: number }[], t: number) {
  const ordered = [...lines].sort((a, b) => a.at - b.at || 0)
  let active = ''
  for (const line of ordered) {
    if (t + 0.04 >= line.at) active = line.role
  }
  return active
}

export function kineticWindow(lines: KineticLine[], appetiserEnd: number) {
  const start = Math.min(...lines.map((line) => line.at))
  const last = Math.max(...lines.map((line) => line.at))
  const end = Math.max(last + 4, at(appetiserEnd, last + 4), start + 0.4)
  return { start, end: end > start ? end : start + 4 }
}

export function kineticClock(total: number) {
  const seconds = Math.max(0, Math.round(total))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
