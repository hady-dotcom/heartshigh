import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { codeRefusal, randomCode } from '../../src/lib/access-codes'
import { killListHits } from '../../src/lib/opening-data'
import { MAX_RANGE_DAYS, defaultPlanName, plural, seasonName, studyDates } from '../../src/lib/schedule'
import { httpsHref, plainText, telHref } from '../../src/lib/text-safety'
import { APPETISER_MAX, HORS_MAX, HORS_MIN, alignToCaptions, appetiserStop, draftTiers, linesFromWords, tierProblem, timingProblems, wordTimeline } from '../../src/lib/tiers'
import { isVerbatim, parseTranscript } from '../../src/lib/transcript'
import { FILMS } from '../../src/seed/films'
import { STARTERS } from '../../src/seed/starters-data'

const root = process.cwd()
const startersDir = path.join(root, 'content', 'transcripts', 'starters')
const index = JSON.parse(readFileSync(path.join(startersDir, 'index.json'), 'utf8')) as Record<string, { seconds: number; lines: number; words: number }>

test('Bug 2: codes refuse when switched off, expired or used up, with one message for unknown and switched off', () => {
  const at = new Date('2026-10-03T12:00:00Z')
  assert.equal(codeRefusal({ uses: 3 }, at), null)
  assert.equal(codeRefusal(null, at), 'That access code was not recognised.')
  assert.equal(codeRefusal({ disabled: true }, at), 'That access code was not recognised.')
  assert.match(codeRefusal({ expiresAt: '2026-10-03T11:59:59Z' }, at) || '', /expired/)
  assert.equal(codeRefusal({ expiresAt: '2026-10-04T00:00:00Z' }, at), null)
  assert.match(codeRefusal({ maxUses: 1, uses: 1 }, at) || '', /already been used/)
  assert.equal(codeRefusal({ maxUses: 2, uses: 1 }, at), null)
})

test('Bug 2: seed and generated codes are long and random, not words', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 500; i++) {
    const code = randomCode('elm')
    assert.match(code, /^ELM-[ABCDEFGHJKMNPQRTUVWXY346789]{4}-[ABCDEFGHJKMNPQRTUVWXY346789]{4}$/)
    seen.add(code)
  }
  assert.equal(seen.size, 500)
  const seeded = path.join(root, 'data', 'seed-codes.json')
  const codes = Object.values(JSON.parse(readFileSync(seeded, 'utf8')) as Record<string, string>)
  assert.ok(codes.length >= 6)
  for (const code of codes) assert.match(code, /^[A-Z]+-[A-Z0-9]{4}-[A-Z0-9]{4}$/, code)
  assert.ok(!codes.some((code) => /LEARN|ADMIN|TEACH|PARENT/.test(code)))
})

test('Bug 13: help contacts render only tel: and https: targets, and plain text', () => {
  assert.equal(httpsHref('javascript:alert(1)'), null)
  assert.equal(httpsHref('http://example.org'), null)
  assert.equal(httpsHref('data:text/html,hi'), null)
  assert.equal(httpsHref('https://www.samaritans.org'), 'https://www.samaritans.org/')
  assert.equal(httpsHref('https://x.org/<b>'), null)
  assert.equal(telHref('<b>999</b>'), 'tel:999')
  assert.equal(plainText('<img src=x onerror=alert(1)>Help'), 'Help')
  assert.equal(plainText('<b>999</b>'), '999')
})

test('Bug 21: plans are capped at a year, named for the season, and counted in the right number', () => {
  assert.throws(() => studyDates('2026-01-01', '2036-01-01', [1]), /a year or less/)
  assert.equal(studyDates('2026-01-01', '2026-12-31', [1]).length, 52)
  assert.equal(MAX_RANGE_DAYS, 366)
  assert.equal(seasonName(new Date('2026-12-05T00:00:00Z')), 'Winter')
  assert.equal(seasonName(new Date('2026-04-05T00:00:00Z')), 'Spring')
  assert.equal(seasonName(new Date('2026-07-05T00:00:00Z')), 'Summer')
  assert.equal(seasonName(new Date('2026-10-03T00:00:00Z')), 'Autumn')
  assert.equal(defaultPlanName(new Date('2026-10-03T00:00:00Z')), 'Autumn study days')
  assert.equal(plural(1, 'sitting'), '1 sitting')
  assert.equal(plural(3, 'sitting'), '3 sittings')
})

test('Bug 15: Al-Nur points to the full class and every seeded pop-up sits inside its talk', () => {
  const nur = FILMS.find((film) => /Al-Nur/.test(film.title))
  assert.ok(nur)
  assert.equal(nur.youtubeId, 'NIR88RRpat4')
  assert.equal(nur.durationSeconds, 2861)
  for (const film of FILMS) {
    if (!film.durationSeconds) continue
    assert.deepEqual(timingProblems(film.durationSeconds, film.points.map((point) => ({ label: `${film.title} at ${point.second}`, start: point.second }))), [], film.title)
  }
  assert.match(timingProblems(100, [{ label: 'A pop-up', start: 140 }])[0], /outside the 1:40 talk/)
  assert.match(timingProblems(null, [{ label: 'A pop-up', start: 1 }])[0], /No duration/)
})

test('Bug 29: npm run reseed wipes and reseeds, and the README says so', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
  assert.equal(pkg.scripts.reseed, 'tsx src/seed/seed.ts --reset')
  assert.match(readFileSync(path.join(root, 'README.md'), 'utf8'), /npm run reseed/)
})

