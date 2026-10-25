import Link from 'next/link'
import { Hidden } from '@/components/app/shell'
import { DemoFrameTools } from '@/components/demo/frame-tools'
import { PARENTING_DEMO_CODE, watchedCount, withDemoQuery } from '@/lib/parenting-demo'
import type { DemoBag } from '../common'
import { DeskFrame } from './shell'
import type { MasterCtx } from './master'

export function ParentingDemoMaster({ ctx, demo }: { ctx: MasterCtx; demo: DemoBag }) {
  const { state, cast, token, role } = demo
  const learners = state.people.filter((person) => person.role === 'learner')
  const view = ctx.query.part === 'answers' ? 'answers' : ctx.query.part === 'code' ? 'code' : 'home'
  const href = (part: string) => withDemoQuery(part ? `/master/parenting-demo?part=${part}` : '/master/parenting-demo', token, role)
  const nav = [
    {
      group: 'Parenting',
      description: 'Practice data for this course only.',
      items: [
        { key: 'portals', label: 'This course', href: href(''), icon: null },
        { key: 'learners', label: 'Answers', href: href('answers'), icon: null },
        { key: 'codes', label: 'Join code', href: href('code'), icon: null },
      ],
    },
  ]
  return (
    <DeskFrame
      payload={ctx.payload}
      user={ctx.user}
      title={view === 'answers' ? 'Answers' : view === 'code' ? 'Join code' : 'This course'}
      intro="What just happened in the practice room. Real portals are not listed here."
      active={view === 'answers' ? 'learners' : view === 'code' ? 'codes' : 'portals'}
      nav={nav}
      brand="Master"
      subBrand="Master desk"
      brandHref={href('')}
      query={ctx.query}
      testId="master"
      showOnPhone
    >
      <DemoFrameTools token={token} role={role} cast={cast} seq={state.seq} />
      {view === 'code' ? (
        <section className="panel" data-testid="demo-code-panel">
          <h2>Join code</h2>
          <p data-testid="demo-join-code">{PARENTING_DEMO_CODE}</p>
          <p>Someone who types this code lands in the course. The practice room stays separate from their account.</p>
          <p><a className="pill outline" href={`/downloads/guiding-home-learning.zip`}>Download the app</a></p>
          <p><Link href={href('')}>Back to the course</Link></p>
        </section>
      ) : null}
      {view === 'answers' ? (
        <ul data-testid="demo-answer-list">
          {state.answers.map((answer) => (
            <li key={answer.id} data-testid="demo-answer">
              <Link href={href('answers')}>
                <b>{answer.learner}</b> on {answer.film}
              </Link>
              <p>{answer.body}</p>
              {answer.reply ? <p data-testid="demo-reply">Reply: {answer.reply}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {view === 'home' ? (
        <>
          <section className="panel" data-testid="portal-card">
            <h2>{cast.portalName}</h2>
            <p>{cast.portalAdmin} looks after it. {cast.teacher} guides the learners. {cast.learner} is in the course.</p>
            <p data-testid="demo-join-code">Join code {PARENTING_DEMO_CODE}</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div className="count-tile"><span>Learners</span><b>{learners.length}</b></div>
              <div className="count-tile"><span>Answers</span><b data-testid="demo-answer-count">{state.answers.length}</b></div>
              <div className="count-tile"><span>Notes</span><b>{state.notes.length}</b></div>
            </div>
          </section>
          <ul data-testid="demo-people">
            {learners.map((person) => (
              <li key={person.name} data-testid="demo-person">
                <Link href={href('answers')}>{person.name}</Link>
                <span> · {watchedCount(state, person.name)} films watched{person.watching ? ` · ${person.watching}` : ''}</span>
              </li>
            ))}
          </ul>
          <p>Latest note: {state.notes[0]?.body}</p>
          <form action="/api/hearts/demo" method="post">
            <Hidden fields={{ action: 'reset', demo: token, next: href('') }} />
            <button className="pill outline" type="submit" data-testid="demo-reset">Start again</button>
          </form>
        </>
      ) : null}
    </DeskFrame>
  )
}
