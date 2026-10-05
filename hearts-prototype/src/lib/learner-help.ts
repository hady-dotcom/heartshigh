/** Two to four short sentences for each learner screen. Shown by the “?” on the page. */

export const LEARNER_HELP: Record<string, string> = {
  home: 'Home is where you pick up. Carry on with a talk, see tonight’s plan, or open today’s clips. Only you and your portal see this page.',
  lanes: 'Lanes are the themes this portal has opened for you. Each door leads to talks and courses you can take. Nothing here is a score.',
  course: 'This is one talk, with questions that pause the film. Captions are our own timed line; the full transcript sits under the player. Your answers stay as private as you choose.',
  speaker: 'This page gathers the talks and courses from one speaker in your portal. Follow them if you want more from them on this phone.',
  garden: 'The garden is a picture of what you have watched and sown. Fruit you have earned opens what was said. It is yours, not a league table.',
  me: 'Me is your name, your saved talks, and the doors into your plan, circle and settings. Changes you make here stay with your account.',
  settings: 'Settings are the quiet switches: night alerts, watch history, and signing out. Legal pages and Get help sit here too.',
  welcome: 'Welcome is the first walk through this portal. A few films and questions point you to a door. You can change course later.',
  gather: 'Gather is for real evenings at the masjid. See what is on, say you will come, and find the door code when you arrive.',
  consent: 'This page records that you have read how we look after each other. We keep the version and the time. Under-13s need a grown-up.',
  privacy: 'This is what we keep, why, who can see it, and your choices. The short line at the top is enough for most people; the full notice is below.',
  terms: 'These are the short rules for using HEARTS. The community guidelines sit beside them. A tap opens the full wording.',
  guidelines: 'How we speak to each other here: adab, no harm, no selling, and no sharing someone else’s answers. Report points here.',
  search: 'Search looks at talk titles, speakers, course names and the start of a transcript. You only see what this portal has opened for you.',
  help: 'Get help has three doors. Something broken goes to HEARTS. A learning question goes to your teacher. Something worrying goes to the people who look after safety.',
  plan: 'Your study plan spreads a course across the days you chose. It is a guide. You can still watch at your own pace.',
  circle: 'Circle is your board and the evenings you can come to. What you write here is for your group, not the whole internet.',
  path: 'Your path is a gentle line about where a little time will help. You never see a number or a label.',
  workbook: 'Your workbook holds answers you chose to keep. Your teacher sees what you shared with them. Private rows stay with you.',
  harvest: 'Harvest is lines you marked while you watched. They stay with you, for revision and for the garden.',
  feed: 'The feed is short clips from real talks. Swipe or use the arrows. Space pauses. A question may pause the film for you to answer.',
  start: 'This is the opening walk before the feed. Your taps stay on this phone unless you ask us to keep your place.',
  live: 'Live is a session happening now. Questions can be asked in the room. Children’s names are not shown on a public question.',
  week: 'My week is the plan for the days ahead. You can add a file of those days to your own calendar. It is a guide, not a score.',
}

export function learnerHelp(testId?: string | null) {
  if (!testId) return ''
  const key = LEARNER_HELP[testId] ? testId : ALIAS[testId]
  return (key && LEARNER_HELP[key]) || ''
}

const ALIAS: Record<string, string> = {
  'feed-screen': 'feed',
  'start-screen': 'start',
  'help-request': 'help',
  'me-settings': 'settings',
  settings: 'settings',
  'garden-workbook': 'workbook',
  'garden-harvest': 'harvest',
  'me-plan': 'plan',
  'me-circle': 'circle',
  'me-path': 'path',
  'gather-list': 'gather',
  'gather-detail': 'gather',
  legal: 'privacy',
  running: 'terms',
}

export function learnerHelpKeys() {
  return Object.keys(LEARNER_HELP)
}
