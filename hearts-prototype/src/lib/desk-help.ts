import { JOURNAL_LABEL } from './journal-copy'

/** Plain British English for the desk “?” tips. Two to four short sentences each. */

export const PAGE: Record<string, string> = {
  overview:
    'This is the front page of the desk. The numbers are people who have joined, courses you made, and how busy the last two weeks were. Share the address or the QR code so people can join. Teachers see the same page, with fewer switches.',
  teach:
    'Each row is a learner who joined with a learner code. Give them a course, open their workbook, or look at the app as they see it. Shared answers and recordings sit below, so you can reply without leaving this page.',
  feedback:
    'Only answers a learner chose to share show up here. Filters shrink the list, and Anonymise turns names into Learner A, B, and so on. A download is noted. Private answers are counted and never shown.',
  compass:
    'Compass is a gentle monthly look at how people are doing, scored from −10 to +10. Learners never see a number or a label, only a line about what to focus on. The mix decides how the shelf balances quieter ones, steady ones, and a new door.',
  plans:
    'A study plan spreads one course across the days you tick. Talks stay in order and are shared out evenly, so the last day is not empty. It is a guide. People can still watch at their own pace.',
  diaries:
    `Each row is a ${JOURNAL_LABEL.one.toLowerCase()} entry. You see who wrote it, which portal, and when. The words show only when the learner shared them and did not keep the answer private. You can still delete an entry.`,
  nights:
    'Live in person is evenings in person. Someone who watched a part this week has their own ticket. Everyone else has a place held, and you welcome them in at the door. Check-in is on this page.',
  gather:
    'Gather is for meetings at the masjid: classes, circles and open evenings. Put a date up, share the link, and take the register from Attendance. Ideas from learners wait here until you open them.',
  content:
    'Build a subject here: a topic, then a film, then the questions that pause the film. Courses from the library are read only, and you can still add your own questions on top. Search, Mine and Library help when the list is long.',
  bringIn:
    'Bring in is where films enter the library. Paste YouTube links, a playlist or a channel, then untick any you want to leave out. Films under five minutes, and ones already here, start unticked. Everything you bring in stays a draft until you publish it.',
  sheet:
    'The master sheet is a workbook you can download, edit and upload again. Preview first. Nothing is saved until you apply. An empty export is refused, so you do not download a blank file by mistake.',
  create:
    'The sheet creator searches for talks on a topic and builds a draft workbook. Nothing goes live until you apply the preview on the sheet page. A portal draft stays in this portal. The shared library is unchanged.',
  library:
    'The library is the shared catalogue. Each course shows which codes and portals can open it. Link a course into this portal so learners can open it. Changes the master desk makes show up here straight away.',
  access:
    'An access code says who someone is, and which library courses they can open. Tick the courses, or pick a whole door when the courses are tagged. Send the link, a copy or the QR code, so nobody has to type the letters. Learner and parent codes need a teacher code, so someone can see their progress.',
  opening:
    'These are the questions a newcomer sees before the clips. Keep the starter set, change the words, leave a scene out, or add your own. Your own questions belong to this portal. They can be for any kind of work, not only HEARTS.',
  circle:
    'Circle answers are short examples that sit beside real shared answers, so a question is never empty. They are never counted in progress, trends or exports. You can write them yourself, or draft a handful from the built-in lines or this portal’s own AI account. You can also switch a talk’s set on or off.',
  ai:
    'Each row is one job that runs after a talk comes in. Edit the words, try them on one talk, then mark a version live. A run uses this portal’s own AI account when one is connected in Settings. Otherwise the built-in drafts are used, and a new run waits on Review without touching work you already approved.',
  settings:
    'These are the details people see: the name, welcome line, logo, time zone and the short films at the door. Sharing choices decide whether learners can see answers others chose to share. A portal admin can connect this portal’s own AI account here. Save before you leave.',
  wizard:
    'Three short steps get the portal ready: a welcome line, an optional first course, then you are done. You can run this again from Settings. Nothing here deletes what you already made.',
  portals:
    'Each portal is one mosque or community, with its own admin, codes and people. You open them here, and each portal admin runs their own. View as lets you see a desk as that admin does. Open with courses and features when you want to switch parts on in stages.',
  portalCreate:
    'Three short steps open a portal: the name and address, the library courses it can use, then which parts learners and the desk will see. Saving takes effect at once. You can change those parts later from the portal’s edit page.',
  portalEdit:
    'Features decide what this portal shows: Gather, Compass, the Garden, and the rest. Saving takes effect at once for learners and for the desk. Courses ticked here are linked from the library.',
  review:
    'Review is where drafts wait for a person. Approve what reads true, and send back what does not. Approved work is what learners see.',
  tiers:
    'These are the short, medium and longer ways into the same talk. Check the times and the lines before you mark a talk as checked. Learners only see work you have checked.',
  packs:
    'A pack is the set of courses an access code opens. Library packs can be linked by any portal. A portal pack belongs to one community.',
  questions:
    'Joining questions are asked once, when someone joins. Each answer points to a door of Hadith Jibril, and the door with the most answers chooses the first course. The default set is already on every portal. You can attach more, or add your own.',
  lanes:
    'Lanes are the themes the opening uses to pick clips. The titles here are what learners see on Lanes. Change a title with care, because it shows on every phone in that portal.',
  simulator:
    'Answer the opening questions here the way a new person would, without making an account. Pick one answer for each question. You will see how the feelings move, which lane comes first, and which clips would play. Nothing on this page is saved.',
  personas:
    'Scales and bands are the words Compass uses behind the scenes. Learners never see these names, only a gentle line. Change them with care. They shape every monthly look.',
  trends:
    'Network trends are counts across portals that opted in. A trend only appears when enough people are in the group. A name is never shown.',
  course:
    'This is one subject: its topics, films and the questions that pause them. Library courses are read only here. Your own questions still sit on top of a library film.',
  compassLearner:
    'This is one learner’s Compass over the months. You see the detail, and why a talk was put forward. They still only see a gentle line, never these numbers.',
  attendance:
    'This is the register for gatherings: who said they would come, who arrived, and a download when you need a list. It does not change who is invited.',
  experiments:
    'A test shows some learners one wording and others another, then counts what they do. Learners are never told they are in a test. A sheikh’s words stay as they are. The kill switch stops every running test at once.',
  insights:
    'Insights shows how people move through HEARTS: taps, scrolls and clips they watch. The counts stay in our database. We never store what someone typed, or an answer.',
  calendar:
    'Event Calendar knows Friday, Ramadan, Dhul Hijjah, the two Eids and seasons you add. The Islamic day changes at Maghrib. A suggested line never reaches a learner until you approve it.',
  live:
    'Live recordings are video sessions for this portal, including ones already held. Learners see a session while it is on, and a replay afterwards if you keep one. Paste a YouTube or Vimeo link, or use Mux when it is configured.',
  framing:
    'Framing is how a clip sits on the phone. The coloured segments are the director’s pick. Play it through, then change a segment when the crop is wrong. The film itself stays where it is.',
  missions:
    'A mission is a warm ask, never a scolding. Write what you are asking, why it matters, how many minutes, the dates, a target, and which portals. Ask for help is the thread inside the app, so nobody needs a support email.',
  safety:
    'Care and safety is where the team looks at concerns people raise, and at words the screen held back. Hide or keep an item, and send a short note. A gold box at the top is for the named person when someone needs support.',
  announcements:
    'Write a short note for everyone, for teachers, or for one access code. It appears on Home until they dismiss it. Learners cannot reply here. They write to their teacher.',
  transcripts:
    'Every talk is listed with the speaker, the length and a picture. Open a talk to fix a line, replace a word, or save. Talks with no transcript can pull captions from YouTube. Learners hear these lines on the clips.',
}

