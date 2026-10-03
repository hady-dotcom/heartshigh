// Balanced persona bands. The source tables left Anger and Greed empty and gave Devout Practitioner
// and Traditionalist the same ranges. These ranges are a reading of the three docs together: each band
// has its own centre, every scale has a row, and no two bands share a signature. They stay editable.

import { SCALE_KEYS, type ScaleKey } from './heart'
import type { PersonaBand, RangeRow } from './persona'

/** Kept so older notes can see that the gap is closed. No scale is missing a row. */
export const MISSING_SCALE_ROWS: ScaleKey[] = []

export const BALANCE_NOTES: { id: string; text: string }[] = [
  {
    id: 'anger-greed',
    text: 'Anger and Greed had no source row. Each band now has its own inclusive range for both, so a heated band such as Social Activist is not the same shape as a quiet one.',
  },
  {
    id: 'devout',
    text: 'Devout Practitioner and Traditionalist arrived identical. They are now distinct: Devout centres on faith and discipline, with the dust scales mostly held. Traditionalist centres on belonging, with faith present but lower and the dust scales wider.',
  },
  {
    id: 'centres',
    text: 'The other bands take one centre each. New Muslim: faith bright, discipline still wide. Social Activist: compassion high and anger on the heated side. Family-Centred: belonging and gratitude, without that heat. Secular Muslim: faith on the low side. Cultural: belonging high and faith across the middle. Seeker: faith and worry both open. Progressive: compassion high and ego low. Academic: ego and study high, belonging low. Convert is not a separate band from New Muslim.',
  },
  {
    id: 'step-2',
    text: 'A published band matches a reading only when every scale it includes was read, and that reading (the phone’s −1 to +1, mapped onto −10 to +10) sits inside the range. A persona is never stored on the person.',
  },
  {
    id: 'season',
    text: 'Leon’s season pairing for the ten scales was not in the pack, so Season on each scale is left blank until someone sets it.',
  },
]

type Pair = [number, number]

const CENTRES: Record<string, Record<ScaleKey, Pair>> = {
  devout: {
    desire: [2, 10], greed: [1, 10], anger: [2, 10], ego: [0, 8], worry: [-2, 6],
    belonging: [2, 10], gratitude: [4, 10], faith: [6, 10], compassion: [3, 10], discipline: [6, 10],
  },
  traditionalist: {
    desire: [-2, 6], greed: [-2, 6], anger: [-4, 4], ego: [-2, 6], worry: [-2, 6],
    belonging: [6, 10], gratitude: [0, 6], faith: [2, 8], compassion: [-2, 6], discipline: [4, 10],
  },
  'new-muslim': {
    desire: [-6, 4], greed: [-4, 4], anger: [-4, 6], ego: [-4, 4], worry: [-6, 2],
    belonging: [-4, 6], gratitude: [0, 8], faith: [2, 10], compassion: [0, 8], discipline: [-6, 2],
  },
  activist: {
    desire: [-2, 8], greed: [0, 8], anger: [-8, 0], ego: [-2, 6], worry: [-4, 4],
    belonging: [2, 10], gratitude: [-2, 6], faith: [0, 8], compassion: [6, 10], discipline: [2, 10],
  },
  'family-centred': {
    desire: [-2, 6], greed: [-4, 4], anger: [-2, 6], ego: [-2, 6], worry: [-6, 2],
    belonging: [6, 10], gratitude: [2, 10], faith: [0, 8], compassion: [4, 10], discipline: [0, 8],
  },
  secular: {
    desire: [-4, 6], greed: [-2, 6], anger: [-4, 4], ego: [-2, 8], worry: [-4, 6],
    belonging: [0, 8], gratitude: [-2, 6], faith: [-8, 0], compassion: [0, 8], discipline: [-6, 2],
  },
  cultural: {
    desire: [-2, 8], greed: [-2, 8], anger: [-2, 6], ego: [0, 8], worry: [-2, 6],
    belonging: [4, 10], gratitude: [0, 8], faith: [-4, 4], compassion: [0, 6], discipline: [-4, 2],
  },
  seeker: {
    desire: [-4, 4], greed: [-2, 6], anger: [-4, 4], ego: [-6, 2], worry: [-8, 2],
    belonging: [-4, 4], gratitude: [-2, 8], faith: [-2, 8], compassion: [0, 8], discipline: [-6, 2],
  },
  progressive: {
    desire: [-2, 8], greed: [0, 8], anger: [-6, 2], ego: [-8, 2], worry: [-4, 6],
    belonging: [-2, 8], gratitude: [0, 8], faith: [-2, 6], compassion: [4, 10], discipline: [-2, 6],
  },
  academic: {
    desire: [-2, 8], greed: [-2, 6], anger: [-2, 6], ego: [2, 10], worry: [-2, 8],
    belonging: [-6, 2], gratitude: [-2, 6], faith: [-2, 6], compassion: [-2, 6], discipline: [2, 10],
  },
}

const NOTES: Record<string, string> = {
  devout: 'Centre: faith and discipline. Dust scales are mostly held. Worry can still be present. Not the same shape as Traditionalist.',
  traditionalist: 'Centre: belonging, with steady discipline. Faith is present and lower than Devout. Dust scales sit wider.',
  'new-muslim': 'Centre: a bright, new faith. Discipline and trust are still wide.',
  activist: 'Centre: compassion, with anger on the heated side of the ladder.',
  'family-centred': 'Centre: belonging and gratitude. Anger is not the heated band used for Social Activist.',
  secular: 'Centre: faith on the low side of the ladder. The other scales stay ordinary.',
  cultural: 'Centre: belonging. Faith sits across the middle, not on Secular Muslim’s low band.',
  seeker: 'Centre: an open faith, with worry and discipline still wide and ego quiet.',
  progressive: 'Centre: compassion high and ego low. Faith is a mid band, narrower than Seeker.',
  academic: 'Centre: ego and the discipline of study. Belonging sits low.',
}

const TITLES: [string, string][] = [
  ['devout', 'Devout Practitioner'],
  ['traditionalist', 'Traditionalist'],
  ['new-muslim', 'New Muslim'],
  ['activist', 'Social Activist'],
  ['family-centred', 'Family-Centred'],
  ['secular', 'Secular Muslim'],
  ['cultural', 'Cultural'],
  ['seeker', 'Seeker'],
  ['progressive', 'Progressive'],
  ['academic', 'Academic'],
]

function rangesFor(key: string): RangeRow[] {
  const centre = CENTRES[key]
  return SCALE_KEYS.map((scale) => {
    const [min, max] = centre[scale]
    return { scale, present: true, min, max }
  })
}

export const PERSONA_BANDS: PersonaBand[] = TITLES.map(([key, title]) => ({
  key,
  title,
  status: 'published',
  source: 'balanced',
  placeholder: false,
  identicalGroup: '',
  note: NOTES[key],
  ranges: rangesFor(key),
}))
