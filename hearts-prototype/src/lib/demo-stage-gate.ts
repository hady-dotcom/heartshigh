/** Sign-in gate for /demo-stage. Practice data only. */

export const DEMO_STAGE_PATH = '/demo-stage'

export function isDemoStageNext(next: string | null | undefined) {
  const value = (next || '').trim()
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return false
  const path = value.split(/[?#]/)[0]
  return path === DEMO_STAGE_PATH
}

/** The demo-labelled master login, including when the return path is the stage. */
export function isDemoStageLogin(next: string | null | undefined, demo: string | null | undefined) {
  return demo === 'stage' || isDemoStageNext(next)
}

export function demoStageLoginHref() {
  return `/login?next=${encodeURIComponent(DEMO_STAGE_PATH)}&demo=stage`
}

/** A failed demo sign-in stays on the demo login. Every other sign-in stays on the ordinary one. */
export function loginFailurePath(next: string) {
  return isDemoStageNext(next) ? demoStageLoginHref() : '/login'
}
