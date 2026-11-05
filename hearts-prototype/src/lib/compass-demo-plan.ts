// Pure rules for the hearts-demo seed. Existing accounts keep the password they already have.

export const DEMO_PASSWORD = 'compass-demo'

/** A password is returned only when this run is creating the user. */
export function passwordForNewAccount(isNew: boolean) {
  return isNew ? DEMO_PASSWORD : null
}

const LIFE_PLAN: { key: string; note: string }[] = [
  { key: 'work', note: 'The mornings are full, and the evenings too.' },
  { key: 'baby', note: 'Sleep comes in small pieces.' },
  { key: 'exams', note: 'The paper is on Thursday.' },
  { key: 'grief', note: 'The house is quieter than it was.' },
  { key: 'ramadan', note: 'The fasts have started to feel kind.' },
  { key: 'travel', note: 'I am with family, two cities away.' },
  { key: 'health', note: 'The stairs take a little longer.' },
  { key: 'work', note: 'A deadline moved, and the week went with it.' },
  { key: 'exams', note: 'Revision is taking the late hours.' },
  { key: 'grief', note: 'I still set a place out of habit.' },
  { key: 'baby', note: 'The nights are ours in turns.' },
  { key: 'travel', note: 'The mosque nearby is small and kind.' },
  { key: 'health', note: 'The doctor asked for rest this week.' },
  { key: 'ramadan', note: 'Iftar is with the neighbours on Friday.' },
]

/** Opening month has no check-in. Later months rotate so one person never repeats a note. */
export function lifeForDemo(personIndex: number, month: number) {
  if (month <= 0) return { keys: [] as string[], note: '' }
  const row = LIFE_PLAN[(personIndex * 3 + month) % LIFE_PLAN.length]
  return { keys: [row.key], note: row.note }
}
