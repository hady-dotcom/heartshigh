import Link from 'next/link'
import { cookies } from 'next/headers'
import { Mascot } from '@/components/brand'
import { HarvestSeen } from '@/components/app/harvest-seen'
import { now } from '@/lib/clock'
import { doorTitle, isNewMoment, WORKING_DOORS } from '@/lib/harvest'
import { ownHarvest, sampleHarvest, type HarvestView } from '@/server/harvest'
import { AppFrame, Back, TabBar } from '@/components/app/shell'
import { type Ctx, unreadCount } from '../common'

const KIND = { quran: "Qur'an", hadith: 'Hadith', line: 'Moment' } as const

function filtersOf(query: Ctx['query']) {
  const door = WORKING_DOORS.some((row) => row.key === query.door) ? query.door! : ''
  const speaker = query.speaker && query.speaker.length < 80 ? query.speaker : ''
  const group: 'door' | 'speaker' = query.group === 'speaker' ? 'speaker' : 'door'
  return { door, speaker, group }
}

function hrefFor(base: string, current: { door: string; speaker: string; group: string }, patch: Partial<{ door: string; speaker: string; group: string }>) {
  const next = { ...current, ...patch }
  const params = new URLSearchParams()
  if (next.door) params.set('door', next.door)
  if (next.speaker) params.set('speaker', next.speaker)
  if (next.group === 'speaker') params.set('group', 'speaker')
  const query = params.toString()
  return `${base}/garden/harvest${query ? `?${query}` : ''}`
}

function groupsOf(items: HarvestView[], by: 'door' | 'speaker') {
  const buckets = new Map<string, HarvestView[]>()
  for (const item of items) {
    const key = by === 'door' ? item.door || 'Other' : item.speaker || 'Speaker'
    const list = buckets.get(key) || []
    list.push(item)
    buckets.set(key, list)
  }
  const keys = [...buckets.keys()]
  if (by === 'door') {
    keys.sort((a, b) => {
      const ai = WORKING_DOORS.findIndex((door) => door.key === a)
      const bi = WORKING_DOORS.findIndex((door) => door.key === b)
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    })
  } else keys.sort((a, b) => a.localeCompare(b))
  return keys.map((key) => ({
    key,
    title: by === 'door' ? doorTitle(key === 'Other' ? '' : key) : key,
    items: buckets.get(key) || [],
  }))
}

export async function GardenHarvest({ payload, user, base, query }: Ctx) {
  const [own, unread, jar] = await Promise.all([ownHarvest(payload, user), unreadCount(payload, user), cookies()])
  const demo = own.length === 0
  const source = demo ? await sampleHarvest(payload) : own
  const seen = (() => {
    const raw = jar.get('hearts_harvest_seen')?.value
    if (!raw) return null
    try {
      const value = decodeURIComponent(raw)
      return Number.isNaN(new Date(value).getTime()) ? null : value
    } catch {
      return null
    }
  })()
  const at = now()
  const filters = filtersOf(query)
  const doors = WORKING_DOORS.filter((door) => source.some((item) => item.door === door.key))
  const speakers = [...new Set(source.map((item) => item.speaker).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const shown = source.filter((item) => (filters.door ? item.door === filters.door : true) && (filters.speaker ? item.speaker === filters.speaker : true))
  const groups = groupsOf(shown, filters.group)
  return (
    <AppFrame testId="garden-harvest">
      <div className="app-scroll">
        <Back href={`${base}/garden`} label="Garden" />
        <div className="app-head"><h1>Harvest</h1></div>
        <HarvestSeen at={at.toISOString()} />
        <p className="lead">Lines from the talks you watch, kept word for word from the transcript. A short clip adds a line here and does not mark the course part as watched.</p>
        {demo && source.length ? (
          <p className="demo-note" data-testid="harvest-demo">A sample, so you can see a harvest before you have watched. Yours replaces it as soon as a short clip plays.</p>
        ) : null}
        {source.length ? (
          <>
            <div className="chip-row quiet" data-testid="harvest-filter-door">
              <Link className={filters.door ? '' : 'on'} href={hrefFor(base, filters, { door: '' })}>All doors</Link>
              {doors.map((door) => (
                <Link key={door.key} className={filters.door === door.key ? 'on' : ''} href={hrefFor(base, filters, { door: door.key })}>{door.short}</Link>
              ))}
            </div>
            <div className="chip-row quiet" data-testid="harvest-filter-speaker">
              <Link className={filters.speaker ? '' : 'on'} href={hrefFor(base, filters, { speaker: '' })}>All speakers</Link>
              {speakers.map((speaker) => (
                <Link key={speaker} className={filters.speaker === speaker ? 'on' : ''} href={hrefFor(base, filters, { speaker })}>{speaker}</Link>
              ))}
            </div>
            <div className="chip-row quiet" data-testid="harvest-group-by">
              <Link className={filters.group === 'door' ? 'on' : ''} href={hrefFor(base, filters, { group: 'door' })}>By door</Link>
              <Link className={filters.group === 'speaker' ? 'on' : ''} href={hrefFor(base, filters, { group: 'speaker' })}>By speaker</Link>
            </div>
          </>
        ) : null}
        <div data-testid="harvest">
          {groups.map((group) => (
            <section className="harvest-group" key={group.key} data-testid="harvest-group" data-group={group.key}>
              <h2>{group.title}</h2>
              {group.items.map((item) => {
                const fresh = isNewMoment(item.gatheredAt, seen, at)
                const replay = item.courseId ? `${base}/course/${item.courseId}?part=${item.lessonId}&t=${Math.floor(item.seconds)}` : null
                return (
                  <article className="harvest-card" key={item.id} data-testid="harvest-item" data-door={item.door || 'Other'} data-speaker={item.speaker} data-new={fresh ? 'yes' : 'no'} data-kind={item.kind} data-surface={item.surface}>
                    <header>
                      <span>
                        {fresh ? <span className="harvest-new" data-testid="harvest-new">New</span> : null}
                        <span className={`tag ${item.kind}`}>{KIND[item.kind]}</span>
                      </span>
                      <small>{item.doorLabel}</small>
                    </header>
                    <blockquote>{item.text}</blockquote>
                    <small>{[item.speaker, item.lessonTitle, item.timestamp ? `at ${item.timestamp}` : ''].filter(Boolean).join(' · ')}</small>
                    {replay ? (
                      <div className="harvest-actions">
                        <Link className="pill outline small" href={replay} data-testid="harvest-replay">Play from {item.timestamp}</Link>
                        <Link className="pill outline small" href={`${replay}&context=1`} data-testid="harvest-context-link">See it in context</Link>
                      </div>
                    ) : null}
                    {item.commentary ? (
                      <details data-testid="scholars">
                        <summary>What do the scholars say</summary>
                        <p className="muted" data-testid="scholar-source">{item.commentary.citation}</p>
                        <blockquote data-testid="scholar-text">{item.commentary.text}</blockquote>
                      </details>
                    ) : null}
                  </article>
                )
              })}
            </section>
          ))}
          {!shown.length ? (
            <div className="empty-state" data-testid={source.length ? 'harvest-filter-empty' : 'harvest-empty'}>
              <Mascot width={110} />
              <p>{source.length ? 'Nothing in this door or from this speaker.' : 'Nothing gathered yet. When a short clip plays, the line you are hearing is kept here.'}</p>
            </div>
          ) : null}
        </div>
      </div>
      <TabBar base={base} active="garden" unread={unread} />
    </AppFrame>
  )
}
