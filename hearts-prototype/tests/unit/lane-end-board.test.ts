import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { autoAdvanceClosesBoard, boardClickFires, boardTapFires, endCardShows, ghostClick, laneEndClosesBoard, pointerTravel } from '../../src/lib/board-gestures'
import { afterClipEnds } from '../../src/lib/film-advance'

const journey = readFileSync(path.join(process.cwd(), 'src/components/journey/journey.tsx'), 'utf8')
const between = (from: string, to: string) => {
  const start = journey.indexOf(from)
  const end = journey.indexOf(to, start + from.length)
  assert.ok(start >= 0 && end > start, `${from} … ${to}`)
  return journey.slice(start, end)
}

/**
 * The phone check that failed: quiet lane, last clip (~20 s), board open, Save → Not now, then a Like
 * pressed at ~0:19.9 and lifted after the clip has ended. Events in the order a real tap produces them.
 */
class LastClip {
  now = 1000
  boardOpen = false
  boardMounted = false
  openedAt = 0
  toggledAt = 0
  lastPressAt = 0
  sheet = false
  clipEnded = false
  sheets = 0
  endLanes = 0
  tap: { control: string; x: number; y: number; t: number; acted: boolean } | null = null
  wait(ms: number) { this.now += ms }
  openBoard() { this.boardOpen = true; this.boardMounted = true; this.openedAt = this.now; this.toggledAt = this.now }
  closeBoard() { this.boardOpen = false; this.boardMounted = false; this.toggledAt = this.now; this.tap = null }
  /** runEndAdvance → afterClipEnds → showLaneEnd('auto'). */
  clipEnds() {
    if (this.sheet) return // the sheet holds the clip; nothing ends behind it
    assert.equal(afterClipEnds({ nextIndex: null }).kind, 'lane-end')
    this.clipEnded = true
    if (laneEndClosesBoard('auto') && this.boardOpen) this.closeBoard()
  }
  endCard() { return endCardShows({ clipEnded: this.clipEnded, lastClip: true, boardOpen: this.boardOpen, sheetOpen: this.sheet }) }
  pointerdown(control: string, x = 195, y = 342) {
    this.lastPressAt = this.now
    if (this.boardMounted && !this.sheet) this.tap = { control, x, y, t: this.now, acted: false }
  }
  pointerup(control: string, x = 195, y = 342) {
    // A board that unmounted between press and lift takes the lift with it: the tap is lost.
    if (!this.boardMounted || this.sheet) return
    const tap = this.tap
    const pressedHere = Boolean(tap && tap.control === control)
    const fires = boardTapFires({ pressedHere, pressedAt: tap?.t ?? 0, pressTravel: tap ? pointerTravel(tap, { x, y }) : 0, openedAt: this.openedAt, now: this.now, dragTravel: 0 })
    this.tap = tap && pressedHere ? { ...tap, acted: fires } : null
    if (fires) { this.sheet = true; this.sheets += 1 }
  }
  click(target: string) {
    if (ghostClick({ now: this.now, boardChangedAt: this.toggledAt, lastPressAt: this.lastPressAt, detail: 1 })) return 'swallowed'
    if (target === 'not-now' && this.sheet) { this.sheet = false; return 'closed' }
    if (target === 'end-lanes' && this.endCard()) { this.endLanes += 1; return 'end-lanes' }
    if ((target === 'fave' || target === 'save') && this.boardMounted && !this.sheet) {
      const tap = this.tap
      const pressedHere = Boolean(tap && tap.control === target)
      if (pressedHere) this.tap = null
      if (boardClickFires({ detail: 1, boardOpen: this.boardOpen, pressedHere, acted: Boolean(tap?.acted), pressedAt: tap?.t ?? 0, openedAt: this.openedAt })) { this.sheet = true; this.sheets += 1; return 'acted' }
    }
    return 'none'
  }
}

