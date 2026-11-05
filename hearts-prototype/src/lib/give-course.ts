export type GiveCourseRow = { id: number; title: string; door: string }

/** Search, then group by Jibril door. Door order follows the list that was passed in. */
export function giveCourseGroups(courses: GiveCourseRow[], query: string) {
  const q = query.trim().toLowerCase()
  const rows = courses.filter((course) => !q || `${course.title} ${course.door}`.toLowerCase().includes(q))
  const groups: { door: string; courses: GiveCourseRow[] }[] = []
  for (const row of rows) {
    const found = groups.find((group) => group.door === row.door)
    if (found) found.courses.push(row)
    else groups.push({ door: row.door, courses: [row] })
  }
  return groups
}
