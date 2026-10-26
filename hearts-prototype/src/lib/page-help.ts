/** Short 'How to use this page' copy. Two to four sentences. British English. */

export type HelpCopy = { title: string; body: string[] }

const DEFAULT: HelpCopy = {
  title: 'How to use this page',
  body: [
    'This page is part of HEARTS: short talks, a circle that meets in person, and a garden that grows as you watch.',
    'The bar at the bottom moves you around.',
    'Nothing here is a test.',
  ],
}

const PAGES: Record<string, HelpCopy> = {
  home: {
    title: 'How to use Home',
    body: [
      'Home is the place you come back to.',
      'Continue picks up the talk you were in, and Today’s clips opens a short film.',
      'The rings are plain counts of time you have spent, not a score.',
    ],
  },
  feed: {
    title: 'How to use clips',
    body: [
      'The talk sits in a wide band at the top, with the words underneath.',
      'Swipe up for the next clip, swipe down to change lane, and tap the picture to pause or play.',
      'Clip, extract, Full talk, Ready for more?, Share and Save sit under the words.',
      'Pull the More tab up if you have hidden them, and swipe the handle down to put them away.',
    ],
  },
  appetiser: {
    title: 'How to use Ready for more?',
    body: [
      'This is the longer cut of the same talk, with the words under the picture.',
      'Tap Back to return to the short clips.',
      'The clock, Ready for more?, Watch the whole talk, and Share sit under the words.',
      'Pull the More tab up if you have hidden them, and swipe the handle down to put them away.',
    ],
  },
  start: {
    title: 'How to use the opening',
    body: [
      'A few short scenes help us pick your first talk, and there is no right answer.',
      'Let’s play starts from the first scene, and you can skip any scene you would rather not sit with.',
      'Only you see these answers, unless you later share them with a teacher.',
    ],
  },
  welcome: {
    title: 'How to use Welcome',
    body: [
      'Someone in your circle opened HEARTS for you. It is short talks, a few minutes a day.',
      'Begin when you are ready. You can sign in later if you already have an account.',
    ],
  },
  join: {
    title: 'How to join',
    body: [
      'If your code is already filled in, leave it. Add your name, email and a password.',
      'That is enough to come in. Teachers who already have an account sign in from the door.',
    ],
  },
  lanes: {
    title: 'How to use Lanes',
    body: [
      'Each lane is one theme, like Trust or Patience, and it says which tree it grows and which doors it walks.',
      'Tap a lane to see its talks in order, then Continue plays the next one you have not watched, and Back returns you to that lane.',
      'Courses already in those clips are open now, and the others open one a day.',
    ],
  },
  lane: {
    title: 'How to use this lane',
    body: [
      'These talks belong together, in the order to watch them.',
      'Continue plays the next one you have not watched. Back on the film returns you here.',
      'The bar shows how many you have finished, and how many minutes you have watched.',
    ],
  },
  garden: {
    title: 'How to use the Garden',
    body: [
      'The garden is a quiet picture of time you have given.',
      'Five trees grow here: Islam, Iman, Ihsan, the Hour and the Sitting, and each lane is a branch on its tree.',
      'Tap a branch to open that lane, or the name on the pot to see the lanes and doors.',
      'Finished counts a talk once you watch it to the end or tap I have watched this part, short clips do not count, and your path is this course only.',
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
      'These doors come from the hadith of Jibril. A door lights when you finish a talk that sits in it.',
      'Tap a door to read it, and to find talks that sit there.',
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
      'Your teacher’s replies appear under the ones you offered them.',
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
      'Keep this app on this phone opens the install card again. Settings holds sound, privacy and the account.',
    ],
  },
  settings: {
    title: 'How to use Settings',
    body: [
      'Each switch saves as you flip it.',
      'Sound, privacy, Live in person alerts and the account sit in their own groups.',
    ],
  },
  plan: {
    title: 'How to use My week',
    body: [
      'Pick a course and the days that suit you.',
      'Daily spreads the talks out, and chosen weekdays land on the first sittings.',
      'Days with a sitting get a gold mark. It is a guide, and you can still watch at your own pace.',
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
      'The film sits at the top in a wide band.',
      'Tap the picture to pause or play.',
      'Pull the More tab up if you have hidden the speed, the clock and the question dots, then swipe the handle down to put them away.',
      'Tap a question dot on the timeline to jump there so you can write, and What others said is initials only, with no rating.',
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
      'Live in person is the evenings you can come to.',
      'The board is a note for everyone in your circle.',
    ],
  },
  speaker: {
    title: 'How to use a speaker page',
    body: [
      'This is one teacher, and the talks they gave.',
      'Start a course from the list, or watch a short clip first.',
    ],
  },
  help: {
    title: 'How to use Help',
    body: [
      'These are people you can call now, and you do not have to give your name.',
      'They answer. This choice is not saved, and nobody at your masjid is told.',
      'Come back when you feel ready.',
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
      'Teachers use the same door and come into the app. The desk needs a laptop.',
    ],
  },
  placing: {
    title: 'How to begin',
    body: [
      'A few short questions help us pick a gentle first talk. There is no right answer.',
      'Skip this and play the scenes instead if you would rather.',
    ],
  },
  'placing-result': {
    title: 'How to use this page',
    body: [
      'This is a good first talk, chosen from what you just said.',
      'Start the course, or go to your clips if you would rather watch a short film first.',
    ],
  },
  saved: {
    title: 'How to use Saved',
    body: [
      'Clips you kept sit here.',
      'Open one to watch it again. Nothing here is a test.',
    ],
  },
  'support-page': {
    title: 'How to ask for help',
    body: [
      'Write to your portal team here. A person will read it and reply on this page.',
      'If you need someone right now, call a helpline. Do not wait for the reply.',
    ],
  },
  'parent-workbook': {
    title: 'How to use the Workbook',
    body: [
      'Each film has one question. Write your answer under it.',
      'Save keeps it on this phone until you have an account. A few answers from other parents sit underneath.',
    ],
  },
  'shaped-page': {
    title: 'How to use this page',
    body: [
      'Asks you joined, and what the group decided, sit here.',
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
  'live-home': {
    title: 'How to use Live recordings',
    body: [
      'Live recordings are the video sessions for your portal.',
      'When one is on you can watch and send a question.',
      'After it ends, a replay sits here if the teacher kept one.',
    ],
  },
  'live-screen': {
    title: 'How to use Live recordings',
    body: [
      'Live recordings are the video sessions with your teacher.',
      'When one is on you can watch and send a question.',
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
      'Say if you are coming, not sure yet, or cannot this time.',
      'Share the link so someone who is not on HEARTS can still say they are coming.',
    ],
  },
  'gather-propose': {
    title: 'How to suggest a gathering',
    body: [
      'Suggest a time and a kind of meeting. The portal team will look.',
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
      'A short note after the gathering. Only you and the portal team see it, unless you share it.',
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
      'Log out if you need to leave this phone.',
    ],
  },
  'feature-unavailable': {
    title: 'How to use this page',
    body: [
      'This part is not on in your portal yet.',
      'Go back home, or ask your teacher if you were expecting it.',
    ],
  },
  'sequence-home': {
    title: 'How to use this course',
    body: [
      'The films are in a fixed order. Start at 1, or press Continue to pick up where you left off.',
      'When a film ends, the next one starts.',
      'If a film is locked, watch the one before it first.',
    ],
  },
  'sequence-course': {
    title: 'How to watch a film',
    body: [
      'Press play. Your place is saved, so you can leave and come back.',
      'A question can appear while the film plays. Answer it in your own words.',
      'The lines under the film are there to help you notice a moment. They are not a test.',
    ],
  },
  'sequence-me': {
    title: 'How to use Me',
    body: [
      'This page is your name, your notes, and a way to log out.',
      'Keep my place remembers where you were in a film.',
    ],
  },
  'sequence-gate': {
    title: 'How to start',
    body: [
      'These are the films in this course. Sign in to watch them in order.',
      'If you have a code, use Join with a code.',
    ],
  },
  'sequence-closed': {
    title: 'How to use this page',
    body: [
      'This course is paused. Your progress is kept.',
      'Log out if you need to leave this phone.',
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

/** Bodies for a portal that is not HEARTS. Titles stay, so the page ? still matches the screen. */
const PLAIN_BODIES: Record<string, string[]> = {
  default: [
    'This page is part of your learning app: short films, a few questions, and a place to come back to.',
    'The bar at the bottom moves you around.',
    'Nothing here is a test.',
  ],
  start: [
    'A few short questions, then the films. There is no right answer.',
    'Let’s play starts with the first question. You can skip any question you would rather not sit with.',
    'Only you see these answers, unless you later share them with a teacher.',
  ],
  home: [
    'Home is the place you come back to.',
    'Continue picks up the film you were in.',
    'The rings are plain counts of time you have spent, not a score.',
  ],
  me: [
    'This is your name, your week, your saved films and your settings.',
    'Keep this app on this phone opens the install card again. Settings holds sound, privacy and the account.',
  ],
  course: [
    'The film sits at the top.',
    'Tap the picture to pause or play.',
    'The clock, the speed and the question dots sit under the film.',
  ],
  'course-overview': [
    'This is the whole course: every film, the count and the time. Schedule all of these puts them on My week.',
    'Questions only appear once you open a film and reach their moment. Nothing here previews them.',
  ],
  placing: [
    'A few short questions help us pick a gentle first film. There is no right answer.',
    'Skip this and play the scenes instead if you would rather.',
  ],
  'placing-result': [
    'This is a good first film, chosen from what you just said.',
  ],
  plan: [
    'Pick a course and the days that suit you.',
    'Daily spreads the films out, and chosen weekdays land on the first sittings.',
    'Days with a sitting get a mark. It is a guide, and you can still watch at your own pace.',
  ],
  speaker: [
    'This is one teacher, and the films they gave.',
    'Start a course from the list, or watch a short clip first.',
  ],
  welcome: [
    'Someone in your group opened this app for you. It is short films, a few minutes a day.',
    'Begin when you are ready. You can sign in later if you already have an account.',
  ],
  lanes: [
    'Each lane is one theme, such as Trust or Patience.',
    'Tap a lane to see its films in order, then Continue plays the next one you have not watched, and Back returns you to that lane.',
    'Courses already in those clips are open now, and the others open one a day.',
  ],
  garden: [
    'Courses is where you see what you have watched.',
    'Each course lists its films in order, with a tick when you finish one.',
    'Finished counts a film once you watch it to the end or tap I have watched this part.',
  ],
  'garden-jibril': [
    'This page is not used on a new portal.',
    'Go back to Courses to see the films in this place.',
  ],
  'garden-ghunya': [
    'This page is not used on a new portal.',
    'Go back to Courses to see the films in this place.',
  ],
  'garden-harvest': [
    'Lines you kept from films sit here.',
    'Open one to read it again.',
  ],
  help: [
    'These are people you can call now, and you do not have to give your name.',
    'They answer. This choice is not saved, and nobody here is told.',
    'Come back when you feel ready.',
  ],
  gather: [
    'These are meetings for your group. Say if you are coming.',
    'You can bring someone who is not in this app yet, or suggest a gathering.',
  ],
  'gather-detail': [
    'Say if you are coming, not sure yet, or cannot this time.',
    'Share the link so someone who is not in this app can still say they are coming.',
  ],
}

export function helpFor(page: string | undefined | null, options?: { plain?: boolean }): HelpCopy {
  const key = helpPageKey(page)
  const copy = key === 'default' ? DEFAULT : PAGES[key]
  if (!options?.plain) return copy
  const body = PLAIN_BODIES[key]
  return body ? { ...copy, body } : copy
}

/** Learner-facing '?' copy for report and announce. Two to four short sentences. */
export const LEARNER_HELP: Record<string, string> = {
  report:
    'This is a quiet way to tell the portal team something does not sit right. They will look, and the other person is not told your name. If someone is at risk, a named person is asked to look today and will reach out.',
  announce:
    'A short note from your masjid or school. It stays at the top of Home until you dismiss it. You cannot reply here. Write to your teacher if you have a question.',
  'hide-until-moment':
    'The list stays quiet until you reach a question, or tap its dot on the timeline to jump there. The course page never previews the questions.',
}

const PLAIN_LEARNER_HELP: Record<string, string> = {
  announce: 'A short note from your group. It stays at the top of Home until you dismiss it. You cannot reply here. Write to your teacher if you have a question.',
}

export function learnerHelp(topic: string, options?: { plain?: boolean }) {
  if (options?.plain && PLAIN_LEARNER_HELP[topic]) return PLAIN_LEARNER_HELP[topic]
  return LEARNER_HELP[topic] || ''
}

/** Every learner help lookup: page copy, aliases, topic tips, and the fallback key. */
export function learnerHelpKeys() {
  return [...Object.keys(PAGES), ...Object.keys(ALIASES), ...Object.keys(LEARNER_HELP), 'default']
}
