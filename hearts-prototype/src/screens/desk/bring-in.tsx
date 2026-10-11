import Link from 'next/link'
import { cookies } from 'next/headers'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { BusyForm } from '@/components/desk/busy-form'
import { BringInLive } from '@/components/desk/bring-in-live'
import { DOORS, doorCode, doorLabel } from '@/lib/doors'
import { TOOL } from '@/lib/desk-help'
import { CAPTION_LANGUAGES, bringInStatus, bringInStatusLabel } from '@/lib/youtube'
import { helperTokenFlash } from '@/lib/helper-token-flash'
import { skipLabel, type BringInRow } from '@/lib/bring-in-plan'
import { listDraftTalks, type PreviewBody } from '@/server/bring-in'
import type { SessionUser } from '@/server/context'
import { clock, rows, str, type Ctx, type Row } from '../common'
import { AdminFrame } from './overview'

function captionsLabel(flag: string) {
  if (flag === 'yes') return 'Captions listed'
  if (flag === 'no') return 'No captions'
  return 'Captions unknown'
}

export async function BringInBody({
  payload,
  user,
  next,
  courses,
  query,
}: {
  payload: Payload
  user: SessionUser
  next: string
  courses: { id: number; title: string; speaker: string }[]
  query: { preview?: string; lessons?: string; token?: string; notice?: string }
}) {
  const previewId = Number(query.preview || 0)
  const preview = previewId
    ? ((await payload.findByID({ collection: 'bring-in-previews', id: previewId, depth: 0, overrideAccess: true }).catch(() => null)) as { body?: PreviewBody; actor?: unknown } | null)
    : null
  const body = preview?.body
  const lessonIds = (query.lessons || '').split(',').map((value) => Number(value)).filter((id) => id > 0)
  const brought = lessonIds.length ? await rows(payload, 'lessons', { id: { in: lessonIds } }, { limit: 80 }) : []
  const [mappings, tokens] = user.role === 'master'
    ? await Promise.all([
        rows(payload, 'channel-speakers', undefined, { sort: 'label', limit: 100 }),
        rows(payload, 'helper-tokens', undefined, { sort: '-createdAt', limit: 20 }),
      ])
    : [[], []]
  const jar = user.role === 'master' ? await cookies() : null
  const flash = helperTokenFlash({ once: jar?.get('hearts_helper_once')?.value, seen: jar?.get('hearts_helper_seen')?.value })
  const secret = flash.show ? flash.secret : ''
  const draftList = await listDraftTalks(payload, user)
  const shown = new Set(brought.map((lesson) => lesson.id))
  const otherDrafts = draftList.talks.filter((talk) => !shown.has(talk.id))
  return (
    <div data-testid="bring-in">
      {secret ? (
        <p className="flash notice" data-testid="helper-token-once">Copy this helper token now. It is stored as a hash and will not be shown again. <code data-testid="helper-token-value">{secret}</code></p>
      ) : null}
      <section className="panel">
        <header>
          <div>
            <h2>Paste links <HelpTip topic="bring-in-paste">{TOOL.bringInPaste}</HelpTip></h2>
            <p>One film, several films, a playlist or a channel. Nothing is saved until you bring the ticked rows in.</p>
          </div>
        </header>
        <BusyForm className="body form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'preview-bring-in', next }} />
          <label className="stack">YouTube links, playlist or channel
            <textarea data-testid="bring-in-urls" name="urls" rows={6} required placeholder={'https://www.youtube.com/watch?v=…\nhttps://www.youtube.com/watch?v=… | Speaker name\nhttps://www.youtube.com/playlist?list=…'} />
          </label>
          <label className="stack">Course <HelpTip topic="bring-in-course">{TOOL.bringInCourse}</HelpTip>
            <select name="course" data-testid="bring-in-course" defaultValue={body?.courseId ? String(body.courseId) : 'new'}>
              <option value="new">Create a new course</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label className="stack">New course name<input data-testid="bring-in-new-title" name="newTitle" defaultValue={body?.newTitle || ''} placeholder="Used only when Create a new course is chosen" /></label>
          <div className="cols">
            <label className="stack">Speaker for this course<input data-testid="bring-in-speaker" name="speaker" defaultValue={body?.courseSpeaker || ''} placeholder="Used when a line does not name one" /></label>
            <label className="stack">Caption language <HelpTip topic="bring-in-lang">{TOOL.bringInLanguage}</HelpTip>
              <select name="captionLang" data-testid="bring-in-lang" defaultValue={body?.lang || 'en'}>
                {CAPTION_LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="cols">
            <label className="stack">Jibril section <HelpTip topic="bring-in-jibril">{TOOL.bringInJibril}</HelpTip>
              <select name="jibril" data-testid="bring-in-jibril" defaultValue="">
                <option value="">None</option>
                {DOORS.map((door) => <option key={door.number} value={doorCode(door.number)}>{doorCode(door.number)} · {doorLabel(door)}</option>)}
              </select>
            </label>
            <label className="stack">Ghunya heading <HelpTip topic="bring-in-ghunya">{TOOL.bringInGhunya}</HelpTip>
              <input name="ghunya" data-testid="bring-in-ghunya" placeholder="Optional" />
            </label>
          </div>
          <div className="actions"><button className="btn ink" type="submit" data-testid="bring-in-lookup">Look up</button> <HelpTip topic="bring-in-lookup">{TOOL.bringInLookup}</HelpTip></div>
        </BusyForm>
      </section>

      {body?.rows?.length ? (
        <section className="panel" style={{ marginTop: 18 }} data-testid="bring-in-preview">
          <header>
            <div>
              <h2>Films to bring in <HelpTip topic="bring-in-skip">{TOOL.bringInSkip}</HelpTip></h2>
              <p>Untick any row you want to leave out. Short films, private or unavailable films, and ones already in the library start unticked.</p>
            </div>
          </header>
          <BusyForm className="body" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'commit-bring-in', next, preview: previewId }} />
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Bring in</th><th>Film</th><th>Length</th><th>Captions</th><th>Speaker <HelpTip topic="row-speaker">{TOOL.bringInSpeaker}</HelpTip></th><th>Jibril</th><th>Ghunya</th></tr></thead>
                <tbody>
                  {body.rows.map((row) => <PreviewRow key={`${row.id}-${row.index}`} row={row} />)}
                </tbody>
              </table>
            </div>
            <div className="actions" style={{ marginTop: 12 }}><button className="btn teal" type="submit" data-testid="bring-in-commit">Bring in ticked films</button></div>
          </BusyForm>
        </section>
      ) : null}

      {brought.length ? (
        <section className="panel" style={{ marginTop: 18 }} data-testid="bring-in-result">
          <header>
            <div>
              <h2>Status <HelpTip topic="bring-in-publish">{TOOL.bringInPublish}</HelpTip></h2>
              <p>These rows update while a film is queued or processing. Drafts stay hidden from learners until you publish them.</p>
            </div>
          </header>
          <div className="body">
            <BringInLive ids={lessonIds} />
            <BusyForm action="/api/hearts" method="post" style={{ marginTop: 16 }}>
              <Hidden fields={{ action: 'publish-talks', next: `${next}?lessons=${lessonIds.join(',')}` }} />
              {brought.map((lesson) => (
                <input key={lesson.id} type="hidden" name="lesson" value={lesson.id} />
              ))}
              <label className="check">
                <input type="checkbox" name="giveHolders" value="yes" data-testid="bring-in-give" /> Also give it to learners who already hold this pack
                <HelpTip topic="bring-in-give">{TOOL.bringInGiveHolders}</HelpTip>
              </label>
              <div className="actions"><button className="btn ink" type="submit" data-testid="bring-in-publish">Publish these talks</button></div>
            </BusyForm>
            <div style={{ marginTop: 16 }}>
              {brought.map((lesson) => <ResultRow key={lesson.id} lesson={lesson} next={`${next}?lessons=${lessonIds.join(',')}`} />)}
            </div>
          </div>
        </section>
      ) : null}

      {otherDrafts.length ? (
        <section className="panel" style={{ marginTop: 18 }} data-testid="bring-in-drafts">
          <header>
            <div>
              <h2>Draft talks <HelpTip topic="bring-in-publish">{TOOL.bringInPublish}</HelpTip></h2>
              <p>These include films from Bring in and from the master sheet. Learners cannot see them until you publish.</p>
              {draftList.more ? <p className="hint">This list shows the latest {draftList.talks.length}. Publish these, then open Bring in again for the rest.</p> : null}
            </div>
          </header>
          <div className="body">
            <BusyForm action="/api/hearts" method="post">
              <Hidden fields={{ action: 'publish-talks', next }} />
              {otherDrafts.map((talk) => <input key={talk.id} type="hidden" name="lesson" value={talk.id} />)}
              <label className="check">
                <input type="checkbox" name="giveHolders" value="yes" data-testid="bring-in-drafts-give" /> Also give them to learners who already hold this pack
                <HelpTip topic="bring-in-drafts-give">{TOOL.bringInGiveHolders}</HelpTip>
              </label>
              <div className="actions"><button className="btn ink" type="submit" data-testid="bring-in-publish-all">Publish all these drafts</button></div>
            </BusyForm>
            <div style={{ marginTop: 16 }}>
              {otherDrafts.map((talk) => (
                <div key={talk.id} data-testid="bring-in-draft-row" data-status={talk.status || 'draft'} style={{ marginBottom: 12 }}>
                  <p><b>{talk.title}</b> {talk.courseTitle ? <span className="hint">{talk.courseTitle}</span> : null} <span className="badge gold">Draft</span> {talk.status ? <span className="badge gold">{bringInStatusLabel(talk.status)}</span> : null}</p>
                  <BusyForm action="/api/hearts" method="post">
                    <Hidden fields={{ action: 'publish-talks', lesson: talk.id, next }} />
                    <label className="check">
                      <input type="checkbox" name="giveHolders" value="yes" /> Also give it to learners who already hold this pack
                    </label>
                    <div className="actions"><button className="btn ghost small" type="submit" data-testid="bring-in-publish-one">Publish this talk</button></div>
                  </BusyForm>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {user.role === 'master' ? (
        <>
          <section className="panel" style={{ marginTop: 18 }} data-testid="channel-map">
            <header><div><h2>Channel speakers <HelpTip topic="channel-map">{TOOL.bringInChannel}</HelpTip></h2><p>Used when the line and the course do not name a speaker.</p></div></header>
            <BusyForm className="body form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'save-channel-speaker', next }} />
              <div className="cols">
                <label className="stack">Channel id or name<input name="channelKey" data-testid="channel-key" required /></label>
                <label className="stack">Speaker<input name="speaker" data-testid="channel-speaker" required /></label>
              </div>
              <div className="actions"><button className="btn ghost" type="submit" data-testid="channel-save">Save mapping</button></div>
            </BusyForm>
            {mappings.length ? (
              <div className="body">
                {mappings.map((row) => (
                  <form key={row.id} action="/api/hearts" method="post" data-testid="channel-row">
                    <Hidden fields={{ action: 'delete-channel-speaker', next, mapping: row.id }} />
                    <span>{str(row.label) || str(row.channelKey)} → {str(row.speaker)}</span>
                    <button className="btn ghost small" type="submit">Remove</button>
                  </form>
                ))}
              </div>
            ) : null}
          </section>
          <section className="panel" style={{ marginTop: 18 }} data-testid="helper-tokens">
            <header>
              <div>
                <h2>Caption helper <HelpTip topic="helper-token">{TOOL.bringInHelper}</HelpTip></h2>
                <p>Create a token for the script on your own machine. It can only list waiting talks and attach a transcript.</p>
              </div>
            </header>
            <BusyForm className="body form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'create-helper-token', next }} />
              <label className="stack">Name<input name="label" data-testid="helper-label" placeholder="Home machine" /></label>
              <div className="actions"><button className="btn ink" type="submit" data-testid="helper-create">Create helper token</button></div>
            </BusyForm>
            <div className="body">
              {tokens.length ? tokens.map((row) => (
                <form key={row.id} action="/api/hearts" method="post" data-testid="helper-row" data-revoked={row.revokedAt ? 'yes' : 'no'}>
                  <Hidden fields={{ action: 'revoke-helper-token', next, token: row.id }} />
                  <p><b>{str(row.label)}</b> <span className="hint">{str(row.tokenPrefix)}… {row.revokedAt ? 'Revoked' : 'Active'}</span></p>
                  {row.revokedAt ? null : <button className="btn ghost small" type="submit" data-testid="helper-revoke">Revoke</button>}
                </form>
              )) : <p className="hint">No helper tokens yet.</p>}
              <p className="hint">Run instructions are in <code>scripts/bring-in-helper/README.md</code>.</p>
            </div>
          </section>
        </>
      ) : null}
      <p className="hint" style={{ marginTop: 18 }}><Link href={next.startsWith('/master') ? '/master/library' : next.replace('/bring-in', '/content')}>Back to the course tree</Link></p>
    </div>
  )
}

export async function PortalBringInScreen(ctx: Ctx) {
  const courses = await rows(ctx.payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: ctx.portal.id } }] }, { sort: 'title', limit: 500 })
  return (
    <AdminFrame ctx={ctx} active="bring-in" title="Bring in" intro="Paste YouTube links, a playlist or a channel. Films arrive as drafts. Learners see a talk only after you publish it." testId="admin-bring-in">
      <BringInBody
        payload={ctx.payload}
        user={ctx.user}
        next={`${ctx.base}/admin/bring-in`}
        courses={courses.map((course) => ({ id: course.id, title: str(course.title), speaker: str(course.speaker) }))}
        query={ctx.query}
      />
    </AdminFrame>
  )
}

