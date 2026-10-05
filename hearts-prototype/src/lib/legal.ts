import { storageNoticeRows } from './storage-keys'

export const LEGAL_KINDS = ['privacy', 'terms', 'guidelines', 'portal-agreement'] as const
export type LegalKind = (typeof LEGAL_KINDS)[number]

export const LEARNER_CONSENT_KINDS = ['privacy', 'terms'] as const

export const DEFAULT_LEGAL_VERSION = '2026-10-04-draft'

export type LegalDoc = {
  kind: LegalKind
  version: string
  title: string
  summary: string
  body: string
  published: boolean
  draftForAdviserReview: boolean
  updatedLabel: string
}

export function isLegalKind(value: unknown): value is LegalKind {
  return value === 'privacy' || value === 'terms' || value === 'guidelines' || value === 'portal-agreement'
}

export function legalHref(kind: LegalKind, portalSlug?: string | null) {
  const path = kind === 'portal-agreement' ? '/running' : `/${kind === 'guidelines' ? 'guidelines' : kind}`
  if (!portalSlug) return path
  return `/p/${portalSlug}${path}`
}

export function cookieSectionMarkdown() {
  const rows = storageNoticeRows()
  const lines = [
    '## Cookies and storage on this phone',
    '',
    'HEARTS only uses what it needs to run. There is no advertising cookie and no analytics cookie today, so UK PECR does not ask us for a cookie banner. If we ever add something that is not strictly necessary (such as analytics), we will ask first. That note also sits in the README.',
    '',
    '| Name | Where | Why | Needed |',
    '| --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.name} | ${row.where} | ${row.why} | ${row.needed ? 'Yes' : 'Ask first'} |`),
    '',
    'Fonts are served from HEARTS itself. We do not load Google Fonts from their servers.',
    '',
  ]
  return lines.join('\n')
}

/** Escape text that will sit in HTML we built ourselves. */
export function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]+)\)/g, '<a href="$2">$1</a>')
}

/** A small markdown subset: headings, paragraphs, lists, tables, links. No raw HTML. */
export function renderLegalMarkdown(source: string) {
  const blocks = source.replace(/\r\n/g, '\n').trim().split(/\n{2,}/)
  const html: string[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    if (lines[0].startsWith('# ')) {
      html.push(`<h1>${inline(lines[0].slice(2))}</h1>`)
      continue
    }
    if (lines[0].startsWith('## ')) {
      html.push(`<h2>${inline(lines[0].slice(3))}</h2>`)
      continue
    }
    if (lines[0].startsWith('### ')) {
      html.push(`<h3>${inline(lines[0].slice(4))}</h3>`)
      continue
    }
    if (lines.every((line) => line.startsWith('|') && line.endsWith('|'))) {
      const body = lines.filter((line) => !/^\|\s*---/.test(line))
      if (body.length >= 2) {
        const cells = (line: string) => line.slice(1, -1).split('|').map((cell) => cell.trim())
        const head = cells(body[0])
        const rows = body.slice(1).map(cells)
        html.push(
          `<table class="legal-table"><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows
            .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`,
        )
        continue
      }
    }
    if (lines.every((line) => /^[-*]\s/.test(line))) {
      html.push(`<ul>${lines.map((line) => `<li>${inline(line.replace(/^[-*]\s/, ''))}</li>`).join('')}</ul>`)
      continue
    }
    if (lines.every((line) => /^\d+\.\s/.test(line))) {
      html.push(`<ol>${lines.map((line) => `<li>${inline(line.replace(/^\d+\.\s/, ''))}</li>`).join('')}</ol>`)
      continue
    }
    html.push(`<p>${inline(lines.join(' '))}</p>`)
  }
  return html.join('\n')
}

export function nextLegalVersion(current: string) {
  const stamp = new Date().toISOString().slice(0, 10)
  if (!current.startsWith(stamp)) return `${stamp}-a`
  const suffix = current.slice(stamp.length + 1)
  if (!suffix) return `${stamp}-a`
  const code = suffix.charCodeAt(0)
  if (code >= 97 && code < 122) return `${stamp}-${String.fromCharCode(code + 1)}`
  return `${stamp}-${Date.now().toString().slice(-4)}`
}
