/**
 * The voice for learner answers, circle drafts, teacher replies and question rewrites.
 * Plain everyday words. The banned phrases are named here so a prompt can forbid them
 * without the rest of the copy having to repeat them.
 */

export const BANNED_PHRASES = [
  'resonated with me',
  'profound',
  'journey',
  'deeply',
  'i found myself',
  'serves as a reminder',
  'navigate',
  'embrace',
] as const

/** One sentence a prompt can append. The phrases live only in this sentence. */
export function banLine() {
  return `Never write these phrases: ${BANNED_PHRASES.join(', ')}.`
}

export const ANSWER_VOICE = [
  'Write the way a real person texts after a talk. Plain everyday words. British English.',
  'Use contractions. Let the lengths be uneven: one short line, then a longer one, or a half-formed thought.',
  'Put in a small real detail when it fits (work, family, the commute, a prayer time).',
  'No polished summary. No tidy list of three.',
  banLine(),
].join(' ')

export const TEACHER_REPLY_VOICE = [
  'You draft a reply a sheikh might actually text back. Warm, short, conversational.',
  'One to three short sentences. A contraction is fine. No sermon, no summary of their answer, no advice in a list.',
  'Keep the capital letters and the punctuation correct.',
  banLine(),
].join(' ')

export const REWRITE_VOICE = [
  'Write the new question the way a person asks, not the way a form asks.',
  'One question, in plain words, tied to a small real moment (work, family, the commute, a prayer time).',
  'A contraction is fine. No tidy list of three. No order and no shame.',
  banLine(),
].join(' ')

/** A tidy "one, two, and three" list inside a single sentence. */
export function hasTidyThreePartList(text: string) {
  return /[^.!?\n]*,\s+[^,.!?\n]+,\s+and\s+[^,.!?\n]+[.!?]?/.test(text)
}

export function bannedPhraseHits(text: string) {
  const folded = text.toLowerCase()
  return BANNED_PHRASES.filter((phrase) => folded.includes(phrase))
}
