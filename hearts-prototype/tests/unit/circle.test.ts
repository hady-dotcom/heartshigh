import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  CIRCLE_LENGTHS,
  CIRCLE_MAX_SHOWN,
  CIRCLE_TONES,
  circleProblems,
  circleShown,
  circleSpread,
  mixSwarm,
  mockCircleAnswers,
  parseCircleReply,
} from '../../src/lib/circle'
import { killListHits } from '../../src/lib/opening-data'
import { CIRCLE_COLUMNS, circleSheetValues, readCircleRow } from '../../src/lib/circle-sheet'

const POINTS = [
  { prompt: 'What is one small thing you could carry from this talk into tomorrow?', kind: 'reflection' },
  { prompt: 'What would you ask the Shaykh?', kind: 'question' },
  { prompt: 'What is the first sign that light is entering the heart?', kind: 'multiple_choice', options: ['You start to incline towards the Akhira', 'You feel no more sadness', 'You stop making mistakes'] },
  { prompt: 'Greet three people first this week.', kind: 'task' },
]

test('Circle: the built-in drafts meet the count, follow the tone and length spread, and pass every word check', () => {
  for (const point of POINTS) {
    for (let seed = 0; seed < 30; seed++) {
      const drafts = mockCircleAnswers(point, 7, CIRCLE_TONES, CIRCLE_LENGTHS, seed)
      assert.equal(drafts.length, 7)
      const spread = circleSpread(7, CIRCLE_TONES, CIRCLE_LENGTHS)
      assert.deepEqual(drafts.map((row) => [row.tone, row.length]), spread.map((row) => [row.tone, row.length]))
      for (const draft of drafts) {
        assert.deepEqual(circleProblems(draft.name, draft.body), [], `${point.kind} seed ${seed}: ${draft.body}`)
        assert.deepEqual(killListHits(draft.body), [])
      }
      if (point.kind === 'multiple_choice') assert.ok(drafts.every((row) => point.options!.some((option) => row.body.includes(option))))
    }
  }
  const short = mockCircleAnswers(POINTS[0], 3, ['quiet'], ['short'], 1)
  const long = mockCircleAnswers(POINTS[0], 3, ['quiet'], ['long'], 1)
  assert.ok(short.every((row) => row.tone === 'quiet' && row.length === 'short'))
  assert.ok(long.every((row, index) => row.body.length > short[index].body.length), 'long answers are longer')
  assert.deepEqual(mockCircleAnswers(POINTS[1], 5, CIRCLE_TONES, CIRCLE_LENGTHS, 9), mockCircleAnswers(POINTS[1], 5, CIRCLE_TONES, CIRCLE_LENGTHS, 9), 'deterministic per seed')
  assert.equal(new Set(mockCircleAnswers(POINTS[0], 6, CIRCLE_TONES, CIRCLE_LENGTHS, 2).map((row) => row.name)).size, 6, 'different people')
})

test('Circle: an AI reply only keeps answers that pass the kill list and plain-text checks', () => {
  const spread = circleSpread(4, ['warm', 'honest'], ['short'])
  const reply = `Here you go: ${JSON.stringify({
    answers: [
      { name: 'Amina', tone: 'warm', length: 'short', text: 'This landed gently for me.' },
      { name: 'Yusuf', tone: 'honest', length: 'short', text: 'I should pray more, honestly.' },
      { name: 'Hana', tone: 'warm', length: 'short', text: 'It was <b>lovely</b>.' },
      { name: 'Omar', tone: 'loud', length: 'huge', text: 'I wrote it down by the kettle.' },
    ],
  })}`
  const kept = parseCircleReply(reply, spread)
  assert.deepEqual(kept.map((row) => row.name), ['Amina', 'Omar'])
  assert.equal(kept[1].tone, 'honest', 'an unknown tone falls back to the spread')
  assert.equal(kept[1].length, 'short')
  assert.deepEqual(parseCircleReply('not json', spread), [])
  assert.ok(circleProblems('Sam', 'I need to fix my prayer').length > 0)
  assert.ok(circleProblems('Sam', '').length > 0)
  assert.ok(circleProblems('Sam', 'x'.repeat(601)).length > 0)
})

