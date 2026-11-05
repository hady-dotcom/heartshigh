import Link from 'next/link'
import type { Payload } from 'payload'
import { ExampleInUse } from '@/components/app/care'
import { Hidden } from '@/components/app/shell'
import { DeleteInline } from '@/components/desk/delete-controls'
import { matchApprovedTeacher, teacherChoices } from '@/lib/approved-teachers'
import { DOORS } from '@/lib/doors'
import {
  ADDED_CHOICES,
  LENGTH_CHOICES,
  SOURCE_CHOICES,
  STATUS_CHOICES,
  filterLibraryTalks,
  hjLabel,
  pageTalks,
  shownInLibrary,
  talkListHref,
  watchHref,
  type LibraryTalk,
  type TalkFilters,
} from '@/lib/library-talks'
import { isUnderMinTalk } from '@/lib/talk-length'
import { loadLibraryTalk, loadLibraryTalks } from '@/server/library-talks'
import { clock } from '../common'

type TalkQuery = {
  q?: string
  teacher?: string
  door?: string
  status?: string
  length?: string
  source?: string
  added?: string
  tp?: string
}

function filtersOf(query: TalkQuery): TalkFilters {
  return {
    q: query.q || '',
    teacher: query.teacher || '',
    door: query.door || '',
    status: query.status || '',
    length: query.length || '',
    source: query.source || '',
    added: query.added || '',
  }
}

function teacherLabel(name: string) {
  return matchApprovedTeacher(name)?.displayName || name
}

function statusLabel(status: LibraryTalk['status']) {
  return STATUS_CHOICES.find((choice) => choice.value === status)?.label || status
}

function sourceLabel(source: LibraryTalk['source']) {
  if (source === 'youtube') return 'YouTube'
  if (source === 'vimeo') return 'Vimeo'
  return ''
}

