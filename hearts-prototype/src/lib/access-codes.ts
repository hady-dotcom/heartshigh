import { randomInt } from 'node:crypto'

export const JOIN_FAILS_PER_IP = 10
export const JOIN_FAILS_PER_CODE = 5
export const JOIN_WINDOW_MS = 10 * 60 * 1000

export type CodeState = {
  disabled?: boolean | null
  expiresAt?: string | null
  maxUses?: number | null
  uses?: number | null
}

/** Why a code cannot be used right now, or null when it can. One message for unknown and switched-off codes. */
export function codeRefusal(code: CodeState | undefined | null, at: Date): string | null {
  if (!code || code.disabled) return 'That access code was not recognised.'
  if (code.expiresAt && new Date(code.expiresAt).getTime() <= at.getTime()) return 'That access code has expired. Ask whoever gave it to you for a new one.'
  if (code.maxUses && (code.uses || 0) >= code.maxUses) return 'That access code has already been used. Ask whoever gave it to you for a new one.'
  return null
}

// No 0/O, 1/I/L, 5/S or 2/Z, so codes survive being read aloud or copied from paper.
const ALPHABET = 'ABCDEFGHJKMNPQRTUVWXY346789'

/** A code like ELM-7KQX-M4TD: 27^8, about 38 bits of randomness after the prefix. With the join rate limit that is far beyond guessing. */
export function randomCode(prefix: string) {
  const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
  const head = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return `${head ? `${head}-` : ''}${block()}-${block()}`
}
