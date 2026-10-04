import { FramingPlayer } from '@/components/app/framing-player'
import { loadFramingFiles } from '@/lib/framing/store'
import { fallbackTrack, parseTrack } from '@/lib/framing/validate'
import type { FramingTrack } from '@/lib/framing/types'
import sample from '../../../../../tests/fixtures/framing-track.json'

function allowed() {
  return process.env.HEARTS_E2E === '1' || process.env.NODE_ENV !== 'production'
}

export default async function DevFraming({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!allowed()) return <p>Not available.</p>
  const query = await searchParams
  const files = loadFramingFiles()
  const wanted = query.youtube || query.clip
  const fromFile = wanted ? files.find((row) => row.youtubeId === wanted) : null
  const track: FramingTrack = parseTrack(query.track ? JSON.parse(query.track) : null) || fromFile || (sample as FramingTrack) || fallbackTrack('dQw4w9WgXcQ', 0, 20)
  const variant = query.variant || process.env.HEARTS_FRAMING_MODE
  return (
    <main style={{ margin: 0, minHeight: '100dvh', background: '#0F3B3A' }} data-testid="dev-framing">
      <FramingPlayer
        youtubeId={track.youtubeId}
        track={track}
        variant={variant}
        autoplay={query.autoplay !== '0'}
        sound={query.sound !== '0'}
        speaker={query.speaker}
      />
    </main>
  )
}
