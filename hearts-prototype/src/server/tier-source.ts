import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * The transcript a talk's tiers are drafted from and checked against: the shipped caption file for its YouTube id
 * when there is one (it carries the real timing), otherwise the lesson's own transcript.
 */
export function tierSourceText(lesson: { youtubeId?: string | null; transcript?: string | null } | null | undefined) {
  if (!lesson) return ''
  const id = lesson.youtubeId || ''
  if (/^[\w-]{11}$/.test(id)) {
    const file = path.join(process.cwd(), 'content/transcripts/starters', `${id}.vtt`)
    if (existsSync(file)) return readFileSync(file, 'utf8')
  }
  return typeof lesson.transcript === 'string' ? lesson.transcript : ''
}