test('lane end: a Like pressed before the last clip ends and lifted after it still opens the sheet; the board stays open', () => {
  for (const control of ['fave', 'save']) {
    const phone = new LastClip()
    phone.openBoard()
    phone.wait(1200)
    phone.pointerdown('save'); phone.wait(90); phone.pointerup('save'); phone.click('save')
    assert.equal(phone.sheets, 1)
    phone.wait(1500)
    phone.pointerdown('not-now', 195, 689); phone.wait(90); phone.click('not-now')
    phone.wait(2500)
    phone.pointerdown(control)
    phone.wait(40)
    phone.clipEnds() // the clip ends while the finger is down
    phone.wait(50)
    phone.pointerup(control)
    phone.click(control)
    assert.equal(phone.boardOpen, true, `${control}: the lane end does not yank the board shut`)
    assert.equal(phone.sheets, 2, `${control}: the tap is not lost`)
    assert.equal(phone.endCard(), false, 'no end card under the board or the sheet')
    phone.wait(1500)
    phone.pointerdown('not-now', 195, 689); phone.wait(90); phone.click('not-now')
    assert.equal(phone.endCard(), false, 'board still open')
    phone.wait(800)
    phone.pointerdown('board-close', 360, 259); phone.wait(90); phone.closeBoard()
    assert.equal(phone.click('film'), 'swallowed', 'the close tap’s click goes nowhere')
    assert.equal(phone.endCard(), true, 'closing the board shows the end card')
    phone.wait(900)
    phone.pointerdown('end-lanes', 195, 437); phone.wait(90)
    assert.equal(phone.click('end-lanes'), 'end-lanes', 'Try another lane works first tap')
  }
})

test('lane end: a tap on the open board after the clip ended works too', () => {
  const phone = new LastClip()
  phone.openBoard()
  phone.wait(3000)
  phone.clipEnds()
  phone.wait(2000)
  phone.pointerdown('fave'); phone.wait(90); phone.pointerup('fave'); phone.click('fave')
  assert.equal(phone.sheets, 1)
  assert.equal(phone.boardOpen, true)
})

test('lane end: same rule as a mid-lane auto-advance; a swipe past the last clip (board shut) still shows the card', () => {
  assert.equal(laneEndClosesBoard('auto'), autoAdvanceClosesBoard('auto'))
  assert.equal(laneEndClosesBoard('auto'), false)
  assert.equal(laneEndClosesBoard('swipe'), true)
  assert.equal(endCardShows({ clipEnded: true, lastClip: true, boardOpen: false, sheetOpen: false }), true)
  assert.equal(endCardShows({ clipEnded: true, lastClip: true, boardOpen: true, sheetOpen: false }), false)
  assert.equal(endCardShows({ clipEnded: true, lastClip: true, boardOpen: false, sheetOpen: true }), false)
  assert.equal(endCardShows({ clipEnded: false, lastClip: true, boardOpen: false, sheetOpen: false }), false)
  assert.equal(endCardShows({ clipEnded: true, lastClip: false, boardOpen: false, sheetOpen: false }), false)
})

test('wiring: the clip end and the error skip call showLaneEnd(\'auto\'); only a swipe may shut the board there; the card waits for board and sheet', () => {
  const show = between('const showLaneEnd = (', 'const advance = useCallback(')
  assert.match(show, /if \(laneEndClosesBoard\(how\) && boardOpenRef\.current\) \{[\s\S]{0,160}setBoardOpen\(false\)/)
  assert.doesNotMatch(show.replace(/if \(laneEndClosesBoard[\s\S]*?\n {4}\}/, ''), /setBoardOpen\(false\)/, 'no unconditional close')
  assert.match(between('const runEndAdvance = useCallback(', 'runEndAdvanceRef.current = runEndAdvance'), /if \(step\.kind === 'lane-end'\) \{\s*showLaneEnd\('auto'\)/)
  assert.match(journey, /showLaneEndNow\(\{ thisClipEnded: true, nextIndex: next \}\)\) \{\s*showLaneEnd\('auto'\)/)
  assert.match(journey, /swipe === 'next'\) \{\s*showLaneEnd\(\)/)
  assert.match(journey, /endCardShows\(\{ clipEnded, lastClip: nextClipAt == null, boardOpen, sheetOpen: Boolean\(sheet\) \}\) \? \(\s*<div className="end-card" data-testid="feed-end">/)
  // Mid-lane auto-advance keeps the board open the same way.
  assert.match(journey, /keepBoardOnShow\.current = !autoAdvanceClosesBoard\(how\)/)
})
