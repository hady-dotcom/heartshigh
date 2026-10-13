/** Answers a learner has offered to their teacher. A private answer stays hidden even if a share flag is also set. */

export function sharedWithTeacher(
  answer: { id?: number; keepPrivate?: unknown; shareWithTeacher?: unknown },
  consented?: ReadonlySet<number>,
) {
  if (answer.keepPrivate === true) return false
  if (answer.shareWithTeacher === true) return true
  return answer.id != null && Boolean(consented?.has(answer.id))
}

export function sharedAnswersNewestFirst<T extends { id?: number; keepPrivate?: unknown; shareWithTeacher?: unknown; createdAt?: string | null }>(
  answers: T[],
  consented?: ReadonlySet<number>,
) {
  return answers.filter((answer) => sharedWithTeacher(answer, consented)).sort((a, b) => {
    const byTime = String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    if (byTime) return byTime
    return (b.id || 0) - (a.id || 0)
  })
}

export function sharedAnswerText(answer: { body?: unknown; choice?: unknown; video?: unknown; audio?: unknown; image?: unknown }) {
  const body = typeof answer.body === 'string' ? answer.body.trim() : ''
  const choice = typeof answer.choice === 'string' ? answer.choice.trim() : ''
  if (body && choice && body !== choice) return `${body} ${choice}`
  if (body || choice) return body || choice
  if (answer.video || answer.audio) return 'A recording'
  if (answer.image) return 'A photo'
  return 'Shared answer'
}

export function teachSeenAt(map: unknown, portalId: number) {
  if (!map || typeof map !== 'object') return null
  const value = (map as Record<string, unknown>)[String(portalId)]
  return typeof value === 'string' && value ? value : null
}

export function withTeachSeen(map: unknown, portalId: number, at: string) {
  const current: Record<string, string> = {}
  if (map && typeof map === 'object') {
    for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
      if (typeof value === 'string') current[key] = value
    }
  }
  current[String(portalId)] = at
  return current
}

/** Answers with shareWithTeacher set, excluding anything kept private. Newer than seenAt when that visit exists. */
export function sharedAnswerWhere(portalId: number, seenAt: string | null) {
  const and: Record<string, unknown>[] = [
    { portal: { equals: portalId } },
    { shareWithTeacher: { equals: true } },
    { keepPrivate: { not_equals: true } },
  ]
  if (seenAt) and.push({ createdAt: { greater_than: seenAt } })
  return { and }
}
