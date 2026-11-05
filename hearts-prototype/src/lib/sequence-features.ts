import { FEATURE_KEYS, isFeatureKey, sequenceFeatureMap, type FeatureKey, type FeatureMap } from './features'

/** Plain names for a sequenced course. The stored keys stay the same as the rest of the platform. */
export const SEQUENCE_FEATURE_COPY: Record<FeatureKey, { name: string; what: string }> = {
  garden: { name: 'Progress', what: 'How far someone has got in this course.' },
  workbook: { name: 'Saved answers', what: 'Answers in one place, so a learner can read them again.' },
  planner: { name: 'Plan', what: 'Spread the films across days.' },
  announcements: { name: 'Notes', what: 'A short note on the home page.' },
  circle: { name: 'Example answers', what: 'Sample answers so a question is not empty.' },
  compass: { name: 'Check-in', what: 'A monthly note on how someone is doing.' },
  feedback: { name: 'Teacher notes', what: 'A teacher can reply to an answer.' },
  gather: { name: 'Meetups', what: 'Meetings in person, and who is coming.' },
  live: { name: 'Live video', what: 'A live session for people in this portal.' },
  missions: { name: 'Try this', what: 'A small ask to try one thing from a film.' },
  insights: { name: 'Insights', what: 'Which films people open. Private answers stay private.' },
  experiments: { name: 'Wording tests', what: 'Try two ways of saying something.' },
  calendar: { name: 'Dates', what: 'Dates this group wants people to see.' },
  ai: { name: 'Helper', what: 'Optional help for the desk. Nothing is sent until you connect an account.' },
}

export const KINETIC_COPY = {
  name: 'Kinetic text',
  what: 'A short clip of moving words from a film.',
}

export const PLAYBACK_COPY = {
  name: 'Watch in order',
  what: 'Films play from 1 to the last, with lines and questions at the right moment. This stays on.',
}

export function sequenceFeatureDefaults(): FeatureMap {
  return sequenceFeatureMap(undefined)
}

/** A save from the sequenced-course form. Unchecked parts stay off. */
export function sequenceFeaturesFromForm(form: FormData, field = 'feature'): FeatureMap {
  const on = new Set(form.getAll(field).map(String).filter(isFeatureKey))
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, on.has(key)])) as FeatureMap
}
