/** Mission progress and thank-you fan-out. Pure functions. */

export type MissionProgress = {
  joined: number
  target: number
  remaining: number
  pct: number
  reached: boolean
  line: string
}

export function missionProgress(joined: number, target: number): MissionProgress {
  const safeJoined = Math.max(0, Math.floor(Number(joined) || 0))
  const safeTarget = Math.max(0, Math.floor(Number(target) || 0))
  const remaining = Math.max(0, safeTarget - safeJoined)
  const pct = safeTarget ? Math.min(100, Math.round((safeJoined / safeTarget) * 100)) : 0
  const reached = safeTarget > 0 && safeJoined >= safeTarget
  const line = safeTarget
    ? `${safeJoined} of ${safeTarget} have joined`
    : `${safeJoined} ${safeJoined === 1 ? 'has' : 'have'} joined`
  return { joined: safeJoined, target: safeTarget, remaining, pct, reached, line }
}

export function weekMinutesFromSeconds(seconds: number) {
  return Math.max(0, Math.round((Number(seconds) || 0) / 60))
}

export function minutesTowardAsk(minutes: number, asked: number) {
  const have = Math.max(0, Math.round(Number(minutes) || 0))
  const want = Math.max(0, Math.round(Number(asked) || 0))
  return {
    minutes: have,
    asked: want,
    done: want > 0 && have >= want,
    pct: want ? Math.min(100, Math.round((have / want) * 100)) : have > 0 ? 100 : 0,
    line: want ? `${have} of ${want} minutes this week` : `${have} minute${have === 1 ? '' : 's'} this week`,
  }
}

export type Participant = { userId: number; portalId?: number | null }

export type ThankYouNote = {
  user: number
  portal?: number
  title: string
  body: string
  href: string
  key: string
  channel: 'in-app'
}

export function thankYouFanOut(
  participants: Participant[],
  input: { missionId: number; result: string; href: string },
): ThankYouNote[] {
  const result = String(input.result || '').trim()
  const body = result ? `You helped decide: ${result}` : 'You helped shape HEARTS. Thank you.'
  const href = input.href || '/'
  const seen = new Set<number>()
  const notes: ThankYouNote[] = []
  for (const person of participants) {
    const id = Number(person.userId)
    if (!id || seen.has(id)) continue
    seen.add(id)
    notes.push({
      user: id,
      portal: person.portalId || undefined,
      title: 'Thank you for helping shape HEARTS',
      body,
      href,
      key: `mission-thanks-${input.missionId}-${id}`,
      channel: 'in-app',
    })
  }
  return notes
}

export function shapedLine(result: string) {
  const text = String(result || '').trim()
  return text ? `You helped decide: ${text}` : 'You helped shape HEARTS. Thank you.'
}

export const MISSION_TONE =
  'Ask warmly. Never guilt-trip. Learners already give their time; a mission is a thank-you and an invitation, not a duty.'
