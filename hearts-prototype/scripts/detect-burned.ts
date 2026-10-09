/**
 * Finds lessons whose picture carries heavy burned-in text in the lower third.
 * Dry-run unless `--write` is passed. `--write` refuses a production or remote database.
 *
 *   npm run detect:burned
 *   npm run detect:burned -- --write
 */
import sharp from 'sharp'
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { isProduction, isRemoteDatabase } from '../src/lib/env'
import { burnedCandidate, heavyLowerThird } from '../src/lib/burned'

const write = process.argv.includes('--write')

if (write && (isProduction() || isRemoteDatabase())) {
  console.error('Refusing to mark burned captions on a production or remote database. Nothing was changed.')
  process.exit(1)
}

async function lowerThirdOf(youtubeId: string) {
  try {
    const response = await fetch(`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`, { signal: AbortSignal.timeout(12_000) })
    if (!response.ok) return false
    const raw = await sharp(Buffer.from(await response.arrayBuffer())).greyscale().raw().toBuffer({ resolveWithObject: true })
    return heavyLowerThird(new Uint8Array(raw.data), raw.info.width, raw.info.height)
  } catch {
    return false
  }
}

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

let flagged = 0
try {
  const found = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 0,
    pagination: false,
    where: { youtubeId: { exists: true } },
  })
  for (const lesson of found.docs as unknown as { id: number; title?: string; youtubeId?: string; burnedCaptions?: boolean }[]) {
    const id = lesson.youtubeId || ''
    if (!id) continue
    const heavy = await lowerThirdOf(id)
    if (!burnedCandidate(id, heavy)) continue
    flagged += 1
    const why = heavy ? 'lower third' : 'known Short'
    console.log(`${write ? 'Marking' : 'Would mark'} lesson ${lesson.id} (${id}) burned captions: ${why}. ${lesson.title || ''}`)
    if (write && !lesson.burnedCaptions) {
      await payload.update({ collection: 'lessons', id: lesson.id, overrideAccess: true, data: { burnedCaptions: true } as never })
    }
  }
  console.log(`${write ? '' : 'Dry run. '}${flagged} lesson${flagged === 1 ? '' : 's'} with burned captions.`)
} finally {
  await closePayload(payload)
}
process.exit(0)
