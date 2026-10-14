import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Payload } from 'payload'
import { FramingPreview } from '@/components/desk/framing-preview'
import { trackForClip } from '@/lib/framing/store'
import { fallbackTrack, parseTrack } from '@/lib/framing/validate'
import type { FramingTrack } from '@/lib/framing/types'
import { plural } from '@/lib/schedule'
import { idOf } from '@/lib/ids'
import type { SessionUser } from '@/server/context'
import { partTitle } from '@/lib/talk-title'
import { rows, str } from '../common'
import { DeskFrame, masterNav } from './shell'

type MasterCtx = { payload: Payload; user: SessionUser; query: Record<string, string | undefined> }

function clock(total: number) {
  const seconds = Math.max(0, Math.round(total))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export async function MasterFramingList(ctx: MasterCtx) {
  const cuts = await rows(ctx.payload, 'cuts', { placeholder: { not_equals: true } }, { limit: 400, sort: 'id' })
  const lessonIds = [...new Set(cuts.map((cut) => idOf(cut.lesson)).filter((id): id is number => Boolean(id)))]
  const lessons = lessonIds.length ? await rows(ctx.payload, 'lessons', { id: { in: lessonIds } }, { limit: 400 }) : []
  const rowsWithTracks = cuts.map((cut) => {
    const lesson = lessons.find((row) => row.id === idOf(cut.lesson))
    const youtubeId = str(lesson?.youtubeId) || ''
    const track = trackForClip(youtubeId, Number(cut.start), Number(cut.end), cut.framingTrack || lesson?.framingTrack)
    return { cut, lesson, youtubeId, track }
  })
  return (
    <DeskFrame payload={ctx.payload} user={ctx.user} title="Framing" intro="How a clip is cropped on the phone. Every learner sees the wide video on top and the words below. Open a clip to check that picture." active="framing" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={ctx.query} testId="master-framing">
      <section className="panel">
        <header className="light"><h2>Clips</h2><span className="hint">{rowsWithTracks.filter((row) => row.track).length} with a stored track</span></header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Talk</th><th>Window</th><th>Track</th><th /></tr></thead>
            <tbody>
              {rowsWithTracks.map(({ cut, lesson, track }) => (
                <tr key={cut.id} data-testid="framing-row">
                  <td><b>{partTitle(lesson)}</b><div className="hint">{str(lesson?.speaker)}</div></td>
                  <td>{clock(Number(cut.start))} to {clock(Number(cut.end))}</td>
                  <td>Learners: wide video and words{track && track.segments.some((segment) => segment.mode !== 'F') ? <div className="hint">Lab only: {track.segments.map((segment) => segment.mode).join(' · ')}</div> : null}</td>
                  <td><Link className="btn ghost small" href={`/master/framing/${cut.id}`} data-testid="framing-open">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DeskFrame>
  )
}

export async function MasterFramingClip(ctx: MasterCtx, cutId: number) {
  const cut = (await rows(ctx.payload, 'cuts', { id: { equals: cutId } }, { limit: 1 }))[0]
  if (!cut) notFound()
  const lesson = (await rows(ctx.payload, 'lessons', { id: { equals: idOf(cut.lesson) || 0 } }, { limit: 1 }))[0]
  const youtubeId = str(lesson?.youtubeId)
  if (!youtubeId) notFound()
  const stored = parseTrack(cut.framingTrack) || parseTrack(lesson?.framingTrack)
  const track: FramingTrack = trackForClip(youtubeId, Number(cut.start), Number(cut.end), stored) || fallbackTrack(youtubeId, Number(cut.start), Number(cut.end))
  const next = `/master/framing/${cut.id}`
  return (
    <DeskFrame payload={ctx.payload} user={ctx.user} title={partTitle(lesson) || 'Clip framing'} intro="How a clip is cropped on the phone." active="framing" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={ctx.query} testId="framing-clip">
      <p className="hint"><Link href="/master/framing">All clips</Link> · YouTube {youtubeId} · {clock(track.start)} to {clock(track.end)}</p>
      <section className="panel" data-testid="framing-panel">
        <header><div><h2>On the phone</h2><p data-testid="segment-count">{plural(track.segments.length, 'segment')}</p></div></header>
        <div className="body">
          <FramingPreview track={track} youtubeId={youtubeId} speaker={str(lesson?.speaker)} cutId={cut.id} next={next} placeholder={process.env.HEARTS_E2E === '1'} />
        </div>
      </section>
    </DeskFrame>
  )
}
