import type { Payload } from 'payload'

export type EraseUserArgs = {
  actor: { id: number; role?: string | null; name?: string | null }
  userId: number
  confirmName: string
  portalId?: number | null
}

export type EraseUserResult = { ok: true; deleted?: Record<string, number> } | { ok: false; pending?: boolean; error: string }

/**
 * Single hook for A19. Calls `wipeUser()` from the delete-and-wipe erase registry when that
 * module is on this tree. Integrator: once `src/server/erase/` is merged, this import resolves
 * and the 14-day job wipes for real. Do not add a second wipe here.
 */
export async function eraseUser(payload: Payload, args: EraseUserArgs): Promise<EraseUserResult> {
  try {
    const spec = './erase'
    const mod = (await import(/* webpackIgnore: true */ spec)) as {
      wipeUser?: (
        payload: Payload,
        args: EraseUserArgs & { mode: 'account'; self: boolean },
      ) => Promise<{ ok?: boolean; error?: string; deleted?: Record<string, number> }>
    }
    if (typeof mod.wipeUser !== 'function') {
      return { ok: false, pending: true, error: 'INTEGRATOR: wire eraseUser() to wipeUser() from src/server/erase/.' }
    }
    const result = await mod.wipeUser(payload, { ...args, mode: 'account', self: true })
    if (result && result.ok === false) return { ok: false, error: result.error || 'The wipe was refused.' }
    return { ok: true, deleted: result?.deleted }
  } catch (error) {
    const missing = error instanceof Error && /Cannot find module|MODULE_NOT_FOUND/i.test(error.message)
    if (missing) {
      return { ok: false, pending: true, error: 'INTEGRATOR: src/server/erase/ is not on this branch. Call wipeUser() from eraseUser().' }
    }
    return { ok: false, error: error instanceof Error ? error.message : 'The wipe failed.' }
  }
}
