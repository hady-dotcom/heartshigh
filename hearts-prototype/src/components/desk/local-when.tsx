'use client'

import { useEffect, useState } from 'react'
import { zoneCity, zonedTime } from '@/lib/zone-time'

function viewerZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** UK date, viewer’s local clock, with a short zone label (e.g. 4 Oct 2026, 14:57 EDT). */
export function LocalWhen({ at }: { at: string }) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!at) return
    setText(zonedTime(at, viewerZone(), 'en-GB'))
  }, [at])
  return <time dateTime={at} data-testid="audit-when" data-at={at} data-ready={text ? '1' : '0'}>{text || '\u00a0'}</time>
}

export function LocalZoneNote() {
  const [label, setLabel] = useState('Times in your local time')
  useEffect(() => {
    setLabel(`Times in ${zoneCity(viewerZone())} time`)
  }, [])
  return <p data-testid="audit-zone" data-ready={label.startsWith('Times in your local time') ? '0' : '1'}>{label}</p>
}
