import type { Payload } from 'payload'
import { resolveSpeaker, speakerSlug, type SpeakerIdentity } from '@/lib/speakers'
import rows from './speakers-data.json'

type SeedSpeaker = (typeof rows)[number]

function identity(row: SeedSpeaker, id: number): SpeakerIdentity {
  return { id, name: row.name, displayName: row.displayName, slug: row.slug, aliases: row.aliases }
}

/** Loads the 17 speaker bios and points each talk at the one person it names. Safe to run again. */
export async function seedSpeakers(payload: Payload) {
  const identities: SpeakerIdentity[] = []
  for (const row of rows) {
    const data = {
      name: row.name,
      honorific: row.honorific,
      displayName: row.displayName,
      slug: row.slug,
      aliases: row.aliases,
      bio: row.bio,
      photoUrl: row.photoUrl || undefined,
      photoSource: row.photoSource || undefined,
      links: row.links,
      sources: row.sources,
      status: row.status,
    }
    const found = await payload.find({ collection: 'speakers', overrideAccess: true, depth: 0, limit: 1, where: { slug: { equals: row.slug } } })
    const existing = found.docs[0] as { id: number } | undefined
    const saved = existing
      ? await payload.update({ collection: 'speakers', id: existing.id, overrideAccess: true, data: data as never })
      : await payload.create({ collection: 'speakers', overrideAccess: true, data: data as never })
    identities.push(identity(row, (saved as { id: number }).id))
  }
  await linkTalks(payload, identities)
  return identities.length
}

async function linkTalks(payload: Payload, speakers: SpeakerIdentity[]) {
  const lessons = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 500 })
  for (const lesson of lessons.docs as { id: number; speaker?: string | null; speakerProfile?: unknown }[]) {
    const raw = String(lesson.speaker || '')
    if (!raw) continue
    const resolved = resolveSpeaker(raw, speakers)
    if (!resolved?.id) continue
    const patch: Record<string, unknown> = {}
    if (speakerSlug(raw) !== resolved.slug) patch.speaker = resolved.name
    const current = typeof lesson.speakerProfile === 'number' ? lesson.speakerProfile : null
    if (current !== resolved.id) patch.speakerProfile = resolved.id
    if (Object.keys(patch).length) await payload.update({ collection: 'lessons', id: lesson.id, overrideAccess: true, data: patch as never })
  }
  const courses = await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 200 })
  for (const course of courses.docs as { id: number; speaker?: string | null; speakerProfile?: unknown }[]) {
    const raw = String(course.speaker || '')
    if (!raw) continue
    const resolved = resolveSpeaker(raw, speakers)
    if (!resolved?.id) continue
    const patch: Record<string, unknown> = {}
    if (speakerSlug(raw) !== resolved.slug) patch.speaker = resolved.name
    const current = typeof course.speakerProfile === 'number' ? course.speakerProfile : null
    if (current !== resolved.id) patch.speakerProfile = resolved.id
    if (Object.keys(patch).length) await payload.update({ collection: 'courses', id: course.id, overrideAccess: true, data: patch as never })
  }
}
