export type TimedCue = { start: number; end: number; text: string }

const SENTENCE = /[.!?]["']?$/
const PAUSE_SENTENCE = 0.7
const PAUSE_COMMA = 0.35

function capitalise(text: string) {
  return text.replace(/^(\s*)([a-z])/, (_match, space: string, letter: string) => `${space}${letter.toUpperCase()}`)
}

/**
 * Sentence breaks from the gaps between cues. No paid model.
 * A gap of 0.7s or more ends a sentence. A shorter pause adds a comma.
 * Text that already has a sentence mark is left alone.
 */
export function punctuateTimedCues(cues: TimedCue[]): TimedCue[] {
  const out = cues
    .map((cue) => ({ start: cue.start, end: cue.end, text: cue.text.replace(/\s+/g, ' ').trim() }))
    .filter((cue) => cue.text)
  for (let index = 0; index < out.length; index++) {
    const prev = out[index - 1]
    const gap = prev ? out[index].start - prev.end : PAUSE_SENTENCE
    if (prev && !SENTENCE.test(prev.text)) {
      if (gap >= PAUSE_SENTENCE) prev.text = prev.text.replace(/[,;:\s]+$/, '') + '.'
      else if (gap >= PAUSE_COMMA && !/[,;:]$/.test(prev.text)) prev.text += ','
    }
    if (!prev || SENTENCE.test(prev.text)) out[index].text = capitalise(out[index].text)
  }
  const last = out[out.length - 1]
  if (last && !SENTENCE.test(last.text)) last.text += '.'
  return out
}

/** True when a local punctuation model is not what produced this text. */
export function cuesLackSentenceMarks(cues: TimedCue[]) {
  const text = cues.map((cue) => cue.text).join(' ')
  return text.length > 0 && !/[.!?]/.test(text)
}
