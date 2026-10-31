// Persona v2. A balanced reading of Doc A (the only numeric table), Docs B and C (the portraits),
// and scales-to-jibril.md (the doors). Doc A is not the master. See PERSONA-BALANCING.md.

import { SCALE_KEYS, type ScaleKey } from './heart'
import type { PersonaBand, RangeRow } from './persona'

export const PERSONA_VERSION = 2

type Pair = [number, number]

/** Inclusive rungs. Every pair of bands is disjoint on at least one scale, so containment cannot match two. */
const RANGES: Record<string, Record<ScaleKey, Pair>> = {
  devout: {
    desire: [2, 5], greed: [1, 6], anger: [0, 4], ego: [-1, 2], worry: [-1, 3],
    belonging: [4, 7], gratitude: [2, 6], faith: [4, 7], compassion: [0, 3], discipline: [7, 9],
  },
  traditionalist: {
    desire: [2, 5], greed: [2, 7], anger: [-3, -1], ego: [0, 3], worry: [-2, 2],
    belonging: [5, 7], gratitude: [2, 6], faith: [8, 10], compassion: [0, 2], discipline: [5, 9],
  },
  activist: {
    desire: [-1, 2], greed: [1, 6], anger: [-8, -4], ego: [-3, 3], worry: [-1, 4],
    belonging: [2, 7], gratitude: [0, 4], faith: [2, 6], compassion: [5, 9], discipline: [2, 4],
  },
  secular: {
    desire: [-8, -5], greed: [-6, -2], anger: [-2, 2], ego: [-4, 1], worry: [-2, 4],
    belonging: [-2, 2], gratitude: [-2, 2], faith: [-8, -3], compassion: [1, 5], discipline: [-6, -2],
  },
  cultural: {
    desire: [-2, 2], greed: [-2, 2], anger: [-2, 3], ego: [-2, 1], worry: [-2, 2],
    belonging: [-1, 5], gratitude: [0, 3], faith: [-1, 2], compassion: [1, 4], discipline: [-2, 2],
  },
  seeker: {
    desire: [-3, 3], greed: [-2, 3], anger: [-1, 4], ego: [-4, 0], worry: [-8, -4],
    belonging: [-3, 2], gratitude: [1, 5], faith: [0, 3], compassion: [3, 7], discipline: [-1, 2],
  },
  progressive: {
    desire: [-4, 1], greed: [-3, 1], anger: [-3, 1], ego: [-2, 2], worry: [-2, 4],
    belonging: [-2, 3], gratitude: [1, 4], faith: [-2, 0], compassion: [6, 8], discipline: [-3, 0],
  },
  academic: {
    desire: [-2, 3], greed: [0, 4], anger: [-1, 3], ego: [4, 7], worry: [-2, 2],
    belonging: [1, 5], gratitude: [2, 6], faith: [2, 5], compassion: [2, 5], discipline: [2, 5],
  },
  'family-centred': {
    desire: [-1, 3], greed: [-1, 3], anger: [-2, 3], ego: [-2, 3], worry: [1, 5],
    belonging: [8, 10], gratitude: [3, 6], faith: [2, 6], compassion: [3, 7], discipline: [2, 6],
  },
  'new-muslim': {
    desire: [-4, 2], greed: [-2, 3], anger: [-3, 2], ego: [-3, 1], worry: [-1, 5],
    belonging: [-8, -4], gratitude: [7, 10], faith: [4, 7], compassion: [3, 7], discipline: [-1, 4],
  },
}

const COPY: Record<string, { title: string; description: string; doors: number[]; talks: string[] }> = {
  devout: {
    title: 'Devout Practitioner',
    description: 'Practice is steady and the household knows the rhythm of prayer. The growth edge is humility and a wider mercy, not more ritual.',
    doors: [16, 6],
    talks: ['When Knowledge Inflates the Ego', "Which People Receive Allah's Mercy?"],
  },
  traditionalist: {
    title: 'Traditionalist',
    description: 'The law and the inherited wording are the ground they stand on. The growth edge is a quieter heart when the rule is already known.',
    doors: [16, 17, 6],
    talks: ['When Knowledge Inflates the Ego', "Which People Receive Allah's Mercy?"],
  },
  activist: {
    title: 'Social Activist',
    description: 'Mercy for people who are being harmed comes first. The growth edge is patience and trust when the work runs hot.',
    doors: [7, 15, 19],
    talks: ['What Is The Difference Between Patience And Complaining?', 'Quranic Connection #26: A Cure for Anxiety'],
  },
  secular: {
    title: 'Secular Muslim',
    description: 'Culture and family may still be close, while prayer and belief sit further off. Mercy before rules, and a door back to talking with Allah.',
    doors: [10, 5, 16],
    talks: ['What is Dua?', 'Using Your Time Wisely'],
  },
  cultural: {
    title: 'Cultural',
    description: 'Eid, family and the home language carry the faith. Prayer and a plain account of belief are the places to lean.',
    doors: [10, 5],
    talks: ['What is Dua?', 'Using Your Time Wisely'],
  },
  seeker: {
    title: 'Seeker',
    description: 'The questions are honest and the ground is still moving. Trust and a small habit give the questions a place to sit.',
    doors: [15, 5],
    talks: ['Quranic Connection #26: A Cure for Anxiety', 'Using Your Time Wisely'],
  },
  progressive: {
    title: 'Progressive',
    description: 'Mercy is wide, and being the thoughtful one can become its own pride. Prayer and ihsan bring the heart back into the argument.',
    doors: [5, 16, 10],
    talks: ['Using Your Time Wisely', 'When Knowledge Inflates the Ego'],
  },
  academic: {
    title: 'Academic',
    description: 'Study is careful and can outrun the heart. The Hour and ihsan are the seats that ask for humility.',
    doors: [17, 16],
    talks: ['When Knowledge Inflates the Ego', "Which People Receive Allah's Mercy?"],
  },
  'family-centred': {
    title: 'Family-Centred',
    description: 'The people at home are the congregation. Trust and qadr help when worry for them fills the month.',
    doors: [15, 10],
    talks: ['Quranic Connection #26: A Cure for Anxiety', 'What is Dua?'],
  },
  'new-muslim': {
    title: 'New Muslim',
    description: 'Gratitude is bright and the circle is still new. Sitting with people, and the manners of the sitting, come before a long syllabus.',
    doors: [2],
    talks: ['On Mosques, Companionship, & Knowledge'],
  },
}

function rangesFor(key: string): RangeRow[] {
  const centre = RANGES[key]
  return SCALE_KEYS.map((scale) => {
    const [min, max] = centre[scale]
    return { scale, present: true, min, max }
  })
}

export const PERSONA_V2: PersonaBand[] = Object.keys(COPY).map((key) => {
  const copy = COPY[key]
  return {
    key,
    title: copy.title,
    status: 'published' as const,
    source: 'balanced' as const,
    placeholder: false,
    identicalGroup: '',
    note: copy.description,
    version: PERSONA_VERSION,
    description: copy.description,
    doors: copy.doors,
    talks: copy.talks,
    ranges: rangesFor(key),
  }
})

/** A reading at the middle of each range, as a device value in −1..+1. It matches that band. */
export function midpointReading(band: PersonaBand) {
  const reading: Partial<Record<ScaleKey, number>> = {}
  for (const row of band.ranges) {
    if (row.min == null || row.max == null) continue
    const rung = Math.round((row.min + row.max) / 2)
    reading[row.scale] = rung / 10
  }
  return reading
}
