/** Learner-facing '?' copy. Two to four short sentences. British English, calm. */

export const LEARNER_HELP: Record<string, string> = {
  report:
    'This is a quiet way to tell the portal team something does not sit right. They will look, and the other person is not told your name. If someone may be at risk, a named person is asked to look today.',
  announce:
    'A short note from your masjid or school. It stays at the top of Home until you dismiss it. You cannot reply here — write to your teacher if you have a question.',
}

export function learnerHelp(topic: string) {
  return LEARNER_HELP[topic] || ''
}
