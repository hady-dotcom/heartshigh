import type { Payload } from 'payload'
import { wipeUser } from './erase'

export type EraseUserArgs = {
  actor: { id: number; role?: string | null; name?: string | null }
  userId: number
  confirmName: string
  portalId?: number | null
}

export type EraseUserResult = { ok: true; deleted?: Record<string, number> } | { ok: false; pending?: boolean; error: string }

/**
 * Single account-wipe hook. Calls wipeUser once — do not add a second wipe path.
 */
export async function eraseUser(payload: Payload, args: EraseUserArgs): Promise<EraseUserResult> {
  try {
    const result = await wipeUser(payload, { ...args, mode: 'account', self: true })
    if (result && result.ok === false) return { ok: false, error: result.error || 'The wipe was refused.' }
    return { ok: true, deleted: 'deleted' in result ? result.deleted : undefined }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The wipe failed.' }
  }
}