function PreviewRow({ row }: { row: BringInRow }) {
  const locked = row.skipReason === 'library' || row.skipReason === 'duplicate'
  return (
    <tr data-testid="bring-in-row" data-id={row.id} data-skip={row.skipReason || 'no'}>
      <td>
        <input type="checkbox" name="pick" value={row.index} defaultChecked={row.selected} disabled={locked} data-testid="bring-in-pick" aria-label={`Bring in ${row.title}`} />
      </td>
      <td>{row.title}{row.skipReason ? <div className="hint">{skipLabel(row.skipReason)}</div> : null}</td>
      <td>{row.durationSeconds ? clock(row.durationSeconds) : 'Length unknown'}</td>
      <td data-testid="bring-in-captions">{captionsLabel(row.captions)}</td>
      <td><input name={`speaker-${row.index}`} defaultValue={row.speaker} data-testid="bring-in-row-speaker" /></td>
      <td>
        <select name={`jibril-${row.index}`} defaultValue={row.jibril} data-testid="bring-in-row-jibril">
          <option value="">None</option>
          {DOORS.map((door) => <option key={door.number} value={doorCode(door.number)}>{doorCode(door.number)}</option>)}
        </select>
      </td>
      <td><input name={`ghunya-${row.index}`} defaultValue={row.ghunya} data-testid="bring-in-row-ghunya" /></td>
    </tr>
  )
}

function ResultRow({ lesson, next }: { lesson: Row; next: string }) {
  const status = bringInStatus(str(lesson.transcriptNote))
  const retry = status === 'failed' || status === 'waiting'
  return (
    <div data-testid="bring-in-saved" data-status={status || 'saved'} style={{ marginBottom: 12 }}>
      <p><b>{str(lesson.title)}</b> {lesson.publishState === 'draft' ? <span className="badge gold">Draft</span> : <span className="badge teal">Published</span>} {status ? <span className="badge gold">{bringInStatusLabel(status)}</span> : null}</p>
      {retry ? (
        <BusyForm action="/api/hearts" method="post">
          <Hidden fields={{ action: 'ingest', lesson: lesson.id, next, retry: 'yes', url: `https://www.youtube.com/watch?v=${str(lesson.youtubeId)}`, fetchTranscript: 'yes', captionLang: 'en' }} />
          <button className="btn ghost small" type="submit" data-testid="bring-in-retry">Try again</button>
        </BusyForm>
      ) : null}
    </div>
  )
}
