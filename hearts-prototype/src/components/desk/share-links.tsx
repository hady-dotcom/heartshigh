'use client'

import { CopyLink } from '@/components/app/copy-link'
import { HelpTip } from './help'
import { TOOL } from '@/lib/desk-help'

export function ShareLinks({ value, testId = 'copy-link' }: { value: string; testId?: string }) {
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(value)}`
  return (
    <div className="share-links">
      <CopyLink value={value} testId={testId} label="Copy" />
      <a className="btn ghost small" data-testid="share-whatsapp" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
      <HelpTip topic="copy-link">{TOOL.copyLink}</HelpTip>
    </div>
  )
}