export const TOOL: Record<string, string> = {
  giveCourse:
    'Give adds one course to this learner’s list. Pick the course first. The button stays still until you do. They see it on Lanes the next time they open the app.',
  viewAs:
    'View as opens the app or the desk as this person, so you can see what they see. You need a short reason, and it is kept on record. You stay signed in as yourself. Use Exit when you are done.',
  hideTest:
    'Hide test accounts is on by default, so practice logins do not clutter the list. The two demo learners stay visible. Untick it when you need to see the test rows.',
  workbook:
    'Workbook downloads this learner’s answers as a spreadsheet. Private rows stay off the file. If they have not answered yet, the button stays still, so you do not download an empty sheet.',
  onTime:
    'On time is how much of their study plan they have kept. It is a guide, not a score. A dash means they do not have a plan yet.',
  exportFeedback:
    'Download writes the shared answers in this view. Anonymise replaces names with Learner A, B, and so on, and emails are never included. The download is noted. If nothing is shared, the buttons stay still.',
  anonymise:
    'Anonymise turns names into Learner A, Learner B, and so on, in a stable order. Emails are left out either way. Turn it off only when you need to speak to a person by name.',
  filters:
    'Filters shrink the list to a door, a course, a date or a group. Press Apply after you change them. Private answers stay counted and hidden.',
  aiSummary:
    'A summary is a draft of the themes in the shared answers. A portal admin can tick the box when this portal’s own account is connected, and must confirm the one call first. Include it in the PDF only when you have read it. It never quotes a private answer.',
  weakQuestions:
    'This check flags questions whose answers would be yes or no, or of little use to a teacher. With this portal’s own AI account connected, a portal admin can tick the box. The page says how many calls that is, and you confirm before they are sent. Rewrites stay as drafts until you say the live question can change.',
  mix:
    'The mix is how the shelf balances quieter ones, steady ones and a new door. The three numbers add up to 100. The usual mix is 60, 25 and 15.',
  compassScores:
    'Scores run from −10 to +10. Learners never see the number. Teach next is a note for you, not a label on anyone.',
  weekdays:
    'Tick the days the plan should use. Talks stay in order and are shared out evenly across those days. Leave a day unticked and nothing is placed on it.',
  earnedTicket:
    'Earned means they watched a part this week and can check themselves in. Held means a place is kept and you welcome them in at the door. Walk-in is someone you let in without a ticket.',
  checkinOverride:
    'Let them in anyway welcomes someone whose ticket is only held, or who has no ticket. Use it at the door. The list still shows who arrived.',
  copyLink:
    'Copy puts the join link on the clipboard. WhatsApp opens a message with the same link. The QR code is the same address, for a poster or a phone camera.',
  codeLimits:
    'Limits cap how many people can use a code, or when it stops working. Leave them empty for an open code. You can switch a code off later without deleting it.',
  teacherCode:
    'A teacher code is the staff member who sees this learner’s progress. Learner and parent codes need one. Admin and teacher codes do not.',
  requiredCourses:
    'Optional. Tick courses everyone with this code must finish.',
  timeZone:
    'The time zone is how dates and nights appear for this portal. Pick the city of the masjid. It does not change the clocks on people’s phones.',
  watchHistory:
    'Ask learners if they will share a detailed watch history. When it is off, teachers only see which parts were finished. Each learner still chooses for themselves.',
  embed:
    'Paste this where you would like a button that opens the portal. The colour is the one you set above. It is an ordinary link, not a live frame of the app.',
  localCourse:
    'A subject made here belongs to this portal. Add a first topic and film if you have them. You can add more in the editor. Learners open it once it is on a code, or once you give it to them.',
  contentSearch:
    'Search looks at subject titles. Mine is what you made here, and Library is what you linked. The list is grouped by the twenty doors of Hadith Jibril, then by Ghunya seat.',
  ingest:
    'Paste one YouTube link, or several on their own lines, to add those films as new parts. A line can be the link, then a bar, then that film’s speaker. New films stay drafts until you publish them. This does not replace the open film unless you tick Replace this film.',
  bringInPaste:
    'Paste one link, several links, a playlist or a channel. A line can end with a bar and a speaker name for that film. Look up reads the list before anything is saved.',
  bringInCourse:
    'Pick a course you can edit, or type a name to make a new one. The course speaker is used when a line does not name one. A new course is not shown as a talk until you publish one.',
  bringInLanguage:
    'This is the caption language to ask YouTube for. English is the choice we start with. The same language is used for every film in this list.',
  bringInJibril:
    'W1 to W20 is the door of Hadith Jibril this talk sits in. Leave it blank if you are not placing it yet. You can set a different door on each row after the lookup.',
  bringInGhunya:
    'Optional. A short name for the seat this talk belongs in. Leave it blank if you are not placing it.',
  bringInSkip:
    'Untick a row to leave that film out. Films under five minutes are refused. Private films, and films already in the library, start unticked.',
  bringInSpeaker:
    'The speaker on the row is saved on that film. It starts from the name on the line, then the course, then a channel you have matched. The YouTube channel name is never used on its own.',
  bringInPublish:
    'Publish makes a draft visible to learners who already have this course, including a draft from the master sheet. Talks still waiting for their words stay hidden until those words are attached. You can publish one row or several at once.',
  bringInGiveHolders:
    'Tick this to add the course to learners who already hold a pack that contains it and who keep a saved course list. Leave it unticked and those learners keep the list they joined with. People who read the pack live already see new courses in that pack.',
  bringInHelper:
    'The caption helper runs on your own machine, where YouTube is not blocked. The code can only list talks waiting for their words, and attach them. It is stored scrambled, shown once, and you can cancel it here.',
  bringInChannel:
    'Match a channel name, or its YouTube id, to a speaker. That speaker is used only when the line and the course do not name one. It does not rename films you have already brought in.',
  bringInLookup:
    'Look up turns a playlist or a channel into films, and shows the length and whether captions are listed. Nothing is saved until you bring the ticked rows in. A failed lookup leaves the library as it was.',
  packGiveHolders:
    'Tick this to add newly ticked courses to learners who already hold this pack and keep a saved course list. Leave it unticked and those learners keep the list they joined with. People who join from now on get the courses either way.',
  fetchTranscript:
    'Leave this ticked to pull YouTube’s own captions and keep their times. Untick it when you only want the film and will upload the words yourself. Nothing here asks an AI to write.',
  captionLang:
    'This is the caption language to ask YouTube for. English is the choice we start with. Automatic captions in that language are used when there is no manual track.',
  bringInRetry:
    'Try again runs the same bring-in on this row. It keeps the caption language, and a speaker already named on this film. A private or missing film is marked failed, so it is not tried forever. It does not start a second part.',
  replaceFilm:
    'Replace this film changes the open part to the new link. If learners can already see that part, it stays published. Clips from the old film are set aside, including ones you already approved. Leave it unticked to add the links as new parts.',
  transcriptFiles:
    'Pick a talk by its title, then add a .vtt, .srt or .txt file. The words land on that talk, and you can undo the save. Open the talk to fix one line or replace a word everywhere.',
  extract:
    'This drafts clips from the words of the talk. Clips you have already approved stay. The built-in run needs no account. A portal admin can tick the portal AI box, confirm the one call, and that run is billed to the portal.',
  portalAi:
    'This box sends the run to your portal’s own AI account, the address and key saved in Settings. The line beside it says how many calls that is and a rough cost, and you confirm before anything is sent. Only a portal admin can start a run. HEARTS does not pay for it.',
  sheetScope:
    'This says what the workbook covers: the whole library, this portal’s own courses, or one course. A portal export skips library courses, so it can be empty. The blank template is always safe to download.',
  sheetPreview:
    'Preview lists every add, change and problem before anything is saved. Rows with a problem are reported and left out. Apply saves the clean rows. Undo takes back the last import.',
  creatorSearch:
    'Search looks on YouTube for talks of at least five minutes. Select all ticks the list, and the count shows how many are ticked. Tick the ones you want, paste links, or upload a file, then build a draft workbook. Apply it on the sheet page when you are happy.',
  hideScene:
    'Leave this scene out hides it for your community only. The scene that opens the help screen cannot be hidden. The starter choices still mean what Hady Core set.',
  addOpeningScene:
    'Add a question writes one of your own scenes for this portal. Learners see it after the starter set you kept. Use it for estate-agent training, self-development, or any work that is not the HEARTS set.',
  helpContacts:
    'Help contacts are shown on the help screen. Add a local line if you have one. With none of your own, the national lines are shown.',
  circleTones:
    'Tones and lengths shape the drafted circle answers. A portal admin can tick the portal AI box when an account is connected, and must confirm the call count first. Otherwise the built-in drafts are used. You can edit, switch off or delete any of them.',
  circleBulk:
    'All on and all off switch the circle answers for this talk or the whole course. They do not delete the words. Real shared answers are never switched off from here.',
  aiGrant:
    'This lets portal admins edit the steps, or takes that away. They can always read the list. A run uses that portal’s own AI account when one is connected in Settings.',
  aiPrompt:
    'These are the instructions sent when this portal’s own AI account is connected. Saving writes a new version, and the live one stays until you mark this one live. Try one talk first, and confirm the two calls when an account is connected. With no account, the try uses the built-in draft.',
  adopt:
    'Link adds this library course to the portal. Learners see it once a code or a grant includes it. The original stays as the master desk set it.',
  deactivate:
    'Deactivate stops learners signing in. Their work is still here. Activate opens the portal again. Only the master desk can do this.',
  activity:
    'Each bar is one day: parts watched and questions answered. It is a pulse, not a league table. Empty days are normal.',
  portalDetails:
    'The name is what people see. The short address becomes /p/that-word. Kind is only a label for you. The welcome line greets whoever arrives.',
  portalCourses:
    'These are library courses this portal can use. Tick them, pick a whole door when courses are tagged, or choose all library courses. You can change the list later. Nothing is copied, and the original stays as the master desk set it.',
  portalFeatures:
    'Standard is the usual set: the parts that stay on, plus circle answers, Compass and feedback. Everything switches the extra parts on as well. You can still switch a middle part off, or pick extras one by one. Saving takes effect at once.',
  safeguarding:
    'This box is for the named person who will reach out. Other staff only see that a person is needed. The email says to look today and does not add extra personal detail.',
}

