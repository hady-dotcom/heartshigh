import { CATALOGUE, backgroundSrc, pickBackground, type Background } from '@/lib/backgrounds'
import { kineticExtractLine, kineticExtractWords } from '@/lib/extracts'
import { pickScene } from '@/lib/scenes'
import { beatLine } from '@/lib/sentences'
import type { FeedItem, SlideStyle } from '@/server/learner'

type CardBeat = NonNullable<FeedItem['beats']>[number]

const STYLE_LIST = ['kinetic', 'windows', 'conversation', 'cinema', 'unfold'] as const

function pickStyle(index: number, visit: number, previous: string, base = 0): SlideStyle {
  let at = (base + visit + index) % STYLE_LIST.length
  if (STYLE_LIST[at] === previous) at = (at + 1) % STYLE_LIST.length
  return STYLE_LIST[at]
}

function paintExtractBeat(quote: string) {
  const line = beatLine(quote || '')
  if (!line) return ''
  return kineticExtractLine(line)
}

/** Every beat, voiced or not, is at most two sentences and about 30 words, and never stops on a hanging word. */
function beatsOf(item: FeedItem): CardBeat[] {
  if (item.beats?.length) {
    return item.beats
      .map((row) => {
        const quote = beatLine(row.quote || '') || row.quote
        return {
          ...row,
          quote: kineticExtractLine(quote),
          words: row.words?.length ? kineticExtractWords(row.words) : row.words,
        }
      })
      .filter((row) => row.quote)
  }
  return (['hook', 'turn', 'land'] as const)
    .map((beat) => ({ beat, quote: paintExtractBeat(item[beat] || ''), gold: '', audio: null }))
    .filter((row) => row.quote)
}

/**
 * After each talk, a face film or a scenic card, then a question.
 * Face films and cards alternate through the session. A return visit swaps which
 * one a talk leads with, and steps the card's style.
 * Without BACKGROUNDS_BASE_URL the six local stills are used, and a shared tag steps on.
 * With the bucket URL, the card's stored catalogue still is used. A neighbour that
 * shares landscape, palette or time steps on. Learn more always opens the appetiser.
 */
export function mixFeed(items: FeedItem[], visit = 0, backgroundsBaseUrl: string | null = null): FeedItem[] {
  const out: FeedItem[] = []
  let previousStyle = ''
  let previousScene: { id: string; tags: readonly string[] } | null = null
  let previousBackground: Background | null = null
  const base = (backgroundsBaseUrl || '').trim()
  items.forEach((item, index) => {
    out.push(item)
    if (item.card && item.card !== 'talk') return
    const films = item.films || []
    const showFilm = films.length > 0 && Math.abs(visit + index) % 2 === 0
    const questionFilm = films[Math.abs(visit + index) % films.length]
    if (showFilm && questionFilm) {
      previousStyle = questionFilm.style
      out.push({ ...item, id: `film-${item.cutId}`, card: 'film', film: questionFilm, typography: { style: questionFilm.style, inPlace: true, src: questionFilm.src } })
    } else {
      const beats = beatsOf(item)
      if (beats.length) {
        const styleBase = Math.max(0, STYLE_LIST.indexOf((item.cardStyle || 'kinetic') as (typeof STYLE_LIST)[number]))
        const style = pickStyle(index, visit, previousStyle, styleBase)
        previousStyle = style
        const local = pickScene(item.cardScene || 'road', 0, previousScene)
        previousScene = local
        const chosen = base && CATALOGUE.length ? pickBackground(CATALOGUE, item.cardBackground || index, previousBackground) : null
        if (chosen) previousBackground = chosen
        out.push({
          ...item,
          id: `scene-${item.cutId}`,
          card: 'scene',
          scene: {
            style,
            scene: (chosen && backgroundSrc(chosen.file, base)) || local.src,
            destination: 'clip',
            beats,
            brightness: chosen?.brightness || null,
          },
        })
      }
    }
    out.push({ ...item, id: `question-${item.cutId}`, card: 'question', film: questionFilm, prompt: 'What stays with you from this?' })
  })
  return out
}
