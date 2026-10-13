import { hiddenFromLearners } from './youtube'

/** Missing means the row predates drafts. Those talks stay published. */
export function isDraftLesson(row: { publishState?: string | null } | null | undefined) {
  return row?.publishState === 'draft'
}

/**
 * Attaching a transcript never publishes. A talk that had none stays or becomes a draft.
 * Round 1 talks that are already marked published still come back as drafts.
 */
export function helperAttachResult() {
  return {
    publishState: 'draft' as const,
    learnersCanSee: false,
    message: 'It stays a draft until someone publishes it. Learners cannot see it yet.',
  }
}

/** Learners see a talk only after it is published and the film is ready. */
export function learnerLessonVisible(row: { publishState?: string | null; transcriptNote?: string | null } | null | undefined) {
  if (!row) return false
  if (isDraftLesson(row)) return false
  if (hiddenFromLearners(row.transcriptNote)) return false
  return true
}

export function publishNotice(input: {
  published: number
  stillHidden: number
  give: boolean
  coursesInPack: number
  holdersUpdated: number
  holdersLive: number
}) {
  const n = input.published
  const bits = [`Published ${n} talk${n === 1 ? '' : 's'}.`]
  if (input.stillHidden) {
    bits.push(
      `${input.stillHidden} of them ${input.stillHidden === 1 ? 'is' : 'are'} still waiting for a transcript or failed, so learners cannot see ${input.stillHidden === 1 ? 'that one' : 'those'} yet.`,
    )
  } else {
    bits.push('Learners who already have this course can see them.')
  }
  if (!input.give) {
    bits.push('People who hold a pack with this course, but joined before it was on their list, were left as they are.')
    return bits.join(' ')
  }
  if (!input.coursesInPack) {
    bits.push('This course is not in a pack, so there was nobody extra to give it to.')
    return bits.join(' ')
  }
  bits.push(
    `Added this course to ${input.holdersUpdated} learner${input.holdersUpdated === 1 ? '' : 's'} who already hold the pack and keep a saved course list.`,
  )
  if (input.holdersLive) {
    bits.push(
      `${input.holdersLive} learner${input.holdersLive === 1 ? '' : 's'} read the pack live, so they already had the course.`,
    )
  }
  return bits.join(' ')
}

export function packSaveNotice(input: { added: number; give: boolean; holdersUpdated: number; holdersLive: number }) {
  const bits = ['Pack updated.']
  bits.push('The desk shows these courses now.')
  bits.push('Anyone who joins with this pack from now on gets them.')
  if (!input.give || !input.added) {
    bits.push('Learners who already joined keep the course list they had.')
    return bits.join(' ')
  }
  bits.push(
    `Added the new course${input.added === 1 ? '' : 's'} to ${input.holdersUpdated} learner${input.holdersUpdated === 1 ? '' : 's'} who keep a saved list.`,
  )
  if (input.holdersLive) {
    bits.push(`${input.holdersLive} already read the pack live, so they had ${input.holdersLive === 1 ? 'it' : 'them'}.`)
  }
  return bits.join(' ')
}
