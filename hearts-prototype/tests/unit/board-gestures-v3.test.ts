import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  BOARD_TAP_SLOP_PX,
  GHOST_CLICK_MS,
  boardClickFires,
  boardHandleAction,
  boardTapFires,
  feedGestureCounts,
  ghostClick,
  pointerTravel,
} from '../../src/lib/board-gestures'
import { pageKeyIndex, pickKey, sentencesFromCaptions, wrapWordLines } from '../../src/lib/framing/words'
import type { FramingSentence } from '../../src/lib/framing/types'

Object.assign(globalThis, { React })
const { SpokenWords } = await import('../../src/components/app/spoken-words')
const root = process.cwd()
const journey = readFileSync(path.join(root, 'src/components/journey/journey.tsx'), 'utf8')
const wordsDir = path.join(root, 'content/framing/clip-words')
const between = (from: string, to: string) => {
  const start = journey.indexOf(from)
  const end = journey.indexOf(to, start + from.length)
  assert.ok(start >= 0 && end > start, `${from} … ${to}`)
  return journey.slice(start, end)
}

/**
 * A phone in miniature, wired the way journey.tsx wires the More board, driven by the event order a
 * real tap or drag produces in Chrome (touch emulation and phones alike):
 *   tap:  touchstart, pointerdown, pointerup, touchend, click (the click goes to whatever is under the finger now)
 *   drag: touchstart, pointerdown, pointermove…, pointerup (no click), or pointercancel when the browser pans.
 * Every decision is the real helper from lib/board-gestures.
 */
type Target = 'more' | 'grab' | 'fave' | 'save' | 'learn-more' | 'not-now' | 'tab' | 'film' | 'end-lanes'
class Phone {
  now = 1000
  signedIn = false
  boardOpen = false
  openedAt = 0
  closedAt = 0
  toggledAt = 0
  lastPressAt = 0
  sheet: string | null = null
  sheets = 0
  saved = 0
  tabSheets = 0
  laneMoves = 0
  pictureTaps = 0
  endLanes = 0
  boardTap: { control: Target; x: number; y: number; t: number; acted: boolean } | null = null
  morePress: { t: number; acted: boolean } | null = null
  drag: { x: number; y: number; t: number } | null = null
  feed: { x: number; y: number; t: number } | null = null
  private down: { target: Target; x: number; y: number } | null = null

  wait(ms: number) { this.now += ms }
  openDrawer() { this.openedAt = this.now; this.toggledAt = this.now; this.boardOpen = true; this.feed = null }
  closeDrawer() { this.boardOpen = false; this.closedAt = this.now; this.toggledAt = this.now; this.drag = null; this.boardTap = null; this.morePress = null; this.feed = null }
  /** The lane end or an auto-advance shuts the board: not the guest's gesture. */
  laneEndClosesBoard() { if (this.boardOpen) this.closedAt = this.now; this.boardOpen = false }
  onBoard(target: Target) { return target === 'fave' || target === 'save' || target === 'learn-more' || target === 'grab' }
  act(target: Target) {
    if (target === 'fave' || target === 'save') {
      if (!this.signedIn) { this.sheet = 'save'; this.sheets += 1 } else if (target === 'save') this.saved += 1
    }
  }

