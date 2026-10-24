import type { Payload } from 'payload'
import { TranscriptEditor } from '@/components/desk/transcript-editor'
import type { SessionUser } from '@/server/context'
import { loadTranscriptEditor } from '@/server/transcript-desk'
import { DeskFrame, masterNav } from './shell'

type Query = { error?: string; notice?: string }

export async function TranscriptEditScreen({ payload, user, query, id }: { payload: Payload; user: SessionUser; query: Query; id: number }) {
  const talk = await loadTranscriptEditor(payload, id)
  if (!talk) return null
  return (
    <DeskFrame payload={payload} user={user} title={talk.title} active="transcripts" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={query} testId="transcript-editor-page" primary={{ href: '/master/transcripts', label: 'All transcripts' }}>
      <p className="tx-meta" data-testid="transcript-editor-meta">
        {talk.row ? <><span>{talk.row.speaker}</span><span>{talk.row.lengthLabel}</span><span>{talk.row.sourceLabel}</span><span>{talk.row.timingLabel}</span><span>{talk.row.courses.join(', ')}</span><span>{talk.row.status}</span></> : null}
      </p>
      <TranscriptEditor lessonId={talk.id} youtubeId={talk.youtubeId} timed={talk.timed} lines={talk.lines} canUndo={talk.canUndo} canRedo={talk.canRedo} versions={talk.versions} />
    </DeskFrame>
  )
}
