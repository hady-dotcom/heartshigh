import { formatTimestamp, parseTranscript } from './transcript'

export type SearchKind = 'talk' | 'course' | 'speaker'

export type SearchHit = {
  kind: SearchKind
  id: number | string
  title: string
  sub: string
  href: string
  score: number
  snippet?: string
  match?: string
  timestamp?: string
  seconds?: number
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

export type HighlightPart = { text: string; mark: boolean }

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
  const transcript = (doc.transcript || '').slice(0, 20_000)
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

function firstTermIn(text: string, terms: string[]) {
  const lower = text.toLowerCase()
  return terms.find((term) => lower.includes(term)) || ''
}

/** First spoken line that holds a search term, with its clock time. */
export function transcriptMatch(raw: string | undefined, terms: string[]) {
  if (!raw || !terms.length) return null
  const { cues } = parseTranscript(raw)
  for (const cue of cues) {
    const match = firstTermIn(cue.text, terms)
    if (!match) continue
    return {
      snippet: cue.text.replace(/\s+/g, ' ').trim(),
      match,
      seconds: Math.max(0, Math.floor(cue.start)),
      timestamp: formatTimestamp(cue.start),
    }
  }
  const plain = raw.replace(/\s+/g, ' ').trim()
  const match = firstTermIn(plain, terms)
  if (!match) return null
  const idx = plain.toLowerCase().indexOf(match)
  const start = Math.max(0, idx - 48)
  const end = Math.min(plain.length, idx + match.length + 72)
  return {
    snippet: plain.slice(start, end).trim(),
    match,
    seconds: 0,
    timestamp: formatTimestamp(0),
  }
}

export function highlightParts(text: string, match: string): HighlightPart[] {
  if (!text || !match) return text ? [{ text, mark: false }] : []
  const idx = text.toLowerCase().indexOf(match.toLowerCase())
  if (idx < 0) return [{ text, mark: false }]
  return [
    { text: text.slice(0, idx), mark: false },
    { text: text.slice(idx, idx + match.length), mark: true },
    { text: text.slice(idx + match.length), mark: false },
  ].filter((part) => part.text)
}

function withTimestamp(href: string, seconds: number) {
  const glue = href.includes('?') ? '&' : '?'
  return `${href}${glue}t=${seconds}`
}

export function searchDocs(docs: SearchDoc[], query: string, limit = 24): SearchHit[] {
  const terms = searchTerms(query)
  if (!terms.length) return []
  return docs
    .map((doc) => {
      const score = scoreDoc(doc, terms)
      const spoken = doc.kind === 'talk' ? transcriptMatch(doc.transcript, terms) : null
      const href = spoken ? withTimestamp(doc.href, spoken.seconds) : doc.href
      return {
        kind: doc.kind,
        id: doc.id,
        title: doc.title,
        sub: doc.speaker || doc.courseTitle || doc.door || '',
        href,
        score,
        snippet: spoken?.snippet,
        match: spoken?.match,
        timestamp: spoken?.timestamp,
        seconds: spoken?.seconds,
      } satisfies SearchHit
    })
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
