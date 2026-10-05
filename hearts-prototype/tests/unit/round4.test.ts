import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { talkSources } from '../../scripts/tier-report'
import type { CutInfo } from '../../src/lib/heart'
import { laneClips } from '../../src/lib/lanes'
import { authorTextProblems, killListHits } from '../../src/lib/opening-data'
import { clientIp, joinFailKeys, trustedProxyHops } from '../../src/lib/rate-limit'
import { APPETISER_MAX, HORS_MAX, HORS_MIN, captionIndex, draftTiers, onSentenceBoundary, saidInTalk, sentencesOf } from '../../src/lib/tiers'
import { countsTowardsTrends, TRENDS_MIN_AGE_HOURS } from '../../src/lib/trends'
import { ytDlpArgs, ytDlpProblem } from '../../src/lib/youtube'
import { playerVars } from '../../src/lib/yt'
import type { FeedItem } from '../../src/server/learner'

// Round 4: one test per item from the retest, named by its label. Each one failed before its fix.

const root = process.cwd()
const talks = talkSources()
const drafts = talks.map((talk) => ({ talk, draft: draftTiers(talk.raw, talk.seconds), sentences: sentencesOf(talk.raw) }))
const OUTRO_OR_ADVERT = /e-?books?|subscribe|thank you for watching|download|website|as-?salamu? ?alaikum|i (also )?bear witness|asked a question/i

test('Extraction: every one of the 31 talks has a draft', () => {
  assert.equal(talks.length, 31)
  for (const { talk, draft } of drafts) assert.ok(draft, `${talk.id} has no draft`)
})

test('Extraction: the seed path drafts two or three pop-ups for every talk, at least 8 seconds apart and clear of the kill list', () => {
  for (const { talk, draft } of drafts) {
    const popups = draft!.popups
    assert.ok(popups.length >= 2 && popups.length <= 3, `${talk.id} has ${popups.length} pop-ups`)
    for (let i = 1; i < popups.length; i++) assert.ok(popups[i].second - popups[i - 1].second >= 8, `${talk.id} pop-ups ${popups[i - 1].second} and ${popups[i].second}`)
    for (const popup of popups) assert.deepEqual(killListHits(popup.prompt), [], `${talk.id}: ${popup.prompt}`)
  }
})

test('Extraction: every tier boundary falls on a sentence boundary, inside the silence around it', () => {
  for (const { talk, draft, sentences } of drafts) {
    const length = talk.seconds || Infinity
    assert.ok(onSentenceBoundary(sentences, draft!.hors.start, 'in', length), `${talk.id} hors in ${draft!.hors.start}`)
    assert.ok(onSentenceBoundary(sentences, draft!.hors.end, 'out', length), `${talk.id} hors out ${draft!.hors.end}`)
    assert.ok(onSentenceBoundary(sentences, draft!.appetiser.start, 'in', length), `${talk.id} appetiser in ${draft!.appetiser.start}`)
    assert.ok(onSentenceBoundary(sentences, draft!.appetiser.end, 'out', length), `${talk.id} appetiser out ${draft!.appetiser.end}`)
  }
})

test('Extraction: the hors runs 15 to 20 seconds and the appetiser up to about 3 minutes, inside the talk', () => {
  for (const { talk, draft } of drafts) {
    const hors = draft!.hors.end - draft!.hors.start
    const appetiser = draft!.appetiser.end - draft!.appetiser.start
    assert.ok(hors >= HORS_MIN - 0.01 && hors <= HORS_MAX + 0.01, `${talk.id} hors ${hors}`)
    assert.ok(appetiser > 0 && appetiser <= APPETISER_MAX + 0.01, `${talk.id} appetiser ${appetiser}`)
    if (talk.seconds) assert.ok(draft!.appetiser.end <= talk.seconds && draft!.hors.end <= talk.seconds, `${talk.id} inside the talk`)
  }
})

