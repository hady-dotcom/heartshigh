// Seed data for the opening ("Shine and dust"): Leon's ten scales, the Jibril lanes, and the six scenes.
// Copy comes from ux-first-run.md and the build spec (sections 2.1, 2.7, 2.8). Plain module, no path aliases,
// so the seed, the server, the browser and the tests can all import it.
import type { LaneDef, ScaleDef, ScaleKey, SceneDef } from './heart'
import { hasMarkup, killHits } from './text-safety'

export const SCALES: (ScaleDef & {
  leonName: string
  room: 'appetites' | 'heat' | 'unsettled' | 'lights'
  polishLabel: string
  anchors: Record<string, string>
})[] = [
  // Rooms follow the spec's four room names. Leon's season pairing table is not in the pack, so season is left empty.
  // Anchors hold only the rungs quoted in ux-first-run.md; the rest are waiting for Leon's docs.
  { key: 'desire', leonName: 'Desire / Sexuality', room: 'appetites', polishLabel: 'Guarding the gaze', firstOpenRead: false, anchors: { '-4': 'mild obsession with beauty', '2': 'chooses what they consume' } },
  { key: 'greed', leonName: 'Greed / Wealth Attachment', room: 'appetites', polishLabel: 'Lightness and giving', firstOpenRead: true, anchors: { '-2': 'slight anxiety around giving, afraid of losing' } },
  { key: 'anger', leonName: 'Anger / Resentment', room: 'heat', polishLabel: 'Patience', firstOpenRead: true, anchors: { '-2': 'struggles to forgive, replays events mentally' } },
  { key: 'ego', leonName: 'Ego / Pride', room: 'heat', polishLabel: 'Quiet heart', firstOpenRead: true, anchors: { '-2': 'seeks validation' } },
  { key: 'worry', leonName: 'Fear / Anxiety', room: 'unsettled', polishLabel: 'Trust', firstOpenRead: true, anchors: { '1': 'seeks refuge in prayer in moments of fear' } },
  { key: 'belonging', leonName: 'Loneliness / Belonging', room: 'unsettled', polishLabel: 'Good company', firstOpenRead: true, anchors: { '2': 'feels seen by close friends' } },
  { key: 'gratitude', leonName: 'Gratitude / Contentment', room: 'lights', polishLabel: 'Noticing gifts', firstOpenRead: true, anchors: { '-7': 'compares life to others' } },
  { key: 'faith', leonName: 'Faith / Connection to God', room: 'lights', polishLabel: 'Talking to Allah', firstOpenRead: true, anchors: {} },
  { key: 'compassion', leonName: 'Compassion / Empathy', room: 'lights', polishLabel: 'Mercy', firstOpenRead: true, anchors: { '4': "sees people's wounds beyond their behaviour" } },
  { key: 'discipline', leonName: 'Discipline / Self-Control', room: 'lights', polishLabel: 'Small steady habits', firstOpenRead: true, anchors: {} },
]

const c = (pairs: [number, number][]) => pairs.map(([clause, rank]) => ({ clause, rank }))

