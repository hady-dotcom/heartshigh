// Learner-facing compass copy, the monthly wording, and the life check-in.
// Every string here is shown to a learner, so it has to pass the kill list. Scale names such as
// "gratitude" are on that list, so the focus word for that scale is "thankfulness".

import type { ScaleKey } from './heart'

export type PlaceKey = 'growing' | 'steady' | 'flourishing'
export type Frame = 'places' | 'focusing' | 'both'

export type PlaceCopy = { key: PlaceKey; label: string; low: number; high: number; forward: string }

export type CompassCopy = {
  frame: Frame
  focusLead: string
  places: PlaceCopy[]
  movementUp: string
  movementSame: string
  movementOnward: string
}

export type LifeOption = { key: string; label: string; boost: ScaleKey }

export const DEFAULT_COPY: CompassCopy = {
  frame: 'both',
  focusLead: 'Focusing on',
  places: [
    { key: 'growing', label: 'Growing', low: -10, high: -3, forward: 'A few minutes with {area} will carry this forward.' },
    { key: 'steady', label: 'Steady', low: -2, high: 2, forward: 'Keep {area} company a little this month.' },
    { key: 'flourishing', label: 'Flourishing', low: 3, high: 10, forward: '{area} is in a good season. Let it spill into the next step.' },
  ],
  movementUp: "You've grown in {area} since last month.",
  movementSame: '{area} is holding steady.',
  movementOnward: '{area} would welcome a little more time this month.',
}

export const LIFE_PROMPT = {
  caption: "What's going on in life right now?",
  subline: 'One line is enough. It helps us keep this month close to you.',
}

export const LIFE_OPTIONS: LifeOption[] = [
  { key: 'work', label: 'Work is full just now', boost: 'worry' },
  { key: 'home', label: 'Home is full just now', boost: 'belonging' },
  { key: 'money', label: 'Money is on my mind', boost: 'greed' },
  { key: 'people', label: 'I want a gentler pace with people', boost: 'anger' },
  { key: 'practice', label: 'Prayer has been quiet', boost: 'faith' },
]

/** Short words for the "Focusing on" line. Configurable per scale. Never the dust name. */
export const FOCUS_NAMES: Record<ScaleKey, string> = {
  desire: 'looking',
  greed: 'giving',
  anger: 'patience',
  ego: 'quiet',
  worry: 'trust',
  belonging: 'company',
  gratitude: 'thankfulness',
  faith: 'closeness',
  compassion: 'mercy',
  discipline: 'habits',
}

export type MonthWording = { caption: string; subline: string; labels: Record<string, string> }

/** Same options and the same nudges. Only the words change, so a month does not feel like a repeat. */
export const MONTH_WORDING: Record<string, MonthWording> = {
  extra: {
    caption: 'Something small and welcome turns up on an ordinary day.',
    subline: 'What does the first thought do with it?',
    labels: {
      treat: 'Spend it on myself.',
      tuck: 'Put it aside for later.',
      'pass-on': 'Share some of it.',
      pause: 'Stop, say thank you, then choose.',
    },
  },
  queue: {
    caption: 'Someone steps ahead of you while you are waiting.',
    subline: 'What does your face do?',
    labels: {
      look: 'A long look. They will notice.',
      polite: 'A few careful words.',
      'let-go': 'Let it pass. Their day may be heavy.',
      replay: 'Leave it, then tell the story later.',
    },
  },
  thumb: {
    caption: 'Late at night, the screen is still in your hand.',
    subline: 'What is holding it there?',
    labels: {
      'one-more': 'One more clip. Then one more.',
      lives: 'Other days look brighter than mine.',
      off: 'Nothing. I put it down.',
      talk: 'A talk, or a few verses.',
    },
  },
  visitor: {
    caption: 'A restless thought arrives in the small hours.',
    subline: 'What do you reach for?',
    labels: {
      phone: 'The phone, to drown it out.',
      person: 'A message to someone I trust.',
      wudu: 'Water, then the prayer mat.',
      spin: 'Nothing. I lie there with it.',
      heavy: 'This is heavier than a restless night.',
    },
  },
  news: {
    caption: 'Good news arrives.',
    subline: 'Who hears it first?',
    labels: {
      family: 'The family chat',
      one: 'Just the one person I tell',
      online: 'Everyone, out loud',
      allah: 'Allah first, then I will see',
      nobody: 'Nobody comes to mind',
    },
  },
  doors: {
    caption: 'Six paths. Which one draws you today?',
    subline: 'Any path is a fair start.',
    labels: {
      calmer: 'A quieter mind',
      habits: 'Small habits that stay',
      'big-q': 'Sitting with the big questions',
      good: 'Being of some use out there',
      beginning: 'From the first step',
      close: 'Feeling close again',
    },
  },
}
