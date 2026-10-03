// Draft persona bands. Where Leon's tables leave a gap, the row is empty or marked as a stand-in.
// Nothing here is treated as a real range. Publishing is refused until a person fills the gap.
// These names never reach a learner: the kill list blocks them in learner-facing copy.

import { SCALE_KEYS, type ScaleKey } from './heart'
import type { PersonaBand, RangeRow } from './persona'

/** Scales the source tables do not have a row for. Kept as rows so the desk can fill them later. */
export const MISSING_SCALE_ROWS: ScaleKey[] = ['anger', 'greed']

const IDENTICAL_NOTE = 'Devout Practitioner and Traditionalist were given the same ranges. The −10 to +10 bands are a stand-in for “not narrowed yet”, not Leon’s figures. Both stay drafts until the ranges differ, or one is retired.'
const EMPTY_NOTE = 'No range was in the build pack. Doc C is incomplete, so this draft is empty rather than guessed.'

function ranges(filled: boolean): RangeRow[] {
  return SCALE_KEYS.map((scale) => {
    if (MISSING_SCALE_ROWS.includes(scale)) return { scale, present: false, min: null, max: null }
    if (!filled) return { scale, present: true, min: null, max: null }
    return { scale, present: true, min: -10, max: 10 }
  })
}

export const OPEN_QUESTIONS: { id: string; text: string }[] = [
  {
    id: 'anger-greed',
    text: 'The source tables have no Anger row and no Greed row. Each band keeps an empty row for both, marked “No source row”, and cannot be published until those rows are filled or the rule changes.',
  },
  {
    id: 'identical',
    text: 'Devout Practitioner and Traditionalist arrived with the same ranges. Both are drafts. The −10 to +10 figures are a stand-in meaning “not narrowed yet”, not a copy of Leon’s table. Publishing stays closed until the two ranges differ, or one is retired.',
  },
  {
    id: 'doc-c',
    text: 'Doc C is incomplete and was not in the build pack. The other bands are empty drafts. No range was invented for them.',
  },
  {
    id: 'which-names',
    text: 'Cultural, Seeker, Progressive and Academic are names learner copy is forbidden to show. It is open whether each is a real row. Convert is not seeded as its own band beside New Muslim.',
  },
  {
    id: 'step-2',
    text: 'The UX draft’s step 2 rule was not in the pack. Until it is, a published band matches a reading only when every scale it includes was read, and that reading (the phone’s −1 to +1, mapped onto −10 to +10) sits inside the range. Drafts never match. Two bands with the same ranges match nobody. A missing reading does not count as a fit.',
  },
  {
    id: 'where-readings-live',
    text: 'Trend contributions do not carry scale readings. The lens can only use a heart state saved with Keep my place, for someone who also opted into trends. A persona is never stored on the person, the heart state or the contribution.',
  },
  {
    id: 'season',
    text: 'Leon’s season pairing for the ten scales was not in the pack, so Season on each scale is left blank.',
  },
  {
    id: 'anchors',
    text: 'Anchor texts are only the rungs already quoted in the opening notes. The rest of −10 to +10 is empty until someone adds it.',
  },
]

const draft = (key: string, title: string, filled: boolean, identicalGroup: string, note: string): PersonaBand => ({
  key,
  title,
  status: 'draft',
  source: 'unassigned',
  placeholder: true,
  identicalGroup,
  note,
  ranges: ranges(filled),
})

/** Seed order: the identical pair first, then the names used as simulator fixtures, then the unresolved names. */
export const PERSONA_BANDS: PersonaBand[] = [
  draft('devout', 'Devout Practitioner', true, 'devout-traditionalist', IDENTICAL_NOTE),
  draft('traditionalist', 'Traditionalist', true, 'devout-traditionalist', IDENTICAL_NOTE),
  draft('new-muslim', 'New Muslim', false, '', EMPTY_NOTE),
  draft('activist', 'Social Activist', false, '', EMPTY_NOTE),
  draft('family-centred', 'Family-Centred', false, '', EMPTY_NOTE),
  draft('secular', 'Secular Muslim', false, '', EMPTY_NOTE),
  draft('cultural', 'Cultural', false, '', EMPTY_NOTE),
  draft('seeker', 'Seeker', false, '', EMPTY_NOTE),
  draft('progressive', 'Progressive', false, '', EMPTY_NOTE),
  draft('academic', 'Academic', false, '', EMPTY_NOTE),
]
