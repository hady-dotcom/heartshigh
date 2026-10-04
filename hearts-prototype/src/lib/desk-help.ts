/** Plain British English for the desk “?” tips. Two to four short sentences each. */

export const PAGE: Record<string, string> = {
  overview:
    'This is the front door of the portal desk. The counts are everyone who has joined, the courses you made here, and how busy the last fortnight has been. Use the address and the QR to invite people. Teachers see the same picture, with fewer settings.',
  teach:
    'Each row is a learner who joined with a learner code. Give them a course, open their workbook, or look at the app as they see it. Shared workbook entries and recordings sit below, so you can reply without leaving this page.',
  feedback:
    'Only answers a learner chose to share appear here. Filters narrow the list; Anonymise turns names into Learner A, B, and so on. Downloads are written to the audit log. Answers kept private are counted and never shown.',
  compass:
    'Compass is a gentle monthly look at how people are doing, scored from −10 to +10. Learners never see a number or a label — only a line about what to focus on. The mix decides how the shelf balances quieter scales, steady ones, and a new door.',
  plans:
    'A study plan spreads one course across the days you tick. Parts stay in order and are shared out evenly, so the last day is not empty. It is a guide; learners can still watch at their own pace.',
  nights:
    'Nights are evenings in person. Someone who watched a part this week earns their own ticket; anyone else has a place held and you welcome them in at the door. Check-in is on this page.',
  gather:
    'Gather is for gatherings at the masjid — classes, circles and open evenings. Publish a date, share the link, and take the register from Attendance. Suggestions from learners wait here until you open them.',
  content:
    'Build subjects here: a topic, then a film, then the questions that pause the film. Courses from the library are read only; you can still add your own questions on top. Search and Mine or Library help when the list is long.',
  sheet:
    'The master sheet is a workbook you can download, edit and upload again. Preview first — nothing is saved until you apply. An empty export is refused, so you do not download a blank file by mistake.',
  create:
    'The sheet creator searches for talks on a topic and builds a draft workbook. Nothing goes live until you apply the preview on the sheet page. A portal draft stays in this portal; the shared library is unchanged.',
  library:
    'The library is the shared catalogue. Link a course into this portal so learners can open it. Changes the master desk makes appear here straight away.',
  access:
    'An access code says who someone is and which course pack they see. Send the link, a copy or the QR, so nobody has to type the letters. Learner and parent codes need a teacher code so someone can see their progress.',
  opening:
    'These are the scenes a newcomer sees before the feed. You may change the words for your community or leave a scene out. The choices and what they mean stay as the master desk set them.',
  circle:
    'Circle answers are light, written examples that sit beside real shared answers so a question is never empty. They are never counted in progress, trends or exports. You can write them, draft a handful, or switch a talk’s set on or off.',
  ai:
    'Each step is one job the model does after a talk is ingested. Edit the prompt, try it on a single talk, then mark a version live. Re-runs land as drafts on Review and leave approved work where it is.',
  settings:
    'These details are what people see: the name, welcome line, logo, time zone and the short films at the door. Sharing choices decide whether learners can see answers others chose to share. Save before you leave.',
  wizard:
    'Three short steps get the portal ready: a welcome line, an optional first course, then you are done. You can run this again from Settings. Nothing here deletes what you already made.',
  portals:
    'Each portal is one mosque or community, with its own admin, codes and people. You open portals here; each portal admin runs their own. View as lets you see a portal desk as that admin does.',
  review:
    'Review is where machine drafts wait for a person. Approve what reads true; send back what does not. Approved work is what learners see.',
  tiers:
    'Talk tiers are the short, medium and longer ways into the same talk. Check the times and the lines before you mark a talk as checked. Learners only see checked work.',
  packs:
    'A pack is the set of courses an access code opens. Library packs can be linked by any portal; a portal pack belongs to one community.',
  questions:
    'Placing questions are asked once when someone joins. Each answer points to a door of Hadith Jibril. The door with most answers chooses the first course.',
  lanes:
    'Lanes are the themes the opening uses to pick clips. The titles here are what learners see on Lanes. Change a title with care; it shows on every phone in that portal.',
  simulator:
    'The simulator lets you walk the opening as a newcomer would, without making an account. Use it to check wording and the route before you publish a change. Nothing here is saved against a real person.',
  personas:
    'Scales and bands are the Compass language. Learners never see these names — only a gentle line. Change them with care; they shape every monthly look.',
  trends:
    'Network trends are counts across portals that opted in. A trend only appears when enough people are in the bucket. A name is never shown.',
  course:
    'This is one subject: its topics, films and the questions that pause them. Library courses are read only here. Your own questions still sit on top of a library film.',
  compassLearner:
    'This is one learner’s Compass over the months. You see the scales and why a talk was put forward. They still only see a gentle line, never these numbers.',
  attendance:
    'This is the register for gatherings. Who said they would come, who arrived, and a download when you need a list. It does not change who is invited.',
  experiments:
    'A test shows some learners one wording or layout and others another, then counts what they do. Learners are never told they are in a test. A sheikh’s words stay as they are. The kill switch stops every running test at once.',
  insights:
    'Insights is our own look at how people move through HEARTS. Taps, scrolls and clip watches stay in our Postgres. We never store typed text or an answer.',
  calendar:
    'The calendar knows Friday, Ramadan, Dhul Hijjah, the two Eids and seasons you add. The Islamic day moves on at Maghrib. A suggested line never reaches a learner until you approve it.',
  missions:
    'A mission is a warm ask, never a scolding. Write a plain ask, why it matters, how many minutes, the dates, a target, and which portals. Ask for help is the in-app thread so nobody needs a support email.',
}