  pointerdown(target: Target, x: number, y: number) {
    this.lastPressAt = this.now // window capture notePress (also on touchstart)
    this.down = { target, x, y }
    if (this.sheet) return
    if (this.boardOpen && this.onBoard(target)) this.boardTap = { control: target, x, y, t: this.now, acted: false }
    if (target === 'more' || target === 'grab') { this.drag = { x, y, t: this.now }; if (target === 'more') this.morePress = { t: this.now, acted: false } }
    if (target === 'film' && !this.boardOpen) this.feed = { x, y, t: this.now }
  }
  pointerup(x: number, y: number) {
    const down = this.down
    if (!down || this.sheet) return
    const target = down.target // touch pointers are captured by the pressed element
    if (target === 'more' || target === 'grab') {
      const start = this.drag
      this.drag = null
      if (!start) return
      const dy = y - start.y
      const action = boardHandleAction({ boardOpen: this.boardOpen, dy, velocity: dy / Math.max(1, this.now - start.t), travel: pointerTravel(start, { x, y }) })
      if (action !== 'none' && this.morePress) this.morePress.acted = true
      if (action === 'open') this.openDrawer()
      else if (action === 'close') this.closeDrawer()
      return
    }
    if (target === 'film') {
      const start = this.feed
      this.feed = null
      if (!start || !feedGestureCounts({ startedAt: start.t, boardOpen: this.boardOpen, boardClosedAt: this.closedAt })) return
      if (y - start.y > 48) this.laneMoves += 1
      else if (Math.abs(y - start.y) < 10) this.pictureTaps += 1
      return
    }
    if (this.boardOpen && (target === 'fave' || target === 'save')) {
      const tap = this.boardTap
      const pressedHere = Boolean(tap && tap.control === target)
      const fires = boardTapFires({ pressedHere, pressedAt: tap?.t ?? 0, pressTravel: tap ? pointerTravel(tap, { x, y }) : 0, openedAt: this.openedAt, now: this.now, dragTravel: 0 })
      this.boardTap = tap && pressedHere ? { ...tap, acted: fires } : null
      if (fires) this.act(target)
    }
  }
  pointercancel() { this.down = null; this.drag = null; this.feed = null }
  /** The browser's click for the tap, aimed at what is under the finger now (touch adjustment may move it). */
  click(target: Target, detail = 1) {
    if (ghostClick({ now: this.now, boardChangedAt: this.toggledAt, lastPressAt: this.lastPressAt, detail })) return 'swallowed'
    if (target === 'not-now' && this.sheet) { this.sheet = null; return 'closed-sheet' }
    if (target === 'tab' && !this.signedIn) { this.sheet = 'place'; this.tabSheets += 1; return 'tab-sheet' }
    if (target === 'end-lanes') { this.endLanes += 1; return 'end-lanes' }
    if (target === 'more' && !this.boardOpen) {
      const press = this.morePress
      this.morePress = null
      if (detail === 0 || (press && !press.acted)) { this.openDrawer(); return 'opened-on-click' }
      return 'none'
    }
    if ((target === 'fave' || target === 'save') && this.boardOpen && !this.sheet) {
      const tap = this.boardTap
      const pressedHere = Boolean(tap && tap.control === target)
      const fires = boardClickFires({ detail, boardOpen: this.boardOpen, pressedHere, acted: Boolean(tap?.acted), pressedAt: tap?.t ?? 0, openedAt: this.openedAt })
      if (pressedHere) this.boardTap = null
      if (fires) { this.act(target); return 'acted-on-click' }
    }
    return 'none'
  }
  /** A real tap: touchstart+pointerdown, ~90ms, pointerup+touchend, then the click. */
  tap(target: Target, at = { x: 195, y: 340 }, opts: { clickOn?: Target; wobble?: { dx: number; dy: number }; hold?: number } = {}) {
    this.pointerdown(target, at.x, at.y)
    this.wait(opts.hold ?? 90)
    const up = { x: at.x + (opts.wobble?.dx ?? 0), y: at.y + (opts.wobble?.dy ?? 0) }
    this.pointerup(up.x, up.y)
    return this.click(opts.clickOn ?? (target === 'more' && this.boardOpen ? 'learn-more' : target))
  }
  /** A drag: pointerdown, `steps` pointermoves over `ms`, then pointerup (no click), or pointercancel if the browser took the pan. */
  dragFrom(target: Target, from: { x: number; y: number }, dy: number, ms: number, steps = 3, cancel = false) {
    this.pointerdown(target, from.x, from.y)
    for (let index = 1; index <= steps; index++) this.wait(ms / steps)
    if (cancel) this.pointercancel()
    else this.pointerup(from.x, from.y + dy)
  }
}

const MORE = { x: 195, y: 662 }
const GRAB = { x: 195, y: 259 }
const LIKE = { x: 195, y: 342 }
const SAVE = { x: 271, y: 342 }
const NOT_NOW = { x: 195, y: 689 }

// ---------- 1: Like after Save → Not now ----------

test('1: open board, Save, Not now, 2.5 s, Like: the FIRST Like tap opens the sheet (once)', () => {
  const phone = new Phone()
  assert.equal(phone.tap('more', MORE), 'swallowed', 'the More tap’s own click is dropped')
  assert.equal(phone.boardOpen, true)
  phone.wait(1000)
  phone.tap('save', SAVE, { clickOn: 'save' })
  assert.equal(phone.sheet, 'save')
  phone.wait(1500)
  assert.equal(phone.tap('not-now', NOT_NOW), 'closed-sheet')
  phone.wait(2500)
  phone.tap('fave', LIKE)
  assert.equal(phone.sheet, 'save', 'first Like tap works')
  assert.equal(phone.sheets, 2, 'one sheet per tap, the click never opens a second')
})

