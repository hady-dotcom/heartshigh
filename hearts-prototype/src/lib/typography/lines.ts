const token = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '')

/** Closed-class words. A line that is only one of these waits for the next word. */
const FUNCTION = new Set('i a an the to and of in on at or but is it its'.split(' '))

export function isFunctionWord(text: string) {
  const bare = token(text)
  return bare.length > 0 && bare.length <= 3 && FUNCTION.has(bare)
}

/**
 * Drop a repeated word from the picture. The later one stays, at the later time,
 * so the line is not early. The recording still has the stutter.
 */
export function withoutStutters<T extends { text: string }>(words: T[]): T[] {
  const out: T[] = []
  for (const word of words) {
    const prev = out[out.length - 1]
    const a = prev ? token(prev.text) : ''
    const b = token(word.text)
    if (prev && a && a === b) {
      out[out.length - 1] = word
      continue
    }
    out.push(word)
  }
  return out
}

export type Line<T> = { words: T[]; gold: boolean; phrase: string }

/** Connector runs of about three words. A lone function word joins the next run. Key phrases stay whole. */
export function phraseLines<T extends { text: string }>(words: T[], spans: { from: number; to: number; phrase: string }[]): Line<T>[] {
  const raw: Line<T>[] = []
  let run: T[] = []
  const flush = () => {
    if (!run.length) return
    raw.push({ words: run, gold: false, phrase: '' })
    run = []
  }
  words.forEach((word, index) => {
    const span = spans.find((row) => index >= row.from && index <= row.to)
    if (span && index === span.from) {
      flush()
      raw.push({ words: words.slice(span.from, span.to + 1), gold: true, phrase: span.phrase })
    } else if (!span) {
      run.push(word)
      if (run.length === 3) flush()
    }
  })
  flush()
  const packed: Line<T>[] = []
  let held: T[] = []
  for (const line of raw) {
    if (!line.gold && line.words.length === 1 && isFunctionWord(line.words[0].text)) {
      held = held.concat(line.words)
      continue
    }
    if (held.length && !line.gold) {
      packed.push({ ...line, words: held.concat(line.words) })
      held = []
      continue
    }
    packed.push(line)
  }
  if (held.length) {
    const prev = [...packed].reverse().find((line) => !line.gold)
    if (prev) prev.words = prev.words.concat(held)
    else packed.push({ words: held, gold: false, phrase: '' })
  }
  return packed
}

/**
 * Words of a line that may be on screen. A line does not appear as a single
 * function word: "I" waits until the next word of its phrase is spoken.
 */
export function lineWords<T extends { text: string; showAt: number }>(line: Line<T>, time: number): T[] {
  const due = line.words.filter((word) => word.showAt <= time + 1e-4)
  if (!due.length) return []
  if (due.length === 1 && line.words.length > 1 && isFunctionWord(due[0].text)) return []
  return due
}

/**
 * What may be painted now. Only the latest gold landing is kept, so an earlier
 * one does not stay stacked underneath. A stack keeps the recent connector lines.
 */
export function linesOnScreen<T extends { text: string; showAt: number }>(lines: Line<T>[], time: number, stack = false): Line<T>[] {
  const due = lines.filter((line) => lineWords(line, time).length)
  const gold = [...due].reverse().find((line) => line.gold)
  const connectors = due.filter((line) => !line.gold)
  if (stack) {
    const rows = connectors.slice(-3)
    if (gold) rows.push(gold)
    return rows.sort((a, b) => a.words[0].showAt - b.words[0].showAt)
  }
  const connector = connectors[connectors.length - 1]
  return [gold, connector].filter((line): line is Line<T> => Boolean(line))
}