export const TOOL: Record<string, string> = {
  giveCourse:
    'Give adds one course to this learner’s list. Choose the course first; the button stays still until you do. They see it on Lanes the next time they open the app.',
  viewAs:
    'View as opens the app or desk as this person, so you can see what they see. You need a short reason, kept in the audit log. You stay signed in as yourself; use Exit when you are done.',
  hideTest:
    'Hide test accounts is on by default, so audit and QA logins do not clutter the list. The two demo learners stay visible. Untick it when you need to see the test rows.',
  workbook:
    'Workbook downloads this learner’s answers as a spreadsheet. Private rows stay off the file. If they have not answered yet, the button stays still so you do not download an empty sheet.',
  onTime:
    'On time is how much of their study plan they have kept to. It is a guide, not a score. A dash means they do not have a plan yet.',
  exportFeedback:
    'Download writes the shared answers in this view. Anonymise replaces names with Learner A, B, and so on; emails are never included. The download is logged. If nothing is shared, the buttons stay still.',
  anonymise:
    'Anonymise turns names into Learner A, Learner B, and so on, in a stable order. Emails are left out either way. Turn it off only when you need to speak to a person by name.',
  filters:
    'Filters narrow the list to a door, a course, a date or a cohort. Apply after you change them. Private answers stay counted and hidden.',
  aiSummary:
    'An AI summary is a draft of themes in the shared answers. Include it in the PDF only when you have read it. It never quotes a private answer.',
  weakQuestions:
    'This check flags questions whose answers would be yes or no, or of little use to a sheikh. Rewrites are drafts. Nothing overwrites the live question until you say so.',
  mix:
    'The mix is how the shelf balances quieter scales, steady ones and a new door. The three numbers are scaled to 100. The usual mix is 60, 25 and 15.',
  compassScores:
    'Scores run from −10 to +10. Learners never see the number. Teach next is a prompt for you, not a label on anyone.',
  weekdays:
    'Tick the days the plan should use. Parts stay in order and are shared out evenly across those days. Leave a day unticked and nothing is placed on it.',
  earnedTicket:
    'Earned means they watched a part this week and can check themselves in. Held means a place is kept and you welcome them in at the door. Walk-in is someone you let in without a ticket.',
  checkinOverride:
    'Let them in anyway welcomes someone whose ticket is only held, or who has no ticket. Use it at the door. The log still shows who arrived.',
  copyLink:
    'Copy puts the join link on the clipboard. WhatsApp opens a message with the same link. The QR is the same address, for a poster or a phone camera.',
  codeLimits:
    'Limits cap how many people can use a code, or when it stops working. Leave them empty for an open code. You can switch a code off later without deleting it.',
  teacherCode:
    'A teacher code is the staff member who sees this learner’s progress. Learner and parent codes need one. Admin and teacher codes do not.',
  requiredCourses:
    'These are courses everyone on the code is asked to finish. They sit beside the pack, not instead of it. Leave them unticked if the pack is enough.',
  timeZone:
    'The time zone is how dates and nights appear for this portal. Pick the city of the masjid. It does not change the clocks on people’s phones.',
  watchHistory:
    'Ask learners if they will share detailed watch history. Off, teachers only see which parts were finished. Each learner still chooses for themselves.',
  embed:
    'Paste this where you would like a button that opens the portal. The colour is the one you set above. It is an ordinary link, not a live frame of the app.',
  localCourse:
    'A subject made here belongs to this portal. Add a first topic and film if you have them; you can add more in the editor. A course pack is optional.',
  contentSearch:
    'Search looks at subject titles. Mine is what you made here; Library is what you linked. The list is grouped by the twenty doors of Hadith Jibril, then by Ghunya seat.',
  ingest:
    'Paste a YouTube or share link to fetch the film and, when we can, the transcript. You can also upload a transcript file. Nothing is shown to learners until you approve cuts and questions.',
  sheetScope:
    'Scope says what the workbook covers: the whole library, this portal’s own courses, or one course. Portal exports skip library courses, so they can be empty. The blank template is always safe to download.',
  sheetPreview:
    'Preview shows every add, change and problem before anything is saved. Apply only when the sheet is clean. Undo takes back the last import, not older ones.',
  creatorSearch:
    'Search looks on YouTube for talks on this topic. Tick the ones you want, or paste links and upload a file. Build draft writes a workbook; apply it on the sheet page when you are happy.',
  hideScene:
    'Leave this scene out hides it for your community only. The scene that opens the help screen cannot be hidden. The choices still mean what the master desk set.',
  helpContacts:
    'Help contacts are shown on the help screen. Add a local line if you have one. With none of your own, the national lines are shown.',
  circleTones:
    'Tones and lengths shape the drafted circle answers. Every draft still goes through the same word checks as the editor. You can edit, switch off or delete any of them.',
  circleBulk:
    'All on and all off switch the circle answers for this talk or the whole course. They do not delete the words. Real shared answers are never switched off from here.',
  aiGrant:
    'This lets portal admins edit the steps, or takes that away. They can always read the list. Keys stay in the server environment and are never shown.',
  aiPrompt:
    'The prompt is the instruction the model sees. Saving writes a new version; the live one stays until you mark this one live. Try it on a single talk before you roll it out.',
  adopt:
    'Link adds this library course to the portal. Learners see it once a code or grant includes it. The original stays as the master desk set it.',
  deactivate:
    'Deactivate stops learners signing in. Their work is still here. Activate opens the portal again. Only the master desk can do this.',
  activity:
    'Each bar is one day: parts watched and questions answered. It is a pulse, not a league table. Empty days are normal.',
}