/** Longer “?” on the experiments page. Button names stay, so the words match the screen. */
export const EXPERIMENT_HELP: { title?: string; body: string }[] = [
  { body: 'A test shows some learners one wording and others another, then counts what they do. Learners are never told they are in a test.' },
  { title: 'Start', body: 'turns a draft on. From then on, learners see one of the versions.' },
  { title: 'Hold back', body: 'keeps a version from running. Use it when a suggested line is not ready.' },
  { title: 'Make the winner the default', body: 'puts the winning words in place for everyone, once you are sure.' },
  { title: 'Kill switch', body: 'stops every running test at once. Everyone sees the usual words again.' },
  { body: 'A sheikh’s words are never tested. The talk, the Qur’an, the hadith, and the meaning of a question stay as they are.' },
]

export const TEST_IDS: Record<string, string> = {
  'admin-overview': 'overview',
  'admin-teach': 'teach',
  'feedback-desk': 'feedback',
  'compass-portal': 'compass',
  'admin-plans': 'plans',
  'master-diaries': 'diaries',
  'portal-diaries': 'diaries',
  'admin-nights': 'nights',
  'master-nights': 'nights',
  'desk-live': 'live',
  'master-live': 'live',
  'master-framing': 'framing',
  'framing-clip': 'framing',
  'framing-desk': 'framing',
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
  'admin-questions': 'questions',
  'admin-settings': 'settings',
  wizard: 'wizard',
  'ai-registry': 'ai',
  'ai-step-page': 'ai',
  master: 'portals',
  'portal-create': 'portalCreate',
  'portal-edit': 'portalEdit',
  'master-library': 'library',
  'master-bring-in': 'bringIn',
  'admin-bring-in': 'bringIn',
  'master-course': 'course',
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
  'admin-safety': 'safety',
  'master-safety': 'safety',
  'admin-announcements': 'announcements',
  'master-announcements': 'announcements',
  transcripts: 'transcripts',
  'transcript-editor-page': 'transcripts',
}

/** Page copy for a desk frame, from the nav key or the screen test id. */
export function pageHelp(active?: string, testId?: string) {
  if (testId && PAGE[TEST_IDS[testId] || testId]) return PAGE[TEST_IDS[testId] || testId]
  if (active && PAGE[active]) return PAGE[active]
  return ''
}

export function deskPageCopyKeys() {
  return Object.keys(PAGE)
}

export function deskTestIdKeys() {
  return Object.keys(TEST_IDS)
}

export function helpSentenceCount(text: string) {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean).length
}