test('1: a Like whose pointerup did not act (lifted 24px+ away at 75% zoom, the browser still calls it a tap) works on its click, once', () => {
  const phone = new Phone()
  phone.tap('more', MORE)
  phone.wait(800)
  assert.equal(phone.tap('fave', LIKE, { wobble: { dx: 0, dy: BOARD_TAP_SLOP_PX + 2 } }), 'acted-on-click')
  assert.equal(phone.sheets, 1)
})

test('1: a signed-in Save that acted on pointerup is not toggled again by its click', () => {
  const phone = new Phone()
  phone.signedIn = true
  phone.tap('more', MORE)
  phone.wait(800)
  assert.equal(phone.tap('save', SAVE), 'none')
  assert.equal(phone.saved, 1)
  phone.wait(800)
  phone.tap('save', SAVE)
  assert.equal(phone.saved, 2, 'each real tap toggles exactly once')
})

test('1: the More tap’s click landing on a board button never fires it (pressed before the board opened)', () => {
  const phone = new Phone()
  phone.signedIn = true
  phone.pointerdown('more', MORE.x, MORE.y)
  phone.wait(90)
  phone.pointerup(MORE.x, MORE.y)
  // Beyond the 700ms ghost window, so only boardClickFires stands between this click and Save.
  phone.wait(GHOST_CLICK_MS + 50)
  assert.equal(phone.click('save'), 'none')
  assert.equal(phone.saved, 0)
})

// ---------- 2: More after a fast drag-close ----------

test('2: fast drag-close (3 moves in 50ms) then More 150ms later: the first More tap opens', () => {
  const phone = new Phone()
  phone.tap('more', MORE)
  phone.wait(900)
  phone.dragFrom('grab', GRAB, 300, 50, 3)
  assert.equal(phone.boardOpen, false)
  assert.equal(phone.laneMoves, 0, 'closing never moves the lane')
  phone.wait(150)
  const click = phone.tap('more', MORE)
  assert.equal(phone.boardOpen, true, 'first tap')
  assert.equal(click, 'swallowed', 'its own leftover click is still dropped')
  assert.equal(phone.tabSheets, 0)
})

test('2: a drag the phone turned into a pan (pointercancel, no pointerup) leaves nothing stale: next More tap opens', () => {
  const phone = new Phone()
  phone.tap('more', MORE)
  phone.wait(900)
  phone.dragFrom('grab', GRAB, 300, 40, 3, true)
  assert.equal(phone.boardOpen, true, 'a cancelled drag does not close')
  phone.tap('grab', GRAB, { clickOn: 'film' }) // tap the handle to close; its click lands on the film
  assert.equal(phone.boardOpen, false)
  assert.equal(phone.pictureTaps, 0, 'the close tap’s click never toggles the film')
  phone.wait(100)
  phone.tap('more', MORE)
  assert.equal(phone.boardOpen, true)
})

test('2: a More tap with a quick 10px downward wobble opens (it used to "close" the shut board and do nothing)', () => {
  const phone = new Phone()
  phone.tap('more', MORE, { wobble: { dx: 0, dy: 10 }, hold: 20 })
  assert.equal(phone.boardOpen, true)
  assert.equal(boardHandleAction({ boardOpen: false, dy: 10, velocity: 0.5, travel: 10 }), 'open')
  assert.equal(boardHandleAction({ boardOpen: false, dy: 60, velocity: 0.5, travel: 60 }), 'none', 'a real downward swipe on More still does nothing')
  assert.equal(boardHandleAction({ boardOpen: false, dy: -30, velocity: -0.5, travel: 30 }), 'open')
  assert.equal(boardHandleAction({ boardOpen: true, dy: 300, velocity: 6, travel: 300 }), 'close')
  assert.equal(boardHandleAction({ boardOpen: true, dy: 2, velocity: 0, travel: 2 }), 'close', 'a tap on the handle closes')
  assert.equal(boardHandleAction({ boardOpen: true, dy: -40, velocity: -1, travel: 40 }), 'none', 'pulling an open board up leaves it open')
})

test('2: if a More pointerup is lost or misread, its click opens the board; a More click after an open never closes it', () => {
  const phone = new Phone()
  phone.pointerdown('more', MORE.x, MORE.y)
  phone.wait(90)
  phone.pointercancel() // e.g. the phone began a scroll, then the browser still delivered the tap
  assert.equal(phone.click('more'), 'opened-on-click')
  assert.equal(phone.boardOpen, true)
  assert.equal(phone.click('more', 0), 'none', 'already open')
})

// ---------- ghost guard: only the open/close gesture's own click ----------

