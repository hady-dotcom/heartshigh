'use client'

import { useId, useState, type ReactNode } from 'react'
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
      <p>A test shows some learners one wording or layout and others another, then counts what they do. Learners are never told they are in a test.</p>
      <p><b>Start</b> turns a draft on. From then on, learners see one of the versions.</p>
      <p><b>Hold back</b> keeps a version from running. Use it when a suggested line is not ready.</p>
      <p><b>Make the winner the default</b> puts the winning words in place for everyone, once you are sure.</p>
      <p><b>Kill switch</b> stops every running test at once. Everyone sees the usual words again.</p>
      <p>A sheikh’s words are never tested. Talk content, Qur’an, hadith, and the meaning of a question stay as they are.</p>
    </DeskHelp>
  )
}
