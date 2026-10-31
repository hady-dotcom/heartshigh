import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'
import { filterTalks, type TranscriptRow } from '@/lib/transcript-desk'
import type { SessionUser } from '@/server/context'
import { listTranscriptTalks } from '@/server/transcript-desk'
import { DeskFrame, masterNav } from './shell'

type Query = { error?: string; notice?: string; q?: string; missing?: string; untimed?: string; short?: string }

function on(value: string | undefined) {
  return value === '1' || value === 'yes' || value === 'on'
}

function optionLabel(row: TranscriptRow, titles: Map<string, number>) {
  return (titles.get(row.title) || 0) > 1 ? `${row.title} · ${row.courses[0]}` : row.title
}

export async function TranscriptsScreen({ payload, user, query }: { payload: Payload; user: SessionUser; query: Query }) {
  const talks = await listTranscriptTalks(payload)
  const shown = filterTalks(talks, { q: query.q, missing: on(query.missing), untimed: on(query.untimed), short: on(query.short) })
  const titles = new Map<string, number>()
  for (const talk of talks) titles.set(talk.title, (titles.get(talk.title) || 0) + 1)
  return (
    <DeskFrame payload={payload} user={user} title="Transcripts" active="transcripts" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={query} testId="transcripts">
      <form className="tx-filters" action="/master/transcripts" method="get" data-testid="transcript-filters">
        <label className="stack">Search<input name="q" type="search" defaultValue={query.q || ''} placeholder="Title, speaker or course" data-testid="transcript-search" /></label>
        <label className="check"><input type="checkbox" name="missing" value="1" defaultChecked={on(query.missing)} data-testid="filter-missing" /> No transcript</label>
        <label className="check"><input type="checkbox" name="untimed" value="1" defaultChecked={on(query.untimed)} data-testid="filter-untimed" /> No timing</label>
        <label className="check"><input type="checkbox" name="short" value="1" defaultChecked={on(query.short)} data-testid="filter-short" /> Too short (under 5 min)</label>
        <button className="btn ghost small" type="submit" data-testid="transcript-apply">Show</button>
      </form>
      <section className="panel" id="transcript-list">
        <header>
          <div>
            <h2>Talks</h2>
            <p>{shown.length} {shown.length === 1 ? 'talk' : 'talks'} on this list.</p>
          </div>
        </header>
        {shown.length ? (
          <ul className="tx-list" data-testid="transcript-rows">
            {shown.map((talk) => (
              <li key={talk.id} className="tx-card" data-testid="transcript-row" data-lesson={talk.id} data-missing={talk.hasTranscript ? 'no' : 'yes'} data-timed={talk.timed ? 'yes' : 'no'} data-short={talk.tooShort ? 'yes' : 'no'} data-source={talk.sourceLabel}>
                <a className="tx-row" href={`/master/transcripts/${talk.id}`}>
                  {talk.youtubeId ? <img className="tx-thumb" alt="" src={`https://i.ytimg.com/vi/${talk.youtubeId}/hqdefault.jpg`} data-testid="transcript-thumb" /> : <span className="tx-letter" data-testid="transcript-thumb" aria-hidden="true">{talk.initial}</span>}
                  <span>
                    <b data-testid="transcript-title">{talk.title}</b>
                    <span className="tx-meta">
                      <span data-testid="transcript-speaker">{talk.speaker}</span>
                      <span data-testid="transcript-length">{talk.lengthLabel}</span>
                      <span data-testid="transcript-source">{talk.sourceLabel}</span>
                      <span data-testid="transcript-timing">{talk.timingLabel}</span>
                      <span data-testid="transcript-courses">{talk.courses.join(', ')}</span>
                      <span data-testid="transcript-status">{talk.status}</span>
                    </span>
                  </span>
                </a>
                {talk.canFetch ? (
                  <form action="/api/hearts" method="post">
                    <Hidden fields={{ action: 'fetch-talk-captions', lesson: talk.id, next: `/master/transcripts/${talk.id}` }} />
                    <button className="btn ghost small tx-fetch" type="submit" data-testid="transcript-fetch">Get captions from YouTube</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <p data-testid="transcript-none">No talk matches. <a href="/master/transcripts">Show every talk</a>.</p>}
      </section>
      <section className="panel" id="transcript-upload" style={{ marginTop: 18 }}>
        <header>
          <div>
            <h2>Add a file to a talk <HelpTip topic="transcript-files">{TOOL.transcriptFiles}</HelpTip></h2>
            <p>Pick the talk by its title. The file’s words land on that talk.</p>
          </div>
        </header>
        <form className="body form" action="/api/hearts" method="post" encType="multipart/form-data">
          <Hidden fields={{ action: 'upload-transcript-file', next: '/master/transcripts' }} />
          <label className="stack">Talk
            <select name="lesson" required data-testid="transcript-talk" defaultValue="">
              <option value="" disabled>Choose a talk</option>
              {talks.map((talk) => <option key={talk.id} value={talk.id}>{optionLabel(talk, titles)}</option>)}
            </select>
          </label>
          <label className="stack">File (.vtt, .srt or .txt)<input data-testid="sheet-transcript-file" type="file" name="file" accept=".vtt,.srt,.txt,.md,text/plain" required /></label>
          <div className="actions"><button className="btn ink" type="submit" data-testid="sheet-transcript-upload">Put this file on the talk</button></div>
        </form>
      </section>
    </DeskFrame>
  )
}
