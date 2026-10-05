import { bannedPhraseHits } from './human-voice'
import { killListHits } from './opening-data'
import type { CircleDraft, CircleLength, CirclePoint, CircleTone } from './circle'

const NAMES = ['Yusuf', 'Amina', 'Bilal', 'Maryam', 'Idris', 'Hana', 'Omar', 'Safiya', 'Ibrahim', 'Zainab', 'Layla', 'Hamza']

type Written = { name: string; body: string; tone: CircleTone; length: CircleLength }

/** Answers written for the five questions on the starter talks. Each one answers that question, not a template. */
const STARTER: { prompt: string; answers: Written[] }[] = [
  {
    prompt: 'Which one manner of the Prophet would you like to carry with you this week?',
    answers: [
      { name: 'Yusuf', tone: 'honest', length: 'short', body: 'The greeting. I walked past the neighbour twice this week and said nothing.' },
      { name: 'Amina', tone: 'warm', length: 'medium', body: 'He asked how people were, then waited. I tried that with my sister last night. I usually rush her off the phone.' },
      { name: 'Bilal', tone: 'practical', length: 'long', body: 'Smiling first. At the shop this morning the man on the till looked tired, so I smiled before I asked for the bread. He smiled back. I want that for the week, not just the one time.' },
      { name: 'Maryam', tone: 'quiet', length: 'short', body: 'Sending salawat after Fajr, before I pick up the phone.' },
      { name: 'Idris', tone: 'practical', length: 'medium', body: 'Eating with people. I had lunch at my desk again today. Tomorrow I will sit with whoever is in the kitchen.' },
    ],
  },
  {
    prompt: "What is one thing you have that you could see as Allah's rather than yours?",
    answers: [
      { name: 'Hana', tone: 'quiet', length: 'short', body: 'The flat. I say my flat. It was here before me.' },
      { name: 'Omar', tone: 'honest', length: 'medium', body: 'The morning. I treat those hours as mine to spend. They are not.' },
      { name: 'Safiya', tone: 'honest', length: 'medium', body: "Dad's old car. I get cross when someone dings the door, as if I built it." },
      { name: 'Ibrahim', tone: 'searching', length: 'short', body: 'These two hands. I was washing up and it landed. I did not make them.' },
      { name: 'Zainab', tone: 'warm', length: 'long', body: 'The job. I talk about it as something I did on my own. A friend reminded me of the years my mum covered the rent while I trained.' },
      { name: 'Layla', tone: 'quiet', length: 'short', body: 'Breath. Obvious, and I still forget by the time I am on the bus.' },
    ],
  },
  {
    prompt: 'What does the Shaykh say is the first sign that light is entering the heart?',
    answers: [
      { name: 'Hamza', tone: 'honest', length: 'medium', body: 'I went with “You start to incline towards the Akhira”. The other two sounded too tidy for real life.' },
      { name: 'Amina', tone: 'searching', length: 'medium', body: 'The first one. I still get low, and I still mess things up, so those other two cannot be the sign he meant.' },
      { name: 'Yusuf', tone: 'practical', length: 'long', body: 'Inclining towards the Akhira. On the bus I was thinking about a meeting, then about what the week adds up to. That pull is the bit I replayed.' },
      { name: 'Maryam', tone: 'honest', length: 'medium', body: "I nearly chose 'you stop making mistakes'. Then I thought of last Ramadan. I was still late for things, and the month still felt different." },
      { name: 'Bilal', tone: 'quiet', length: 'short', body: 'The next life, not a big feeling. The news just feels thinner than it did.' },
    ],
  },
  {
    prompt: 'When did you last feel the change that comes in Ramadan? What did it feel like?',
    answers: [
      { name: 'Safiya', tone: 'warm', length: 'medium', body: 'Last year, the last ten nights. The house was quiet after the children slept. I did not want the night to finish.' },
      { name: 'Omar', tone: 'honest', length: 'medium', body: 'The first week. Fajr was easy for about four days. Then work piled up. Those four days felt light, though.' },
      { name: 'Hana', tone: 'warm', length: 'short', body: "Iftar at my aunt's. Everyone was hungry and still kind. That is the bit I remember." },
      { name: 'Idris', tone: 'practical', length: 'long', body: 'Two years ago, taraweeh on Green Street. My legs hurt and I was glad to be stood there. An odd mix, and it has stayed.' },
      { name: 'Layla', tone: 'quiet', length: 'medium', body: 'This past Ramadan I mostly felt tired. One evening after maghrib I sat on the sofa and the room felt soft. That was the change.' },
    ],
  },
  {
    prompt: 'Call on Allah by the name Al-Nur once a day this week. Note one moment it changed how you saw something.',
    answers: [
      { name: 'Zainab', tone: 'practical', length: 'medium', body: 'After maghrib on Tuesday. The kitchen looked different once I stopped rushing the washing up. Not magic. Just slower.' },
      { name: 'Ibrahim', tone: 'searching', length: 'long', body: 'Monday, on the way to work. I said it once at the lights. The grey street was the same street. I noticed the tree by the station, which I walk past every day.' },
      { name: 'Amina', tone: 'honest', length: 'short', body: 'Missed Wednesday. Did Thursday before sleep. I was cross about an email, then less so.' },
      { name: 'Hamza', tone: 'quiet', length: 'medium', body: 'After Fajr on Friday. I looked at the pile of school letters and it was one pile, not a verdict on the week.' },
      { name: 'Maryam', tone: 'warm', length: 'medium', body: 'Walking the dog. The neighbour’s window was lit and I thought of them, not of the noise last week.' },
      { name: 'Yusuf', tone: 'practical', length: 'short', body: 'Once, before I opened the laptop. The inbox was still the inbox. I answered the kind one first.' },
    ],
  },
]

