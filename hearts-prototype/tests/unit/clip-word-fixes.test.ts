import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { applyWordFixes, fixesFor, type FixHit, type FixToken, type WordFix, type WordFixes } from '../../src/lib/framing/clip-word-fixes'
import { clipSentences, type WorkFile } from '../../src/lib/framing/clip-words'
import { trackForClip } from '../../src/lib/framing/store'
import fixesFile from '../../content/framing/clip-words-fixes.json'
import live from '../fixtures/live-clips.json'

type Clip = { cutId: number; youtubeId: string; start: number; end: number }
const clips = live.clips as Clip[]
const fixes = fixesFile as WordFixes
const WORK = '/workspace/own-cms/content-load/work'

const run = (text: string, from = 10, step = 0.5): FixToken[] => text.split(' ').map((w, at) => ({ w, t: from + at * step, e: from + (at + 1) * step }))
const text = (tokens: FixToken[]) => tokens.map((row) => row.w).join(' ')
const fix = (from: string, to: string, extra: Partial<WordFix> = {}): WordFix => ({ from, to, ...extra })

/** What a demo viewer must never read under a speaker. Each was in a live clip before the fixes, or is a near cousin. */
const DENYLIST: [RegExp, string][] = [
  [/\bsatan\s+(bilal|muhammad|prophet|rasul|abu|umar|ali|uthman|aisha|khadija|ibrahim|musa|isa|nabi)/i, 'Satan before a holy name (misheard "Sayyidina")'],
  [/\b(sayyidina|prophet|messenger|muhammad|bilal)\W+(\w+\W+)?(satan|devil|shaytan)\b/i, 'Satan beside a holy name'],
  [/\bsatan\b/i, 'Satan anywhere (none of the 138 clips speak of Satan by that name)'],
  [/\bmachete\b/i, 'misheard "mashayikh"'],
  [/\bsoviet\b/i, 'misheard "sabr"'],
  [/\bprofitable law\b/i, 'misheard "Prophet of Allah"'],
  [/\b(choose|refuge in|after) a law\b/i, 'misheard "Allah"'],
  [/\bbite him\b/i, 'misheard "buy him"'],
  [/\bbreak his soul\b/i, 'misheard "break his fast"'],
  [/\bAllah,? what makes you cry\b/i, 'Bilal asks the Prophet, not Allah'],
  [/\b(asked|asks) (imam )?\S+ allah a question\b/i, 'misheard "rahimahullah"'],
  [/\bsaid allah, isn't it\b/i, 'a non-Muslim addressing Allah'],
  [/\bBlacks\b/, 'reads as a racial term'],
  [/(^|[.?!]\s+)F\s/, 'a lone F at a sentence start reads as an expletive'],
  [/\bprophet saw\b/i, '"(saw)" honorific misheard as the verb'],
  [/\bprophetam\b/i, 'honorific run into the word'],
  [/\b(fuck|shit|bitch|bastard|cunt|whore|slut|nigg|faggot|retard)/i, 'profanity or slur'],
]

test('a fix replaces the misheard words over their own span, spread evenly', () => {
  const tokens = run('this verse was revealed, Satan Bilal came to wake him')
  const { tokens: out, hits } = applyWordFixes(tokens, [fix('Satan Bilal', 'Sayyidina Bilal')])
  assert.equal(text(out), 'this verse was revealed, Sayyidina Bilal came to wake him')
  assert.equal(hits.length, 1)
  assert.deepEqual([out[4].t, out[5].t], [tokens[4].t, tokens[5].t])
  // More words than before: starts run from the first old start to the last old start, the last ends where it did.
  const longer = applyWordFixes(run('the Prophet Salallahu said'), [fix('Salallahu', 'sallallahu alayhi wa sallam')]).tokens
  assert.equal(text(longer), 'the Prophet sallallahu alayhi wa sallam said')
  assert.deepEqual(longer.slice(2, 6).map((row) => row.t), [11, 11.125, 11.25, 11.375])
  assert.equal(longer[5].e, 11.5)
  const many = applyWordFixes(run('um of Satan Muhammad in Sallallahu'), [fix('um of Satan Muhammad in', 'ummah of Sayyidina Muhammad,')]).tokens
  assert.equal(text(many), 'ummah of Sayyidina Muhammad, Sallallahu')
  assert.equal(many[0].t, 10)
  assert.equal(many[3].e, 12.5)
  for (let at = 1; at < many.length; at++) assert.ok(many[at].t > many[at - 1].t)
})

test('a bare word keeps the caption punctuation; a punctuated word must match it exactly', () => {
  assert.equal(text(applyWordFixes(run('the masjid, the Masid. And Masid?'), [fix('Masid', 'masjid')]).tokens), 'the masjid, the masjid. And masjid?')
  assert.equal(text(applyWordFixes(run('So he. Said, Can I'), [fix('he. Said,', 'he said,')]).tokens), 'So he said, Can I')
  assert.equal(text(applyWordFixes(run('So he said, Can I'), [fix('he. Said,', 'he said,')]).tokens), 'So he said, Can I')
  assert.equal(applyWordFixes(run('So he said, Can I'), [fix('he. Said,', 'he said,')]).hits.length, 0)
  assert.equal(text(applyWordFixes(run('the subhan Allah, or'), [fix('Subhan Allah', 'SubhanAllah')]).tokens), 'the SubhanAllah, or')
})

test('an empty fix drops the words; a spelling already right is not counted', () => {
  const { tokens, hits } = applyWordFixes(run('able to recite. F the new Muslim'), [fix('F', '')])
  assert.equal(text(tokens), 'able to recite. the new Muslim')
  assert.equal(hits[0].after, '')
  assert.equal(applyWordFixes(run('say SubhanAllah now'), [fix('Subhanallah', 'SubhanAllah')]).hits.length, 0)
})

test('a fix only touches its own video, its own time and the clip window', () => {
  const tokens = run('he said. Yes he said. No', 100, 5)
  const at = applyWordFixes(tokens, [fix('he said.', 'he said,', { at: 115 })]).tokens
  assert.equal(text(at), 'he said. Yes he said, No')
  const windowed = applyWordFixes(tokens, [fix('he said.', 'he said,')], { start: 112, end: 130 }).tokens
  assert.equal(text(windowed), 'he said. Yes he said, No')
  const all: WordFixes = { version: 1, global: [fix('Quran', "Qur'an")], fixes: [fix('a', 'b', { youtubeId: 'one' }), fix('c', 'd', { youtubeId: 'two' })] }
  assert.deepEqual(fixesFor(all, 'one').map((row) => row.from), ['a', 'Quran'])
})

test('fixes run before sentences are found, so a mended full stop joins the sentence', () => {
  const work: WorkFile = {
    words: 'So he. Said, Can I tell you about the easiest form of worship?'.split(' ').map((w, at) => [w.replace(/[.,?]/g, '').toLowerCase(), 5 + at * 0.4, 5.3 + at * 0.4]),
    disp: 'So he. Said, Can I tell you about the easiest form of worship?'.split(' '),
  }
  const clip = { youtubeId: 'x', start: 5, end: 12 }
  assert.equal(clipSentences(work, clip)?.[0].text, 'So he.')
  const fixed = clipSentences(work, clip, { fixes: [fix('he. Said,', 'he said,')] })!
  assert.equal(fixed[0].text.startsWith('So he said, Can I tell you'), true)
})

test('the fixes file is well formed: every per-video fix names a live clip, says why, and changes something', () => {
  const ids = new Set(clips.map((row) => row.youtubeId))
  const severities = new Set(['offensive', 'jarring', 'mishearing', 'spelling', 'punctuation'])
  assert.ok(fixes.fixes.length > 100)
  for (const row of fixes.fixes) {
    assert.ok(row.youtubeId && ids.has(row.youtubeId), `${row.youtubeId} "${row.from}" is not a live clip`)
    assert.ok(row.severity && severities.has(row.severity), `"${row.from}" severity`)
    assert.ok(row.reason, `"${row.from}" has no reason`)
    assert.notEqual(row.from, row.to)
    assert.ok(row.from.trim())
  }
  for (const row of fixes.global) {
    assert.equal(row.youtubeId, undefined)
    assert.ok(row.reason)
  }
  assert.ok(fixes.fixes.some((row) => row.from === 'Satan Bilal' && row.to === 'Sayyidina Bilal' && row.severity === 'offensive'))
})

test('no clip track says "Satan Bilal", and the denylist of offensive or jarring words finds nothing', () => {
  const found: string[] = []
  for (const clip of clips) {
    const track = trackForClip(clip.youtubeId, clip.start, clip.end, null)!
    const said = track.sentences!.map((row) => row.text).join(' ')
    assert.ok(!/satan bilal/i.test(said), `cut ${clip.cutId} still says Satan Bilal`)
    for (const [pattern, why] of DENYLIST) {
      const hit = pattern.exec(said)
      if (hit) found.push(`cut ${clip.cutId} ${clip.youtubeId}: "${hit[0]}" (${why})`)
    }
  }
  assert.deepEqual(found, [])
})

test('the fixed words are in the committed tracks, timed forward and inside their window', () => {
  const byId = new Map(clips.map((row) => [row.youtubeId, row]))
  const words = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean)
  for (const row of fixes.fixes) {
    const clip = byId.get(row.youtubeId!)!
    const track = trackForClip(clip.youtubeId, clip.start, clip.end, null)!
    const said = ` ${words(track.sentences!.map((line) => line.text).join(' ')).join(' ')} `
    // Punctuation-only fixes leave the same words; the others must show their replacement.
    if (row.to && words(row.to).join(' ') !== words(row.from).join(' ')) {
      assert.ok(said.includes(` ${words(row.to).join(' ')} `), `cut ${row.cutId}: "${row.to}" is not in the track`)
    }
    let last = -Infinity
    for (const sentence of track.sentences!) {
      for (const word of sentence.words!) {
        assert.ok(word.t >= clip.start && word.t <= clip.end, `cut ${row.cutId} word "${word.w}" at ${word.t}`)
        assert.ok(word.t > last, `cut ${row.cutId} word "${word.w}" runs backwards`)
        last = word.t
      }
      assert.ok(sentence.s >= clip.start && sentence.e <= clip.end && sentence.e > sentence.s, `cut ${row.cutId} sentence ${sentence.s}-${sentence.e}`)
    }
  }
})

