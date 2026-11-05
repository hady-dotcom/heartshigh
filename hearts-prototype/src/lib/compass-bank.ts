// The monthly item bank. Two wordings for every scale, sat in two sets of five, rotated.
// Learner strings have to pass the kill list. Staff "why" lines live with the life events and may name a scale.

import type { ScaleKey } from './heart'
import { TAP_STEP } from './heart'

export type BankOption = { key: string; label: string; delta: -1 | 0 | 1 }

export type BankItem = {
  key: string
  scale: ScaleKey
  form: 'a' | 'b'
  caption: string
  subline: string
  options: BankOption[]
}

export type MonthForm = { id: string; items: BankItem[] }

export type LifeEvent = {
  key: string
  label: string
  scales: ScaleKey[]
  doors: number[]
  why: string
}

const option = (key: string, label: string, delta: -1 | 0 | 1): BankOption => ({ key, label, delta })

function item(scale: ScaleKey, form: 'a' | 'b', caption: string, subline: string, options: BankOption[]): BankItem {
  return { key: `${scale}-${form}`, scale, form, caption, subline, options }
}

export const BANK: BankItem[] = [
  item('gratitude', 'a', 'A small kindness lands in your day.', 'What does the first thought do with it?', [
    option('slip', 'I barely notice.', -1),
    option('clock', 'I clock it, then move on.', 0),
    option('thanks', 'I stop and say thank you.', 1),
  ]),
  item('gratitude', 'b', 'The evening was ordinary, and still something in it was good.', 'Where does that good go?', [
    option('past', 'It slips past.', -1),
    option('once', 'I mention it once.', 0),
    option('name', 'I name it, quietly, before I sleep.', 1),
  ]),
  item('anger', 'a', 'Someone speaks over you in a group.', 'What stays in the room afterwards?', [
    option('sharp', 'A sharp reply, then I replay it.', -1),
    option('pause', 'A pause, and a short answer.', 0),
    option('cool', 'I let the heat pass before I speak.', 1),
  ]),
  item('anger', 'b', 'A queue, and someone steps in front.', 'What does your face do?', [
    option('look', 'A long look they will feel.', -1),
    option('words', 'A few careful words.', 0),
    option('pass', 'I let it pass. Their day may be heavy.', 1),
  ]),
  item('worry', 'a', 'A plan for next week will not sit still.', 'What do you do with the spinning?', [
    option('turn', 'I keep turning it over.', -1),
    option('step', 'I write one next step.', 0),
    option('ease', 'I put it down and ask for ease.', 1),
  ]),
  item('worry', 'b', 'News from far away sits on your chest.', 'Where do you take it?', [
    option('worst', 'I stay with the worst picture.', -1),
    option('talk', 'I talk it through with one person.', 0),
    option('leave', 'I pray, then I leave the outcome.', 1),
  ]),
  item('faith', 'a', 'The day has been long, and the prayer mat is there.', 'What happens?', [
    option('past', 'I walk past it.', -1),
    option('short', 'A short prayer, then I carry on.', 0),
    option('sit', 'I sit, and I speak as if someone is listening.', 1),
  ]),
  item('faith', 'b', 'You want a word with Allah before sleep.', 'How does it go?', [
    option('none', 'The words do not come.', -1),
    option('lines', 'A few lines I know.', 0),
    option('stay', 'I stay until it feels like a conversation.', 1),
  ]),
  item('belonging', 'a', 'Friday, and the circle is gathering.', 'Where do you stand?', [
    option('edge', 'I stay on the edge, then leave.', -1),
    option('one', 'I sit, and I speak to one person.', 0),
    option('glad', 'I am glad to be among them.', 1),
  ]),
  item('belonging', 'b', 'A message arrives from someone who knows you.', 'What do you do with it?', [
    option('unread', 'I leave it unread.', -1),
    option('later', 'A short reply, later.', 0),
    option('held', 'I answer, and I feel held.', 1),
  ]),
  item('greed', 'a', 'A little extra arrives this month.', 'What is the first thought?', [
    option('keep', 'Keep all of it close.', -1),
    option('aside', 'Set some aside, then see.', 0),
    option('out', 'A portion goes out before I spend.', 1),
  ]),
  item('greed', 'b', 'A friend is short, and you have enough.', 'What do you do?', [
    option('away', 'I look away.', -1),
    option('little', 'I offer a little, carefully.', 0),
    option('give', 'I give before I count the cost.', 1),
  ]),
  item('desire', 'a', 'A bright picture holds your eye longer than you meant.', 'What happens next?', [
    option('stay', 'I stay with it.', -1),
    option('notice', 'I notice, then look away.', 0),
    option('down', 'I put the screen down.', 1),
  ]),
  item('desire', 'b', 'Late, and the next clip is already playing.', 'What do you do?', [
    option('more', 'One more, then another.', -1),
    option('finish', 'I finish this one and stop.', 0),
    option('off', 'I switch it off and leave the room.', 1),
  ]),
  item('ego', 'a', 'You knew the answer, and someone else is praised.', 'What rises?', [
    option('mine', 'I want them to know it was mine.', -1),
    option('sting', 'A small sting, then I let it go.', 0),
    option('glad', 'I am glad for them.', 1),
  ]),
  item('ego', 'b', 'Praise arrives for work you did.', 'Where does it sit?', [
    option('again', 'I tell the story again.', -1),
    option('thanks', 'I say thank you, and I mean it.', 0),
    option('pass', 'I pass the credit on.', 1),
  ]),
  item('compassion', 'a', 'Someone near you is having a hard week.', 'What do you offer?', [
    option('far', 'I keep my distance.', -1),
    option('word', 'A kind word in passing.', 0),
    option('time', 'I make time, and I listen.', 1),
  ]),
  item('compassion', 'b', 'A stranger is stuck, and you are in a hurry.', 'What wins?', [
    option('on', 'I walk on.', -1),
    option('hand', 'A quick hand, then I go.', 0),
    option('stop', 'I stop until they are steady.', 1),
  ]),
  item('discipline', 'a', 'The prayer time arrives in the middle of a task.', 'What do you do?', [
    option('next', 'I tell myself I will catch the next one.', -1),
    option('late', 'I pause, a little late.', 0),
    option('on', 'I stop, and I pray it on time.', 1),
  ]),
  item('discipline', 'b', 'A small promise you made to yourself this morning.', 'By evening, where is it?', [
    option('forgot', 'I forgot it.', -1),
    option('part', 'I did part of it.', 0),
    option('kept', 'I kept it.', 1),
  ]),
]