export const LANES: (LaneDef & { seriesNote: string })[] = [
  { key: 'trust', title: 'Trust', scale: 'worry', fit: 'natural', order: 1, clauses: c([[27, 1], [22, 2], [15, 3]]), excludeClauses: [26, 31, 32, 33, 34, 35], optInOnly: false, seriesNote: "Vol 5 tawakkul 114–125; Vol 2 Bismillah 47–104; The Names; DUA: The Answered Prayer. Do not route on Vol 4 'fear prayer' (239–301)." },
  { key: 'company', title: 'Good company', scale: 'belonging', fit: 'natural', order: 2, clauses: c([[2, 1], [4, 2], [8, 2], [37, 3], [9, 3]]), excludeClauses: [], optInOnly: false, seriesNote: 'Vol 1 sitting 53–111; Vol 5 fellowship 43–86; Vol 5 murid/shaykh 22–42; In Good Company; Manners of the Salaf' },
  { key: 'lightness', title: 'Lightness and giving', scale: 'greed', fit: 'natural', order: 3, clauses: c([[16, 1], [35, 2], [27, 3]]), excludeClauses: [], optInOnly: false, seriesNote: 'Vol 1 Zakat 17–20; Vol 5 rich and poor 43–86; Vol 5 tawakkul 114–125' },
  { key: 'quiet', title: 'Quiet heart', scale: 'ego', fit: 'natural', order: 4, clauses: c([[31, 1], [33, 2], [39, 2], [35, 3]]), excludeClauses: [], optInOnly: false, seriesNote: 'Vol 3 ikhlas/riya 326–350; Vol 5 tawadu (no pages); Kingdom of the Heart; Purification of the Heart' },
  { key: 'talking', title: 'Talking to Allah', scale: 'faith', fit: 'natural', order: 5, clauses: c([[22, 1], [21, 2], [30, 2], [29, 3], [31, 3]]), excludeClauses: [], optInOnly: false, seriesNote: 'Vol 2 Bismillah 47–104; Vol 2 tawba 105–208; Vol 1 Ch 4 171–; Faithful; The Names; Dhikr & Fikr' },
  { key: 'habits', title: 'Small steady habits', scale: 'discipline', fit: 'natural', order: 6, clauses: c([[15, 1], [17, 1], [1, 2], [10, 2], [36, 3]]), excludeClauses: [], optInOnly: false, seriesNote: "Vol 4 five prayers 110–238; Vol 4 year-fast 5–109; Vol 1 fasting 21–23; Vol 5 'easy first' 22–42; Ramadan Muslims; The Blessing of Time" },
  { key: 'patience', title: 'Patience', scale: 'anger', fit: 'workable', order: 7, clauses: c([[20, 1], [17, 1], [37, 2], [6, 3]]), excludeClauses: [], optInOnly: false, seriesNote: 'Vol 1 fasting incl. the tongue 21–23; Vol 1 hisba patience (no pages); Vol 5 sabr 140–144; Vol 5 husn al-khuluq 126–131; Our Character' },
  { key: 'gifts', title: 'Noticing gifts', scale: 'gratitude', fit: 'workable', order: 8, clauses: c([[27, 1], [1, 2], [16, 3]]), excludeClauses: [], optInOnly: false, seriesNote: 'Vol 5 tawakkul 114–125 (contentment); Vol 3 days of the week 351–360; shelf Vol 5 §17 shukr, rida (no pages); The Blessing of Time' },
  { key: 'mercy', title: 'Mercy', scale: 'compassion', fit: 'workable', order: 9, clauses: c([[6, 1], [4, 2], [8, 2], [16, 3], [10, 3]]), excludeClauses: [], optInOnly: false, seriesNote: 'Vol 5 husn al-khuluq 126–131; Vol 5 strangers 43–86; Vol 1 zakat beneficiaries 17–20; Our Character' },
  { key: 'guarding-gaze', title: 'Guarding the gaze', scale: 'desire', fit: 'weak', order: 10, clauses: c([[31, 1], [29, 2], [17, 2]]), excludeClauses: [], optInOnly: true, seriesNote: 'Vol 3 ikhlas 326–350; Vol 2 tawba 105–208; Vol 1 fasting 21–23. Opt-in only. Unit 34 (marriage seat) is not a back door.' },
]

/** The pseudo-lane behind 'Just show me something'. Never scored, never shown. */
export const DEFAULT_LANE = 'default'

const n = (scale: ScaleKey, delta: -1 | 0 | 1) => ({ scale, delta })

