'use client'

import { useSyncExternalStore } from 'react'
import { zoneCity, zonedTime } from '@/lib/zone-time'

function subscribe() {
  return () => {}
}

function viewerZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** UK date, viewer’s local clock, with a short zone label (e.g. 4 Oct 2026, 14:57 EDT). */
export function LocalWhen({ at }: { at: string }) {
  const text = useSyncExternalStore(subscribe, () => zonedTime(at, viewerZone(), 'en-GB'), () => '')
  return <time dateTime={at} data-testid="audit-when" data-at={at}>{text || '\u00a0'}</time>
}

export function LocalZoneNote() {
  const label = useSyncExternalStore(
    subscribe,
    () => `Times in ${zoneCity(viewerZone())} time`,
    () => 'Times in your local time',
  )
  return <p data-testid="audit-zone">{label}</p>
}