function addedLabel(iso: string) {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return ''
  return new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function lengthLabel(seconds: number | null) {
  return seconds ? clock(seconds) : 'Length not known yet'
}

export async function TalkFinder({ payload, base, bringInHref, query }: { payload: Payload; base: string; bringInHref: string; query: TalkQuery }) {
  const filters = filtersOf(query)
  const matched = filterLibraryTalks(await loadLibraryTalks(payload), filters)
  const paged = pageTalks(matched, Number(query.tp) || 1)
  const filtering = Object.values(filters).some((value) => String(value || '').trim())
  const teachers = teacherChoices()
  return (
    <section className="panel" data-testid="library-talks" style={{ marginBottom: 18 }}>
      <header>
        <div>
          <h2>Talks</h2>
          <p>Search titles, teachers, series, tags and doors HJ1 to HJ20.</p>
        </div>
      </header>
      <form className="talk-filters" action={base} method="get" data-testid="library-talk-filters">
        <label className="stack">Search
          <input className="field" type="search" name="q" defaultValue={filters.q} placeholder="Title, teacher, series, tag or door" data-testid="library-talk-search" />
        </label>
        <label className="stack">Teacher
          <select name="teacher" defaultValue={filters.teacher} data-testid="filter-teacher">
            <option value="">Any approved teacher</option>
            {teachers.map((teacher) => <option key={teacher.slug} value={teacher.slug}>{teacher.displayName}</option>)}
          </select>
        </label>
        <label className="stack">Door
          <select name="door" defaultValue={filters.door} data-testid="filter-door">
            <option value="">Any door</option>
            {DOORS.map((door) => <option key={door.number} value={`HJ${door.number}`}>{hjLabel(door.number)}</option>)}
          </select>
        </label>
        <label className="stack">Status
          <select name="status" defaultValue={filters.status} data-testid="filter-status">
            <option value="">Any status</option>
            {STATUS_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
        </label>
        <label className="stack">Length
          <select name="length" defaultValue={filters.length} data-testid="filter-length">
            <option value="">Any length</option>
            {LENGTH_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
        </label>
        <label className="stack">Where it plays
          <select name="source" defaultValue={filters.source} data-testid="filter-source">
            <option value="">YouTube or Vimeo</option>
            {SOURCE_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
        </label>
        <label className="stack">Date added
          <select name="added" defaultValue={filters.added} data-testid="filter-added">
            <option value="">Any time</option>
            {ADDED_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
        </label>
        <div className="actions">
          <button className="btn ink small" type="submit" data-testid="library-talk-apply">Show talks</button>
          {filtering ? <Link className="btn ghost small" href={base} data-testid="library-talk-clear">Show every talk</Link> : null}
        </div>
      </form>
      <div className="body">
        {paged.total ? <p data-testid="library-talk-count">{paged.total === 1 ? '1 talk' : `${paged.total} talks`}</p> : null}
        {paged.talks.map((talk) => {
          const door = talk.door ? hjLabel(talk.door) : ''
          return (
            <article key={talk.id} className="talk-card" data-testid="library-talk" data-door={talk.door ? `HJ${talk.door}` : ''} data-status={talk.status} data-source={talk.source}>
              <Link href={`${base}/talk/${talk.id}`} data-testid="talk-open">{talk.title}</Link>
              <p className="hint">
                {teacherLabel(talk.teacher)}
                {talk.series ? ` · ${talk.series}` : ''}
                {door ? ` · ${door}` : ''}
                {` · ${lengthLabel(talk.durationSeconds)}`}
                {sourceLabel(talk.source) ? ` · ${sourceLabel(talk.source)}` : ''}
                {` · ${statusLabel(talk.status)}`}
              </p>
            </article>
          )
        })}
        {!paged.total ? (
          <ExampleInUse desk testId="library-talk-empty" title="The Names, class 20" action={{ href: filtering ? base : bringInHref, label: filtering ? 'Show every talk' : 'Bring a talk in' }}>
            <p>Shaykh Mikaeel Smith · The Names · HJ10 · YouTube · 47 minutes</p>
          </ExampleInUse>
        ) : null}
        {paged.pages > 1 ? (
          <p className="page-row">
            {paged.page > 1 ? <Link className="btn ghost small" href={talkListHref(base, filters, paged.page - 1)} data-testid="talks-prev">Previous</Link> : null}
            <span>Page {paged.page} of {paged.pages}</span>
            {paged.page < paged.pages ? <Link className="btn ghost small" href={talkListHref(base, filters, paged.page + 1)} data-testid="talks-next">Next</Link> : null}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function hiddenReason(talk: LibraryTalk) {
  if (talk.binned) return 'This talk is in the bin, so learners and courses do not show it.'
  if (talk.tooShort || isUnderMinTalk(talk.durationSeconds)) return 'This talk is under 5 minutes, so it stays hidden.'
  if (talk.source !== 'youtube' && talk.source !== 'vimeo') return 'The library lists YouTube and Vimeo talks.'
  if (!matchApprovedTeacher(talk.teacher)) return 'This teacher is not on the approved list, so the library does not list this talk.'
  return ''
}

export async function TalkDetail({
  payload,
  id,
  base,
  courseBase,
  binHref,
  bringInHref,
  manageAll,
  portalId,
}: {
  payload: Payload
  id: number
  base: string
  courseBase: string
  binHref: string
  bringInHref: string
  manageAll: boolean
  portalId: number | null
}) {
  const talk = await loadLibraryTalk(payload, id)
  if (!talk) return (
    <ExampleInUse desk testId="talk-missing" title="The Names, class 20" action={{ href: base, label: 'Back to the library' }}>
      <p>That talk is not in the library.</p>
    </ExampleInUse>
  )
  const course = talk.courseId
    ? await payload.findByID({ collection: 'courses', id: talk.courseId, depth: 0, overrideAccess: true }).catch(() => null) as { origin?: string | null; portal?: unknown } | null
    : null
  const coursePortal = typeof course?.portal === 'number' ? course.portal : null
  const manage = manageAll || (course?.origin === 'local' && portalId != null && coursePortal === portalId)
  const bin = manage
    ? await payload.find({
      collection: 'desk-bin',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { and: [{ kind: { equals: 'lesson' } }, { recordId: { equals: talk.id } }, { undone: { not_equals: true } }] },
    })
    : null
  const binId = bin?.docs[0]?.id || 0
  const watch = watchHref(talk)
  const courseHref = talk.courseId ? `${courseBase}/${talk.courseId}?part=${talk.id}` : courseBase
  const reason = hiddenReason(talk)
  const door = talk.door ? hjLabel(talk.door) : 'No door yet'
  const added = addedLabel(talk.addedAt)
  return (
    <section className="panel" data-testid="talk-detail" data-binned={talk.binned ? 'yes' : 'no'} data-status={talk.status}>
      <header>
        <div>
          <h2>{talk.title}</h2>
          <p>{teacherLabel(talk.teacher) || 'No teacher yet'}{talk.series ? ` · ${talk.series}` : ''}</p>
        </div>
      </header>
      <div className="body" style={{ display: 'grid', gap: 14 }}>
        {reason ? <p data-testid="talk-hidden-reason">{reason}</p> : null}
        <p>
          {door}
          {` · ${lengthLabel(talk.durationSeconds)}`}
          {sourceLabel(talk.source) ? ` · ${sourceLabel(talk.source)}` : ''}
          {` · ${statusLabel(talk.status)}`}
          {added ? ` · Added ${added}` : ''}
        </p>
        {talk.tags.length ? <p data-testid="talk-tags">Tags: {talk.tags.join(', ')}</p> : null}
        <div className="actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {watch ? <a className="btn ink" href={watch} target="_blank" rel="noopener noreferrer" data-testid="talk-watch">Watch</a> : null}
          {talk.courseId ? <Link className="btn ghost" href={courseHref} data-testid="talk-course">Open the course</Link> : null}
          {manage && talk.status === 'needs-captions' ? <Link className="btn ghost" href={`${courseHref}#transcript`} data-testid="talk-captions">Add the words</Link> : null}
          {manage && talk.status === 'draft' ? (
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'publish-talks', lesson: talk.id, next: `${base}/talk/${talk.id}` }} />
              <button className="btn ink" type="submit" data-testid="talk-publish">Publish this talk</button>
            </form>
          ) : null}
          {!manage ? <Link className="btn ghost" href={bringInHref} data-testid="talk-shared">Bring a talk in</Link> : null}
        </div>
        {manage && talk.binned && binId ? (
          <form action="/api/hearts" method="post">
            <Hidden fields={{ action: 'desk-undo', bin: binId, next: `${base}/talk/${talk.id}` }} />
            <button className="btn" type="submit" data-testid="talk-restore">Put back</button>
          </form>
        ) : null}
        {manage && !talk.binned ? (
          <DeleteInline kind="lesson" id={talk.id} next={binHref} testId="talk-bin" label="Move to the bin" />
        ) : null}
        {!shownInLibrary(talk) && !talk.binned ? <p className="hint">Learners do not see this talk.</p> : null}
      </div>
    </section>
  )
}
