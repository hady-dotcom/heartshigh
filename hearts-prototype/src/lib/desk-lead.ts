import { JOURNAL_LABEL } from './journal-copy'

/** One plain line per desk page: what it is for, and who sees the result, plus the main action. */

export type DeskPrimary = { label: string; href: string }

type Lead = { line: string; label: string; href: string }

const MASTER: Record<string, Lead> = {
  portals: {
    line: 'Each mosque or community, and who runs it. Only the master desk sees this list.',
    label: 'Open a portal',
    href: '/master/create',
  },
  learners: {
    line: 'Everyone learning, across every portal. Only the master desk sees this whole list.',
    label: 'Open a portal',
    href: '/master/create',
  },
  diaries: {
    line: `${JOURNAL_LABEL.many} across the portals. Learners see their own words. A private entry stays hidden here.`,
    label: 'Open learners',
    href: '/master/learners',
  },
  library: {
    line: 'Shared courses any portal can link. Learners see a course only after their portal links it.',
    label: 'Add a course',
    href: '#new-library-course',
  },
  'bring-in': {
    line: 'Paste films in. Learners see a talk only after you publish it.',
    label: 'Paste links',
    href: '#bring-in-paste',
  },
  live: {
    line: 'Live video for a portal. Learners in that portal see it while it is on.',
    label: 'Open a portal',
    href: '/master/create',
  },
  packs: {
    line: 'The set of courses a join code opens. Learners see whatever their code includes.',
    label: 'Make a pack',
    href: '#new-pack',
  },
  plans: {
    line: 'How a course is spread across days. Learners see their plan on My week.',
    label: 'Open a portal',
    href: '/master',
  },
  circle: {
    line: 'Example answers so a question is never empty. Learners see them in What others said.',
    label: 'Open a talk',
    href: '#circle-index',
  },
  nights: {
    line: 'Evenings in person. Learners with a ticket see the night in the app.',
    label: 'Open a portal',
    href: '/master',
  },
  missions: {
    line: 'A warm ask for help trying something. Learners who are asked see it in the app.',
    label: 'New mission',
    href: '/master/missions/new',
  },
  safety: {
    line: 'Concerns, and words the screen held back. Only the desk sees them.',
    label: 'Review the queue',
    href: '#care-queue',
  },
  announcements: {
    line: 'A short note on Home. Learners see it until they dismiss it.',
    label: 'Write a note',
    href: '#write-a-note',
  },
  opening: {
    line: 'Questions a newcomer answers before the feed. Learners see a scene once it is published.',
    label: 'Edit a scene',
    href: '#opening-scenes',
  },
  lanes: {
    line: 'Threads of clips for one part of the heart. Learners see a clip only after its lane is confirmed.',
    label: 'Try the route',
    href: '/master/simulator',
  },
  experiments: {
    line: 'A quiet test of two wordings. Learners are never told they are in one.',
    label: 'New experiment',
    href: '/master/experiments/new',
  },
  insights: {
    line: 'Taps and drop-off, with no typed answers. Only the master desk and portal admins see this.',
    label: 'See who comes back',
    href: '/master/insights?tab=funnel',
  },
  calendar: {
    line: 'Friday, Ramadan and the seasons. Learners see a line only after you approve it.',
    label: 'Preview a day',
    href: '#calendar-preview',
  },
  framing: {
    line: 'How a clip is cropped on the phone. Learners see the crop you leave in place.',
    label: 'Open the list',
    href: '/master/framing',
  },
  sheet: {
    line: 'One workbook for talks and questions. Learners see a row only after you apply it.',
    label: 'Build a sheet',
    href: '/master/sheet/create',
  },
  transcripts: {
    line: 'The words of each talk. Learners hear these lines on the clips.',
    label: 'Find a talk',
    href: '#transcript-list',
  },
  simulator: {
    line: 'Answer the opening the way a new person would. Nothing on this page is saved.',
    label: 'Try it as a newcomer',
    href: '#simulator',
  },
  personas: {
    line: 'The scale names behind Compass. Learners never see these names, only a gentle line.',
    label: 'Edit a scale',
    href: '#scale-list',
  },
  review: {
    line: 'Drafts waiting for a person. Learners see a line only after you approve it.',
    label: 'Review talk tiers',
    href: '/master/review',
  },
  tiers: {
    line: 'The short, medium and long way into a talk. Learners see a tier only after it is checked.',
    label: 'Review a draft',
    href: '/master/review',
  },
  create: {
    line: 'A draft workbook from a topic. Learners see nothing until you apply it on the sheet.',
    label: 'Search for talks',
    href: '#creator-search',
  },
  questions: {
    line: 'Questions asked once at joining. Learners’ answers pick their first course.',
    label: 'Add a question',
    href: '#new-question',
  },
  trends: {
    line: 'Counts from learners who opted in. No names, and a small group stays hidden.',
    label: 'Edit the bands',
    href: '/master/personas',
  },
  overview: {
    line: 'Who has joined, what you have made, and how the last fortnight went. The portal team sees this.',
    label: 'Open learners',
    href: '',
  },
}

