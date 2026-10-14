import { doorCode, type Door, DOORS } from './doors'
import { doorName, type DoorGroup } from './curriculum-groups'

/** An empty heading so Content can list all twenty doors, even when a portal has nothing on one. */
export function emptyDoorGroup(door: Door): DoorGroup {
  return {
    key: doorCode(door.number),
    number: door.number,
    code: doorCode(door.number),
    title: door.title,
    heading: doorName(door).heading,
    courses: [],
    seats: [],
    unseated: [],
    talkCount: 0,
  }
}

/** Keep existing groups, and insert empty W1–W20 headings for missing doors. */
export function withEveryDoor(groups: DoorGroup[], doors: Door[] = DOORS): DoorGroup[] {
  const byNumber = new Map<number, DoorGroup>()
  const other: DoorGroup[] = []
  for (const group of groups) {
    if (group.number == null) other.push(group)
    else byNumber.set(group.number, group)
  }
  return [...doors.map((door) => byNumber.get(door.number) || emptyDoorGroup(door)), ...other]
}
