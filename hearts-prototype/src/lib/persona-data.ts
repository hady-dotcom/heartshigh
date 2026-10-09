// Persona v2 is the published reading. The notes below are what the tests and the master desk
// still look for. The full account, with citations, is PERSONA-BALANCING.md.

import type { ScaleKey } from './heart'
import { PERSONA_V2 } from './persona-v2'

/** Kept so older notes can see that the gap is closed. No scale is missing a row. */
export const MISSING_SCALE_ROWS: ScaleKey[] = []

export const BALANCE_NOTES: { id: string; text: string }[] = [
  {
    id: 'anger-greed',
    text: 'Anger and Greed had no source row in Doc A, Doc B or Doc C. Each band now has its own inclusive range for both, drawn from the portrait of that band, so a heated band such as Social Activist is not the same shape as a quiet one.',
  },
  {
    id: 'devout',
    text: 'Devout Practitioner and Traditionalist arrived overlapping in Doc A. They are now distinct: Devout Practitioner keeps a high discipline band and a mid faith band. Traditionalist keeps the top of the faith ladder, the law-and-wording fidelity Doc B and Doc C describe.',
  },
  {
    id: 'centres',
    text: 'The other bands take one centre each. New Muslim: gratitude bright and belonging still unsettled. Social Activist: compassion high and anger on the heated side. Family-Centred: belonging at the top of the ladder. Secular Muslim: faith on the low side. Cultural: faith across the middle. Seeker: worry wide open. Progressive: compassion high, without forcing ego low. Academic: ego high. Convert is not a separate band from New Muslim.',
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

export const PERSONA_BANDS = PERSONA_V2
