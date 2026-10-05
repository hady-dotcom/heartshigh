import { bannedPhraseHits } from './human-voice'
import { killListHits } from './opening-data'
import type { CircleDraft, CircleLength, CirclePoint, CircleTone } from './circle'
import { DRAFT_FOLLOW_UPS } from './draft-prompt'

/** Two-word names so the swarm shows initials (YK, AR), never a first name. */
export const CIRCLE_PEOPLE = [
  'Yusuf Khan',
  'Amina Rahman',
  'Bilal Hussain',
  'Maryam Begum',
  'Idris Malik',
  'Hana Ali',
  'Omar Farooq',
  'Safiya Noor',
  'Ibrahim Karim',
  'Zainab Uddin',
  'Layla Qureshi',
  'Hamza Ali',
] as const

type Written = { name: string; body: string; tone: CircleTone; length: CircleLength }

const P = CIRCLE_PEOPLE

/** Answers written for known demo and starter questions. Each one answers that question, not a template. */
const STARTER: { prompt: string; answers: Written[] }[] = [
  {
    prompt: 'Which one manner of the Prophet would you like to carry with you this week?',
    answers: [
      { name: P[0], tone: 'honest', length: 'short', body: 'The greeting. I walked past the neighbour twice this week and said nothing.' },
      { name: P[1], tone: 'warm', length: 'medium', body: 'He asked how people were, then waited. I tried that with my sister last night. I usually rush her off the phone.' },
      { name: P[2], tone: 'practical', length: 'long', body: 'Smiling first. At the shop this morning the man on the till looked tired, so I smiled before I asked for the bread. He smiled back. I want that for the week, not just the one time.' },
      { name: P[3], tone: 'quiet', length: 'short', body: 'Sending salawat after Fajr, before I pick up the phone.' },
      { name: P[4], tone: 'practical', length: 'medium', body: 'Eating with people. I had lunch at my desk again today. Tomorrow I will sit with whoever is in the kitchen.' },
    ],
  },
  {
    prompt: "What is one thing you have that you could see as Allah's rather than yours?",
    answers: [
      { name: P[5], tone: 'quiet', length: 'short', body: 'The flat. I say my flat. It was here before me.' },
      { name: P[6], tone: 'honest', length: 'medium', body: 'The morning. I treat those hours as mine to spend. They are not.' },
      { name: P[7], tone: 'honest', length: 'medium', body: "Dad's old car. I get cross when someone dings the door, as if I built it." },
      { name: P[8], tone: 'searching', length: 'short', body: 'These two hands. I was washing up and it landed. I did not make them.' },
      { name: P[9], tone: 'warm', length: 'long', body: 'The job. I talk about it as something I did on my own. A friend reminded me of the years my mum covered the rent while I trained.' },
      { name: P[10], tone: 'quiet', length: 'short', body: 'Breath. Obvious, and I still forget by the time I am on the bus.' },
    ],
  },
  {
    prompt: 'What does the Shaykh say is the first sign that light is entering the heart?',
    answers: [
      { name: P[11], tone: 'honest', length: 'medium', body: 'I went with “You start to incline towards the Akhira”. The other two sounded too tidy for real life.' },
      { name: P[1], tone: 'searching', length: 'medium', body: 'The first one. I still get low, and I still mess things up, so those other two cannot be the sign he meant.' },
      { name: P[0], tone: 'practical', length: 'long', body: 'Inclining towards the Akhira. On the bus I was thinking about a meeting, then about what the week adds up to. That pull is the bit I replayed.' },
      { name: P[3], tone: 'honest', length: 'medium', body: "I nearly chose 'you stop making mistakes'. Then I thought of last Ramadan. I was still late for things, and the month still felt different." },
      { name: P[2], tone: 'quiet', length: 'short', body: 'The next life, not a big feeling. The news just feels thinner than it did.' },
    ],
  },
  {
    prompt: 'When did you last feel the change that comes in Ramadan? What did it feel like?',
    answers: [
      { name: P[7], tone: 'warm', length: 'medium', body: 'Last year, the last ten nights. The house was quiet after the children slept. I did not want the night to finish.' },
      { name: P[6], tone: 'honest', length: 'medium', body: 'The first week. Fajr was easy for about four days. Then work piled up. Those four days felt light, though.' },
      { name: P[5], tone: 'warm', length: 'short', body: "Iftar at my aunt's. Everyone was hungry and still kind. That is the bit I remember." },
      { name: P[4], tone: 'practical', length: 'long', body: 'Two years ago, taraweeh on Green Street. My legs hurt and I was glad to be stood there. An odd mix, and it has stayed.' },
      { name: P[10], tone: 'quiet', length: 'medium', body: 'This past Ramadan I mostly felt tired. One evening after maghrib I sat on the sofa and the room felt soft. That was the change.' },
    ],
  },
  {
    prompt: 'Call on Allah by the name Al-Nur once a day this week. Note one moment it changed how you saw something.',
    answers: [
      { name: P[9], tone: 'practical', length: 'medium', body: 'After maghrib on Tuesday. The kitchen looked different once I stopped rushing the washing up. Not magic. Just slower.' },
      { name: P[8], tone: 'searching', length: 'long', body: 'Monday, on the way to work. I said it once at the lights. The grey street was the same street. I noticed the tree by the station, which I walk past every day.' },
      { name: P[1], tone: 'honest', length: 'short', body: 'Missed Wednesday. Did Thursday before sleep. I was cross about an email, then less so.' },
      { name: P[11], tone: 'quiet', length: 'medium', body: 'After Fajr on Friday. I looked at the pile of school letters and it was one pile, not a verdict on the week.' },
      { name: P[3], tone: 'warm', length: 'medium', body: 'Walking the dog. The neighbour’s window was lit and I thought of them, not of the noise last week.' },
      { name: P[0], tone: 'practical', length: 'short', body: 'Once, before I opened the laptop. The inbox was still the inbox. I answered the kind one first.' },
    ],
  },
  {
    prompt: 'What will you carry from this sitting into tomorrow?',
    answers: [
      { name: P[1], tone: 'warm', length: 'medium', body: 'The bit about not rushing people. I have a call with my dad in the morning. I will let him finish.' },
      { name: P[6], tone: 'honest', length: 'short', body: 'That I keep treating the next day as a clean page. It is not. I am still the same person at 7am.' },
      { name: P[4], tone: 'practical', length: 'long', body: 'I wrote one line on the back of a receipt: sit down for Fajr, then tea. Tomorrow I will try that before I open the news.' },
      { name: P[10], tone: 'quiet', length: 'medium', body: 'How still the room felt when he paused. I want a minute like that on the bus, even if I only get half of it.' },
      { name: P[2], tone: 'searching', length: 'short', body: 'Not sure yet. I will know when I am at the sink tomorrow night.' },
    ],
  },
]

