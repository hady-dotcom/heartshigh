import { platformClientIpHeader, trustedProxyHops } from '@/lib/rate-limit'

export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.HEARTS_BUILD === '1') return
  if (process.env.NODE_ENV !== 'production') return
  const { assertProductionEnv } = await import('@/lib/env')
  const { logError } = await import('@/lib/log')
  try {
    assertProductionEnv(process.env, { hops: trustedProxyHops(), platformHeader: platformClientIpHeader() })
  } catch (error) {
    logError('boot', error)
    throw error
  }
}

type RequestErrorContext = {
  routerKind: string
  routePath: string
  routeType: string
}

/** Next calls this when a request throws. The line goes to the host’s logs. Cookies and bodies are not included. */
export async function onRequestError(error: Error & { digest?: string }, request: { path: string; method: string }, context: RequestErrorContext) {
  const { logError } = await import('@/lib/log')
  logError('request', error, { path: request.path, method: request.method, router: context.routerKind, route: context.routePath, type: context.routeType, digest: error.digest })
}
