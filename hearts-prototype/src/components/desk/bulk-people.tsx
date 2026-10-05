import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'

export function BulkPeopleBar({
  portalSlug,
  next,
  courses,
  codes,
  classes,
}: {
  portalSlug: string
  next: string
  courses: { id: number; title: string }[]
  codes: { id: number; code: string }[]
  classes: { id: number; name: string }[]
}) {
  return (
    <section className="panel" style={{ marginBottom: 18 }} data-testid="bulk-people">
      <header>
        <div>
          <h2>Change several people <HelpTip topic="bulk-people">{TOOL.bulkPeople}</HelpTip></h2>
          <p>Tick the rows, choose one action, and confirm. The activity log keeps one line with the list.</p>
        </div>
      </header>
      <form id="bulk-people-form" className="body form" action="/api/hearts" method="post" data-testid="bulk-people-form">
        <Hidden fields={{ action: 'people-bulk', portalSlug, next }} />
        <label className="stack">What to do
          <select name="bulk" required data-testid="bulk-action">
            <option value="give-course">Give a course</option>
            <option value="add-class">Add to a class</option>
            <option value="move-code">Move to a code</option>
            <option value="assign-plan">Give a study plan</option>
            <option value="pause">Pause accounts</option>
            <option value="restore">Restore accounts</option>
            <option value="email">Email (once mail is on)</option>
          </select>
        </label>
        <div className="cols">
          <label className="stack">Course
            <select name="course" data-testid="bulk-course">
              <option value="">If needed</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label className="stack">Class
            <select name="class" data-testid="bulk-class-select">
              <option value="">If needed</option>
              {classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
        </div>
        <div className="cols">
          <label className="stack">Access code
            <select name="code" data-testid="bulk-code-select">
              <option value="">If needed</option>
              {codes.map((row) => <option key={row.id} value={row.id}>{row.code}</option>)}
            </select>
          </label>
          <label className="stack">Reason (for pause or restore)<input name="reason" data-testid="bulk-pause-reason" placeholder="Lost phone, or a short reason" /></label>
        </div>
        <div className="cols">
          <label className="stack">Plan start<input type="date" name="start" /></label>
          <label className="stack">Plan end<input type="date" name="end" /></label>
        </div>
        <label className="stack">
          <input type="checkbox" name="confirm" value="yes" required data-testid="bulk-confirm" />
          {' '}This will change the people you ticked. Check the count on the button.
        </label>
        <div className="actions"><button className="btn ink" type="submit" data-testid="bulk-submit">Change the ticked people</button></div>
      </form>
    </section>
  )
}

export function PersonTick({ id }: { id: number }) {
  return <input type="checkbox" name="person" value={id} form="bulk-people-form" data-testid="person-tick" data-person={id} />
}
