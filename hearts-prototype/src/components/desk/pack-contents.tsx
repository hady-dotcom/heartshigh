'use client'

import { useState } from 'react'
import { countLine, doorName, type DoorGroup, type PlacedCourse } from '@/lib/curriculum-groups'

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

type Tile = { key: string; heading: string; more: string; group: DoorGroup | null }

/**
 * A pack's courses as two levels: a tile per door of the spine (empty doors greyed), and, once a door is opened,
 * its Ghunya seats as headings with the courses under each.
 */
export function PackContents({ groups, doors }: { groups: DoorGroup[]; doors: { number: number; title: string }[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!groups.length) return <p className="hint">Nothing in this pack yet.</p>
  const tiles: Tile[] = doors.map((door) => {
    const group = groups.find((row) => row.number === door.number) || null
    return { key: group?.key || `W${door.number}`, ...doorName(door), group }
  })
  const other = groups.find((group) => group.number == null)
  if (other) tiles.push({ key: other.key, heading: 'Not on a door yet', more: '', group: other })
  const current = tiles.find((tile) => tile.key === open && tile.group)
  return (
    <div className="pack-contents" data-testid="pack-contents">
      <div className="door-tiles" data-testid="door-tiles">
        {tiles.map((tile) => {
          const group = tile.group
          const on = tile.key === open
          return (
            <button
              key={tile.key}
              type="button"
              className={`door-tile${group ? '' : ' empty'}${on ? ' on' : ''}`}
              data-testid="door-tile"
              data-door={tile.key}
              data-empty={group ? 'no' : 'yes'}
              aria-expanded={group ? on : undefined}
              disabled={!group}
              onClick={() => setOpen(on ? null : tile.key)}
            >
              <b>{tile.heading}</b>
              {tile.more ? <span className="door-tile-more">{tile.more}</span> : null}
              <span className="door-tile-count">{group ? countLine(group.talkCount, group.courses.length) : 'Nothing here yet'}</span>
            </button>
          )
        })}
      </div>
      {current?.group ? (
        <div className="door-open" data-testid="door-open" data-door={current.key}>
          <h3>{current.heading}{current.more ? <span className="hint"> · {current.more}</span> : null}</h3>
          {current.group.seats.map((seat) => (
            <details key={seat.id} className="seat-group" data-testid="seat-group">
              <summary>
                <span className="seat-head">
                  <span className="seat-label" title={seat.note || seat.label} data-testid="seat-label">{seat.label}</span>
                  {seat.subject ? <span className="seat-subject">{seat.subject}</span> : null}
                </span>
                <span className="hint">{countLine(seat.talkCount, seat.courses.length)}</span>
              </summary>
              <div className="seat-courses">{seat.courses.map((course) => <CourseLine key={course.id} course={course} />)}</div>
            </details>
          ))}
          {current.group.unseated.length ? (
            <details className="seat-group unseated" data-testid="seat-group" open={!current.group.seats.length}>
              <summary>
                <span className="seat-head"><span className="seat-label" data-testid="seat-label">Not on a seat yet</span></span>
                <span className="hint">{countLine(current.group.unseated.reduce((sum, course) => sum + course.talkCount, 0), current.group.unseated.length)}</span>
              </summary>
              <div className="seat-courses">{current.group.unseated.map((course) => <CourseLine key={course.id} course={course} />)}</div>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