test('Extraction: hook, turn, land and the hors line are the speaker’s words, in order, and they come in that order', () => {
  for (const { talk, draft } of drafts) {
    for (const line of [draft!.hook, draft!.turn, draft!.land, draft!.hors.quote]) assert.ok(saidInTalk(line, talk.raw), `${talk.id}: "${line}" is word for word`)
    assert.ok(draft!.hookAt < draft!.turnAt && draft!.turnAt < draft!.landAt, `${talk.id} hook ${draft!.hookAt}, turn ${draft!.turnAt}, land ${draft!.landAt}`)
    assert.ok(draft!.hookAt >= draft!.appetiser.start - 0.5 && draft!.landAt < draft!.appetiser.end, `${talk.id} lines sit in the appetiser`)
  }
})

test('Extraction: the turn is a real turn, not the next few seconds of the hook (N_-YiwIb-u0 and every other talk)', () => {
  for (const { talk, draft } of drafts) {
    const short = (talk.seconds || 0) < 120
    const gap = draft!.turnAt - draft!.hookAt
    assert.ok(gap >= (short ? Math.min(15, (talk.seconds || 0) * 0.25) - 0.5 : 20), `${talk.id} turn only ${gap.toFixed(1)} s after the hook`)
    assert.notEqual(draft!.turn, draft!.hook, talk.id)
  }
})

test('Extraction: the hors is chosen by hook score, not the land line', () => {
  const normal = (text: string) => text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
  for (const { talk, draft } of drafts) assert.ok(!normal(draft!.hors.quote).includes(normal(draft!.land)), `${talk.id}: the hors is the land`)
})

test('Extraction: intro music, sponsor and outro lines are left out (FAxIZIqwfd8 stops before its free ebooks outro)', () => {
  for (const { talk, draft } of drafts) {
    for (const line of [draft!.hook, draft!.turn, draft!.land, draft!.hors.quote]) assert.doesNotMatch(line, OUTRO_OR_ADVERT, `${talk.id}: "${line}"`)
    assert.doesNotMatch(draft!.hook, /^\[?music\]?$/i, talk.id)
  }
  const fax = drafts.find((row) => row.talk.id === 'FAxIZIqwfd8')!.draft!
  assert.ok(fax.appetiser.end <= 48.7, `FAxIZIqwfd8 appetiser runs to ${fax.appetiser.end}, into the outro at 48.7`)
  assert.ok(fax.hors.end <= 48.7)
})

test('Extraction: the Al-Nur hook is word for word from the transcript', () => {
  const nur = drafts.find((row) => row.talk.id === 'NIR88RRpat4')!
  const transcript = readFileSync(path.join(root, 'content/transcripts/mikaeel-al-nur.md'), 'utf8').replace(/\*\*\[[\d:]+\]\*\*/g, ' ')
  const plain = (text: string) => text.replace(/\s+/g, ' ').trim()
  assert.ok(plain(transcript).includes(plain(nur.draft!.hook)), `"${nur.draft!.hook}" is not in the transcript as written`)
  assert.ok(saidInTalk(nur.draft!.land, nur.talk.raw))
})

test('A2: the appetiser caption shows the hook, then the turn, then the land, each at its moment', () => {
  const lines = [{ at: 10, text: 'hook' }, { at: 40, text: 'turn' }, { at: 90, text: 'land' }]
  assert.equal(captionIndex(lines, 0), 0)
  assert.equal(captionIndex(lines, 12), 0)
  assert.equal(captionIndex(lines, 39.9), 1)
  assert.equal(captionIndex(lines, 60), 1)
  assert.equal(captionIndex(lines, 95), 2)
  assert.equal(captionIndex(undefined, 95), 0)
})

