/** Short 'How to use this page' copy. Two to four sentences. British English. */

export type HelpCopy = { title: string; body: string[] }

const DEFAULT: HelpCopy = {
  title: 'How to use this page',
  body: [
    'This page is part of HEARTS: short talks, a circle that meets in person, and a garden that grows as you watch.',
    'Use the bar at the bottom to move around.',
    'Nothing here is a test.',
  ],
}

const PAGES: Record<string, HelpCopy> = {
  home: {
    title: 'How to use Home',
    body: [
      'Home is the place you come back to.',
      'Continue picks up the talk you were in. Today\'s clips opens a short film.',
      'The rings show how you have spent time, in plain counts.',
    ],
  },
  feed: {
    title: 'How to use clips',
    body: [
      'Swipe up for the next clip. Swipe down to change lane.',
      'Swipe sideways for more from this speaker.',
      'Tap Ready for more? under a clip, or on a scenic card, to sit with the longer cut.',
    ],
  },
  start: {
    title: 'How to use the opening',
    body: [
      'A few short scenes help us choose your first talk. There is no right answer.',
      'Skip any scene you would rather not sit with.',
      'Only you see these answers unless you later share them with a teacher.',
    ],
  },
  welcome: {
    title: 'How to use Welcome',
    body: [
      'Someone in your circle opened HEARTS for you: short talks, a few minutes a day.',
      'Begin when you are ready. You can sign in later if you already have an account.',
    ],
  },
  join: {
    title: 'How to join',
    body: [
      'Your code may already be filled in. Add your name, email and a password.',
      'That is enough to come in. Teachers sign in from the door if they already have an account.',
    ],
  },
  lanes: {
    title: 'How to use Lanes',
    body: [
      'Each lane is one theme: a path to walk, one subject at a time.',
      'Tap a lane to watch its clips. Courses sit underneath, this week first.',
    ],
  },
  garden: {
    title: 'How to use the Garden',
    body: [
      'The garden is a quiet picture of time you have given.',
      'Each planter belongs to a theme. It starts as a seedling and grows as you watch a full talk and sit with a question.',
      'Tap a planter to see that theme\'s talks.',
    ],
  },
  'garden-general': {
    title: 'How to use this page',
    body: [
      'These are plain counts of time you have given: talks, answers, seats and lines kept.',
      'Nothing here is a score.',
    ],
  },
  'garden-jibril': {
    title: 'How to use the twenty doors',
    body: [
      'These doors come from the hadith of Jibril. A door lights when you finish a talk placed in it.',
      'Tap a door to read it and to find talks that sit there.',
    ],
  },
  'garden-ghunya': {
    title: 'How to use this reading',
    body: [
      'These are seats from al-Ghunya, grouped by door.',
      'Mark a seat once you have read it. It lights up here.',
    ],
  },
  'garden-workbook': {
    title: 'How to use the Workbook',
    body: [
      'Answers you write in a talk are kept here, whether you share them or not.',
      'Your teacher\'s replies appear under the ones you offered them.',
    ],
  },
  'garden-harvest': {
    title: 'How to use Harvest',
    body: [
      'Lines you kept from talks sit here: verses, hadith and short sayings.',
      'Open one to read it again.',
    ],
  },
  me: {
    title: 'How to use Me',
    body: [
      'This is your name, your week, your saved clips, your workbook and your settings.',
      'The first rows take you to those places. Settings holds sound, privacy and the account.',
    ],
  },
  settings: {
    title: 'How to use Settings',
    body: [
      'Each switch saves as you flip it.',
      'Sound, privacy, nights and the account sit in their own groups.',
    ],
  },
  plan: {
    title: 'How to use My week',
    body: [
      'Pick a course and the days that suit you. The talks are shared out in order.',
      'It is a guide only. You can always watch at your own pace.',
    ],
  },
  'learner-path': {
    title: 'How to use this page',
    body: [
      'These lines come from time you have actually given, not from a label.',
      'If a row has no reason yet, you have not sat with that theme this week.',
    ],
  },
  course: {
    title: 'How to use a talk',
    body: [
      'The film sits at the top. Questions stay hidden until their moment, then the talk pauses.',
      'What others said is a quiet list of initials, not names. There is no rating.',
    ],
  },
  'course-overview': {
    title: 'How to use this course',
    body: [
      'This is the whole course: every talk, the count and the time.',
      'Questions only appear once you open a talk and reach their moment. Nothing here previews them.',
    ],
  },
  circle: {
    title: 'How to use Circle',
    body: [
      'Nights are the evenings you can come to in person.',
      'The board is a note for everyone in your circle.',
    ],
  },
  speaker: {
    title: 'How to use a speaker page',
    body: [
      'This is one teacher and the talks they gave.',
      'Start a course from the list, or watch a short clip first.',
    ],
  },
}

export function helpFor(page: string | undefined | null): HelpCopy {
  if (!page) return DEFAULT
  return PAGES[page] || DEFAULT
}

/** Learner-facing '?' copy for report and announce. Two to four short sentences. */
export const LEARNER_HELP: Record<string, string> = {
  report:
    'This is a quiet way to tell the portal team something does not sit right. They will look, and the other person is not told your name. If someone may be at risk, a named person is asked to look today.',
  announce:
    'A short note from your masjid or school. It stays at the top of Home until you dismiss it. You cannot reply here — write to your teacher if you have a question.',
  'hide-until-moment':
    'Questions stay hidden until their moment in the talk. The dots light when that time arrives. The list of talks never shows the questions.',
}

export function learnerHelp(topic: string) {
  return LEARNER_HELP[topic] || ''
}