const TEST_IDS: Record<string, string> = {
  'admin-overview': 'overview',
  'admin-teach': 'teach',
  'feedback-desk': 'feedback',
  'compass-portal': 'compass',
  'admin-plans': 'plans',
  'admin-nights': 'nights',
  'desk-gather': 'gather',
  'admin-content': 'content',
  'admin-course': 'course',
  'master-sheet': 'sheet',
  'portal-sheet': 'sheet',
  'portal-creator': 'create',
  'master-creator': 'create',
  'master-circle': 'circle',
  'portal-circle': 'circle',
  'desk-attendance': 'attendance',
  'master-review-popups': 'review',
  'admin-library': 'library',
  'admin-access': 'access',
  'admin-opening': 'opening',
  'admin-settings': 'settings',
  wizard: 'wizard',
  'ai-registry': 'ai',
  'ai-step-page': 'ai',
  master: 'portals',
  'master-library': 'library',
  'master-course': 'course',
  'master-packs': 'packs',
  'master-questions': 'questions',
  'master-review': 'review',
  'master-tiers': 'tiers',
  'master-tier': 'tiers',
  'master-opening': 'opening',
  'master-lanes': 'lanes',
  'master-simulator': 'simulator',
  'master-personas': 'personas',
  'master-trends': 'trends',
  'compass-learner': 'compassLearner',
  'gather-attendance': 'attendance',
  'experiments-desk': 'experiments',
  'insights-desk': 'insights',
  'calendar-desk': 'calendar',
  'missions-desk': 'missions',
}

/** Page copy for a desk frame, from the nav key or the screen test id. */
export function pageHelp(active?: string, testId?: string) {
  if (testId && PAGE[TEST_IDS[testId] || testId]) return PAGE[TEST_IDS[testId] || testId]
  if (active && PAGE[active]) return PAGE[active]
  return ''
}

export function helpSentenceCount(text: string) {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean).length
}