test('ghost: only the click of the press that opened or closed the board is dropped', () => {
  // The press that toggled (began 90ms before the change): its click is dropped.
  assert.equal(ghostClick({ now: 1100, boardChangedAt: 1090, lastPressAt: 1000, detail: 1 }), true)
  // A fresh press after the change always passes.
  assert.equal(ghostClick({ now: 1300, boardChangedAt: 1090, lastPressAt: 1200, detail: 1 }), false)
  // No press at all (keyboard Escape closed it) or a press long before: not that gesture's click.
  assert.equal(ghostClick({ now: 1100, boardChangedAt: 1090, lastPressAt: 0, detail: 1 }), false)
  assert.equal(ghostClick({ now: 9100, boardChangedAt: 9090, lastPressAt: 1000, detail: 1 }), false)
})

test('ghost: the lane end shutting the board does not arm the guard, so a real tap on "Try another lane" works', () => {
  const phone = new Phone()
  phone.tap('more', MORE)
  phone.wait(2000)
  phone.pointerdown('end-lanes', 195, 437)
  phone.laneEndClosesBoard() // the clip ends while the finger is down
  phone.wait(90)
  phone.pointerup(195, 437)
  assert.equal(phone.click('end-lanes'), 'end-lanes')
})

test('ghost: the tab under the More handle never gets the More tap’s click', () => {
  const phone = new Phone()
  assert.equal(phone.tap('more', MORE, { clickOn: 'tab' }), 'swallowed')
  assert.equal(phone.tabSheets, 0)
  phone.wait(GHOST_CLICK_MS + 1)
  phone.tap('tab', { x: 195, y: 700 })
  assert.equal(phone.tabSheets, 1, 'a tab tapped on purpose still asks')
})

test('feed: a fast swipe down that began on the film after the board closed still changes lane; the close itself never does', () => {
  const phone = new Phone()
  phone.tap('more', MORE)
  phone.wait(900)
  phone.dragFrom('grab', GRAB, 300, 50, 3)
  assert.equal(phone.laneMoves, 0)
  phone.wait(120)
  phone.dragFrom('film', { x: 195, y: 300 }, 200, 80, 4)
  assert.equal(phone.laneMoves, 1)
})

// ---------- wiring in journey.tsx ----------