export const SCENES: SceneDef[] = [
  {
    key: 'extra',
    order: 1,
    layout: 'grid4',
    caption: 'A little unexpected **extra** lands in your pocket.',
    subline: 'Go with your first thought.',
    adaptedFrom: 'Doc A "wealth before poverty"; Greed −2 "slight anxiety around giving, afraid of losing"',
    options: [
      { key: 'treat', label: "Treat myself. I've earned it.", replyPill: 'Fair. Some weeks, you have.', nudges: [n('greed', -1)] },
      { key: 'tuck', label: 'Tuck it away, just in case.', replyPill: 'The careful squirrel. Respect.', nudges: [n('greed', -1)] },
      { key: 'pass-on', label: 'Pass some on. Someone needs it.', replyPill: 'Straight back out the door.', nudges: [n('greed', 1), n('compassion', 1)] },
      { key: 'pause', label: 'Pause. Alhamdulillah. Then decide.', replyPill: 'A breath first. Then the plan.', nudges: [n('gratitude', 1)] },
    ],
  },
  {
    key: 'queue',
    order: 2,
    layout: 'grid4',
    caption: 'Someone pushes in front of you in the **queue**.',
    subline: 'Your face, honestly?',
    adaptedFrom: 'Anger −2 "replays events mentally"; Compassion +4 "sees people\'s wounds beyond their behaviour"',
    options: [
      { key: 'look', label: "The Look. They'll feel it.", replyPill: 'The Look has been deployed.', nudges: [n('anger', -1), n('ego', -1)] },
      { key: 'polite', label: 'A polite word. Mostly polite.', replyPill: 'Polite-ish. A classic.', nudges: [n('anger', 0), n('ego', 0)] },
      { key: 'let-go', label: 'Let it go. Rough day, maybe.', replyPill: 'Let it slide.', nudges: [n('anger', 1), n('compassion', 1)] },
      { key: 'replay', label: 'Fine… then replay it at dinner.', replyPill: 'Ah, the dinner-table replay.', nudges: [n('anger', -1)] },
    ],
  },
  {
    key: 'thumb',
    order: 3,
    layout: 'grid4',
    caption: "It's late. Your **thumb** is still scrolling.",
    subline: "What's keeping it there?",
    adaptedFrom: 'Gratitude −7 "compares life to others". No desire nudge at first open (spec 2.8).',
    options: [
      { key: 'one-more', label: 'One more video. Then another.', replyPill: 'The algorithm sends its regards.', nudges: [n('discipline', -1)] },
      { key: 'lives', label: 'Lives and looks better than mine.', replyPill: 'That feed can be a lot.', nudges: [n('gratitude', -1)], sensitivity: 'private' },
      { key: 'off', label: "Nothing. I'm off at a decent hour.", replyPill: 'Lights out. Fair play.', nudges: [n('discipline', 1)] },
      { key: 'talk', label: "A talk, or some Qur'an.", replyPill: 'Good company for the small hours.', nudges: [n('faith', 1)] },
    ],
  },
  {
    key: 'visitor',
    order: 4,
    layout: 'grid4',
    caption: 'A worry turns up at **2am**, uninvited.',
    subline: 'What do you reach for first?',
    adaptedFrom: 'Fear +1 "seeks refuge in prayer in moments of fear". Everyday worry only.',
    options: [
      { key: 'phone', label: 'My phone, to drown it out.', replyPill: 'Distraction, the old faithful.', nudges: [n('worry', -1)], sensitivity: 'private' },
      { key: 'person', label: "A person. I'll message someone.", replyPill: "Someone's phone is about to buzz.", nudges: [n('belonging', 1)], sensitivity: 'private' },
      { key: 'wudu', label: 'Wudu and the prayer mat.', replyPill: 'Cool water, quiet room.', nudges: [n('faith', 1), n('worry', 1)], sensitivity: 'private' },
      { key: 'spin', label: 'Nothing. I lie there and let it spin.', replyPill: 'The 2am spin. We know it.', nudges: [n('worry', -1), n('belonging', -1)], sensitivity: 'private' },
      { key: 'heavy', label: "It's more than a worry right now.", nudges: [], crisis: true },
    ],
  },
  {
    key: 'news',
    order: 5,
    layout: 'bubbles',
    caption: '**Big** news. The good kind.',
    subline: 'Who hears it first?',
    adaptedFrom: 'Ego −2 "seeks validation"; Belonging +2 "feels seen by close friends"',
    options: [
      { key: 'family', label: 'The family group chat', replyPill: 'Phones buzzing in three time zones.', nudges: [n('belonging', 1)] },
      { key: 'one', label: 'My one person', replyPill: 'Some news is best whispered.', nudges: [n('belonging', 1)] },
      { key: 'online', label: "Everyone. It's going online.", replyPill: 'Going public. Bold.', nudges: [n('ego', -1)] },
      { key: 'allah', label: "Allah first, then I'll see.", replyPill: 'Straight to the top.', nudges: [n('faith', 1)] },
      { key: 'nobody', label: 'Nobody springs to mind.', replyPill: "That's alright. Some seasons are quieter.", nudges: [n('belonging', -1)], sensitivity: 'private' },
    ],
  },
  {
    key: 'doors',
    order: 6,
    layout: 'doorsCarousel',
    caption: "Six **doors**. Which one's calling you?",
    subline: 'No wrong door.',
    adaptedFrom: 'Doc B "where they want to be"',
    options: [
      { key: 'calmer', label: 'A calmer heart', nudges: [n('worry', -1)], intentLane: 'trust' },
      { key: 'habits', label: 'Habits that actually stick', nudges: [n('discipline', -1)], intentLane: 'habits' },
      { key: 'big-q', label: 'Making sense of the big questions', nudges: [n('faith', 0)], intentLane: 'talking' },
      { key: 'good', label: 'Doing some good out there', nudges: [n('compassion', 1)], intentLane: 'mercy' },
      { key: 'beginning', label: 'Starting from the very beginning', nudges: [n('faith', 0)], spineFirst: true },
      { key: 'close', label: 'Feeling close to Allah again', nudges: [n('faith', -1)], intentLane: 'talking' },
    ],
  },
]

