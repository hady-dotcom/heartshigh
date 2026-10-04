import Link from 'next/link'
import type { Payload } from 'payload'
import type { ReactNode } from 'react'
import { Hidden } from '@/components/app/shell'
import { CIRCLE_LENGTHS, CIRCLE_MAX_COUNT, CIRCLE_TONES, LENGTH_LABELS, TONE_LABELS, circleShown } from '@/lib/circle'
import { idOf, portalIdOf } from '@/lib/ids'
import { circleScope, circleSettings, pointsInScope } from '@/server/circle'
import type { SessionUser } from '@/server/context'
import { partTitle } from '@/lib/talk-title'
import { type Ctx, type Row, clock, rows, str } from '../common'
import { AdminFrame } from './overview'
import { DeskFrame, masterNav } from './shell'

type CircleCtx = { payload: Payload; user: SessionUser; query: Record<string, string | undefined>; here: string; portalId: number | null }

const KIND: Record<string, string> = { reflection: 'Reflection', question: 'Question', multiple_choice: 'Multiple choice', task: 'Task' }
const INTRO =
  'Answers from the HEARTS circle sit in a question’s “What others said” beside real learners’ shared answers, so nobody meets an empty list. They carry a light label, show less often as real answers arrive, and are never counted in analytics, trends, profiles or progress.'

async function talksInScope(ctx: CircleCtx) {
  const { payload, user } = ctx
  let lessons: Row[]
  if (user.role === 'master') {
    const points = await rows(payload, 'engagement-points', { status: { not_equals: 'rejected' } }, { limit: 5000 })
    const ids = [...new Set(points.map((point) => idOf(point.lesson)).filter((id): id is number => Boolean(id)))]
    lessons = ids.length ? await rows(payload, 'lessons', { id: { in: ids } }, { limit: 1000 }) : []
  } else {
    const courses = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portalIdOf(user) } }] }, { limit: 500 })
    lessons = courses.length ? await rows(payload, 'lessons', { course: { in: courses.map((course) => course.id) } }, { limit: 1000 }) : []
  }
  const courseIds = [...new Set(lessons.map((lesson) => idOf(lesson.course)).filter((id): id is number => Boolean(id)))]
  const [courses, points, circle] = await Promise.all([
    courseIds.length ? rows(payload, 'courses', { id: { in: courseIds } }, { limit: 1000 }) : Promise.resolve([]),
    lessons.length ? rows(payload, 'engagement-points', { and: [{ lesson: { in: lessons.map((lesson) => lesson.id) } }, { status: { not_equals: 'rejected' } }] }, { limit: 5000, depth: 1 }) : Promise.resolve([]),
    lessons.length ? rows(payload, 'circle-answers', { lesson: { in: lessons.map((lesson) => lesson.id) } }, { limit: 20000 }) : Promise.resolve([]),
  ])
  const visible = pointsInScope(points, user)
  return lessons
    .map((lesson) => {
      const own = circle.filter((row) => idOf(row.lesson) === lesson.id && (user.role === 'master' || !idOf(row.portal) || idOf(row.portal) === ctx.portalId))
      return {
        lesson,
        course: courses.find((course) => course.id === idOf(lesson.course)),
        questions: visible.filter((point) => idOf(point.lesson) === lesson.id).length,
        on: own.filter((row) => row.enabled !== false).length,
        all: own.length,
      }
    })
    .filter((row) => row.questions > 0)
    .sort((a, b) => str(a.course?.title).localeCompare(str(b.course?.title)) || Number(a.lesson.order || 0) - Number(b.lesson.order || 0))
}

