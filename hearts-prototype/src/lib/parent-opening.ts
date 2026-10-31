import { cleanPortalScenes, type PortalSceneDraft } from './portal-scenes'

/** The parent opening set. A portal admin can replace every line. Learners see only this set once it is saved. */
export const PARENT_OPENING: PortalSceneDraft[] = [
  {
    key: 'ages',
    caption: 'How old are the children at home?',
    subline: 'Go with your first thought.',
    options: [
      { key: 'under-5', label: 'Under 5' },
      { key: 'five', label: '5 to 11' },
      { key: 'twelve', label: '12 to 16' },
      { key: 'mixed', label: 'Mixed ages' },
    ],
  },
  {
    key: 'feel',
    caption: 'What does home learning feel like right now?',
    subline: 'Go with your first thought.',
    options: [
      { key: 'calm', label: 'Mostly calm' },
      { key: 'messy', label: 'A bit messy' },
      { key: 'hard', label: 'Quite hard' },
      { key: 'starting', label: 'We are just starting' },
    ],
  },
  {
    key: 'moment',
    caption: 'What is the hardest moment of the day?',
    subline: 'Go with your first thought.',
    options: [
      { key: 'start', label: 'Getting started' },
      { key: 'stay', label: 'Staying with the task' },
      { key: 'several', label: 'More than one child' },
      { key: 'afternoon', label: 'The afternoon slump' },
    ],
  },
  {
    key: 'time',
    caption: 'How much time can you give on a usual day?',
    subline: 'Go with your first thought.',
    options: [
      { key: 'short', label: 'Under 20 minutes' },
      { key: 'half', label: 'About half an hour' },
      { key: 'hour', label: 'About an hour' },
      { key: 'changes', label: 'It changes' },
    ],
  },
  {
    key: 'better',
    caption: 'What would you most like to get better at?',
    subline: 'Go with your first thought.',
    options: [
      { key: 'calmer', label: 'A calmer start' },
      { key: 'week', label: 'A plan for the week' },
      { key: 'stuck', label: 'Helping when they get stuck' },
      { key: 'try', label: 'Letting them try it themselves' },
    ],
  },
  {
    key: 'learns',
    caption: 'How does your child learn best?',
    subline: 'Go with your first thought.',
    options: [
      { key: 'watch', label: 'Watching someone' },
      { key: 'alone', label: 'Trying it alone' },
      { key: 'talk', label: 'Talking it through' },
      { key: 'bursts', label: 'Short bursts' },
    ],
  },
  {
    key: 'want',
    caption: 'What do you want from this course?',
    subline: 'Go with your first thought.',
    options: [
      { key: 'routine', label: 'A simple routine' },
      { key: 'ideas', label: 'Ideas when we get stuck' },
      { key: 'confidence', label: 'A bit more confidence' },
      { key: 'films', label: 'Just to watch the films' },
    ],
  },
  {
    key: 'where',
    caption: 'Where will you watch?',
    subline: 'Go with your first thought.',
    options: [
      { key: 'table', label: 'At the kitchen table' },
      { key: 'quiet', label: 'In a quiet corner' },
      { key: 'wherever', label: 'Wherever we can' },
      { key: 'each-day', label: 'It changes each day' },
    ],
  },
]

/** Saved scene rows for this portal. Throws when a line would be rejected. */
export function parentOpeningScenes() {
  const cleaned = cleanPortalScenes(PARENT_OPENING)
  if (cleaned.error || cleaned.scenes.length !== PARENT_OPENING.length) {
    throw new Error(cleaned.error || 'The parent opening questions were not kept.')
  }
  return cleaned.scenes
}