/** Handwritten replies for the three follow-ups the starter map puts on talk pop-ups. */
const FOLLOW_UPS: { needle: string; answers: Written[] }[] = [
  {
    needle: DRAFT_FOLLOW_UPS[0],
    answers: [
      { name: P[0], tone: 'honest', length: 'short', body: 'The pause after he said it. I replayed that more than the words.' },
      { name: P[3], tone: 'warm', length: 'medium', body: 'I was on the 25. A boy let his gran take the seat. I thought of that line and kept looking at them till my stop.' },
      { name: P[8], tone: 'searching', length: 'long', body: 'I tried to hold the whole sentence and lost it at the lights. What stayed was the tone. Soft, like he was talking to one person in a hall.' },
      { name: P[5], tone: 'quiet', length: 'short', body: 'A short bit about the heart. I said it once under my breath on the stairs.' },
      { name: P[2], tone: 'practical', length: 'medium', body: 'I put it in my notes app at the bus stop. Read it again when I put the kettle on. Still there.' },
    ],
  },
  {
    needle: DRAFT_FOLLOW_UPS[1],
    answers: [
      { name: P[1], tone: 'practical', length: 'medium', body: 'Thursday tea with my sister. I talk over her. That is the place I will try to do less of that.' },
      { name: P[6], tone: 'honest', length: 'short', body: 'The group chat. I write fast and send. I might leave one message sitting for a minute.' },
      { name: P[9], tone: 'warm', length: 'long', body: 'School run, if I am honest. I get sharp when we are late. I can hear his words in the hallway while I look for shoes.' },
      { name: P[11], tone: 'quiet', length: 'medium', body: 'Late evening, when the house is finally still. That is when I usually pick the phone back up. I might not, one night.' },
      { name: P[4], tone: 'searching', length: 'short', body: 'At work, in the kitchen, if anyone else is in there. We usually talk about nothing.' },
    ],
  },
  {
    needle: DRAFT_FOLLOW_UPS[2],
    answers: [
      { name: P[7], tone: 'warm', length: 'medium', body: 'The kindness in how he said it. I can keep that even if I forget the rest of the paragraph.' },
      { name: P[10], tone: 'quiet', length: 'short', body: 'One sentence. I wrote it on the back of a shopping list.' },
      { name: P[0], tone: 'honest', length: 'long', body: 'I keep wanting a neat takeaway. There was not one. I will hold the bit that made me sit up, and leave the rest.' },
      { name: P[8], tone: 'searching', length: 'medium', body: 'The question he left hanging. I do not have an answer. That is the bit I am taking with me.' },
      { name: P[2], tone: 'practical', length: 'short', body: 'Do the small thing he named, once, before Friday.' },
    ],
  },
]

