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
  appetiser: {
    title: 'How to use Ready for more?',
    body: [
      'This is the longer cut of the same talk, still full-screen.',
      'Tap Back to return to the short clips. The clock shows how far you are through this cut.',
      'Learn more opens the whole talk when you want to sit with it.',
    ],
  },
  start: {
    title: 'How to use the opening',
    body: [
      'A few short scenes help us choose your first talk. There is no right answer.',
      'Let\'s play always starts from the first scene. Skip any scene you would rather not sit with.',
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
      'Tap a lane to watch its clips. Courses that already appear in those clips are open now. Others open one a day.',
    ],
  },
  garden: {
    title: 'How to use the Garden',
    body: [
      'The garden is a quiet picture of time you have given.',
      'Finished counts a talk once you watch it to the end or tap I have watched this part. Short clips do not count. Your path is this course only.',
      'Each planter belongs to a theme. It starts as a seedling and grows as you finish a talk and sit with a question.',
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
      'Keep HEARTS on this phone opens the install card again. Settings holds sound, privacy and the account.',
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
      'Pick a course and the days that suit you. Daily spans space the talks; chosen weekdays land on the first sittings.',
      'Days with a sitting get a gold mark on the week strip. It is a guide only. You can always watch at your own pace.',
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
      'The film sits at the top. Tap a question dot on the timeline to jump there; the talk pauses so you can write.',
      'What others said is a quiet list of initials, not names. There is no rating.',
    ],
  },
  'course-overview': {
    title: 'How to use this course',
    body: [
      'This is the whole course: every talk, the count and the time. Schedule all of these puts them on My week.',
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
  help: {
    title: 'How to use Help',
    body: [
      'These are people you can call or visit if you need support now.',
      'The numbers and links are for this portal. Back to HEARTS returns you to the opening.',
    ],
  },
  login: {
    title: 'How to sign in',
    body: [
      'Use the email and password you joined with.',
      'Teachers come into the app. The desk needs a laptop.',
    ],
  },
  door: {
    title: 'How to come in',
    body: [
      'If you have an access code, join from here. If you already have an account, sign in.',
      'Teachers use the same door. They come into the app; the desk needs a laptop.',
    ],
  },
  placing: {
    title: 'How to begin',
    body: [
      'A few short questions help us choose a gentle first talk. There is no right answer.',
      'Skip this and play the scenes instead if you would rather.',
    ],
  },
  'placing-result': {
    title: 'How to use this page',
    body: [
      'This is a good first talk, chosen from what you just said.',
      'Start the course, or go to your feed if you would rather watch a short clip first.',
    ],
  },
  saved: {
    title: 'How to use Saved',
    body: [
      'Clips you kept from the feed sit here.',
      'Open one to watch it again. Nothing here is a test.',
    ],
  },
  'support-page': {
    title: 'How to ask for help',
    body: [
      'Write to the portal team here. You do not need an email.',
      'They will read it. This is not the crisis contacts on the opening.',
    ],
  },
  'shaped-page': {
    title: 'How to use this page',
    body: [
      'Missions you joined, and what the group decided, sit here.',
      'You cannot change a decision from this list.',
    ],
  },
  'mission-page': {
    title: 'How to use this ask',
    body: [
      'This is a thank-you, not a duty. Join if you can help, then mark it when you have done it.',
      'Open the screen the ask is about if you want to try it now.',
    ],
  },
  'live-screen': {
    title: 'How to sit with a live talk',
    body: [
      'When it is live you can watch and send a question.',
      'After it ends, a replay sits here if the teacher kept one.',
    ],
  },
  gather: {
    title: 'How to use Gather',
    body: [
      'These are meetings at your masjid or school. Say if you are coming.',
      'You can bring someone who is not on HEARTS yet, or suggest a gathering.',
    ],
  },
  'gather-detail': {
    title: 'How to use this gathering',
    body: [
      'Say if you are coming, maybe, or cannot this time.',
      'Share the link so someone who is not on HEARTS can still say they are coming.',
    ],
  },
  'gather-propose': {
    title: 'How to suggest a gathering',
    body: [
      'Propose a time and a kind of meeting. The portal team will look.',
      'This does not book the room on its own.',
    ],
  },
  'gather-door': {
    title: 'How to arrive',
    body: [
      'This is the door list for tonight. Tick yourself in when you are here.',
      'Your teacher can also tick you in.',
    ],
  },
  'gather-reflect': {
    title: 'How to reflect',
    body: [
      'A short note after the gathering. Only you and the portal team see it unless you share.',
    ],
  },
  recalibrate: {
    title: 'How to take a fresh look',
    body: [
      'Five short questions, in different words from last time. There is no right answer.',
      'Your path on Me updates from what you sit with, not from a score.',
    ],
  },
  closed: {
    title: 'How to use this page',
    body: [
      'This portal is paused. Your answers and your garden are kept.',
      'Sign out if you need to leave this phone.',
    ],
  },
  'feature-unavailable': {
    title: 'How to use this page',
    body: [
      'This part is not on in your portal yet.',
      'Go back home, or ask your teacher if you were expecting it.',
    ],
  },
}

/** Screen test ids that share another page's copy. Never point at a different kind of page. */
const ALIASES: Record<string, string> = {
  'welcome-films': 'welcome',
  'garden-door': 'garden-jibril',
  'mission-missing': 'mission-page',
  forgot: 'login',
  reset: 'login',
}

export function helpPageKey(page: string | undefined | null) {
  if (!page) return 'default'
  const key = ALIASES[page] || page
  return PAGES[key] ? key : 'default'
}

export function helpFor(page: string | undefined | null): HelpCopy {
  const key = helpPageKey(page)
  return key === 'default' ? DEFAULT : PAGES[key]
}

/** Learner-facing '?' copy for report and announce. Two to four short sentences. */
export const LEARNER_HELP: Record<string, string> = {
  report:
    'This is a quiet way to tell the portal team something does not sit right. They will look, and the other person is not told your name. If someone may be at risk, a named person is asked to look today.',
  announce:
    'A short note from your masjid or school. It stays at the top of Home until you dismiss it. You cannot reply here — write to your teacher if you have a question.',
  'hide-until-moment':
    'The list stays quiet until you reach a question, or tap its dot on the timeline to jump there. The course page never previews the questions.',
}

export function learnerHelp(topic: string) {
  return LEARNER_HELP[topic] || ''
}
