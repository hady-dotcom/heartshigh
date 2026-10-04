'use client'

import { useEffect, useMemo, useState } from 'react'
import { expose, sessionId } from './experiment-track'
import { fallbackPayload, formatSlotLabel, slotOf, type VariantView } from './experiment-slots'

export type { VariantView }

export type VariantMap = Record<string, VariantView>

function viewOf(slot: string, incoming?: Partial<VariantView> | null): VariantView {
  const fallback = fallbackPayload(slot)
  const payload = incoming?.payload && typeof incoming.payload === 'object' ? incoming.payload : fallback
  const label = typeof payload.label === 'string' ? payload.label : String(fallback.label || '')
  return {
    slot,
    experimentKey: incoming?.experimentKey || null,
    variantKey: incoming?.variantKey || null,
    payload,
    label,
    framing: typeof payload.framing === 'string' ? payload.framing : undefined,
    running: Boolean(incoming?.running && incoming.variantKey),
  }
}

/**
 * Returns the payload for a testable slot. Safe default when nothing is running
 * or the request fails. Logs one exposure per browser session per experiment.
 */
export function useVariant(slot: string, initial?: Partial<VariantView> | null, minutes?: number): VariantView {
  const [view, setView] = useState<VariantView>(() => viewOf(slot, initial))

  useEffect(() => {
    let cancelled = false
    const fallback = viewOf(slot, initial)
    setView(fallback)
    const spec = slotOf(slot)
    if (!spec) return
    void fetch(`/api/experiments?action=assign&slot=${encodeURIComponent(slot)}`, { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !body || body.error) return
        const next = viewOf(slot, body)
        setView(next)
        if (next.running) expose(slot, sessionId())
      })
      .catch(() => {
        if (!cancelled) setView(fallback)
      })
    return () => {
      cancelled = true
    }
  }, [slot, initial?.experimentKey, initial?.variantKey])

  return useMemo(() => {
    if (!minutes) return view
    return { ...view, label: formatSlotLabel(view.label, minutes) }
  }, [view, minutes])
}

export function variantLabel(slot: string, variants: VariantMap | null | undefined, minutes?: number) {
  const view = variants?.[slot] || viewOf(slot)
  return minutes ? formatSlotLabel(view.label, minutes) : view.label
}
