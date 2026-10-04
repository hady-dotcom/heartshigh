/**
 * Read-only report of every course lesson: stored title, YouTube id, stored duration,
 * live YouTube title, and live duration when yt-dlp can answer.
 * Flags lessons under 10 minutes and titles that do not match YouTube.
 * Prints what a write would change. Never writes.
 *
 *   npm run report:mains
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { fetchYoutubeMeta, ytDlpBinary } from '../src/lib/youtube'
import { seriesPartNumber } from '../src/lib/first-course'
import { clock as seriesClock, groupSeriesEnabled, planSeriesMoves, type LibraryLesson } from '../src/lib/series-group'

const execFileAsync = promisify(execFile)

async function youtubeDuration(id: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(ytDlpBinary(), ['--skip-download', '--print', '%(duration)s', `https://www.youtube.com/watch?v=${id}`], { timeout: 20_000 })
    const seconds = Number(String(stdout).trim())
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null
  } catch {
    return null
  }
}

function clock(total: number) {
  const value = Math.max(0, Math.floor(total))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

function titlesMatch(stored: string, live: string) {
  const a = stored.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const b = live.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!a || !b) return false
  return a.includes(b.slice(0, 24)) || b.includes(a.slice(0, 24))
}

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

type Lesson = { id: number; title?: string; youtubeId?: string; durationSeconds?: number; speaker?: string; course?: number | { id: number; title?: string; speaker?: string } }
type Course = { id: number; title?: string; speaker?: string }

try {
  const courses = ((await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as Course[])
  const lessons = ((await payload.find({ collection: 'lessons', overrideAccess: true, depth: 1, limit: 0, pagination: false })).docs as Lesson[])
  const short: string[] = []
  const mismatch: string[] = []
  const wouldChange: string[] = []
  console.log('Mains report (read-only). Nothing is written.\n')
  for (const course of courses.sort((a, b) => a.id - b.id)) {
    const own = lessons.filter((lesson) => (typeof lesson.course === 'object' ? lesson.course?.id : lesson.course) === course.id)
    console.log(`# ${course.id} ${course.title || '(untitled)'} · ${own.length} talks`)
    for (const lesson of own) {
      const stored = Number(lesson.durationSeconds || 0)
      const youtubeId = lesson.youtubeId || ''
      const meta = youtubeId ? await fetchYoutubeMeta(youtubeId) : undefined
      const liveTitle = meta?.title || ''
      const liveDuration = youtubeId ? await youtubeDuration(youtubeId) : null
      const seconds = liveDuration || stored
      const flags: string[] = []
      if (seconds > 0 && seconds < 600) flags.push(seconds < 180 ? 'UNDER 10 MIN → clip' : 'UNDER 10 MIN → Ready for more?')
      if (liveTitle && !titlesMatch(String(lesson.title || ''), liveTitle)) flags.push('TITLE MISMATCH')
      if (!youtubeId) flags.push('NO YOUTUBE ID')
      if (meta === null) flags.push('YOUTUBE MISSING')
      const line = `  ${lesson.id}  ${lesson.title || '(untitled)'}  id=${youtubeId || '—'}  stored=${stored ? clock(stored) : '—'}  live=${liveDuration ? clock(liveDuration) : liveTitle ? 'title only' : '—'}  yt="${liveTitle || '—'}"${flags.length ? `  !! ${flags.join(', ')}` : ''}`
      console.log(line)
      if (flags.some((flag) => flag.startsWith('UNDER 10 MIN'))) short.push(`${course.title}: ${lesson.title} (${clock(seconds)}) — propose as ${seconds < 180 ? 'a clip' : 'Ready for more?'}, not a main`)
      if (flags.includes('TITLE MISMATCH')) mismatch.push(`${lesson.id}: stored "${lesson.title}" vs YouTube "${liveTitle}"`)
      if (liveDuration && stored && Math.abs(liveDuration - stored) > 15) {
        wouldChange.push(`lesson ${lesson.id} durationSeconds ${stored} -> ${liveDuration}`)
      }
      if (liveTitle && !titlesMatch(String(lesson.title || ''), liveTitle)) {
        wouldChange.push(`lesson ${lesson.id} title "${lesson.title}" -> "${liveTitle}" (needs Leon)`)
      }
    }
  }
  console.log('\n## Short mains (under 10 minutes)')
  console.log(short.length ? short.map((row) => `- ${row}`).join('\n') : '- none')
  console.log('\n## Title mismatches')
  console.log(mismatch.length ? mismatch.map((row) => `- ${row}`).join('\n') : '- none')
  console.log('\n## Would change (not applied)')
  console.log(wouldChange.length ? wouldChange.map((row) => `- ${row}`).join('\n') : '- none')
  console.log(`\n${courses.length} courses, ${lessons.length} lessons. Later parts flagged: ${lessons.filter((lesson) => (seriesPartNumber(String(lesson.title || '')) || 1) > 1).length}.`)

  const library: LibraryLesson[] = lessons.map((lesson) => {
    const courseId = typeof lesson.course === 'object' ? lesson.course?.id || 0 : Number(lesson.course || 0)
    const course = courses.find((row) => row.id === courseId)
    return {
      id: lesson.id,
      title: String(lesson.title || ''),
      courseId,
      courseTitle: String(course?.title || ''),
      durationSeconds: Number(lesson.durationSeconds || 0),
      youtubeId: lesson.youtubeId || '',
      order: 0,
      speaker: String(lesson.speaker || (typeof lesson.course === 'object' ? lesson.course?.speaker : '') || course?.speaker || ''),
    }
  })
  const grouping = planSeriesMoves(library)
  console.log(`\n## Series grouping (would apply only if HEARTS_GROUP_SERIES=1; now ${groupSeriesEnabled() ? 'on' : 'off'})`)
  console.log('Railway must not group without Leon. Leftover long talks are never bundled.')
  for (const group of grouping.groups) {
    console.log(`- ${group.title}: ${group.lessonIds.length} talks [${group.seconds.map((value) => seriesClock(value)).join(', ')}]`)
  }
  console.log(grouping.moves.length ? grouping.moves.map((move) => `  move lesson ${move.lessonId} "${move.title}"  ${move.fromTitle} -> ${move.toTitle}  (${seriesClock(move.seconds)})  ${move.reason}`).join('\n') : '  already grouped, or no numbered same-speaker series')
  console.log('\n## Short mains after grouping — propose as clips or Ready for more?, not as mains')
  console.log(grouping.shortMains.length ? grouping.shortMains.map((row) => `- ${row.courseTitle}: ${row.lessonTitle} (${seriesClock(row.seconds)}) → ${row.proposeAs === 'clip' ? 'clip' : 'Ready for more?'}`).join('\n') : '- none')
  console.log('\nNothing was written. Grouping is not applied here.')
} finally {
  await closePayload(payload)
}
