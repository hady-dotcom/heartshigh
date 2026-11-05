import Link from 'next/link'
import { Hidden } from '@/components/app/shell'
import type { ShortTalkRow } from '@/server/short-talks'

export function TooShortFilter({ base, count, active }: { base: string; count: number; active: boolean }) {
  const clean = base.split('?')[0]
  return (
    <div className="actions" data-testid="too-short-filter" style={{ marginBottom: 14 }}>
      <Link className={`btn small ${active ? 'ghost' : 'ink'}`} href={clean} data-testid="filter-all">All</Link>
      <Link className={`btn small ${active ? 'ink' : 'ghost'}`} href={`${clean}?show=too-short`} data-testid="filter-too-short">Too short ({count})</Link>
    </div>
  )
}

export function TooShortTable({ talks, next, canRestore = true }: { talks: ShortTalkRow[]; next: string; canRestore?: boolean }) {
  return (
    <section className="panel" data-testid="too-short-list">
      <header>
        <div>
          <h2>Too short ({talks.length})</h2>
          <p>These talks are under 5 minutes, so learners do not see them. Nothing is deleted.</p>
        </div>
      </header>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Talk</th><th>Speaker</th><th>Length</th><th>Course</th><th /></tr></thead>
          <tbody>
            {talks.map((talk) => (
              <tr key={talk.id} data-testid="too-short-row" data-seconds={talk.durationSeconds}>
                <td>{talk.title}</td>
                <td>{talk.speaker || <span className="hint">Not set</span>}</td>
                <td>{talk.length}</td>
                <td>
                  {talk.courseTitle}
                  {talk.courseHidden && talk.courseNote ? <div className="hint" data-testid="course-hidden-note">{talk.courseNote}</div> : null}
                </td>
                <td>
                  {canRestore ? (
                    <form action="/api/hearts" method="post">
                      <Hidden fields={{ action: 'restore-short-talk', lesson: talk.id, next }} />
                      <button className="btn ghost small" type="submit" data-testid="restore-short-talk">Restore</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {!talks.length ? <tr><td colSpan={5}><p className="empty">No talks are marked too short.</p></td></tr> : null}
          </tbody>
        </table>
      </div>
      {canRestore ? (
        <form className="body" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'mark-short-talks', next }} />
          <button className="btn ghost small" type="submit" data-testid="mark-short-talks">Mark talks under 5 minutes</button>
        </form>
      ) : null}
    </section>
  )
}
