import Link from 'next/link'
import { AppFrame, Back, TabBar } from '@/components/app/shell'
import { SearchBox } from '@/components/app/search-box'
import { groupHits } from '@/lib/learner-search'
import { searchPortal } from '@/server/learner-search'
import { unreadCount, type Ctx } from '../common'

export async function SearchScreen({ payload, user, portal, base, query }: Ctx) {
  const q = typeof query.q === 'string' ? query.q : ''
  const unread = await unreadCount(payload, user)
  const hits = q.trim() ? await searchPortal(payload, user, portal, base, q) : []
  const groups = groupHits(hits)
  return (
    <AppFrame testId="search" evening>
      <div className="app-scroll">
        <Back href={base} label="Home" />
        <div className="app-head">
          <h1>Search</h1>
        </div>
        <SearchBox action={`${base}/search`} defaultValue={q} />
        {!q.trim() ? <p className="muted">Type a talk, a speaker or a topic.</p> : null}
        {q.trim() && !hits.length ? <p data-testid="search-empty">Nothing in this portal matched that.</p> : null}
        {groups.talks.length ? (
          <section data-testid="search-talks">
            <p className="eyebrow">Talks</p>
            {groups.talks.map((hit) => (
              <Link key={`t-${hit.id}`} className="list-link" href={hit.href} data-testid="search-hit">
                <span className="grow">{hit.title}<small>{hit.sub}</small></span>›
              </Link>
            ))}
          </section>
        ) : null}
        {groups.courses.length ? (
          <section data-testid="search-courses">
            <p className="eyebrow">Courses</p>
            {groups.courses.map((hit) => (
              <Link key={`c-${hit.id}`} className="list-link" href={hit.href} data-testid="search-hit">
                <span className="grow">{hit.title}<small>{hit.sub}</small></span>›
              </Link>
            ))}
          </section>
        ) : null}
        {groups.speakers.length ? (
          <section data-testid="search-speakers">
            <p className="eyebrow">Speakers</p>
            {groups.speakers.map((hit) => (
              <Link key={`s-${hit.id}`} className="list-link" href={hit.href} data-testid="search-hit">
                <span className="grow">{hit.title}<small>{hit.sub}</small></span>›
              </Link>
            ))}
          </section>
        ) : null}
      </div>
      <TabBar base={base} active="home" portal={portal} unread={unread} />
    </AppFrame>
  )
}
