import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'
import { isAwaitingTranscript } from '@/lib/youtube'
import type { SessionUser } from '@/server/context'
import { rows, str } from '../common'
import { DeskFrame, masterNav } from './shell'

type Query = { error?: string; notice?: string }

export async function TranscriptFilesScreen({ payload, user, query }: { payload: Payload; user: SessionUser; query: Query }) {
  const [media, lessons] = await Promise.all([
    rows(payload, 'media', undefined, { sort: '-createdAt', limit: 80 }),
    rows(payload, 'lessons', { transcriptNote: { like: 'Bring-in: waiting' } }, { sort: '-updatedAt', limit: 100 }),
  ])
  const files = media.filter((row) => /\.(vtt|srt|txt|md)$/i.test(str(row.filename) || str(row.alt)))
  const waiting = lessons.filter((lesson) => isAwaitingTranscript(str(lesson.transcriptNote)))
  return (
    <DeskFrame payload={payload} user={user} title="Transcript files" intro="Store the timed transcript files a master sheet points at, and attach one to a talk that is waiting." active="transcripts" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={query} testId="transcript-files">
      <section className="panel">
        <header>
          <div>
            <h2>Upload a transcript file <HelpTip topic="transcript-files">{TOOL.transcriptFiles}</HelpTip></h2>
            <p>The media number is what the sheet’s transcript column needs.</p>
          </div>
        </header>
        <form className="body form" action="/api/hearts" method="post" encType="multipart/form-data">
          <Hidden fields={{ action: 'upload-transcript-file', next: '/master/transcripts' }} />
          <label className="stack">Timed transcript (.vtt, .srt or .txt)<input data-testid="sheet-transcript-file" type="file" name="file" accept=".vtt,.srt,.txt,.md,text/plain" required /></label>
          <div className="actions"><button className="btn ink" type="submit" data-testid="sheet-transcript-upload">Store this file</button></div>
        </form>
        {files.length ? (
          <div className="body">
            <table className="data" data-testid="transcript-media">
              <thead><tr><th>Media</th><th>File</th></tr></thead>
              <tbody>
                {files.map((row) => (
                  <tr key={row.id} data-testid="transcript-media-row">
                    <td className="num">{row.id}</td>
                    <td>{str(row.filename) || str(row.alt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="body hint">No transcript files stored yet.</p>}
      </section>
      <section className="panel" style={{ marginTop: 18 }} data-testid="awaiting-transcripts">
        <header><h2>Waiting for a transcript</h2><p>These talks were brought in, but YouTube did not give captions. They stay off the learner side until a transcript is attached.</p></header>
        <div className="body">
          {waiting.length ? waiting.map((lesson) => (
            <form key={lesson.id} className="form" action="/api/hearts" method="post" encType="multipart/form-data" data-testid="awaiting-row" style={{ marginBottom: 16 }}>
              <Hidden fields={{ action: 'attach-transcript', lesson: lesson.id, next: '/master/transcripts' }} />
              <p><b>{str(lesson.title)}</b> {lesson.youtubeId ? <span className="hint">YouTube {str(lesson.youtubeId)}</span> : null}</p>
              <p className="hint">{str(lesson.transcriptNote)}</p>
              <label className="stack">Timed transcript<textarea name="transcript" rows={4} placeholder="[0:00:00] The words of the talk" /></label>
              <label className="stack">Or a file<input type="file" name="file" accept=".vtt,.srt,.txt,.md,text/plain" /></label>
              <div className="actions"><button className="btn ghost small" type="submit" data-testid="attach-transcript">Attach transcript</button></div>
            </form>
          )) : <p className="hint" data-testid="awaiting-empty">No talks are waiting.</p>}
        </div>
      </section>
    </DeskFrame>
  )
}
