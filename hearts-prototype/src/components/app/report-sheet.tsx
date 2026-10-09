'use client'

import { useState } from 'react'
import { TopicHelp } from '@/components/app/page-help'
import { REPORT_LABEL, type ReportReason, type TargetType } from '@/lib/safety'

export function ReportButton({
  targetType,
  targetId,
  next,
}: {
  targetType: TargetType
  targetId: number
  next: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="link-btn"
        data-testid="report-open"
        data-target-type={targetType}
        data-target-id={String(targetId)}
        onClick={() => setOpen(true)}
        style={{ fontSize: 13, color: '#E4D3A4' }}
      >
        Report a concern
      </button>
      {open ? <ReportSheet targetType={targetType} targetId={targetId} next={next} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

export function ReportSheet({
  targetType,
  targetId,
  next,
  onClose,
}: {
  targetType: TargetType
  targetId: number
  next: string
  onClose: () => void
}) {
  return (
    <div className="sheet-scrim" style={{ zIndex: 40 }} data-testid="report-sheet">
      <section className="sheet" role="dialog" aria-label="Report a concern" style={{ background: '#0E2A2B', color: '#E8F0EE' }}>
        <div className="handle" />
        <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>×</button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Report a concern
          <TopicHelp topic="report" />
        </h2>
        <p>Tell the portal team. They will look. The other person is not told your name.</p>
        <form action="/api/hearts" method="post">
          <input type="hidden" name="action" value="report" />
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={String(targetId)} />
          <input type="hidden" name="next" value={next} />
          <fieldset style={{ border: 0, padding: 0, margin: '12px 0' }}>
            <legend style={{ fontWeight: 700, marginBottom: 8 }}>What&apos;s wrong?</legend>
            {(Object.keys(REPORT_LABEL) as ReportReason[]).map((reason) => (
              <label key={reason} className="choice" style={{ display: 'block', margin: '8px 0' }}>
                <input type="radio" name="reason" value={reason} required data-testid={`report-reason-${reason}`} /> {REPORT_LABEL[reason]}
              </label>
            ))}
          </fieldset>
          <label className="stack">
            A note, if you want
            <textarea name="note" rows={3} maxLength={500} data-testid="report-note" />
          </label>
          <button className="share-btn" type="submit" data-testid="report-submit">Send</button>
        </form>
      </section>
    </div>
  )
}
