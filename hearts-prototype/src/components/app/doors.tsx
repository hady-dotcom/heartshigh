import { capitalAfterColon } from '@/lib/doors'

/** The Jibril doors a course or talk sits in, as learners see them: number and title, never a clause. */
export function DoorChips({ doors, max = 2 }: { doors: { number: number; title: string }[]; max?: number }) {
  if (!doors.length) return null
  const shown = doors.slice(0, max)
  return (
    <span className="door-chips" data-testid="course-doors">
      {shown.map((door) => (
        <span key={door.number} className="door-chip" data-testid="door-chip" data-door={door.number}>Door {door.number} · {capitalAfterColon(door.title)}</span>
      ))}
      {doors.length > shown.length ? <span className="door-chip more">+{doors.length - shown.length} more</span> : null}
    </span>
  )
}
