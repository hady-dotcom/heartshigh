import type { HeartState, SceneDef } from './heart'

const TOPICS: Record<string, { title: string; why: string }> = {
  calmer: { title: 'a calmer heart', why: 'You chose the door that asked for quiet.' },
  habits: { title: 'prayer', why: 'You asked for habits that actually stick.' },
  'big-q': { title: 'the big questions', why: 'You wanted to make sense of the things that sit underneath the day.' },
  good: { title: 'doing some good', why: 'You chose the door that faces other people.' },
  beginning: { title: 'the beginning', why: 'You asked to start from the first things.' },
  close: { title: 'feeling close to Allah', why: 'You chose the door that asked to come close again.' },
  lord: { title: 'Allah as Lord', why: 'When you thought about who you answer to, your Lord came first.' },
  prophet: { title: 'the Prophet', why: 'When you thought about who you answer to, the Prophet came first.' },
  people: { title: 'the people you look after', why: 'When you thought about who you answer to, the people around you came first.' },
  unsure: { title: 'a calm place to start', why: 'You were not sure yet, so we begin gently.' },
}

export function beginWith(state: HeartState | null | undefined, scenes: SceneDef[]) {
  const taps = state?.taps || []
  const door = taps.find((tap) => tap.scene === 'doors' && tap.option !== 'pass')
  if (door && TOPICS[door.option]) return TOPICS[door.option]
  const account = taps.find((tap) => tap.scene === 'account' && tap.option !== 'pass')
  if (account && TOPICS[account.option]) return TOPICS[account.option]
  const intent = state?.intentLane
  if (intent === 'habits' || intent === 'talking') return TOPICS.habits
  if (intent === 'trust') return TOPICS.calmer
  if (intent === 'mercy') return TOPICS.good
  void scenes
  return { title: 'a calm place to start', why: 'A short talk to sit with first. You can always change lane.' }
}
