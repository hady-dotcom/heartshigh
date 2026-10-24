'use client'

import { useEffect, useId } from 'react'

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

/** Invisible until Cloudflare’s script paints the widget into this box. */
export function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const id = useId().replace(/:/g, '')
  useEffect(() => {
    if (!siteKey || document.querySelector(`script[src="${SCRIPT}"]`)) return
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [siteKey])
  if (!siteKey) return null
  return <div id={`turnstile-${id}`} className="cf-turnstile" data-sitekey={siteKey} data-theme="light" data-testid="turnstile" />
}
