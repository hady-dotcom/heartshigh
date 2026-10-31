// The closed list of teachers the library filter may offer.
// A talk can name someone else. That name never becomes a filter choice.
import rows from '../seed/speakers-data.json'
import { foldSpeaker, speakerSlug } from './speakers'

export type ApprovedTeacher = {
  name: string
  displayName: string
  slug: string
  aliases: string[]
}

/** Every teacher in the speaker catalogue. Draft bios stay on the list; a random channel name does not. */
export const APPROVED_TEACHERS: ApprovedTeacher[] = rows.map((row) => ({
  name: row.name,
  displayName: row.displayName,
  slug: row.slug,
  aliases: row.aliases || [],
}))

export function approvedTeacherBySlug(slug: string) {
  const key = slug.trim().toLowerCase()
  if (!key) return null
  return APPROVED_TEACHERS.find((teacher) => teacher.slug === key) || null
}

/** The catalogue teacher a written name is pointing at, or null when the name is not approved. */
export function matchApprovedTeacher(raw: string) {
  const text = raw.trim()
  if (!text) return null
  const folded = foldSpeaker(text)
  const slug = speakerSlug(text)
  return APPROVED_TEACHERS.find((teacher) => {
    if (teacher.slug === slug) return true
    const names = [teacher.name, teacher.displayName, ...teacher.aliases]
    return names.some((name) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      return foldSpeaker(trimmed) === folded || speakerSlug(trimmed) === slug
    })
  }) || null
}

export function teacherChoices() {
  return [...APPROVED_TEACHERS].sort((a, b) => a.displayName.localeCompare(b.displayName, 'en'))
}
