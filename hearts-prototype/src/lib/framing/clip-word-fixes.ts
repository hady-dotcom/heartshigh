/**
 * Hand-checked corrections for caption mishearings, applied to a clip's words before they are paged.
 *
 * YouTube's auto captions mishear names and Arabic terms ("Satan Bilal" for "Sayyidina Bilal"). The fixes live in
 * content/framing/clip-words-fixes.json so they can be reviewed, and scripts/clip-words-from-work.ts applies them every
 * time it cuts the clip tracks.
 *
 * Matching is word by word and ignores case. A `from` word written with punctuation ("he." "Said,") must match that
 * punctuation exactly, which is how a broken sentence is mended; a bare word matches whatever punctuation the caption
 * gave it, and the replacement keeps that punctuation. The new words take over the old words' span, spread evenly, so
 * the clock stays honest; an empty `to` drops the words.
 */

export type WordFixSeverity = 'offensive' | 'jarring' | 'mishearing' | 'spelling' | 'punctuation'
export type WordFix = {
  /** Absent for a global fix, which applies to every clip. */
  youtubeId?: string
  /** The feed cut the fix was found in (for the reviewer). */
  cutId?: number
  /** The caption clock of the first word (+-AT_SLACK seconds), or a [from, to] stretch. Absent: anywhere in the clip. */
  at?: number | [number, number]
  from: string
  to: string
  severity?: WordFixSeverity
  reason?: string
}
export type WordFixes = { version: 1; about?: string; global: WordFix[]; fixes: WordFix[] }
export type FixToken = { w: string; t: number; e: number }
export type FixHit = { fix: WordFix; t: number; before: string; after: string }

export const AT_SLACK = 3
/** Words this far outside the clip window are left alone (the fixes were checked against the clip's own text). */
const WINDOW_SLACK = 1

const EDGE = /^([^\p{L}\p{N}']*)(.*?)([^\p{L}\p{N}']*)$/u

function parts(word: string) {
  const [, lead = '', core = '', tail = ''] = EDGE.exec(word) || []
  return { lead, core, tail }
}

const words = (text: string) => text.split(/\s+/).filter(Boolean)

function sameWord(want: string, have: string) {
  const wanted = parts(want)
  if (wanted.lead || wanted.tail) return want.toLowerCase() === have.toLowerCase()
  return wanted.core.toLowerCase() === parts(have).core.toLowerCase()
}

function nearAt(fix: WordFix, t: number) {
  if (fix.at == null) return true
  if (Array.isArray(fix.at)) return t >= fix.at[0] - 0.05 && t <= fix.at[1] + 0.05
  return Math.abs(t - fix.at) <= AT_SLACK
}

/**
 * Clocks for the replacement words, inside the old words' span. The same number of words keep the old clocks one for
 * one. Otherwise the new starts are spread evenly from the first old word's start to the last old word's start (so the
 * last word still starts, and ends, where the last old word did and a clip edge keeps or cuts it the same way); a
 * single old word is shared out evenly across its own start and end.
 */
function respan(old: FixToken[], replaced: string[]): FixToken[] {
  if (!replaced.length) return []
  if (replaced.length === old.length) return replaced.map((w, at) => ({ w, t: old[at].t, e: old[at].e }))
  const first = old[0]
  const last = old[old.length - 1]
  const end = Math.max(last.e, last.t + 0.05)
  if (old.length === 1 || replaced.length === 1) {
    const from = first.t
    const step = (end - from) / replaced.length
    return replaced.map((w, at) => ({ w, t: from + step * at, e: from + step * (at + 1) }))
  }
  const step = (last.t - first.t) / (replaced.length - 1)
  return replaced.map((w, at) => {
    const t = first.t + step * at
    return { w, t, e: at === replaced.length - 1 ? end : t + step }
  })
}

/** The fixes that apply to one video: its own first (in file order), then the global ones. */
export function fixesFor(all: WordFixes | null | undefined, youtubeId: string): WordFix[] {
  if (!all) return []
  return [...(all.fixes || []).filter((row) => row.youtubeId === youtubeId), ...(all.global || []).filter((row) => !row.youtubeId)]
}

/** Apply fixes to a run of words. Each fix replaces every match it finds, left to right, without re-reading its own output. */
export function applyWordFixes(tokens: FixToken[], fixes: WordFix[], window?: { start: number; end: number }) {
  let list = tokens
  const hits: FixHit[] = []
  for (const fix of fixes) {
    const want = words(fix.from)
    if (!want.length) continue
    const put = words(fix.to)
    const next: FixToken[] = []
    for (let index = 0; index < list.length; ) {
      const first = list[index]
      const inWindow = !window || (first.t >= window.start - WINDOW_SLACK && first.t <= window.end + WINDOW_SLACK)
      const matches =
        inWindow && nearAt(fix, first.t) && index + want.length <= list.length && want.every((word, at) => sameWord(word, list[index + at].w))
      if (!matches) {
        next.push(first)
        index++
        continue
      }
      const old = list.slice(index, index + want.length)
      const lead = parts(want[0]).lead || parts(want[0]).tail ? '' : parts(old[0].w).lead
      const lastWant = parts(want[want.length - 1])
      const tail = lastWant.lead || lastWant.tail ? '' : parts(old[old.length - 1].w).tail
      const replaced = put.map((word, at) => {
        let text = word
        if (at === 0 && lead && !parts(text).lead) text = lead + text
        if (at === put.length - 1 && tail && !parts(text).tail) text = text + tail
        return text
      })
      if (replaced.join(' ') === old.map((row) => row.w).join(' ')) {
        // Already right (a spelling rule meeting its own spelling): nothing to do.
        next.push(first)
        index++
        continue
      }
      next.push(...respan(old, replaced))
      hits.push({ fix, t: old[0].t, before: old.map((row) => row.w).join(' '), after: replaced.join(' ') })
      index += want.length
    }
    list = next
  }
  return { tokens: list, hits }
}
