import { pickScene } from '@/lib/scenes'
import type { FeedItem, SlideStyle } from '@/server/learner'

type CardBeat = NonNullable<FeedItem['beats']>[number]

const STYLE_LIST = ['kinetic', 'windows', 'conversation', 'cinema', 'unfold'] as const

function pickStyle(index: number, visit: number, previous: string, base = 0): SlideStyle {
  let at = (base + visit + index) % STYLE_LIST.length
  if (STYLE_LIST[at] === previous) at = (at + 1) % STYLE_LIST.length
  return STYLE_LIST[at]
}

function beatsOf(item: FeedItem): CardBeat[] {
  if (item.beats?.length) return item.beats
  return (['hook', 'turn', 'land'] as const)
    .map((beat) => ({ beat, quote: item[beat] || '', gold: '', audio: null }))
    .filter((row) => row.quote.trim())
}

/**
 * After each talk, a face film or a scenic card, then a question.
 * Face films and cards alternate through the session. A return visit swaps which
 * one a talk leads with, and steps the card's style.
 * The background is the card's own setting. A neighbour that shares a tag steps on.
 * Learn more always opens that piece's appetiser.
 */
export function mixFeed(items: FeedItem[], visit = 0): FeedItem[] {
  const out: FeedItem[] = []
  let previousStyle = ''
  let previousScene: { id: string; tags: readonly string[] } | null = null
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
        const scene = pickScene(item.cardScene || 'road', 0, previousScene)
        previousStyle = style
        previousScene = scene
        out.push({
          ...item,
          id: `scene-${item.cutId}`,
          card: 'scene',
          scene: { style, scene: scene.src, destination: 'clip', beats },
        })
      }
    }
    out.push({ ...item, id: `question-${item.cutId}`, card: 'question', film: questionFilm, prompt: 'What stays with you from this?' })
  })
  return out
}
