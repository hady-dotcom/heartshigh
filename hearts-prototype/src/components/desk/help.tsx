'use client'

import { useId, useState, type ReactNode } from 'react'
import { SeeHowLink } from '@/components/see-how'
import { EXPERIMENT_HELP } from '@/lib/desk-help'
import styles from './help.module.css'

export { HelpTip, type HelpTipProps } from '@/components/help-tip'

export function DeskHelp({
  title = 'How to use this page',
  seeHowKey,
  children,
}: {
  title?: string
  /** Help key for the optional See how demo. Nothing is shown when that key has no video. */
  seeHowKey?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const heading = useId()
  return (
    <>
      <button type="button" className={styles.btn} aria-label={title} aria-expanded={open} data-testid="desk-page-help" onClick={() => setOpen(true)}>
        ?
      </button>
      {open ? (
        <div className={styles.back} data-testid="desk-page-help-dialog" onClick={() => setOpen(false)}>
          <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby={heading} onClick={(event) => event.stopPropagation()}>
            <h2 id={heading}>{title}</h2>
            <div className={styles.body}>{children}<SeeHowLink helpKey={seeHowKey} /></div>
            <button type="button" className="btn" data-testid="desk-help-close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function ExperimentHelp() {
  return (
    <DeskHelp seeHowKey="experiments-desk">
      {EXPERIMENT_HELP.map((line) => (
        <p key={line.body}>
          {line.title ? <b>{line.title}</b> : null}
          {line.title ? ' ' : null}
          {line.body}
        </p>
      ))}
    </DeskHelp>
  )
}