test('Bug 30: 31 starters, each length taken from its shipped captions', () => {
  assert.equal(STARTERS.length, 31)
  assert.equal(Object.keys(index).length, 30)
  for (const row of STARTERS) {
    assert.ok(row.lengthSec && row.lengthSec > 0, row.title)
    if (row.youtubeId === 'NIR88RRpat4') assert.equal(row.lengthSec, 2861)
    else assert.equal(row.lengthSec, index[row.youtubeId]?.seconds, `${row.youtubeId} ${row.title}`)
  }
  for (const id of Object.keys(index)) assert.ok(STARTERS.some((row) => row.youtubeId === id), `${id} has captions but no starter row`)
})

test('Section T: rolling auto captions become each word once, in order, without tags or markers', () => {
  const rolling = [
    'WEBVTT',
    '',
    '00:00:01.000 --> 00:00:03.000 align:start position:0%',
    ' ',
    'peace<00:00:01.500><c> be</c><00:00:02.000><c> upon</c><00:00:02.400><c> you</c>',
    '',
    '00:00:03.000 --> 00:00:03.010 align:start position:0%',
    'peace be upon you',
    ' ',
    '',
    '00:00:03.010 --> 00:00:05.000 align:start position:0%',
    'peace be upon you',
    '[Music]<00:00:03.500><c> so&nbsp;the</c><00:00:04.000><c> heart</c>',
  ].join('\n')
  const words = wordTimeline(rolling)
  assert.deepEqual(words.map((word) => word.text), ['peace', 'be', 'upon', 'you', 'so', 'the', 'heart'])
  assert.ok(words.every((word, at) => at === 0 || word.at >= words[at - 1].at))
  assert.equal(words[4].at, 3.5)
})

test('Section T: tier rules hold the hors to 15-20 seconds and the appetiser to about 3 minutes', () => {
  assert.equal(tierProblem({ horsStart: 10, horsEnd: 28, appetiserStart: 0, appetiserEnd: 170 }), null)
  assert.match(tierProblem({ horsStart: 10, horsEnd: 40, appetiserStart: 0, appetiserEnd: 170 }) || '', /between 15 and 20/)
  assert.match(tierProblem({ horsStart: 10, horsEnd: 26, appetiserStart: 100, appetiserEnd: 90 }) || '', /end after it starts/)
  assert.match(tierProblem({ horsStart: 10, horsEnd: 26, appetiserStart: 0, appetiserEnd: 400 }) || '', /about 3 minutes/)
})

test('Section T: the appetiser player stops at its out point and never runs on past about 3 minutes', () => {
  assert.equal(appetiserStop({ start: 40, end: 160 }), 160)
  assert.equal(appetiserStop({ start: 40, end: 900 }), 40 + APPETISER_MAX + 15)
  assert.equal(appetiserStop({ start: 40, end: 0 }), 40 + APPETISER_MAX)
})

const normal = (text: string) => text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()

test('Section T: every shipped transcript drafts verbatim tiers and pop-ups inside its talk', () => {
  const files = readdirSync(startersDir).filter((file) => file.endsWith('.vtt'))
  assert.equal(files.length, 30)
  for (const file of files) {
    const id = file.replace(/\.vtt$/, '')
    const raw = readFileSync(path.join(startersDir, file), 'utf8')
    const { cues } = parseTranscript(raw)
    const all = normal(cues.map((cue) => cue.text).join(' '))
    const draft = draftTiers(cues, index[id].seconds)
    assert.ok(draft, id)
    const hors = draft.hors.end - draft.hors.start
    assert.ok(hors >= HORS_MIN && hors <= HORS_MAX, `${id} hors ${hors}`)
    assert.ok(draft.appetiser.end > draft.appetiser.start && draft.appetiser.end - draft.appetiser.start <= APPETISER_MAX, `${id} appetiser`)
    assert.ok(draft.hors.end <= index[id].seconds && draft.appetiser.end <= index[id].seconds, `${id} inside the talk`)
    for (const line of [draft.hook, draft.turn, draft.land, draft.hors.quote]) assert.ok(all.includes(normal(line)), `${id}: "${line}" is word for word`)
    assert.ok(draft.popups.length >= 2 && draft.popups.length <= 3, `${id} has ${draft.popups.length} pop-ups`)
    for (const popup of draft.popups) {
      assert.ok(popup.second >= 0 && popup.second <= index[id].seconds, `${id} pop-up at ${popup.second}`)
      assert.ok(all.includes(normal(popup.quote)), `${id} pop-up quote is word for word`)
      assert.doesNotMatch(popup.quote, /subscribe|download|website|donat|e-?book/i, `${id} pop-up is not an advert`)
      assert.deepEqual(killListHits(popup.prompt.replace(popup.quote, '')), [], id)
    }
  }
})

test('Section T: estimated transcript marks are moved onto the caption times', () => {
  const captions = ['WEBVTT', '', '00:01:40.000 --> 00:01:44.000', 'the heart turns towards its lord', '', '00:03:10.000 --> 00:03:14.000', 'and light enters the heart slowly'].join('\n')
  const lines = linesFromWords(wordTimeline(captions))
  assert.ok(lines.length >= 1)
  const marked = '**[1:00]** The heart turns towards its Lord.\n\n**[2:00]** And light enters the heart slowly.'
  const aligned = alignToCaptions(marked, captions)
  assert.equal(aligned.matched, 2)
  assert.match(aligned.text, /\*\*\[1:40\]\*\*/)
  assert.match(aligned.text, /\*\*\[3:10\]\*\*/)
  assert.ok(isVerbatim('light enters the heart', 'and light enters the heart slowly'))
})
