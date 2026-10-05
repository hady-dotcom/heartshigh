export type SearchKind = 'talk' | 'course' | 'speaker'

export type SearchHit = {
  kind: SearchKind
  id: number | string
  title: string
  sub: string
  href: string
  score: number
}

export type SearchDoc = {
  kind: SearchKind
  id: number | string
  title: string
  speaker?: string
  courseTitle?: string
  door?: string
  transcript?: string
  href: string
}

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'was', 'were', 'of', 'to', 'a', 'in', 'on', 'it'])

export function searchTerms(query: string) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]+/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !STOP.has(word))
    .slice(0, 8)
}

function haystack(doc: SearchDoc) {
  const transcript = (doc.transcript || '').slice(0, 2000)
  return [doc.title, doc.speaker, doc.courseTitle, doc.door, transcript].filter(Boolean).join('\n').toLowerCase()
}

export function scoreDoc(doc: SearchDoc, terms: string[]) {
  if (!terms.length) return 0
  const text = haystack(doc)
  const title = (doc.title || '').toLowerCase()
  let score = 0
  for (const term of terms) {
    if (title === term) score += 12
    else if (title.includes(term)) score += 6
    if (doc.speaker?.toLowerCase().includes(term)) score += 5
    if (doc.courseTitle?.toLowerCase().includes(term)) score += 3
    if (doc.door?.toLowerCase().includes(term)) score += 2
    if (text.includes(term)) score += 1
  }
  return score
}

export function searchDocs(docs: SearchDoc[], query: string, limit = 24): SearchHit[] {
  const terms = searchTerms(query)
  if (!terms.length) return []
  return docs
    .map((doc) => ({
      kind: doc.kind,
      id: doc.id,
      title: doc.title,
      sub: doc.speaker || doc.courseTitle || doc.door || '',
      href: doc.href,
      score: scoreDoc(doc, terms),
    }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
}

export function groupHits(hits: SearchHit[]) {
  return {
    talks: hits.filter((hit) => hit.kind === 'talk'),
    courses: hits.filter((hit) => hit.kind === 'course'),
    speakers: hits.filter((hit) => hit.kind === 'speaker'),
  }
}

/** Postgres `plainto_tsquery` style: keep letters and join with &. SQLite callers use searchDocs instead. */
export function postgresQuery(query: string) {
  return searchTerms(query).join(' & ')
}