const TASK_BANK: Written[] = [
  { name: P[4], tone: 'practical', length: 'medium', body: 'Did it after maghrib so it would not slip. Two minutes. The kitchen was still a mess.' },
  { name: P[1], tone: 'honest', length: 'short', body: 'Missed Monday. Caught it Tuesday before I slept.' },
  { name: P[9], tone: 'warm', length: 'long', body: 'I did it with my little brother in the hall. He asked what I was doing. I said the words out loud and we both stood there a second.' },
  { name: P[6], tone: 'quiet', length: 'medium', body: 'Once, on the walk to the station. The street was the same street. I was a bit slower at the corner.' },
  { name: P[3], tone: 'searching', length: 'short', body: 'Tried it once. I was rushing. I will try again after Fajr.' },
]

const CHOICE_BANK: Written[] = [
  { name: P[0], tone: 'honest', length: 'medium', body: 'I went with the first line I could picture on a weekday. The others felt like a poster.' },
  { name: P[7], tone: 'warm', length: 'short', body: 'The kinder reading. That is the one I can live with.' },
  { name: P[8], tone: 'searching', length: 'long', body: 'I sat with all three. None of them is tidy. I picked the one that sounded like a real week, not a finished person.' },
  { name: P[11], tone: 'practical', length: 'medium', body: 'The one I can actually do before Friday. I wrote it on a sticky note by the kettle.' },
  { name: P[5], tone: 'quiet', length: 'short', body: 'The middle one. It just fitted.' },
]

/** Standalone replies for talks outside the written sets. Picked by a hash of the prompt so two questions do not share a block. */
const POOL: Written[] = [
  { name: P[0], tone: 'honest', length: 'short', body: 'I nearly skipped this, then came back on the landing.' },
  { name: P[1], tone: 'warm', length: 'medium', body: 'Thought of my nan. She would have nodded and put the kettle on, no speech.' },
  { name: P[2], tone: 'practical', length: 'medium', body: 'Wrote a line on a receipt and stuck it by the fruit bowl. That is as far as I got tonight.' },
  { name: P[3], tone: 'quiet', length: 'short', body: 'Sat with it after maghrib. Not much else tonight.' },
  { name: P[4], tone: 'searching', length: 'long', body: 'Still turning it over. On the bus home I had a half answer, then I lost it at the stop. I will listen to that minute again tomorrow.' },
  { name: P[5], tone: 'honest', length: 'medium', body: 'I talk about this more than I live it. Caught me out while I was making toast.' },
  { name: P[6], tone: 'practical', length: 'short', body: 'Tied it to making tea, so I do not forget.' },
  { name: P[7], tone: 'warm', length: 'long', body: 'Reminded me of home. My mum never makes a fuss and still does the kind thing. I heard her in what he said.' },
  { name: P[8], tone: 'searching', length: 'medium', body: 'More of a question than an answer, for me. I keep coming back to the words he used.' },
  { name: P[9], tone: 'quiet', length: 'medium', body: 'Listened to that bit twice on the way to work. The second time I was not checking the time.' },
  { name: P[10], tone: 'honest', length: 'short', body: 'Hard one to answer. I will try again tomorrow and see.' },
  { name: P[11], tone: 'practical', length: 'long', body: 'Picked one small thing. Did it the same day, after I hung my coat. Day two went better than day one.' },
  { name: P[0], tone: 'warm', length: 'medium', body: 'I smiled. A man at the shop held the door and I thought of this, not of the queue.' },
  { name: P[1], tone: 'quiet', length: 'short', body: 'A small yes. That is all for now.' },
  { name: P[2], tone: 'honest', length: 'medium', body: 'Days are full. This is the first thing that slips when the inbox lights up.' },
  { name: P[3], tone: 'practical', length: 'short', body: 'Set a reminder for after fajr. We will see if I honour it.' },
  { name: P[4], tone: 'warm', length: 'medium', body: 'Thought of the people who make room for me without being asked. I can do that once this week.' },
  { name: P[5], tone: 'searching', length: 'long', body: 'What does this even look like on a Tuesday, between emails. I do not know yet. I will come back after the next bit.' },
  { name: P[6], tone: 'quiet', length: 'medium', body: 'Wrote down the line about the heart. Then I put the pen down and sat.' },
  { name: P[7], tone: 'honest', length: 'short', body: 'Writing it here so I do not forget I said it.' },
]