test('K1: the kill list catches spaced letters, stretched spellings, words built on a listed root and rating a person', () => {
  for (const text of ['Take the q u i z now', 'Q U I Z Z', 'QUIZZ time', 'Open quizlet after this', 'Rate yourself out of 10', 'Your rating this week', 'How would you rate your patience?', 'surveyed', 's u r v e y']) {
    assert.ok(killListHits(text).length > 0, `"${text}" passed`)
  }
  for (const text of ['A first-rate talk about mercy', 'Plan A, B or C', 'What stayed with you from this?', 'The rate of change in the city']) assert.deepEqual(killListHits(text), [], text)
})

test('K1: author text learners read gets one check: plain text and the kill list', () => {
  assert.ok(authorTextProblems([['The question', 'Have a q.u.i.z']]).length > 0)
  assert.ok(authorTextProblems([['The question', 'What stays with you? <b>now</b>']]).length > 0)
  assert.deepEqual(authorTextProblems([['The question', 'What stays with you from this line?']]), [])
})

test('N1: X-Forwarded-For is trusted only behind a configured proxy, read from the right', () => {
  const req = (xff: string) => new Request('http://local/api', { headers: { 'x-forwarded-for': xff, 'x-real-ip': '6.6.6.6' } })
  assert.equal(trustedProxyHops({}), 0)
  assert.equal(trustedProxyHops({ HEARTS_TRUSTED_PROXY_HOPS: '1' }), 1)
  assert.equal(clientIp(req('1.2.3.4'), 0), null, 'no proxy configured: the header is ignored')
  assert.equal(clientIp(req('9.9.9.9, 10.0.0.7'), 1), '10.0.0.7', 'one proxy: the address it saw, not what the visitor wrote')
  assert.equal(clientIp(req('9.9.9.9, 10.0.0.7, 172.16.0.2'), 2), '10.0.0.7')
  assert.equal(clientIp(req('<script>'), 1), null)
})

test('N1: failed joins are keyed by address and code, and by address only when it can be trusted', () => {
  assert.deepEqual(joinFailKeys(null, 'ELM-AAAA-BBBB'), { pair: 'join-fail:unknown:ELM-AAAA-BBBB', address: null })
  assert.deepEqual(joinFailKeys('10.0.0.7', 'ELM-AAAA-BBBB'), { pair: 'join-fail:10.0.0.7:ELM-AAAA-BBBB', address: 'join-fail:10.0.0.7' })
  const handle = readFileSync(path.join(root, 'src/server/handle.ts'), 'utf8')
  assert.doesNotMatch(handle, /join-fail:all/, 'no network-wide failure counter that strangers share')
})

test('N3: trends count only accounts that have finished a video and are at least 24 hours old', () => {
  const at = new Date('2026-10-03T12:00:00Z')
  const old = new Date(at.getTime() - TRENDS_MIN_AGE_HOURS * 3_600_000).toISOString()
  const young = new Date(at.getTime() - 3_600_000).toISOString()
  assert.equal(countsTowardsTrends({ createdAt: old, finishedVideos: 1 }, at), true)
  assert.equal(countsTowardsTrends({ createdAt: old, finishedVideos: 0 }, at), false)
  assert.equal(countsTowardsTrends({ createdAt: young, finishedVideos: 3 }, at), false)
  assert.equal(countsTowardsTrends({ createdAt: null, finishedVideos: 3 }, at), false)
  assert.match(readFileSync(path.join(root, 'README.md'), 'utf8'), /finished at least one video/)
})

