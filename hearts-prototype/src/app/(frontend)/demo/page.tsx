import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Hidden } from '@/components/app/shell'
import { defaultParentingCast, demoBoardPath, PARENTING_DEMO_CODE } from '@/lib/parenting-demo'
import { getSession } from '@/server/context'
import { loadDemoRoom } from '@/server/parenting-demo'
import { DemoBoard } from './stage'
import './demo.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Guiding Home Learning',
  description: 'Four screens for the Parenting course. Practice data only.',
}

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ room?: string; step?: string; error?: string }> }) {
  const query = await searchParams
  const session = await getSession()
  if (!session.user || session.user.role !== 'master') {
    redirect(`/login?next=${encodeURIComponent(query.room ? demoBoardPath(query.room, query.step) : '/demo')}`)
  }
  if (query.room) {
    const room = await loadDemoRoom(session.payload, query.room)
    if (!room) redirect('/demo?error=That practice room is not here.')
    return <DemoBoard token={room.token} cast={room.cast} step={query.step || 'all'} />
  }
  const cast = defaultParentingCast()
  return (
    <main className="parenting-cast" data-testid="parenting-demo-cast">
      <p className="parenting-demo-kicker">Cast your demo</p>
      <h1>Who is on the four screens?</h1>
      <p>Type a name for each person. The films are the live course. Answers and notes stay in this practice room, and you can start again any time.</p>
      {query.error ? <p className="flash error" data-testid="error">{query.error}</p> : null}
      <form action="/api/hearts/demo" method="post" data-testid="demo-cast-form">
        <Hidden fields={{ action: 'open', step: 'all' }} />
        <label>Who runs the whole system?<input name="master" defaultValue={cast.master} data-testid="demo-cast-master" required /></label>
        <label>Who would look after the course?<input name="portalAdmin" defaultValue={cast.portalAdmin} data-testid="demo-cast-admin" required /></label>
        <label>Course name<input name="portalName" defaultValue={cast.portalName} data-testid="demo-cast-portal" required /></label>
        <label>Who would guide the learners?<input name="teacher" defaultValue={cast.teacher} data-testid="demo-cast-teacher" required /></label>
        <label>Pick one learner<input name="learner" defaultValue={cast.learner} data-testid="demo-cast-learner" required /></label>
        <button type="submit" data-testid="demo-cast-show">Show all four</button>
      </form>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Join code</h2>
        <p data-testid="demo-join-code">{PARENTING_DEMO_CODE}</p>
        <p>Someone who types this code on the join page lands in the course.</p>
        <p><a href="/downloads/guiding-home-learning.zip" data-testid="export-download">Download the app</a></p>
      </section>
      <form action="/api/hearts/demo" method="post" className="parenting-cast-picks">
        <Hidden fields={{ action: 'open', master: cast.master, portalAdmin: cast.portalAdmin, portalName: cast.portalName, teacher: cast.teacher, learner: cast.learner, step: 'portal' }} />
        <button type="submit" data-testid="role-switch-portal">Step in as the portal admin</button>
      </form>
      <form action="/api/hearts/demo" method="post">
        <Hidden fields={{ action: 'open', master: cast.master, portalAdmin: cast.portalAdmin, portalName: cast.portalName, teacher: cast.teacher, learner: cast.learner, step: 'teacher' }} />
        <button type="submit" data-testid="role-switch-teacher">Step in as the teacher</button>
      </form>
      <form action="/api/hearts/demo" method="post">
        <Hidden fields={{ action: 'open', master: cast.master, portalAdmin: cast.portalAdmin, portalName: cast.portalName, teacher: cast.teacher, learner: cast.learner, step: 'learner' }} />
        <button type="submit" data-testid="role-switch-learner">Step in as the learner</button>
      </form>
    </main>
  )
}
