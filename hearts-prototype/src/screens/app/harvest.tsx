import Link from 'next/link'
import type { Payload } from 'payload'
import { Mascot } from '@/components/brand'
import { COLLECTION_NAMES, commentaryFor, isNewMoment, type ScholarCitation } from '@/lib/harvest'
import { ayahId as idOfAyah, ayahWindow, surahLabel } from '@/lib/quran-match'
import { TAFSIR_CREDIT } from '@/lib/tafsir'
import { getSession } from '@/server/context'
import { quranIndex, tafsirFor, tafsirSummary } from '@/server/scripture'
import { now } from '@/lib/clock'
import { type Ctx, type Row, ref, rows, str, unreadCount } from '../common'
import { Frame } from './garden'
import { loadDoors } from '@/server/doors'
import { doorByNumber, doorCode, doorNumberOfClause, type Door } from '@/lib/doors'
import { partTitle } from '@/lib/talk-title'
import { resourcesFor, sampleHarvest } from '@/server/harvest'

export const REPLAY_LEAD_SECONDS = 5

export function replayHref(base: string, courseId: number | null, lessonId: number | null, seconds: number) {
  if (!courseId || !lessonId) return null
  return `${base}/course/${courseId}?part=${lessonId}&t=${Math.max(0, Math.floor(seconds) - REPLAY_LEAD_SECONDS)}`
}

