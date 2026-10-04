/**
 * Marks YouTube Shorts and other 9:16 films as vertical, so the feed hides its own captions over their burned-in
 * words and paints our own poster. A /shorts/ link is enough; otherwise YouTube's oEmbed size decides. Lessons
 * already marked, and lessons YouTube cannot answer for, are left as they are, so it is safe to run again.
 *
 *   npm run mark:shorts
 *   npm run mark:shorts -- --dry-run
 */
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { isPortraitSize, isShortsUrl } from '../src/lib/shorts'
import { fetchYoutubeMeta } from '../src/lib/youtube'

const dryRun = process.argv.includes('--dry-run')

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

let marked = 0
let already = 0
let unknown = 0
let landscape = 0
// Three silent answers in a row means YouTube is unreachable from here; /shorts/ links still count after that.
let silentInARow = 0
try {
  const found = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 0, pagination: false, where: { youtubeId: { exists: true } } })
  for (const lesson of found.docs as unknown as { id: number; title?: string; youtubeId?: string; youtubeUrl?: string; sourceUrl?: string; vertical?: boolean }[]) {
    if (lesson.vertical) {
      already += 1
      continue
    }
    let vertical = isShortsUrl(lesson.youtubeUrl) || isShortsUrl(lesson.sourceUrl)
    if (!vertical && lesson.youtubeId) {
      const meta = silentInARow < 3 ? await fetchYoutubeMeta(lesson.youtubeId) : null
      if (!meta?.width) {
        if (silentInARow < 3) silentInARow += 1
        unknown += 1
        continue
      }
      silentInARow = 0
      vertical = isPortraitSize(meta.width, meta.height)
    }
    if (!vertical) {
      landscape += 1
      continue
    }
    marked += 1
    console.log(`${dryRun ? 'Would mark' : 'Marked'} lesson ${lesson.id} as vertical: ${lesson.title || lesson.youtubeId}`)
    if (!dryRun) await payload.update({ collection: 'lessons', id: lesson.id, overrideAccess: true, data: { vertical: true } as never })
  }
  console.log(`${dryRun ? 'Dry run. ' : ''}${marked} marked vertical, ${already} already vertical, ${landscape} landscape, ${unknown} YouTube did not size.`)
  if (silentInARow >= 3) console.log('YouTube did not answer three times in a row, so the rest were judged by their links only. Run it again where YouTube is reachable.')
} finally {
  await closePayload(payload)
}
process.exit(0)