test('wiring: board controls fall back to their click, More has a click fallback, the guard keys on the guest’s own toggle', () => {
  for (const id of ['share', 'fave', 'level-clip', 'level-minutes', 'level-lecture']) {
    const line = journey.split('\n').find((row) => row.includes(`data-testid="${id}"`))
    assert.ok(line, id)
    assert.match(line, /onPointerUp=\{\(event\) => boardAction\(event, [^\n]+\)\} onClick=\{\(event\) => boardClick\(event, /, id)
  }
  assert.match(journey, /data-testid="save"[^\n]*onClick=\{\(event\) => boardClick\(event, saveTap\)\}/)
  assert.doesNotMatch(journey, /boardAction\(event, [^\n]*\)\} onClick=\{\(event\) => event\.preventDefault\(\)\}/)
  const action = between('const boardAction = (', 'const pressBoard = ')
  assert.match(action, /boardTap\.current = tap && pressedHere \? \{ \.\.\.tap, acted: fires \} : null/)
  assert.match(action, /boardClickFires\(\{ detail: event\.detail, boardOpen: boardOpenRef\.current, pressedHere, acted: Boolean\(tap\?\.acted\)/)
  assert.match(journey, /data-testid="more-board"[\s\S]{0,400}onClick=\{moreClick\}/)
  assert.match(between('const openBoard = (', 'const moveBoard = '), /morePress\.current = \{ t: performance\.now\(\), acted: false \}/)
  assert.match(between('const openDrawer = () => {', 'closeDrawerRef.current = closeDrawer'), /boardToggledAt\.current = boardOpenedAt\.current[\s\S]*boardToggledAt\.current = boardClosedAt\.current/)
  // The lane end (on a swipe) and auto-advance close the board without arming the ghost guard.
  assert.doesNotMatch(between('const showLaneEnd = (', 'const advance = useCallback('), /boardToggledAt/)
  assert.match(journey, /window\.addEventListener\('touchstart', notePress, \{ capture: true, passive: true \}\)/)
})

// ---------- 3: exactly one gold word per page ----------

const goldCount = (html: string) => (html.match(/class="fr-key"/g) || []).length
const goldWord = (html: string) => html.match(/<span class="fr-key">([^<]*)<\/span>/)?.[1] ?? null

// The two pages from the phone check, as the live feed builds them from the cut's caption lines (no timed track).
const humility = [
  { at: 410.2, text: "Said to him take it easy on yourself meaning I don't take this stuff heavily I don't take it to heart no big deal you also don't don't go overboard it's no big deal take it", tidy: "Said to him take it easy on yourself meaning I don't take this stuff heavily I don't take it to heart no big deal you also don't don't go overboard it's no big deal take it." },
  { at: 419.6, text: 'Easy on yourself he said because I', tidy: 'Easy on yourself he said because I.' },
  { at: 422.7, text: 'Set as one of my objectives in', tidy: 'Set as one of my objectives in.' },
]
const purification = [
  { at: 1166.4, text: "Rather he came and he just sat next to the prophet son he sent in from the process and he put his hands on the props of someone's thighs okay and um", tidy: "Rather he came and he just sat next to the Prophet son he sent in from the process and he put his hands on the props of someone's thighs okay and um." },
  { at: 1176.3, text: "Also narrates that he says we didn't know this guy we didn't know him we didn't know him at all and you know how um he was very protective", tidy: "Also narrates that he says we didn't know this guy we didn't know him we didn't know him at all and you know how um he was very protective." },
]

test('3: the reported pages: the key sat past the 5-line panel (pre-existing), now the page lights its own best word', () => {
  const cases: [typeof humility, number, number, RegExp, string][] = [
    [humility, 410.28, 425.8, /^Said to him take it easy/, 'yourself'],
    [purification, 1166.08, 1186.08, /^Rather he came/, 'Prophet'],
  ]
  for (const [lines, from, to, which, want] of cases) {
    const sentences = sentencesFromCaptions(lines, from, to)
    const page = sentences.find((row) => which.test(row.text))!
    const shown = wrapWordLines(page.words.map((row) => row.w), 20).slice(0, 5).flat()
    // Why it was blank: the sentence's key is its longest word, which is past the panel's cut.
    assert.ok(!shown.some((word) => word.toLowerCase().replace(/[^a-z']/g, '') === String(page.key).toLowerCase()), `${page.key} is not on the page`)
    const html = renderToStaticMarkup(createElement(SpokenWords, { sentences, time: page.s + 0.2, from, to }))
    assert.equal(goldCount(html), 1, page.text)
    assert.equal(goldWord(html), want)
  }
})

test('3: every page of all 138 timed tracks shows exactly one gold word', () => {
  const files = readdirSync(wordsDir).filter((name) => name.endsWith('.json'))
  assert.equal(files.length, 138)
  let pages = 0
  for (const name of files) {
    const track = JSON.parse(readFileSync(path.join(wordsDir, name), 'utf8')) as { start: number; end: number; sentences: FramingSentence[] }
    for (const page of track.sentences) {
      pages += 1
      const html = renderToStaticMarkup(createElement(SpokenWords, { sentences: [page], time: page.s + 0.01 }))
      assert.equal(goldCount(html), 1, `${name} @${page.s}: ${page.text}`)
      // And in place, with the whole track and the clip window, as the feed renders it.
      const live = renderToStaticMarkup(createElement(SpokenWords, { sentences: track.sentences, time: page.s + 0.01, from: track.start, to: track.end }))
      if (!/data-empty="yes"/.test(live)) assert.equal(goldCount(live), 1, `${name} live @${page.s}`)
    }
  }
  assert.ok(pages > 1000)
})

test('3: caption-built pages: one gold word on every page, short or long', () => {
  const lines = [...humility, ...purification.map((row) => ({ ...row, at: row.at - 1166.08 + 426 }))]
  const sentences = sentencesFromCaptions(lines, 410, 450)
  assert.ok(sentences.length >= 5)
  for (const page of sentences) {
    const html = renderToStaticMarkup(createElement(SpokenWords, { sentences: [page], time: page.s + 0.01 }))
    assert.equal(goldCount(html), 1, page.text)
  }
  // Pages where nothing passes the key filter still get one.
  for (const text of ['Is it?', 'No.', 'I am.', 'Why?', 'So we go to it, and he is in it.']) {
    const built = sentencesFromCaptions([{ at: 0, text }], 0, 5)
    const html = renderToStaticMarkup(createElement(SpokenWords, { sentences: built, time: 0.05 }))
    assert.equal(goldCount(html), 1, text)
  }
  assert.equal(pageKeyIndex([], 'x'), -1)
  assert.equal(pageKeyIndex(['So', 'generous,', 'very', 'generous.'], 'generous'), 1, 'first occurrence of the key')
  assert.equal(pageKeyIndex(['Is', 'it?'], null), 0, 'the first of the longest words')
  assert.equal(pickKey([{ w: 'Is', t: 0 }, { w: 'it?', t: 0 }]), null, 'pickKey alone finds nothing here')
})