function GenerateFields({ count = 6 }: { count?: number }) {
  return (
    <>
      <label className="stack circle-count">How many<input type="number" name="count" min={1} max={CIRCLE_MAX_COUNT} defaultValue={count} data-testid="circle-count" /></label>
      <fieldset className="circle-spread">
        <legend>Tones</legend>
        {CIRCLE_TONES.map((tone) => <label key={tone} className="check"><input type="checkbox" name="tone" value={tone} defaultChecked data-testid={`circle-tone-${tone}`} /> {TONE_LABELS[tone]}</label>)}
      </fieldset>
      <fieldset className="circle-spread">
        <legend>Lengths</legend>
        {CIRCLE_LENGTHS.map((length) => <label key={length} className="check"><input type="checkbox" name="length" value={length} defaultChecked /> {LENGTH_LABELS[length]}</label>)}
      </fieldset>
    </>
  )
}

function Bulk({ lesson, scope, enabled, here, label }: { lesson: number; scope: 'talk' | 'course'; enabled: boolean; here: string; label: string }) {
  return (
    <form action="/api/hearts" method="post">
      <Hidden fields={{ action: 'circle-bulk', lesson, scope, enabled: enabled ? 'on' : 'off', next: here }} />
      <button className={`btn small ${enabled ? 'teal' : 'ghost'}`} type="submit" data-testid={`circle-bulk-${scope}-${enabled ? 'on' : 'off'}`}>{label}</button>
    </form>
  )
}