test('L1: each lane opens its own clips: its starters in order, then clips confirmed for it', () => {
  const clip = (cutId: number): FeedItem => ({ id: String(cutId), cutId, lane: 'x', laneLabel: 'x', speaker: 's', speakerSlug: 's', portrait: null, poster: null, youtubeId: null, courseId: 1, courseTitle: 'c', lessonId: cutId, hors: { start: 0, end: 15, quote: '' }, appetiser: { start: 0, end: 60, quote: '' }, hook: '', turn: '', land: '', style: null, clause: null, parents: { hors: { id: `hors:${cutId}`, level: 'hors', parentId: `appetiser:${cutId}`, parentLevel: 'appetiser' }, appetiser: { id: `appetiser:${cutId}`, level: 'appetiser', parentId: `talk:${cutId}`, parentLevel: 'talk' } } })
  const cut = (id: number, extra: Partial<CutInfo>): CutInfo => ({ id, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, ...extra })
  const cuts = [
    cut(1, { starter: { lane: 'trust', role: 'mains' } }),
    cut(2, { starter: { lane: 'trust', role: 'first' } }),
    cut(3, { starter: { lane: 'company', role: 'first' } }),
    cut(4, { lanes: [{ lane: 'trust', weight: 2, confirmed: true }] }),
    cut(5, { lanes: [{ lane: 'trust', weight: 3, confirmed: false }] }),
  ]
  const clips = Object.fromEntries([1, 2, 3, 4, 5].map((id) => [String(id), clip(id)]))
  assert.deepEqual(laneClips(clips, cuts, 'trust', 'Trust').map((row) => row.cutId), [2, 1, 4])
  assert.deepEqual(laneClips(clips, cuts, 'company', 'Company').map((row) => row.cutId), [3])
  assert.equal(laneClips(clips, cuts, 'trust', 'Trust')[0].laneLabel, 'Trust')
})

test('LOW: yt-dlp is fetched by setup, uses the web_embedded client, and says plainly when YouTube blocks it', () => {
  assert.ok(ytDlpArgs('FAxIZIqwfd8', '/tmp').join(' ').includes('youtube:player_client=web_embedded'))
  assert.match(ytDlpProblem('ERROR: [youtube] x: Sign in to confirm you’re not a bot'), /blocked yt-dlp from this network/)
  assert.match(ytDlpProblem('', true), /not installed/)
  assert.match(readFileSync(path.join(root, 'scripts/setup.mjs'), 'utf8'), /get-yt-dlp\.mjs/)
  assert.match(readFileSync(path.join(root, 'scripts/get-yt-dlp.mjs'), 'utf8'), /YT_DLP_VERSION = '\d{4}\.\d{2}\.\d{2}'/)
})

test('LOW: the browser tests run against their own database file, never the demo one', () => {
  const env = readFileSync(path.join(root, 'tests/env.ts'), 'utf8')
  const config = readFileSync(path.join(root, 'playwright.config.ts'), 'utf8')
  assert.match(env, /E2E_DATABASE = process\.env\.HEARTS_E2E_DATABASE \|\| 'file:\.\/data\/hearts-test\.db'/)
  assert.doesNotMatch(env, /hearts\.db/)
  assert.match(config, /DATABASE_URL: E2E_DATABASE/)
  assert.match(readFileSync(path.join(root, 'tests/global-setup.ts'), 'utf8'), /E2E_DATABASE/)
})

test('LOW: the main player keeps YouTube’s own overlays to a minimum when it pauses at a question', () => {
  const vars = playerVars('full', 0) as Record<string, unknown>
  assert.equal(vars.rel, 0)
  assert.equal(vars.iv_load_policy, 3)
  assert.equal(vars.modestbranding, 1)
  assert.match(readFileSync(path.join(root, 'src/components/app/course-player.tsx'), 'utf8'), /paused-scrim/)
})

test('feed players show none of YouTube’s chrome: no controls, inline, no related videos, cards or captions', () => {
  for (const kind of ['hors', 'appetiser'] as const) {
    const vars = playerVars(kind, 12.5, 40) as Record<string, unknown>
    assert.equal(vars.controls, 0, kind)
    assert.equal(vars.playsinline, 1, kind)
    assert.equal(vars.rel, 0, kind)
    assert.equal(vars.iv_load_policy, 3, kind)
    assert.equal(vars.cc_load_policy, 0, kind)
    assert.equal(vars.modestbranding, 1, kind)
    assert.equal(vars.fs, 0, kind)
  }
})
