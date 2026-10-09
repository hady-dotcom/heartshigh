import { FramingPlayer } from '@/components/app/framing-player'
import { loadFramingFiles } from '@/lib/framing/store'
import { fallbackTrack, parseTrack } from '@/lib/framing/validate'
import type { FramingTrack } from '@/lib/framing/types'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function allowed() {
  return process.env.HEARTS_E2E === '1' || process.env.NODE_ENV !== 'production'
}

function readFixture(name: string) {
  const file = path.join(process.cwd(), 'tests/fixtures', name)
  return parseTrack(JSON.parse(readFileSync(file, 'utf8')))
}

export default async function DevFraming({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!allowed()) return <p>Not available.</p>
  const query = await searchParams
  const files = loadFramingFiles()
  const wanted = query.youtube || query.clip
  const fromFile = wanted ? files.find((row) => row.youtubeId === wanted) : null
  const sample = readFixture('framing-track.json')
  const switching = readFixture('framing-switch.json')
  const track: FramingTrack =
    parseTrack(query.track ? JSON.parse(query.track) : null) ||
    (query.fixture === 'switch' ? switching : null) ||
    fromFile ||
    (query.fixture === 'sample' || !wanted ? sample : null) ||
    switching ||
    fallbackTrack('placeholder', 0, 24)
  const variant = query.variant || process.env.HEARTS_FRAMING_MODE
  const placeholder = query.placeholder !== '0'
  return (
    <main style={{ margin: 0, minHeight: '100dvh', background: '#0F3B3A' }} data-testid="dev-framing">
      <FramingPlayer
        youtubeId={track.youtubeId}
        track={track}
        variant={variant}
        autoplay={query.autoplay === '1'}
        sound={query.sound === '1'}
        speaker={query.speaker}
        title={query.title}
        placeholder={placeholder}
      />
    </main>
  )
}
