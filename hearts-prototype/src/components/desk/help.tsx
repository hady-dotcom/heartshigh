'use client'

import { useId, useState, type ReactNode } from 'react'
import { EXPERIMENT_HELP } from '@/lib/desk-help'
import styles from './help.module.css'

export { HelpTip, type HelpTipProps } from '@/components/help-tip'

export function DeskHelp({
  title = 'How to use this page',
  children,
}: {
  title?: string
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
            <div className={styles.body}>{children}</div>
            <button type="button" className="btn" data-testid="desk-help-close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function ExperimentHelp() {
  return (
    <DeskHelp>
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