function fold(text: string) {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()
}

function hash(text: string) {
  let value = 2166136261
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619)
  return value >>> 0
}

function rotate<T>(rows: T[], seed: number, count: number): T[] {
  if (!rows.length) return []
  const start = seed % rows.length
  return Array.from({ length: Math.min(count, rows.length) }, (_, index) => rows[(start + index) % rows.length])
}

function withChoice(rows: Written[], options: string[] | undefined): Written[] {
  const choice = (options || []).find(Boolean)
  if (!choice) return rows
  return rows.map((row, index) => {
    if (index > 1) return row
    if (/I went with|I picked|chose/i.test(row.body)) return row
    const lead = index === 0 ? `I went with “${choice}”. ` : `I picked “${choice}”. `
    return { ...row, body: `${lead}${row.body}` }
  })
}

export function starterAnswers(point: CirclePoint): CircleDraft[] | null {
  const wanted = fold(point.prompt)
  const found = STARTER.find((row) => fold(row.prompt) === wanted)
  return found ? found.answers.map((row) => ({ ...row })) : null
}

function followUpAnswers(point: CirclePoint): Written[] | null {
  const wanted = fold(point.prompt)
  const found = FOLLOW_UPS.find((row) => wanted.includes(fold(row.needle)))
  return found ? found.answers.map((row) => ({ ...row })) : null
}

/** A fallback that still answers the question in front of the learner, for talks outside the written sets. */
function fitted(point: CirclePoint): Written[] {
  const seed = hash(fold(point.prompt || 'this'))
  if (point.kind === 'task') return rotate(TASK_BANK, seed, 5)
  if (point.kind === 'multiple_choice' && (point.options || []).some(Boolean)) return withChoice(rotate(CHOICE_BANK, seed, 5), point.options)
  const follow = followUpAnswers(point)
  if (follow) return follow
  return rotate(POOL, seed, 5)
}

/** Four to six answers for this exact question. Starter talks use the written set. */
export function answersForPoint(point: CirclePoint): CircleDraft[] {
  const written = starterAnswers(point) || followUpAnswers(point) || fitted(point)
  return written.slice(0, 6)
}

export function circleFillProblems(drafts: CircleDraft[]) {
  const problems: string[] = []
  if (drafts.length < 4 || drafts.length > 6) problems.push(`Expected 4 to 6 answers, got ${drafts.length}.`)
  const names = new Set<string>()
  for (const draft of drafts) {
    const banned = bannedPhraseHits(draft.body)
    const killed = killListHits(`${draft.name} ${draft.body}`)
    if (banned.length) problems.push(`${draft.name} uses a stock phrase: ${banned.join(', ')}.`)
    if (killed.length) problems.push(`${draft.name} uses a blocked word: ${killed.join(', ')}.`)
    if (!draft.body.trim().endsWith('.') && !draft.body.trim().endsWith('?')) problems.push(`${draft.name} is missing a full stop.`)
    if (names.has(draft.name)) problems.push(`${draft.name} appears twice.`)
    names.add(draft.name)
  }
  return problems
}

export const FILL_MIN = 4