function workFiles() {
  const found = new Map<string, string>()
  for (const source of readdirSync(WORK, { withFileTypes: true })) {
    if (!source.isDirectory() || source.name.startsWith('backup')) continue
    for (const name of readdirSync(path.join(WORK, source.name))) if (name.endsWith('.json') && !found.has(name.slice(0, -5))) found.set(name.slice(0, -5), path.join(WORK, source.name, name))
  }
  return found
}

test('every per-video fix still matches its clip in the caption work files (when they are on this machine)', { skip: !existsSync(WORK) && 'no content-load work files here' }, () => {
  const index = workFiles()
  const used = new Set<WordFix>()
  for (const clip of clips) {
    const file = index.get(clip.youtubeId)
    if (!file) continue
    const work = JSON.parse(readFileSync(file, 'utf8')) as WorkFile
    const hits: FixHit[] = []
    const sentences = clipSentences(work, clip, { fixes: fixesFor(fixes, clip.youtubeId), onFix: (hit) => hits.push(hit) })
    hits.forEach((hit) => used.add(hit.fix))
    // The committed track is exactly what the fixes produce today.
    const committed = trackForClip(clip.youtubeId, clip.start, clip.end, null)!
    assert.deepEqual(committed.sentences, sentences, `cut ${clip.cutId}: content/framing/clip-words is stale; rerun npm run framing:clip-words`)
  }
  const unused = fixes.fixes.filter((row) => !used.has(row)).map((row) => `${row.youtubeId} "${row.from}"`)
  assert.deepEqual(unused, [])
})
