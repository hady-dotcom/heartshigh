import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GHOST_CLICK_MS, ghostClick } from '../../src/lib/board-gestures'
import { keyWordIndex, sentencesFromCaptions } from '../../src/lib/framing/words'
import type { FramingSentence } from '../../src/lib/framing/types'

// The unit runner compiles JSX with the classic runtime.
Object.assign(globalThis, { React })
const { SpokenWords } = await import('../../src/components/app/spoken-words')
const root = process.cwd()
const journey = readFileSync(path.join(root, 'src/components/journey/journey.tsx'), 'utf8')
const wordsDir = path.join(root, 'content/framing/clip-words')
const track = (name: string) => JSON.parse(readFileSync(path.join(wordsDir, name), 'utf8')) as { sentences: FramingSentence[] }

// ---------- 1: tapping More only opens the board ----------

test('1: the click left over from the tap that opened the board is swallowed', () => {
  // Press on More at 1000, the board opens on the lift at 1080, the phone's click arrives at 1120.
  assert.equal(ghostClick({ now: 1120, boardChangedAt: 1080, lastPressAt: 1000, detail: 1 }), true)
  // Same for the tap that closes it.
  assert.equal(ghostClick({ now: 5050, boardChangedAt: 5000, lastPressAt: 4950, detail: 1 }), true)
})

test('1: a real tap after the board opened still works, at once', () => {
  assert.equal(ghostClick({ now: 1300, boardChangedAt: 1080, lastPressAt: 1250, detail: 1 }), false, 'a fresh press after the open')
  assert.equal(ghostClick({ now: 1080 + GHOST_CLICK_MS + 1, boardChangedAt: 1080, lastPressAt: 1000, detail: 1 }), false, 'long after the open')
  assert.equal(ghostClick({ now: 1120, boardChangedAt: 1080, lastPressAt: 1000, detail: 0 }), false, 'keyboard Enter or Space')
  assert.equal(ghostClick({ now: 1120, boardChangedAt: 0, lastPressAt: 1000, detail: 1 }), false, 'the board never opened')
})

test('1: simulated guest: one tap on More opens the board and asks for nothing', () => {
  let sheet: string | null = null
  let board = false
  let lastPress = 0
  let changedAt = 0
  const press = (at: number) => { lastPress = at }
  // The tab bar sits right under the More handle; its guard asks a guest to keep their place.
  const click = (at: number, on: 'tab' | 'board-button') => {
    if (ghostClick({ now: at, boardChangedAt: changedAt, lastPressAt: lastPress, detail: 1 })) return
    if (on === 'tab') sheet = 'place'
  }
  press(1000)
  board = true
  changedAt = 1080
  click(1110, 'tab') // touch adjustment aims the leftover click at the week tab
  assert.equal(board, true)
  assert.equal(sheet, null, 'no sheet on top of the board')
  // Tapping a tab on purpose afterwards still asks.
  press(2000)
  click(2060, 'tab')
  assert.equal(sheet, 'place')
})

test('1: the page records every press and swallows the leftover click before anything else sees it', () => {
  assert.match(journey, /window\.addEventListener\('pointerdown', notePress, true\)/)
  assert.match(journey, /window\.addEventListener\('click', swallowGhost, true\)/)
  const guard = journey.slice(journey.indexOf('const swallowGhost = '), journey.indexOf("window.addEventListener('pointerdown', notePress, true)"))
  assert.match(guard, /const changedAt = Math\.max\(boardOpenedAt\.current, boardClosedAt\.current\)/)
  assert.match(guard, /ghostClick\(\{ now: performance\.now\(\), boardChangedAt: changedAt, lastPressAt: lastPressAt\.current, detail: event\.detail \}\)/)
  assert.match(guard, /event\.preventDefault\(\)\n\s+event\.stopPropagation\(\)\n\s+event\.stopImmediatePropagation\(\)/)
  assert.match(journey, /window\.removeEventListener\('click', swallowGhost, true\)/)
})