const SET_ONE: ScaleKey[] = ['gratitude', 'anger', 'worry', 'faith', 'belonging']
const SET_TWO: ScaleKey[] = ['greed', 'desire', 'ego', 'compassion', 'discipline']

export const MONTH_FORMS: MonthForm[] = [
  { id: 'set1a', items: SET_ONE.map((scale) => BANK.find((row) => row.scale === scale && row.form === 'a')!) },
  { id: 'set2a', items: SET_TWO.map((scale) => BANK.find((row) => row.scale === scale && row.form === 'a')!) },
  { id: 'set1b', items: SET_ONE.map((scale) => BANK.find((row) => row.scale === scale && row.form === 'b')!) },
  { id: 'set2b', items: SET_TWO.map((scale) => BANK.find((row) => row.scale === scale && row.form === 'b')!) },
]

export function formForRound(round: number) {
  const index = ((round % MONTH_FORMS.length) + MONTH_FORMS.length) % MONTH_FORMS.length
  return MONTH_FORMS[index]
}

export function formById(id: string) {
  return MONTH_FORMS.find((form) => form.id === id) || null
}

export const LIFE_NOTE_MAX = 280

export const LIFE_EVENTS: LifeEvent[] = [
  { key: 'work', label: 'Work is heavy just now', scales: ['worry'], doors: [15, 10], why: 'Work is heavy, so talks on trust and qadr come forward.' },
  { key: 'baby', label: 'A new baby at home', scales: ['belonging', 'discipline'], doors: [2, 5], why: 'A new baby at home, so talks on company and prayer come forward.' },
  { key: 'exams', label: 'Exams are taking the days', scales: ['worry', 'discipline'], doors: [15, 5], why: 'Exams are close, so talks on trust and prayer come forward.' },
  { key: 'grief', label: 'Someone I love has gone', scales: ['anger', 'worry'], doors: [7, 15], why: 'Grief this month, so talks on patience and qadr come forward.' },
  { key: 'ramadan', label: 'Ramadan is in the air', scales: ['discipline', 'faith'], doors: [7, 5, 10], why: 'Ramadan is in the air, so talks on fasting, prayer and closeness come forward.' },
  { key: 'travel', label: 'I am away from home', scales: ['belonging', 'discipline'], doors: [2, 5], why: 'Away from home, so talks on company and prayer come forward.' },
  { key: 'health', label: 'My health needs care', scales: ['worry', 'discipline'], doors: [15, 5], why: 'Health needs care, so talks on trust and steady prayer come forward.' },
]

export function lifeByKeys(keys: string[]) {
  const wanted = new Set(keys)
  return LIFE_EVENTS.filter((event) => wanted.has(event.key))
}

function clamp(value: number) {
  return Math.min(1, Math.max(-1, value))
}

function round3(value: number) {
  return Math.round(value * 10) / 10
}

/**
 * Applies one monthly sitting onto the previous reading. Unasked scales carry forward.
 * The result is a full snapshot of all ten scales. The previous object is not changed.
 */
export function applyMonth(
  previous: Partial<Record<ScaleKey, number>> | null | undefined,
  picks: { scale: ScaleKey; delta: -1 | 0 | 1 }[],
) {
  const next: Record<ScaleKey, number> = {
    desire: 0, greed: 0, anger: 0, ego: 0, worry: 0, belonging: 0, gratitude: 0, faith: 0, compassion: 0, discipline: 0,
  }
  if (previous) {
    for (const scale of Object.keys(next) as ScaleKey[]) {
      const value = previous[scale]
      if (typeof value === 'number' && Number.isFinite(value)) next[scale] = value
    }
  }
  for (const pick of picks) {
    next[pick.scale] = round3(clamp((next[pick.scale] || 0) + TAP_STEP * pick.delta))
  }
  return next
}
