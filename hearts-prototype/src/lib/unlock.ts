export type Timing = 'immediate' | 'future'

export function delayToMs(amount: number, unit: string) {
  const value = Number(amount)
  if (!Number.isFinite(value) || value < 0) return 0
  const table: Record<string, number> = {
    second: 1000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 7 * 86_400_000,
  }
  return value * (table[unit] || table.day)
}

export function unlockState(args: {
  timing: Timing
  delayMs: number
  hasContingent: boolean
  contingentAnsweredAt: Date | null
  seenAt: Date | null
  at: Date
}): { state: 'open' | 'waiting' | 'countdown'; unlocksAt: Date | null } {
  if (args.timing !== 'future') return { state: 'open', unlocksAt: null }
  if (args.hasContingent && !args.contingentAnsweredAt) return { state: 'waiting', unlocksAt: null }
  const start = args.hasContingent ? args.contingentAnsweredAt : args.seenAt
  if (!start) return { state: 'waiting', unlocksAt: null }
  const unlocksAt = new Date(start.getTime() + args.delayMs)
  if (args.at.getTime() >= unlocksAt.getTime()) return { state: 'open', unlocksAt }
  return { state: 'countdown', unlocksAt }
}

export function formatCountdown(unlocksAt: Date, at: Date) {
  let remaining = Math.max(0, unlocksAt.getTime() - at.getTime())
  const days = Math.floor(remaining / 86_400_000)
  remaining -= days * 86_400_000
  const hours = Math.floor(remaining / 3_600_000)
  remaining -= hours * 3_600_000
  const minutes = Math.floor(remaining / 60_000)
  remaining -= minutes * 60_000
  const seconds = Math.floor(remaining / 1000)
  const parts = []
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`)
  parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  parts.push(`${minutes} min`)
  parts.push(`${seconds} sec`)
  return parts.join(' ')
}
