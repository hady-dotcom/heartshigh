'use client'

import { useId, useState, type ReactNode } from 'react'
import styles from './help.module.css'

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
      <button type="button" className={styles.btn} aria-label={title} aria-expanded={open} data-testid="desk-help" onClick={() => setOpen(true)}>
        ?
      </button>
      {open ? (
        <div className={styles.back} data-testid="desk-help-dialog" onClick={() => setOpen(false)}>
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

export function InsightsHelp() {
  return (
    <DeskHelp>
      <p>Insights is our own look at how people move through HEARTS. Taps, scrolls and clip watches stay in our Postgres. We never store typed text or an answer.</p>
      <p><b>Heatmap</b> shows where people tap on a page, including on things that are not buttons.</p>
      <p><b>Angry taps</b> are three or more taps in the same spot within a second and a half. Open the route and see if something is stuck.</p>
      <p><b>Funnel</b> follows opening questions, the first clip, starting a course, and saving a study plan.</p>
      <p><b>Make this an experiment</b> takes you to the Experiments desk with the slot already chosen.</p>
    </DeskHelp>
  )
}

export function CalendarHelp() {
  return (
    <DeskHelp>
      <p>The calendar knows Friday (and Thursday evening), Ramadan and its last ten nights, the first ten days of Dhul Hijjah, the two Eids, Muharram and Ashura, plus seasons you add, such as exam season.</p>
      <p>The Hijri date uses a civil calendar. The offset of plus or minus one day is for moon sighting.</p>
      <p>A suggested line never reaches a learner until you approve it. A sheikh’s words, talk content, Qur’an and hadith stay as they are.</p>
      <p><b>Preview</b> shows the app as it would look on a date you pick.</p>
    </DeskHelp>
  )
}

export function MissionHelp() {
  return (
    <DeskHelp>
      <p>A mission is a warm ask, never a scolding. Learners already give their time; we thank them for helping shape HEARTS.</p>
      <p>Write a plain ask, why it matters, how many minutes, the dates, a target, and which portals. You can point them at an experiment or a screen.</p>
      <p>When you write <b>What we decided</b>, every person who joined gets a thank-you in the app. Email only goes out if mail is configured.</p>
      <p><b>Ask for help</b> is the in-app thread so nobody needs a support email.</p>
    </DeskHelp>
  )
}

export function DefaultDeskHelp() {
  return (
    <DeskHelp>
      <p>This is a desk page. Use the side list to move between everyday tasks, the middle work, and the in-depth tools.</p>
      <p>Nothing here changes a sheikh’s words, talk content, Qur’an or hadith.</p>
    </DeskHelp>
  )
}
