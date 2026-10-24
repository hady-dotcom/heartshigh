/** Shot measurements from the 4 Oct 2026 box prototype (YuNet + textcheck on the same four windows).
 * Used only when YouTube refuses the temporary download, so the chooser still runs on real stats.
 */
import type { FramingSentence, ShotAnalysis } from '../../src/lib/framing/types'

export type PrototypeClip = {
  youtubeId: string
  start: number
  end: number
  kind: string
  cuts: number[]
  shots: ShotAnalysis[]
  sentences?: FramingSentence[]
}

export const PROTOTYPE_SHOTS: PrototypeClip[] = [
  {
    youtubeId: '9gwe-HMwZv0',
    start: 1005,
    end: 1030,
    kind: 'Speaker off-centre',
    cuts: [],
    shots: [
      {
        start: 1005,
        end: 1030,
        faceCountMedian: 1,
        singleFaceRatio: 0.92,
        faceHeight: 0.22,
        focus: { x: 0.28, y: 0.38 },
        textScore: 0,
        twoFar: false,
        speakerCount: 1,
      },
    ],
    sentences: [
      timed('Also, like the idea of: where do you derive your ʿizzah from?', 1005.2, 1009.4, 'ʿizzah'),
      timed('Where do you derive your honour from?', 1009.4, 1012.1, 'honour'),
      timed('Your dignity, your sense of worth?', 1012.1, 1015.2, 'worth'),
      timed("Like, when someone tells you you're crazy for believing in this, you know, like, you're delusional, basically.", 1015.2, 1022.0, 'delusional'),
      timed('And they seem to be winning as well.', 1022.0, 1024.6, 'winning'),
      timed('They seem to be overcoming you and overpowering you.', 1024.6, 1028.9, 'overpowering'),
    ],
  },
  {
    youtubeId: '45XUrfJS68Q',
    start: 308,
    end: 333,
    kind: 'Two people',
    cuts: [],
    shots: [
      {
        start: 308,
        end: 333,
        faceCountMedian: 2,
        singleFaceRatio: 0.08,
        faceHeight: 0.18,
        focus: { x: 0.62, y: 0.4 },
        textScore: 0,
        twoFar: true,
        speakerCount: 2,
      },
    ],
  },
  {
    youtubeId: '9k7QxXtCzaQ',
    start: 38,
    end: 58,
    kind: 'Slide / on-screen text',
    cuts: [],
    shots: [
      {
        start: 38,
        end: 58,
        faceCountMedian: 1,
        singleFaceRatio: 0.75,
        faceHeight: 0.2,
        focus: { x: 0.5, y: 0.42 },
        textScore: 0.012,
        twoFar: false,
        speakerCount: 1,
      },
    ],
  },
  {
    youtubeId: 'TLCGBj4AlB0',
    start: 2751,
    end: 2779,
    kind: 'Wide shot',
    cuts: [],
    shots: [
      {
        start: 2751,
        end: 2779,
        faceCountMedian: 1,
        singleFaceRatio: 0.84,
        faceHeight: 0.16,
        focus: { x: 0.22, y: 0.4 },
        textScore: 0,
        twoFar: false,
        speakerCount: 1,
      },
    ],
  },
]

function timed(text: string, s: number, e: number, key: string | null): FramingSentence {
  const words = text.split(' ').filter(Boolean)
  const each = Math.max(0.12, (e - s) / Math.max(1, words.length))
  return {
    text,
    s,
    e,
    key,
    words: words.map((w, index) => ({ w, t: Math.round((s + each * index) * 1000) / 1000, key: key ? w.toLowerCase().includes(key.toLowerCase().slice(0, 4)) : false })),
  }
}

export function prototypeFor(youtubeId: string, start: number, end: number) {
  const mid = (start + end) / 2
  return PROTOTYPE_SHOTS.find((row) => row.youtubeId === youtubeId && mid >= row.start - 2 && mid <= row.end + 2) || null
}
