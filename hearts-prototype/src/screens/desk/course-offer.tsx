import Link from 'next/link'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { learnerCodeChoices } from '@/server/course-offer'

/** Shown when a course a portal just made is not on any learner code. */
export async function CourseOnCodes({
  payload,
  portalId,
  portalSlug,
  courseId,
  courseTitle,
  next,
  accessHref,
}: {
  payload: Payload
  portalId: number
  portalSlug: string
  courseId: number
  courseTitle: string
  next: string
  accessHref: string
}) {
  const choices = await learnerCodeChoices(payload, portalId, courseId)
  if (choices.some((choice) => choice.hasCourse)) return null
  return (
    <section className="panel" data-testid="course-on-codes" style={{ margin: '0 0 18px' }}>
      <header>
        <div>
          <h2>Learners cannot open this yet</h2>
          <p>{courseTitle} is not on a learner code. New people only see the courses on their code. People who already joined keep the list they had.</p>
        </div>
      </header>
      <div className="body" style={{ display: 'grid', gap: 16 }}>
        {choices.length ? (
          <form className="form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'offer-on-code', course: courseId, portalSlug, next }} />
            <label className="stack">Add it to a code
              <select name="code" data-testid="offer-code" required defaultValue={choices[0]?.id}>
                {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label} · {choice.packTitle}</option>)}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" name="giveJoined" value="yes" defaultChecked data-testid="offer-give-joined" /> Also give it to people who already joined with that code
            </label>
            <div className="actions"><button className="btn ink" type="submit" data-testid="offer-on-code">Add to this code</button></div>
          </form>
        ) : (
          <p>This portal has no learner code yet. <Link href={accessHref}>Make one on Access</Link>, then add the course.</p>
        )}
        <form action="/api/hearts" method="post">
          <Hidden fields={{ action: 'offer-joined', course: courseId, portalSlug, next }} />
          <p className="hint" style={{ marginTop: 0 }}>Or leave every code as it is, and give this course to people who have already joined.</p>
          <div className="actions"><button className="btn ghost" type="submit" data-testid="offer-joined">Give it to people who have joined</button></div>
        </form>
      </div>
    </section>
  )
}