function secondsOf(entry: Row) {
  if (typeof entry.seconds === 'number') return entry.seconds
  const parts = str(entry.timestamp).split(':').map(Number)
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

/** Which Jibril door each talk sits in: its confirmed tags first, then its cuts' best clause, counted by door. */
async function doorsOfLessons(payload: Payload, lessonIds: number[], doors: Door[]) {
  const out = new Map<number, number>()
  if (!lessonIds.length) return out
  const cuts = await rows(payload, 'cuts', { lesson: { in: lessonIds } }, { limit: 2000 })
  const tags = cuts.length ? await rows(payload, 'tags', { state: { equals: 'confirmed' } }, { limit: 2000 }) : []
  const clauses = await rows(payload, 'clauses', undefined, { limit: 50 })
  const numberOf = new Map(clauses.map((clause) => [clause.id, Number(clause.number)]))
  for (const lessonId of lessonIds) {
    const counts = new Map<number, number>()
    const mine = cuts.filter((cut) => ref(cut.lesson) === lessonId)
    for (const tag of tags) {
      const cutId = ref((tag.item as { value?: unknown } | undefined)?.value)
      if (!mine.some((cut) => cut.id === cutId)) continue
      const door = doorNumberOfClause(numberOf.get(ref(tag.clause) || 0), doors)
      if (door) counts.set(door, (counts.get(door) || 0) + 2)
    }
    for (const cut of mine) {
      const door = doorNumberOfClause(Number(cut.bestClause || 0), doors)
      if (door) counts.set(door, (counts.get(door) || 0) + (cut.status === 'approved' ? 1 : 0.5))
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]
    if (best) out.set(lessonId, best[0])
  }
  return out
}

type View = 'context' | 'scholars' | 'summary' | 'tafsir'

export async function GardenHarvest({ payload, user, base, query }: Ctx) {
  const session = await getSession()
  const reader = session.actor || user
  const [own, unread, drawn] = await Promise.all([
    rows(payload, 'harvest-entries', { user: { equals: user.id } }, { sort: '-createdAt', limit: 1000 }),
    unreadCount(payload, user),
    rows(payload, 'drawn-to', { user: { equals: user.id } }, { sort: '-learnMore', limit: 12 }),
  ])
  const sample = own.length ? [] : await sampleHarvest(payload)
  const entries: Row[] = own.length ? own : sample.map((item) => ({ ...item, sample: true, lesson: item.lessonId, createdAt: item.gatheredAt } as unknown as Row))
  const kind = query.kind === 'quran' || query.kind === 'hadith' || query.kind === 'line' ? query.kind : 'all'
  const group = query.group === 'door' || query.group === 'clause' ? 'door' : query.group === 'speaker' ? 'speaker' : 'talk'
  const doorFilter = Number(query.door) || null
  const speakerFilter = query.speaker ? String(query.speaker) : null
  const openId = Number(query.item) || null
  const view = (['context', 'scholars', 'summary', 'tafsir'] as View[]).includes(query.view as View) ? (query.view as View) : null
  const lessonIds = [...new Set(entries.map((row) => ref(row.lesson)).filter((id): id is number => Boolean(id)))]
  const doors = await loadDoors(payload)
  const [lessons, doorOfLesson, resources] = await Promise.all([
    lessonIds.length ? rows(payload, 'lessons', { id: { in: lessonIds } }) : Promise.resolve([] as Row[]),
    doorsOfLessons(payload, lessonIds, doors),
    resourcesFor(payload, lessonIds),
  ])
  const courseIds = [...new Set(lessons.map((lesson) => ref(lesson.course)).filter((id): id is number => Boolean(id)))]
  const courses = courseIds.length ? await rows(payload, 'courses', { id: { in: courseIds } }) : []
  const talkName = (lesson: Row | undefined) => lesson ? partTitle(lesson, str(courses.find((course) => course.id === ref(lesson.course))?.title)) : 'A talk'
  const doorOf = (entry: Row) => Number(entry.door) || doorOfLesson.get(ref(entry.lesson) || 0) || null
  const speakerOf = (entry: Row) => str(entry.speaker) || str(lessons.find((row) => row.id === ref(entry.lesson))?.speaker)
  const counts = { all: entries.length, quran: entries.filter((row) => row.kind === 'quran').length, hadith: entries.filter((row) => row.kind === 'hadith').length, line: entries.filter((row) => row.kind === 'line').length }
  const shown = entries.filter((row) => (kind === 'all' || row.kind === kind) && (!doorFilter || doorOf(row) === doorFilter) && (!speakerFilter || speakerOf(row) === speakerFilter))
  const doorsHere = [...new Set(entries.map(doorOf).filter((n): n is number => Boolean(n)))].sort((a, b) => a - b)
  const speakersHere = [...new Set(entries.map(speakerOf).filter(Boolean))].sort()
  const at = now()
  const fresh = new Set(entries.filter((row) => !row.seenAt && (row.sample ? isNewMoment(str(row.gatheredAt), null, at) : true)).map((row) => row.id))
  if (fresh.size && own.length && reader.id === user.id) {
    const at = now().toISOString()
    await payload.update({ collection: 'harvest-entries', overrideAccess: true, where: { and: [{ user: { equals: user.id } }, { id: { in: [...fresh] } }] }, data: { seenAt: at } as never })
  }

  const href = (params: Record<string, string | number | null | undefined>, anchor?: string) => {
    const merged: Record<string, string> = {}
    const next = { kind: kind === 'all' ? null : kind, group: group === 'talk' ? null : group, door: doorFilter, speaker: speakerFilter, ...params }
    for (const [key, value] of Object.entries(next)) if (value !== null && value !== undefined && value !== '') merged[key] = String(value)
    const search = new URLSearchParams(merged).toString()
    return `${base}/garden/harvest${search ? `?${search}` : ''}${anchor ? `#${anchor}` : ''}`
  }

  const groups = new Map<string, { title: string; key: string; order: number; items: Row[] }>()
  for (const entry of shown) {
    const lessonId = ref(entry.lesson)
    const lesson = lessons.find((row) => row.id === lessonId)
    let key = `talk-${lessonId || 0}`
    let title = talkName(lesson)
    let order = 0
    if (group === 'door') {
      const door = doorByNumber(doorOf(entry), doors)
      key = door ? `door-${door.number}` : 'door-none'
      title = door ? `Door ${door.number} · ${door.title}` : 'Not yet placed on the hadith'
      order = door ? door.number : 999
    } else if (group === 'speaker') {
      const speaker = speakerOf(entry)
      key = `speaker-${speaker || 'none'}`
      title = speaker || 'Speaker not named'
    }
    if (!groups.has(key)) groups.set(key, { key, title, order, items: [] })
    groups.get(key)!.items.push(entry)
  }
  const sections = [...groups.values()].sort((a, b) => (group === 'door' ? a.order - b.order : group === 'speaker' ? a.title.localeCompare(b.title) : 0))
  for (const section of sections) section.items.sort((a, b) => secondsOf(a) - secondsOf(b))

  const opened = openId ? shown.find((row) => row.id === openId) : null
  const panel = opened && view ? await openPanel(payload, opened, view, href) : null

  return (
    <Frame base={base} title="Harvest" testId="garden-harvest" unread={unread}>
      <p className="lead">Verses, hadith and lines from the talks you watch, in the speaker’s own words. Tap a card to hear that moment again.</p>
      {drawn.length ? (
        <section className="card" data-testid="drawn-to" style={{ marginBottom: 16 }}>
          <p className="eyebrow">Drawn to</p>
          {drawn.map((row) => (
            <p key={row.id} data-testid="drawn-speaker" style={{ margin: '6px 0' }}>
              <Link href={`${base}/speaker/${str(row.speakerSlug)}`}><b>{str(row.speaker)}</b></Link>
              <span className="drawn-meta"> · stayed {Number(row.linger) || 0} · learned more {Number(row.learnMore) || 0}</span>
            </p>
          ))}
        </section>
      ) : null}
      {!own.length && sample.length ? <p className="demo-note" data-testid="harvest-sample">A sample from real talks. Lines you watch in the feed, and the verses and hadith of talks you finish, will replace it.</p> : null}
      {entries.length ? (
        <>
          <div className="chip-row" data-testid="harvest-filters">
            {(['all', 'quran', 'hadith', 'line'] as const).filter((key) => key !== 'line' || counts.line).map((key) => (
              <Link key={key} className={kind === key ? 'on' : ''} href={href({ kind: key === 'all' ? null : key })} data-testid={`harvest-filter-${key}`}>
                {key === 'all' ? 'All' : key === 'quran' ? 'Qur’an' : key === 'hadith' ? 'Hadith' : 'Lines'} <span className="count">{counts[key]}</span>
              </Link>
            ))}
          </div>
          <div className="chip-row soft" data-testid="harvest-grouping">
            <Link className={group === 'talk' ? 'on' : ''} href={href({ group: null })} data-testid="harvest-group-talk">By talk</Link>
            <Link className={group === 'door' ? 'on' : ''} href={href({ group: 'door' })} data-testid="harvest-group-door">By the doors of Jibril</Link>
            <Link className={group === 'speaker' ? 'on' : ''} href={href({ group: 'speaker' })} data-testid="harvest-group-speaker">By speaker</Link>
          </div>
          {doorsHere.length > 1 ? (
            <div className="chip-row quiet" data-testid="harvest-door-filter">
              <Link className={!doorFilter ? 'on' : ''} href={href({ door: null })}>Every door</Link>
              {doorsHere.map((number) => (
                <Link key={number} className={doorFilter === number ? 'on' : ''} href={href({ door: number })} data-testid="harvest-door" data-door={number} title={doorByNumber(number, doors)?.title}>{doorCode(number)}</Link>
              ))}
            </div>
          ) : null}
          {speakersHere.length > 1 ? (
            <div className="chip-row quiet" data-testid="harvest-speaker-filter">
              <Link className={!speakerFilter ? 'on' : ''} href={href({ speaker: null })}>Every speaker</Link>
              {speakersHere.map((name) => (
                <Link key={name} className={speakerFilter === name ? 'on' : ''} href={href({ speaker: name })} data-testid="harvest-speaker" data-speaker={name}>{name}</Link>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <div data-testid="harvest">
        {sections.map((section) => (
          <section key={section.key} className="harvest-group" data-testid="harvest-group" data-group={section.key}>
            <h3 className="harvest-group-title">{section.title}</h3>
            {section.items.map((entry) => {
              const lessonId = ref(entry.lesson)
              const lesson = lessons.find((row) => row.id === lessonId)
              const commentary = entry.kind === 'line' || !entry.reference ? ((entry.commentary as ScholarCitation | undefined) ?? commentaryFor(str(lesson?.transcript), secondsOf(entry), resources.get(lessonId || 0) || [])) : null
              const courseId = lesson ? ref(lesson.course) : null
              return (
                <HarvestCard
                  key={entry.id}
                  entry={entry}
                  talkTitle={talkName(lesson)}
                  speaker={speakerOf(entry)}
                  door={doorByNumber(doorOf(entry), doors)}
                  commentary={commentary}
                  context={courseId && lessonId && lesson?.transcript ? `${base}/course/${courseId}?part=${lessonId}&t=${Math.floor(secondsOf(entry))}&context=1` : null}
                  fresh={fresh.has(entry.id)}
                  replay={replayHref(base, lesson ? ref(lesson.course) : null, lessonId, secondsOf(entry))}
                  href={href}
                  open={opened?.id === entry.id ? view : null}
                  panel={opened?.id === entry.id ? panel : null}
                />
              )
            })}
          </section>
        ))}
        {!entries.length ? (
          <div className="empty-state" data-testid="harvest-empty">
            <Mascot width={110} />
            <p>Nothing gathered yet. Lines you watch in the feed, and the verses and hadith of talks you finish, are collected here.</p>
          </div>
        ) : !shown.length ? (
          <p className="muted" data-testid="harvest-none">Nothing of this kind yet.</p>
        ) : null}
      </div>
    </Frame>
  )
}

function HarvestCard({ entry, talkTitle, speaker, door, commentary, context, fresh, replay, href, open, panel }: {
  entry: Row
  talkTitle: string
  speaker: string
  door: Door | null
  commentary: ScholarCitation | null
  context: string | null
  fresh: boolean
  replay: string | null
  href: (params: Record<string, string | number | null | undefined>, anchor?: string) => string
  open: View | null
  panel: React.ReactNode
}) {
  const quran = entry.kind === 'quran'
  const line = entry.kind === 'line'
  const index = quran && entry.surah && entry.ayah ? quranIndex() : null
  const ayahId = index ? idOfAyah(index, Number(entry.surah), Number(entry.ayah)) : -1
  const hadithMatched = !quran && Boolean(entry.collection && entry.hadithText)
  const anchor = `h-${entry.id}`
  const quote = (
    <>
      <blockquote data-testid="harvest-quote">{str(entry.text)}</blockquote>
      <small className="harvest-when">
        {replay ? <span className="play" aria-hidden="true">▶</span> : null}
        {talkTitle}
        {speaker ? ` · ${speaker}` : ''}
        {entry.timestamp ? ` · at ${str(entry.timestamp)}` : ''}
      </small>
      {door ? <small className="harvest-door" data-testid="harvest-item-door" data-door={door.number}>{doorCode(door.number)} · {door.title}</small> : null}
    </>
  )
  return (
    <article id={anchor} className={`harvest-card${fresh ? ' fresh' : ''}`} data-testid="harvest-item" data-kind={str(entry.kind)} data-matched={index || hadithMatched ? 'yes' : 'no'} data-door={door?.number || ''} data-speaker={speaker} data-surface={str(entry.surface)}>
      <header>
        <span className={`tag ${quran ? 'quran' : line ? 'line' : 'hadith'}`}>{quran ? 'Qur’an' : line ? 'Line' : 'Hadith'}</span>
        {fresh ? <span className="harvest-new" data-testid="harvest-new">New</span> : null}
        <small data-testid="harvest-reference">{str(entry.reference)}</small>
      </header>
      {replay ? (
        <Link className="harvest-replay" href={replay} data-testid="harvest-replay" aria-label={`Hear this moment again${entry.timestamp ? `, at ${str(entry.timestamp)}` : ''}`}>
          {quote}
        </Link>
      ) : (
        <div className="harvest-replay">{quote}</div>
      )}
      {index && ayahId >= 0 ? (
        <div className="harvest-ayah" data-testid="harvest-ayah">
          <p className="ar" lang="ar" dir="rtl">{index.corpus.ar[ayahId]}</p>
          <p className="en">{index.corpus.en[ayahId]}</p>
          <small>{surahLabel(index, Number(entry.surah), Number(entry.ayah))} · Saheeh International</small>
        </div>
      ) : null}
      {index || hadithMatched ? (
        <div className="harvest-actions">
          <Link className={open === 'context' ? 'on' : ''} href={open === 'context' ? href({}, anchor) : href({ item: entry.id, view: 'context' }, anchor)} data-testid="harvest-context">See it in context</Link>
          {index ? (
            <Link className={open && open !== 'context' ? 'on' : ''} href={open && open !== 'context' ? href({}, anchor) : href({ item: entry.id, view: 'scholars' }, anchor)} data-testid="harvest-scholars">What do the scholars say?</Link>
          ) : null}
        </div>
      ) : null}
      {!index && !hadithMatched && (context || commentary) ? (
        <div className="harvest-actions">
          {context ? <Link href={context} data-testid="harvest-line-context">See it in context</Link> : null}
        </div>
      ) : null}
      {!index && commentary ? (
        <details data-testid="harvest-commentary">
          <summary>What do the scholars say?</summary>
          <blockquote data-testid="harvest-commentary-text">{commentary.text}</blockquote>
          <small data-testid="harvest-commentary-source">{commentary.citation}</small>
        </details>
      ) : null}
      {panel}
    </article>
  )
}

async function openPanel(payload: Payload, entry: Row, view: View, href: (params: Record<string, string | number | null | undefined>, anchor?: string) => string) {
  const anchor = `h-${entry.id}`
  if (entry.kind === 'hadith') {
    if (view !== 'context' || !entry.collection || !entry.hadithText) return null
    return (
      <div className="harvest-panel" data-testid="harvest-panel" data-view="context">
        <p className="eyebrow">In context</p>
        {entry.hadithArabic ? <p className="ar" lang="ar" dir="rtl">{str(entry.hadithArabic)}</p> : null}
        <p className="en" data-testid="hadith-text">{str(entry.hadithText)}</p>
        <small data-testid="hadith-source">
          {str(entry.reference) || COLLECTION_NAMES[str(entry.collection)]}
          {entry.grading ? ` · Grading: ${str(entry.grading)}` : ''}
        </small>
        <small className="credit">From the open hadith API by fawazahmed0 (Unlicense).</small>
      </div>
    )
  }
  if (!entry.surah || !entry.ayah) return null
  const surah = Number(entry.surah)
  const ayah = Number(entry.ayah)
  const index = quranIndex()
  if (view === 'context') {
    return (
      <div className="harvest-panel" data-testid="harvest-panel" data-view="context">
        <p className="eyebrow">In context · {surahLabel(index, surah, Math.max(1, ayah - 3)).replace(/:\d+$/, '')} {Math.max(1, ayah - 3)}–{Math.min(index.corpus.surahs[surah - 1].verses, ayah + 3)}</p>
        {ayahWindow(index, surah, ayah).map((row) => (
          <div key={row.ayah} className={`context-ayah${row.focus ? ' focus' : ''}`} data-testid="context-ayah" data-focus={row.focus ? 'yes' : 'no'}>
            <span className="num">{row.ayah}</span>
            <p className="ar" lang="ar" dir="rtl">{row.arabic}</p>
            <p className="en">{row.english}</p>
          </div>
        ))}
        <small className="credit">{index.corpus.sources.arabic}. {index.corpus.sources.english}.</small>
      </div>
    )
  }
  if (view === 'scholars') {
    return (
      <div className="harvest-panel" data-testid="harvest-panel" data-view="scholars">
        <p className="eyebrow">What do the scholars say?</p>
        <div className="scholar-choices">
          <Link href={href({ item: entry.id, view: 'summary' }, anchor)} data-testid="scholars-summary">A short summary</Link>
          <Link href={href({ item: entry.id, view: 'tafsir' }, anchor)} data-testid="scholars-tafsir">Read the tafsir</Link>
        </div>
      </div>
    )
  }
  if (view === 'summary') {
    const summary = await tafsirSummary(payload, surah, ayah)
    if (!summary) return <div className="harvest-panel" data-testid="harvest-panel" data-view="summary"><p className="muted">The tafsir could not be reached just now. Please try again later.</p></div>
    return (
      <div className="harvest-panel" data-testid="harvest-panel" data-view="summary">
        <p className="eyebrow" data-testid="summary-label">{summary.label}</p>
        <p className="summary-text" data-testid="summary-text">{summary.text}</p>
        <Link href={href({ item: entry.id, view: 'tafsir' }, anchor)} data-testid="summary-full">Read the full tafsir</Link>
      </div>
    )
  }
  const texts = await tafsirFor(payload, surah, ayah)
  return (
    <div className="harvest-panel" data-testid="harvest-panel" data-view="tafsir">
      <p className="eyebrow">Tafsir of {surahLabel(index, surah, ayah)}</p>
      {texts.length ? texts.map((row) => (
        <section key={row.slug} className="tafsir-source" data-testid="tafsir-source" data-source={row.slug}>
          <h4 data-testid="tafsir-title">{row.title} <span>({row.language})</span></h4>
          <small>{row.author} · {row.note}</small>
          <div className={`tafsir-text${row.language === 'Arabic' ? ' ar' : ''}`} {...(row.language === 'Arabic' ? { lang: 'ar', dir: 'rtl' } : {})}>
            {row.text.split(/\n+/).filter(Boolean).map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </section>
      )) : <p className="muted">The tafsir could not be reached just now. Please try again later.</p>}
      <small className="credit">{TAFSIR_CREDIT}</small>
    </div>
  )
}
