// Speaker names as learners and the master sheet meet them.
// Pure module: the sheet planner, the seed and the tests share it, and nothing here touches the database.
import { hasMarkup, httpsHref } from './text-safety'

export type SpeakerLink = { label: string; url: string }

export type SpeakerIdentity = {
  id?: number
  name: string
  displayName?: string
  slug: string
  aliases?: string[]
}

export type ResolvedSpeaker = { name: string; slug: string; id: number | null; displayName: string }

/** The same address the learner app already uses for a speaker page. */
export function speakerSlug(value: string) {
  return value.toLowerCase().replace(/^(shaykh|sheikh|imam|ustadh)\s+/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// One leading title only, and ustadha before ustadh, shaykh before sh, so "Shahid" and "ustadha" stay whole.
const HONORIFIC = /^(?:shaykh|sheikh|ustadha|ustadh|imam|doctor|dr|sh)(?:\.\s*|\s+)/i

/** A folded name for matching. Titles, parentheticals, accents and hyphens do not keep two spellings apart. */
export function foldSpeaker(value: string) {
  let text = value.normalize('NFKD').replace(/\p{M}+/gu, '')
  text = text.replace(/\([^)]*\)/g, ' ')
  text = text.replace(/['’`]/g, '')
  text = text.replace(/[-–—]/g, ' ')
  text = text.replace(HONORIFIC, '')
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Variant spellings that already split one speaker into two pages. Alaeddin does not fold into Alauddin, so the alias is listed. */
const KNOWN: SpeakerIdentity[] = [
  { name: 'Mohammad Elshinawy', slug: 'mohammad-elshinawy', displayName: 'Shaykh Mohammad Elshinawy', aliases: ['Sh. Mohammad Elshinawy', 'Sh Mohammad Elshinawy', 'Shaykh Mohammad Elshinawy'] },
  { name: 'Tesneem Alkiek', slug: 'tesneem-alkiek', displayName: 'Dr. Tesneem Alkiek', aliases: ['Dr. Tesneem Alkiek', 'Dr Tesneem Alkiek'] },
  { name: 'Umar Faruq Abd-Allah', slug: 'umar-faruq-abd-allah', displayName: 'Dr. Umar Faruq Abd-Allah', aliases: ['Dr. Umar Faruq Abd-Allah', 'Dr.Umar Faruq Abd Allah', 'Dr Umar Faruq Abd-Allah', 'Umar Faruq Abd Allah'] },
  { name: 'Naeem Baig', slug: 'naeem-baig', displayName: 'Ustadh Naeem Baig', aliases: ['Ustadh Naeem Baig (Hāfidh)', 'Ustadh Naeem Baig (Hafidh)', 'Ustadh Naeem Baig', 'Naeem Baig (Hāfidh)'] },
  { name: 'Alauddin Elbakri', slug: 'alauddin-elbakri', displayName: 'Shaykh Alauddin Elbakri', aliases: ['Alaeddin Albakri', 'Shaykh Alaeddin Albakri', 'Alaeddin El-Bakri', 'Alaeddin Elbakri', 'Shaykh Alaeddin El-Bakri'] },
]

function matches(speaker: SpeakerIdentity, folded: string, slug: string) {
  if (speaker.slug === slug) return true
  const names = [speaker.name, speaker.displayName || '', ...(speaker.aliases || [])]
  return names.some((name) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    return foldSpeaker(trimmed) === folded || speakerSlug(trimmed) === slug
  })
}

/**
 * The one speaker a cell is naming, or null when the name is unknown.
 * A known alias still resolves when the catalogue is empty. Nothing here invents a speaker.
 */
export function resolveSpeaker(raw: string, speakers: SpeakerIdentity[]): ResolvedSpeaker | null {
  const text = raw.trim()
  if (!text) return null
  const folded = foldSpeaker(text)
  const slug = speakerSlug(text)
  const found = speakers.find((speaker) => matches(speaker, folded, slug))
  const known = found || KNOWN.find((speaker) => matches(speaker, folded, slug))
  if (!known) return null
  return { name: known.name, slug: known.slug, id: known.id ?? null, displayName: known.displayName || known.name }
}

/** An http or https citation. Speaker sources include pages that were never served over https. */
export function citationUrl(value: string | null | undefined) {
  const https = httpsHref(value || '')
  if (https) return https
  if (!value || hasMarkup(value)) return null
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

const IMAGE = /\.(jpe?g|png|gif|webp|avif)$/i

/** An https address that is itself an image. A channel page or a citation stays a link. */
export function imageUrl(value: string | null | undefined) {
  const href = httpsHref(value || '')
  if (!href) return null
  return IMAGE.test(new URL(href).pathname) ? href : null
}
