/** Learner-facing part labels. A one-talk course should not say "Part 1" or "last part". */

export function playerPartLabel(input: { index: number; total: number; name: string; courseTitle: string }) {
  const name = input.name.trim()
  const course = input.courseTitle.trim()
  if (input.total <= 1) {
    if (/· Part \d+$/.test(name) || /^Part \d+$/.test(name)) return course || name.replace(/· Part \d+$/, '').trim() || name
    return name || course
  }
  if (/· Part \d+$/.test(name) || /^Part \d+$/.test(name)) return name
  return `Part ${input.index} of ${input.total} · ${name || course}`
}

export function lastPartCopy(total: number) {
  return total <= 1 ? 'This is the whole talk.' : 'This is the last part of this course.'
}

export function resolvePartIndex(lessons: { id: number }[], partQuery: string | undefined) {
  const n = Number(partQuery)
  if (!Number.isFinite(n) || n <= 0) return 0
  const byId = lessons.findIndex((lesson) => lesson.id === n)
  if (byId >= 0) return byId
  if (n >= 1 && n <= lessons.length) return n - 1
  return 0
}