function fold(text: string) {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()
}

function wordsOf(prompt: string) {
  return prompt
    .replace(/[?.,]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z'-]/gi, ''))
    .filter((word) => word.length > 3 && !/^(what|when|which|this|that|with|your|you|have|does|from|once|week|like|would|could|last|feel|felt|name|call|note|something|rather|than)$/i.test(word))
    .slice(0, 4)
}

/** A fallback that still answers the question in front of the learner, for talks outside the starter five. */
function fitted(point: CirclePoint): Written[] {
  const bits = wordsOf(point.prompt)
  const hook = bits.slice(0, 3).join(' ').toLowerCase() || 'this'
  const choice = (point.options || []).find(Boolean)
  const rows: Written[] = [
    { name: 'Yusuf', tone: 'honest', length: 'short', body: choice ? `I went with “${choice}”. It was the line I could picture.` : `On ${hook}, I keep coming back to a small bit from the commute.` },
    { name: 'Amina', tone: 'warm', length: 'medium', body: `I thought of my sister while he was on ${hook}. We talked about it after isha, nothing grand.` },
    { name: 'Bilal', tone: 'practical', length: 'medium', body: `Wrote ${hook} on a note by the kettle. Tried it once before work. That is as far as I got.` },
    { name: 'Maryam', tone: 'quiet', length: 'short', body: `Sat with ${hook} after maghrib. Not much else tonight.` },
    { name: 'Idris', tone: 'searching', length: 'long', body: `Still turning ${hook} over. On the bus home I had a half answer, then I lost it at the stop. I will listen to that minute again tomorrow.` },
  ]
  return rows
}

export function starterAnswers(point: CirclePoint): CircleDraft[] | null {
  const wanted = fold(point.prompt)
  const found = STARTER.find((row) => fold(row.prompt) === wanted)
  return found ? found.answers.map((row) => ({ ...row })) : null
}

/** Four to six answers for this exact question. Starter talks use the written set. */
export function answersForPoint(point: CirclePoint): CircleDraft[] {
  const written = starterAnswers(point) || fitted(point)
  return written.slice(0, 6)
}

export function circleFillProblems(drafts: CircleDraft[]) {
  const problems: string[] = []
  if (drafts.length < 4 || drafts.length > 6) problems.push(`Expected 4 to 6 answers, got ${drafts.length}.`)
  for (const draft of drafts) {
    const banned = bannedPhraseHits(draft.body)
    const killed = killListHits(`${draft.name} ${draft.body}`)
    if (banned.length) problems.push(`${draft.name} uses a stock phrase: ${banned.join(', ')}.`)
    if (killed.length) problems.push(`${draft.name} uses a blocked word: ${killed.join(', ')}.`)
    if (!draft.body.trim().endsWith('.') && !draft.body.trim().endsWith('?')) problems.push(`${draft.name} is missing a full stop.`)
  }
  return problems
}

export const FILL_MIN = 4