// ---------- 2: exactly one gold word per page ----------

const goldCount = (html: string) => (html.match(/class="fr-key"/g) || []).length

test('2: "generous" said twice lights only the first one', () => {
  const page = track('9kvuzeMaiIs-1860-1882.json').sentences.find((row) => /generous, but he's not actually generous/.test(row.text))
  assert.ok(page, 'the page from the phone check')
  assert.equal(page.key, 'generous')
  const html = renderToStaticMarkup(createElement(SpokenWords, { sentences: [page], time: page.s + 0.1 }))
  assert.equal(goldCount(html), 1)
  assert.match(html, /<span class="fr-key">generous,<\/span>/)
  assert.ok(html.indexOf('class="fr-key"') < html.lastIndexOf('generous'), 'the first occurrence is the gold one')
})

test('2: every page in all 138 clips shows at most one gold word', () => {
  const files = readdirSync(wordsDir).filter((name) => name.endsWith('.json'))
  assert.equal(files.length, 138)
  let pages = 0
  let repeated = 0
  for (const name of files) {
    for (const page of track(name).sentences) {
      pages += 1
      const html = renderToStaticMarkup(createElement(SpokenWords, { sentences: [page], time: page.s + 0.01 }))
      assert.ok(goldCount(html) <= 1, `${name} @${page.s}: ${page.text}`)
      const words = page.words.map((row) => row.w)
      if (page.key && words.filter((word) => keyWordIndex([word], page.key) === 0).length > 1) repeated += 1
    }
  }
  assert.ok(pages > 1000)
  assert.ok(repeated >= 30, 'the real tracks do repeat key words, so this covers the bug')
})

test('2: the key index and the caption-built pages mark one word', () => {
  assert.equal(keyWordIndex(['So', 'people', 'say', "he's", 'generous,', 'but', "he's", 'not', 'actually', 'generous.'], 'generous'), 4)
  assert.equal(keyWordIndex(['a', 'b'], null), -1)
  assert.equal(keyWordIndex(['a', 'b'], 'zz'), -1)
  const built = sentencesFromCaptions([{ at: 0, text: 'night every night for the rest of your life.' }], 0, 5)
  for (const page of built) assert.ok(page.words.filter((row) => row.key).length <= 1)
})

// ---------- 3: the garbled caption ----------

test('3: "enoughs" and the other clear non-words are fixed in the generated tracks', () => {
  const fixes = JSON.parse(readFileSync(path.join(root, 'content/framing/clip-words-fixes.json'), 'utf8')) as { fixes: { youtubeId: string; cutId: number; from: string; to: string }[] }
  const want: [string, number, string, string, string][] = [
    ['xFRCtxz6_LA', 101, 'enoughs', 'endless', 'xFRCtxz6_LA-1176-1210.json'],
    ['1suEmWBqlKE', 166, 'ayada', "isti'adha", '1suEmWBqlKE-192-236.json'],
    ['Mw6wrK21trY', 174, 'summate', 'summarize', 'Mw6wrK21trY-243-265.json'],
    ['ogAXx-3OBGg', 119, 'zakatum', 'zakat on them', 'ogAXx-3OBGg-4417-4451.json'],
    ['byhbsgVKZjM', 112, 'indentions', 'indentations', 'byhbsgVKZjM-6459-6501.json'],
  ]
  for (const [youtubeId, cutId, from, to, file] of want) {
    assert.ok(fixes.fixes.some((row) => row.youtubeId === youtubeId && row.cutId === cutId && row.from === from && row.to === to), from)
    const text = track(file).sentences.map((row) => row.text).join(' ')
    assert.doesNotMatch(text, new RegExp(`\\b${from}\\b`, 'i'), `${from} gone`)
    assert.match(text, new RegExp(to.replace(/'/g, "'")), `${to} shown`)
  }
  assert.match(track('xFRCtxz6_LA-1176-1210.json').sentences[0].text, /buying consumption is endless right\?/)
})
