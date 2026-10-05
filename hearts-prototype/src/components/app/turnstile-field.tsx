import { turnstileEnabled, turnstileSiteKey } from '@/lib/turnstile'
import { TurnstileWidget } from './turnstile'

/** Renders nothing in local and e2e runs, where the keys are left unset. */
export function TurnstileField() {
  if (!turnstileEnabled()) return null
  return <TurnstileWidget siteKey={turnstileSiteKey()} />
}
