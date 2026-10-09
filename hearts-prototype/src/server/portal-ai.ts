import type { Payload } from 'payload'
import { canSpendPortalAi, clientFromConnection, parseStored, type LlmClient, type StoredAiConnection } from '@/lib/portal-ai'

export async function storedForPortal(payload: Payload, portalId: number | null | undefined): Promise<StoredAiConnection | null> {
  if (!portalId) return null
  const doc = (await payload.findByID({ collection: 'portals', id: portalId, depth: 0, overrideAccess: true }).catch(() => null)) as { aiConnection?: unknown } | null
  return parseStored(doc?.aiConnection)
}

/**
 * A client for this portal's own account, or null.
 * A master (including view-as) and a learner never receive one, even when a key sits in the server environment.
 */
export async function clientForPortal(
  payload: Payload,
  portalId: number | null | undefined,
  role: string | null | undefined,
  realRole?: string | null,
): Promise<LlmClient | null> {
  if (realRole === 'master' || role === 'master' || role === 'learner') return null
  if (!canSpendPortalAi(role)) return null
  const stored = await storedForPortal(payload, portalId)
  return clientFromConnection(stored)
}