/** Portal paths are relative to /p/:slug/admin unless they start with # or /. */
const PORTAL: Record<string, { line: string; label: string; path: string }> = {
  overview: {
    line: 'Who has joined, what you have made, and how the last fortnight went. The portal team sees this.',
    label: 'Open learners',
    path: 'teach',
  },
  teach: {
    line: 'How each learner is getting on. They do not see this page; a reply shows in their workbook.',
    label: 'See the list',
    path: '#learner-list',
  },
  diaries: {
    line: `${JOURNAL_LABEL.many} in this portal. Learners see their own words. A private entry stays hidden here.`,
    label: 'Open learners',
    path: 'teach',
  },
  feedback: {
    line: 'Answers a learner chose to share. Private answers stay off this page.',
    label: 'Filter the list',
    path: '#feedback-filters',
  },
  compass: {
    line: 'A monthly look, scored for the team. Learners see a gentle line, never the number.',
    label: 'See the circle',
    path: '#compass-circle',
  },
  plans: {
    line: 'A course spread across days. Learners see it on My week.',
    label: 'Share out the parts',
    path: '#new-plan',
  },
  nights: {
    line: 'An evening in person. Learners with a ticket see it in the app.',
    label: 'Plan a night',
    path: '#plan-a-night',
  },
  gather: {
    line: 'Gatherings at the masjid. Learners see a date once you publish it.',
    label: 'Open the register',
    path: 'gather/attendance',
  },
  circle: {
    line: 'Example answers so a question is never empty. Learners see them in What others said.',
    label: 'Open a talk',
    path: '#circle-index',
  },
  live: {
    line: 'A live session for this portal. Learners see it on Live while it is on.',
    label: 'Go to the form',
    path: '#go-live',
  },
  safety: {
    line: 'Concerns for this portal. Only the desk sees them.',
    label: 'Review the queue',
    path: '#care-queue',
  },
  announcements: {
    line: 'A note on Home. Learners see it until they dismiss it.',
    label: 'Write a note',
    path: '#write-a-note',
  },
  library: {
    line: 'Courses from the shared library. Learners see one once a code includes it.',
    label: 'Make your own course',
    path: 'content',
  },
  content: {
    line: 'Subjects, films, and the questions that pause them. Learners see a film once it is published.',
    label: 'Start a subject',
    path: '#new-course',
  },
  'bring-in': {
    line: 'Paste films in as drafts. Learners see a talk only after you publish it.',
    label: 'Paste links',
    path: '#bring-in-paste',
  },
  access: {
    line: 'Who can join, and which courses they see. Send the link; learners do not see this list.',
    label: 'Make a code',
    path: '#new-code',
  },
  missions: {
    line: 'A warm ask for help trying something. Learners who are asked see it in the app.',
    label: 'New mission',
    path: 'missions/new',
  },
  experiments: {
    line: 'Results of quiet wording tests. Learners are never told they are in one.',
    label: 'See the tests',
    path: '#experiment-list',
  },
  insights: {
    line: 'Taps and drop-off for this portal. No typed answers. Portal admins see this.',
    label: 'See who comes back',
    path: 'insights?tab=funnel',
  },
  calendar: {
    line: 'Friday, Ramadan and the seasons. Learners see a line only after you approve it.',
    label: 'Preview a day',
    path: '#calendar-preview',
  },
  opening: {
    line: 'Questions a newcomer sees before the feed. Learners in this portal see your wording.',
    label: 'Add a question',
    path: '#portal-own-form',
  },
  questions: {
    line: 'Joining questions for this portal. A learner’s answers pick their first course.',
    label: 'Add a question',
    path: '#new-question',
  },
  sheet: {
    line: 'Load talks into courses made here. Learners see a row only after you apply it.',
    label: 'Build a sheet',
    path: 'sheet/create',
  },
  create: {
    line: 'A draft sheet from a topic. Learners see nothing until you apply it.',
    label: 'Search for talks',
    path: '#creator-search',
  },
  settings: {
    line: 'The name, welcome and films at the door. Learners see these when they arrive.',
    label: 'Set it up',
    path: 'wizard',
  },
}

const SKIP = new Set(['ai', 'codes'])

export function deskLead(active: string, brandHref: string): { line: string; primary: DeskPrimary } | null {
  if (SKIP.has(active)) return null
  const master = brandHref === '/master'
  if (master) {
    const row = MASTER[active]
    if (!row) return null
    return { line: row.line, primary: { label: row.label, href: row.href } }
  }
  const row = PORTAL[active]
  if (!row) return null
  return { line: row.line, primary: { label: row.label, href: portalHref(brandHref, row.path) } }
}

function portalHref(brandHref: string, path: string) {
  if (path.startsWith('#') || path.startsWith('/')) return path
  const base = brandHref.replace(/\/$/, '')
  return `${base}/${path}`
}
