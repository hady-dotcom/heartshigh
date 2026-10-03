import { countLine, type DoorGroup, type PlacedCourse } from '@/lib/curriculum-groups'

function CourseLine({ course }: { course: PlacedCourse }) {
  return (
    <div className="pack-course" data-testid="pack-course" data-course={course.id}>
      <b>{course.title}</b>
      <span className="hint">{course.talkCount} {course.talkCount === 1 ? 'talk' : 'talks'}</span>
      {course.otherDoors.map((door) => (
        <span key={door.number} className="door-tag" data-testid="other-door" title={door.title}>{door.code}</span>
      ))}
    </div>
  )
}

/** The courses in a pack, collapsed under the doors of the spine. */
export function PackContents({ groups }: { groups: DoorGroup[] }) {
  if (!groups.length) return <p className="hint">Nothing in this pack yet.</p>
  return (
    <div className="pack-contents" data-testid="pack-contents">
      {groups.map((group) => (
        <details key={group.key} className="door-group" data-testid="door-group" data-door={group.code}>
          <summary>
            <span>{group.heading}</span>
            <span className="hint">{countLine(group.talkCount, group.courses.length)}</span>
          </summary>
          <div className="door-group-body">
            {group.unseated.map((course) => <CourseLine key={course.id} course={course} />)}
            {group.seats.map((seat) => (
              <details key={seat.id} className="seat-group" data-testid="seat-group">
                <summary>
                  <span>{seat.label}</span>
                  <span className="hint">{countLine(seat.talkCount, seat.courses.length)}</span>
                </summary>
                {seat.courses.map((course) => <CourseLine key={course.id} course={course} />)}
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}