async function Index(ctx: CircleCtx) {
  const talks = await talksInScope(ctx)
  return (
    <section className="panel" data-testid="circle-index">
      <header className="light"><h2>Talks with questions ({talks.length})</h2><span className="hint">Open a talk to draft, write, edit or switch off its circle answers</span></header>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Course</th><th>Talk</th><th className="num">Questions</th><th className="num">Circle answers on</th><th /></tr></thead>
          <tbody>
            {talks.map(({ lesson, course, questions, on, all }) => (
              <tr key={lesson.id} data-testid="circle-talk" data-lesson={lesson.id}>
                <td>{str(course?.title)}</td>
                <td>{partTitle(lesson, str(course?.title))}</td>
                <td className="num">{questions}</td>
                <td className="num">{on} of {all}</td>
                <td><Link className="btn ghost small" href={`${ctx.here}?lesson=${lesson.id}`} data-testid="circle-open">Open</Link></td>
              </tr>
            ))}
            {!talks.length ? <tr><td colSpan={5} className="empty">{ctx.user.role === 'master' ? 'No talk has questions yet.' : 'None of your portal’s own courses has questions yet. Add questions on a film in Content first.'}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

async function Talk(ctx: CircleCtx, lessonId: number) {
  const { payload, user, here } = ctx
  const scope = await circleScope(payload, user, lessonId)
  if (!scope.ok) return <p className="flash error" data-testid="circle-refused">{scope.error}</p>
  const { lesson, course } = scope
  const back = `${here}?lesson=${lesson.id}`
  const [allPoints, settings] = await Promise.all([rows(payload, 'engagement-points', { and: [{ lesson: { equals: lesson.id } }, { status: { not_equals: 'rejected' } }] }, { sort: 'second', depth: 1 }), circleSettings(payload)])
  const points = pointsInScope(allPoints, user)
  const ids = points.map((point) => point.id)
  const [circle, real] = await Promise.all([
    ids.length ? rows(payload, 'circle-answers', { point: { in: ids } }, { limit: 2000, sort: 'createdAt' }) : Promise.resolve([]),
    ids.length
      ? rows(payload, 'answers', { and: [{ point: { in: ids } }, { shareWithLearners: { equals: true } }, { keepPrivate: { not_equals: true } }, ...(scope.portal ? [{ portal: { equals: scope.portal } }] : [])] }, { limit: 5000, depth: 1 }).then((list) => list.filter((row) => (row.user as { shareWithLearners?: boolean } | null)?.shareWithLearners))
      : Promise.resolve([]),
  ])
  const mine = circle.filter((row) => user.role === 'master' || !idOf(row.portal) || idOf(row.portal) === scope.portal)
  return (
    <div data-testid="circle-talk-detail" data-lesson={lesson.id}>
      <p><Link href={here} className="hint">‹ All talks</Link></p>
      <section className="panel" style={{ marginBottom: 18 }}>
        <header className="light">
          <div><h2>{partTitle(lesson, str(course.title))}</h2><p>{str(course.title)}{lesson.speaker ? `, ${str(lesson.speaker)}` : ''}</p></div>
          <div className="actions">
            <Bulk lesson={lesson.id} scope="talk" enabled here={back} label="All on for this talk" />
            <Bulk lesson={lesson.id} scope="talk" enabled={false} here={back} label="All off for this talk" />
            <Bulk lesson={lesson.id} scope="course" enabled here={back} label="All on for the course" />
            <Bulk lesson={lesson.id} scope="course" enabled={false} here={back} label="All off for the course" />
          </div>
        </header>
        <form className="body form circle-generate" action="/api/hearts" method="post" data-testid="circle-generate-all">
          <Hidden fields={{ action: 'circle-generate', lesson: lesson.id, next: back }} />
          <b>Draft answers for every question on this talk</b>
          <GenerateFields />
          <div className="actions"><button className="btn ink" type="submit" data-testid="circle-generate-all-submit">Draft circle answers</button></div>
          <p className="hint">Drafted by the AI when a key is set, otherwise by the built-in drafts. Every answer goes through the same word checks as the editor, and you can edit, switch off or delete any of them.</p>
        </form>
      </section>
      {points.map((point) => {
        const list = mine.filter((row) => idOf(row.point) === point.id)
        const on = list.filter((row) => row.enabled !== false).length
        const realCount = real.filter((row) => idOf(row.point) === point.id).length
        const shown = circleShown(on, realCount, settings.threshold)
        return (
          <section className="panel circle-point" key={point.id} data-testid="circle-point" data-point={point.id} style={{ marginBottom: 18 }}>
            <header className="light">
              <div>
                <h2>{str(point.prompt)}</h2>
                <p>{clock(Number(point.second || 0))}, {KIND[str(point.kind)] || 'Reflection'}{point.status === 'draft' ? ', draft pop-up' : ''}</p>
              </div>
              <span className="hint" data-testid="circle-balance">{realCount} real shared answer{realCount === 1 ? '' : 's'}. A learner sees {shown} of {on} circle answer{on === 1 ? '' : 's'} now{realCount >= settings.threshold ? ', because the real answers have reached the threshold' : ''}.</span>
            </header>
            <div className="body">
              {list.length ? (
                <ul className="circle-list">
                  {list.map((row) => (
                    <li key={row.id} className={row.enabled === false ? 'off' : ''} data-testid="circle-answer" data-id={row.id} data-enabled={row.enabled === false ? 'no' : 'yes'} data-origin={str(row.origin)}>
                      <div className="circle-text">
                        <b>{str(row.name)}</b>
                        <span className="hint"> {row.origin === 'ai' ? 'Drafted by AI' : 'Written by staff'}{row.tone ? `, ${str(row.tone)}` : ''}{row.length ? `, ${str(row.length)}` : ''}{row.enabled === false ? ', switched off' : ''}</span>
                        <p data-testid="circle-body">{str(row.body)}</p>
                      </div>
                      <div className="circle-tools">
                        <form action="/api/hearts" method="post">
                          <Hidden fields={{ action: 'circle-toggle', id: row.id, enabled: row.enabled === false ? 'on' : 'off', next: back }} />
                          <button className="btn ghost small" type="submit" data-testid="circle-toggle">{row.enabled === false ? 'Switch on' : 'Switch off'}</button>
                        </form>
                        <details>
                          <summary className="btn ghost small" data-testid="circle-edit-open">Edit</summary>
                          <form className="form" action="/api/hearts" method="post" style={{ marginTop: 8 }}>
                            <Hidden fields={{ action: 'circle-edit', id: row.id, next: back }} />
                            <label className="stack">Name<input type="text" name="name" defaultValue={str(row.name)} maxLength={40} /></label>
                            <label className="stack">Answer<textarea name="body" rows={3} defaultValue={str(row.body)} data-testid="circle-edit-body" /></label>
                            <button className="btn ink small" type="submit" data-testid="circle-edit-save">Save</button>
                          </form>
                        </details>
                        <form action="/api/hearts" method="post">
                          <Hidden fields={{ action: 'circle-delete', id: row.id, next: back }} />
                          <button className="btn ghost small" type="submit" data-testid="circle-delete">Delete</button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="empty">No circle answers on this question yet.</p>}
              <div className="circle-forms">
                <form className="form" action="/api/hearts" method="post" data-testid="circle-add">
                  <Hidden fields={{ action: 'circle-add', point: point.id, next: back }} />
                  <b>Add your own</b>
                  <label className="stack">Name shown<input type="text" name="name" maxLength={40} placeholder={(user.name || '').split(' ')[0] || 'Your first name'} data-testid="circle-add-name" /></label>
                  <label className="stack">Your answer<textarea name="body" rows={3} required data-testid="circle-add-body" /></label>
                  <button className="btn ghost small" type="submit" data-testid="circle-add-submit">Add to the circle</button>
                </form>
                <form className="form" action="/api/hearts" method="post" data-testid="circle-generate-one">
                  <Hidden fields={{ action: 'circle-generate', lesson: lesson.id, point: point.id, next: back }} />
                  <b>Draft more for this question</b>
                  <GenerateFields count={3} />
                  <button className="btn ghost small" type="submit">Draft</button>
                </form>
              </div>
            </div>
          </section>
        )
      })}
      {!points.length ? <p className="empty">This talk has no questions yet.</p> : null}
    </div>
  )
}

async function Settings(ctx: CircleCtx) {
  const settings = await circleSettings(ctx.payload)
  return (
    <section className="panel" style={{ marginBottom: 18 }} data-testid="circle-settings">
      <form className="body form circle-settings" action="/api/hearts" method="post">
        <Hidden fields={{ action: 'circle-settings', next: ctx.here }} />
        <label className="stack">Label under each circle answer<input type="text" name="label" defaultValue={settings.label} maxLength={60} data-testid="circle-label-input" /></label>
        <label className="stack">Step back after this many real answers<input type="number" name="threshold" min={1} max={100} defaultValue={settings.threshold} data-testid="circle-threshold-input" /></label>
        <div className="actions"><button className="btn ghost small" type="submit" data-testid="circle-settings-save">Save</button></div>
      </form>
    </section>
  )
}

async function Body(ctx: CircleCtx): Promise<ReactNode> {
  const lessonId = Number(ctx.query.lesson)
  return (
    <>
      {ctx.user.role === 'master' && !lessonId ? await Settings(ctx) : null}
      {lessonId ? await Talk(ctx, lessonId) : await Index(ctx)}
    </>
  )
}

export async function MasterCircle({ payload, user, query }: { payload: Payload; user: SessionUser; query: Record<string, string | undefined> }) {
  const ctx: CircleCtx = { payload, user, query, here: '/master/circle', portalId: null }
  return (
    <DeskFrame payload={payload} user={user} title="Circle answers" intro={INTRO} active="circle" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={query} testId="master-circle">
      {await Body(ctx)}
    </DeskFrame>
  )
}

export async function PortalCircle(ctx: Ctx) {
  const query = ctx.query as Record<string, string | undefined>
  const circle: CircleCtx = { payload: ctx.payload, user: ctx.user, query, here: `${ctx.base}/admin/circle`, portalId: ctx.portal.id }
  return (
    <AdminFrame ctx={ctx} active="circle" title="Circle answers" intro={INTRO} testId="portal-circle">
      {await Body(circle)}
    </AdminFrame>
  )
}
