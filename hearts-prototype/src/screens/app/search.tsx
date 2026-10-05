import Link from 'next/link'
import { AppFrame, Back, TabBar } from '@/components/app/shell'
import { SearchBox } from '@/components/app/search-box'
import { groupHits, highlightParts, type SearchHit } from '@/lib/learner-search'
import { searchPortal } from '@/server/learner-search'
import { unreadCount, type Ctx } from '../common'

function HitLine({ hit }: { hit: SearchHit }) {
  const parts = hit.snippet && hit.match ? highlightParts(hit.snippet, hit.match) : []
  return (
    <Link className="list-link" href={hit.href} data-testid="search-hit">
      <span className="grow">
        {hit.title}
        {hit.sub ? <small>{hit.sub}</small> : null}
        {hit.snippet && hit.timestamp ? (
          <small className="search-hit-snippet" data-testid="search-snippet">
            <span className="search-hit-time" data-testid="search-time">
              {hit.timestamp}
            </span>
            {parts.length
              ? parts.map((part, index) => (part.mark ? <mark key={index} data-testid="search-highlight">{part.text}</mark> : <span key={index}>{part.text}</span>))
              : hit.snippet}
          </small>
        ) : null}
      </span>
      ›
    </Link>
  )
}

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
        {!q.trim() ? <p className="muted">Type a talk, a speaker or a word you heard.</p> : null}
        {q.trim() && !hits.length ? (
          <div className="empty-state" data-testid="search-empty">
            <p>Nothing in this portal matches “{q}”. Try a speaker, a talk title, or a word you heard in a talk.</p>
          </div>
        ) : null}
        {groups.talks.length ? (
          <section data-testid="search-talks">
            <p className="eyebrow" data-testid="search-talks-count">Talks ({groups.talks.length})</p>
            {groups.talks.map((hit) => (
              <HitLine key={`t-${hit.id}`} hit={hit} />
            ))}
          </section>
        ) : null}
        {groups.speakers.length ? (
          <section data-testid="search-speakers">
            <p className="eyebrow" data-testid="search-speakers-count">Speakers ({groups.speakers.length})</p>
            {groups.speakers.map((hit) => (
              <HitLine key={`s-${hit.id}`} hit={hit} />
            ))}
          </section>
        ) : null}
        {groups.courses.length ? (
          <section data-testid="search-courses">
            <p className="eyebrow" data-testid="search-courses-count">Courses ({groups.courses.length})</p>
            {groups.courses.map((hit) => (
              <HitLine key={`c-${hit.id}`} hit={hit} />
            ))}
          </section>
        ) : null}
      </div>
      <TabBar base={base} active="home" portal={portal} unread={unread} />
    </AppFrame>
  )
}
