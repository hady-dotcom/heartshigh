'use client'

import { useState } from 'react'
import { TopicHelp } from '@/components/app/page-help'
import { CARE_REPORT } from '@/lib/care-copy'
import { DEFAULT_HELP_CONTACTS } from '@/lib/opening-data'
import { REPORT_LABEL, type ReportReason, type TargetType } from '@/lib/safety'
import { Helplines } from '@/components/app/care'

export function ReportButton({
  targetType,
  targetId,
  next,
  quiet = false,
}: {
  targetType: TargetType
  targetId: number
  next: string
  /** A small grey link under one answer, for the white Hady Home sheet. */
  quiet?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={quiet ? 'report-under' : undefined} style={quiet ? undefined : { position: 'relative' }}>
      <button
        type="button"
        className={quiet ? 'report-link' : 'link-btn'}
        data-testid="report-open"
        data-target-type={targetType}
        data-target-id={String(targetId)}
        onClick={() => setOpen(true)}
        style={quiet ? undefined : { fontSize: 13, color: 'var(--hh-muted)' }}
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
  const [reason, setReason] = useState('')
  return (
    <div className="sheet-scrim" style={{ zIndex: 40 }} data-testid="report-sheet">
      <section className="sheet" role="dialog" aria-label="Report a concern" style={{ background: 'var(--hh-canvas)', color: 'var(--hh-ink)' }}>
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
            <legend style={{ fontWeight: 700, marginBottom: 8 }}>What is wrong?</legend>
            {(Object.keys(REPORT_LABEL) as ReportReason[]).map((key) => (
              <label key={key} className="choice" style={{ display: 'block', margin: '8px 0' }}>
                <input type="radio" name="reason" value={key} required data-testid={`report-reason-${key}`} onChange={() => setReason(key)} /> {REPORT_LABEL[key]}
              </label>
            ))}
          </fieldset>
          {reason === 'at-risk' ? <p className="care-note" data-testid="report-care">{CARE_REPORT}</p> : null}
          <label className="stack">
            A note, if you want
            <textarea name="note" rows={3} maxLength={500} placeholder="Only if it helps them understand" data-testid="report-note" />
          </label>
          <button className="share-btn" type="submit" data-testid="report-submit">Send to the team</button>
        </form>
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: '0 0 8px' }}>Need someone now? These lines answer any time.</p>
          <Helplines contacts={DEFAULT_HELP_CONTACTS} />
        </div>
      </section>
    </div>
  )
}