export const OPENER = {
  caption: 'Every heart has a bit of shine and a bit of **dust**.',
  subline: "Play a few quick moments with us, then we'll find you something to watch.",
  handOff: "Here's where we'll start you. Pull up a chair.",
  justShow: "No bother. Here's a good one to start with.",
}

export const DEFAULT_HELP_CONTACTS = [
  { label: 'Samaritans (UK and Ireland), free, any time', phone: '116 123', url: 'https://www.samaritans.org', hours: '24 hours, every day' },
  { label: '988 Suicide and Crisis Lifeline (US), call or text', phone: '988', url: 'https://988lifeline.org', hours: '24 hours, every day' },
  { label: 'If you are in danger right now, call 999 in the UK or 911 in the US', phone: '999' },
]

// ux-first-run.md section 7. Matched as whole words or phrases after folding (see killHits in text-safety.ts).
export const KILL_LIST = [
  'survey', 'quiz', 'test', 'assessment', 'questionnaire', 'diagnostic', 'profile', 'result', 'results', 'score', 'points', 'level', 'rank', 'type', 'persona', 'archetype', 'category',
  'desire', 'sexuality', 'lust', 'greed', 'wealth attachment', 'anger', 'resentment', 'ego', 'pride', 'fear', 'anxiety', 'loneliness', 'belonging', 'gratitude', 'contentment', 'faith score', 'compassion', 'empathy', 'discipline', 'self-control',
  'devout', 'traditionalist', 'cultural', 'secular', 'seeker', 'activist', 'progressive', 'academic', 'family-centered', 'family-centred', 'new muslim', 'convert',
  'heart behind the habit', 'why we do what we do', 'roots for the search', 'calm for the long haul', 'freedom in the lines', 'mercy first', 'head to heart', 'a corner for you', 'not on your own', 'healing focus',
  'weakness', 'struggle', 'fix', 'improve', 'cure', 'disease', 'sick heart', 'sin', 'haram', 'should', 'must', 'need to',
  'you are a', 'your heart is', 'based on your answers', "we've analysed", 'your results', 'matched you with',
  'correct', 'incorrect', 'right answer', 'wrong answer', 'agree', 'disagree', 'strongly', 'rarely', 'sometimes', 'often',
  'sign up to continue', 'account required', 'unlock', 'finish setup', "you'll miss out", 'are you sure', "nobody's watching",
  'color', 'favorite', 'recognize', 'behavior', 'center', 'judgment',
]

export function killListHits(text: string) {
  return killHits(text, KILL_LIST)
}

/**
 * The one check for words an author writes and a learner reads: plain text only (no HTML, entities or script) and no
 * kill-list words, after the same folding as killHits. Returns plain-English problems, empty when the words are fine.
 */
export function authorTextProblems(fields: [label: string, text: string | null | undefined][]) {
  const problems: string[] = []
  for (const [label, value] of fields) {
    const text = value || ''
    if (!text.trim()) continue
    if (hasMarkup(text)) problems.push(`${label} is plain text: no HTML, script or code.`)
    const hits = killListHits(text)
    if (hits.length) problems.push(`${label} uses words learners never see from us: ${hits.join(', ')}.`)
  }
  return problems
}

/** Markup alone, for words that are the speaker's own (quotes from a transcript), which the kill list does not govern. */
export function markupProblems(fields: [label: string, text: string | null | undefined][]) {
  return fields.filter(([, value]) => hasMarkup(value || '')).map(([label]) => `${label} is plain text: no HTML, script or code.`)
}