test('Circle: answers fade as real answers arrive and step back at the threshold', () => {
  assert.equal(circleShown(5, 0, 8), 5)
  assert.equal(circleShown(10, 0, 8), CIRCLE_MAX_SHOWN, 'never more than the cap')
  const counts = Array.from({ length: 10 }, (_, real) => circleShown(6, real, 8))
  for (let index = 1; index < counts.length; index++) assert.ok(counts[index] <= counts[index - 1], `does not grow: ${counts}`)
  assert.ok(counts[4] < counts[0] && counts[4] > 0, 'fades before the threshold')
  assert.equal(circleShown(6, 7, 8), 1)
  assert.equal(circleShown(6, 8, 8), 0)
  assert.equal(circleShown(6, 20, 8), 0)
  assert.equal(circleShown(6, 1, 1), 0)
  assert.equal(circleShown(0, 0, 8), 0)

  const circle = ['c1', 'c2', 'c3', 'c4', 'c5']
  const real = (count: number) => Array.from({ length: count }, (_, index) => `r${index}`)
  assert.deepEqual(mixSwarm([], circle, 'u1:p1', 8).sort(), [...circle].sort())
  for (let count = 0; count <= 9; count++) {
    const mixed = mixSwarm(real(count), circle, 'u1:p1', 8)
    assert.equal(mixed.filter((item) => item.startsWith('r')).length, count, 'every real answer stays')
    assert.deepEqual(mixed.filter((item) => item.startsWith('r')), real(count), 'real answers keep their order')
    assert.equal(mixed.filter((item) => item.startsWith('c')).length, circleShown(5, count, 8))
  }
  assert.deepEqual(mixSwarm(real(8), circle, 'u1:p1', 8), real(8))
  assert.deepEqual(mixSwarm(real(3), circle, 'u1:p1', 8), mixSwarm(real(3), circle, 'u1:p1', 8), 'stable for one learner')
  const seen = new Set(Array.from({ length: 12 }, (_, user) => mixSwarm(real(5), circle, `u${user}:p1`, 8).join(',')))
  assert.ok(seen.size > 1, 'different learners see different mixes')
})

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) ? [full] : []
  })
}

test('Circle: only the swarm, the circle desk and the seed read circle answers, so analytics never see them', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')
  const readers = files(root)
    .filter((file) => !file.endsWith('payload-types.ts'))
    .filter((file) => /['"]circle-answers['"]/.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(root, file))
    .sort()
  assert.deepEqual(readers, ['collections.ts', 'screens/desk/circle.tsx', 'seed/seed.ts', 'server/circle.ts'])
  for (const file of files(root)) {
    const text = readFileSync(file, 'utf8')
    if (/circleForPoints/.test(text)) assert.ok(['server/circle.ts', 'screens/app/course.tsx'].includes(path.relative(root, file)), `${file} reads circle answers`)
  }
})

test('Circle: the CircleAnswers sheet tab reads rows through the same checks and exports round-trip', () => {
  const good = readCircleRow({ talk_key: 'al-nur', question_id: '12', name: 'Amina', body: 'This landed gently for me.', tone: 'Warm', length: 'short', origin: 'ai', enabled: 'no' })
  assert.ok(good.ok)
  if (good.ok) assert.deepEqual(good.value, { circleId: null, questionId: 12, name: 'Amina', body: 'This landed gently for me.', tone: 'warm', length: 'short', origin: 'ai', enabled: false, remove: false })
  const columns = (row: Record<string, string>) => {
    const read = readCircleRow(row)
    return read.ok ? [] : read.issues.map((issue) => issue.column)
  }
  assert.deepEqual(columns({ question_id: '3', body: 'You should pray more.' }), ['body'])
  assert.deepEqual(columns({ question_id: '3', name: '<b>Sam</b>', body: 'Fine.' }), ['name'])
  assert.deepEqual(columns({ question_id: 'x', body: 'Fine.', tone: 'loud', length: 'huge', origin: 'robot', enabled: 'maybe' }), ['question_id', 'tone', 'length', 'origin', 'enabled'])
  assert.deepEqual(columns({ question_id: '3', status: 'delete' }), ['circle_id'])
  assert.deepEqual(columns({ question_id: '3', circle_id: '9', status: 'delete' }), [])
  const exported = circleSheetValues({ id: 9, point: 3, name: 'Omar', body: 'Small, but it is a start.', tone: 'practical', length: 'long', origin: 'ai', enabled: true }, { talkKey: 'al-nur', youtubeId: 'NIR88RRpat4' })
  assert.deepEqual(Object.keys(exported), [...CIRCLE_COLUMNS])
  const back = readCircleRow(Object.fromEntries(Object.entries(exported).map(([key, value]) => [key, value == null ? '' : String(value)])))
  assert.ok(back.ok)
  if (back.ok) assert.deepEqual([back.value.circleId, back.value.questionId, back.value.body, back.value.enabled], [9, 3, 'Small, but it is a start.', true])
})
