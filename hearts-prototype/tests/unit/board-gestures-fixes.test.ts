import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { BOARD_ARM_MS, BOARD_TAP_SLOP_PX, boardShouldClose, boardTapFires, boardTapNote, coachTapAction, feedGestureCounts, pictureTapIgnored } from '../../src/lib/board-gestures'
import { pictureIsTap, verticalSwipe } from '../../src/lib/film-advance'
import { freshSheetHistory, sheetClosed, sheetOpened, sheetPopped, sheetUrl } from '../../src/lib/sheet-history'

const root = path.join(process.cwd(), 'src')
const journey = readFileSync(path.join(root, 'components/journey/journey.tsx'), 'utf8')
const css = readFileSync(path.join(root, 'app/(frontend)/journey.css'), 'utf8')
const between = (from: string, to: string) => {
  const start = journey.indexOf(from)
  const end = journey.indexOf(to, start + from.length)
  assert.ok(start >= 0 && end > start, `${from} … ${to}`)
  return journey.slice(start, end)
}

// ---------- A: the help card ----------

test('A: a tap on the help card only hides it; the film never sees it', () => {
  assert.equal(coachTapAction({ onCard: true }), 'dismiss-only')
  assert.equal(coachTapAction({ onCard: pictureIsTap(3, 4) }), 'dismiss-only')
  assert.equal(coachTapAction({ onCard: pictureIsTap(0, 140) }), 'film', 'a real swipe on the card still moves the feed')
  // The card catches its own pointer: it is no longer click-through to the film catcher.
  assert.match(css, /\.j-coach-card \{\s*pointer-events: auto;\s*touch-action: none;/)
  const card = between('data-testid="coach-card"', '<h2>How to move around</h2>')
  assert.match(card, /onPointerDown=\{\(event\) => \{ event\.stopPropagation\(\); event\.preventDefault\(\); onDown\(event\) \}\}/)
  assert.match(card, /onPointerUp=\{\(event\) => \{\n\s+event\.stopPropagation\(\)\n\s+event\.preventDefault\(\)/)
  // Dismissing also swallows any leftover picture tap, and a tap clears the gesture instead of running runPictureTap.
  assert.match(card, /swallowPicture\(\)\n\s+dismissCoach\(\)/)
  assert.match(card, /'dismiss-only' \|\| !start\) \{[\s\S]{0,200}gesture\.current = null/)
  assert.doesNotMatch(card, /runPictureTap/)
  assert.doesNotMatch(journey, /data-testid="swipe-coach" onClick=\{dismissCoach\}/)
})

// ---------- B: the first tap on a board button ----------

test('B: a press that began on the button after the board opened always fires, with no arm wait', () => {
  const openedAt = 1000
  // 50ms after the board opened, a fresh press on Like: the old 300ms arm rejected this.
  assert.equal(boardTapFires({ pressedHere: true, pressedAt: 1050, pressTravel: 0, openedAt, now: 1120, dragTravel: 0 }), true)
  assert.ok(1120 - openedAt < BOARD_ARM_MS)
  // A stale drag elsewhere on the board no longer blocks it.
  assert.equal(boardTapFires({ pressedHere: true, pressedAt: 5000, pressTravel: 3, openedAt, now: 5100, dragTravel: 200 }), true)
  // A little finger wobble on the button is still a tap; a real drag across it is not.
  assert.equal(boardTapFires({ pressedHere: true, pressedAt: 5000, pressTravel: 14, openedAt, now: 5100, dragTravel: 0 }), true)
  assert.equal(boardTapFires({ pressedHere: true, pressedAt: 5000, pressTravel: BOARD_TAP_SLOP_PX, openedAt, now: 5100, dragTravel: 0 }), false)
  // The tap that opened the board (pressed before it existed) still cannot fire a control.
  assert.equal(boardTapFires({ pressedHere: true, pressedAt: 990, pressTravel: 0, openedAt, now: 1100, dragTravel: 0 }), false)
  assert.equal(boardTapFires({ pressedHere: false, pressedAt: 0, pressTravel: 0, openedAt, now: 1100, dragTravel: 0 }), false)
  assert.equal(boardTapFires({ pressedHere: false, pressedAt: 0, pressTravel: 0, openedAt, now: 1400, dragTravel: 0 }), true)
})

test('B: board controls record the press in the capture phase and are not pan targets', () => {
  assert.match(journey, /onPointerDownCapture=\{\(event\) => \{\n\s+const control = \(event\.target as HTMLElement\)\.closest\('button, a, \[role="button"\]'\)\n\s+boardTap\.current = \{ control, x: event\.clientX, y: event\.clientY, t: performance\.now\(\), acted: false \}/)
  const action = between('const boardAction = (', 'const pressBoard = ')
  assert.match(action, /const pressedHere = Boolean\(tap && control && tap\.control === control\)/)
  assert.match(action, /boardTapFires\(\{/)
  assert.doesNotMatch(action, /boardClickAllowed/)
  assert.match(css, /\.j-board button,\n\.j-board a,\n\.j-board \[role='button'\] \{ touch-action: none; \}/)
})

test('B: simulated: Like during the sheet exit animation opens a sheet that stays open', () => {
  // The headless repro: Like opens the sheet, Not now starts its 250ms exit, Like again at 150ms.
  let h = freshSheetHistory()
  let onEntry = false
  let depth = 0
  const depthNow = () => depth
  let shown = false
  const open = () => {
    const step = sheetOpened(h, onEntry)
    h = step.next
    if (step.history === 'push') depth += 1
    onEntry = true
    shown = true
    return h.gen
  }
  const close = (gen: number | null) => {
    const step = sheetClosed(h, gen, onEntry)
    if (!step.applies) return
    h = step.next
    shown = false
    if (step.back) {
      depth -= 1
      onEntry = false
      pop()
    }
  }
  const pop = () => {
    const step = sheetPopped(h)
    h = step.next
    if (step.closeSheet) shown = false
  }
  const first = open()
  // Not now: the exit animation runs; meanwhile Like opens a new sheet on the same entry.
  const second = open()
  assert.notEqual(first, second)
  assert.equal(depthNow(), 1, 'the second sheet reuses the entry, no extra push')
  // The first sheet's animation ends and calls its close: it belongs to an older sheet and is ignored.
  close(first)
  assert.equal(shown, true, 'the sheet the guest just asked for stays open')
  assert.equal(depthNow(), 1)
  // Closing the open one steps back exactly once; the pop is ours and is consumed.
  close(second)
  assert.equal(shown, false)
  assert.equal(depthNow(), 0)
  assert.equal(h.ownBacks, 0)
  // The browser Back button with a sheet open still closes it.
  open()
  onEntry = false
  depth -= 1
  pop()
  assert.equal(shown, false)
})

test('B: the sheet keeps its own instance, close and history entry', () => {
  assert.match(journey, /<KeepPlaceSheet key=\{sheetKey\} reason=\{sheet\}[^\n]*onClose=\{\(\) => closeSheet\(sheetKey\)\}/)
  const open = between('const openSheet = useCallback(', 'const dismissCoach')
  assert.match(open, /sheetOpened\(sheetHistory\.current, Boolean\(window\.history\.state\?\.hearts\?\.sheet\)\)/)
  assert.match(open, /window\.history\.replaceState\(\{ \.\.\.window\.history\.state, hearts: \{ sheet: true \} \}, '', here\)/)
  assert.match(open, /else push\(here, \{ sheet: true \}\)/)
  const pop = between('const onPop = () => {', 'const feedNow')
  assert.match(pop, /sheetPopped\(sheetHistory\.current\)/)
  assert.match(pop, /if \(popped\.consumed\) return/)
  assert.match(between('setSignedIn(true)', "setToast('Your place is kept.')"), /leaveSheet\(null\)/)
})

test('B: a Like that lands on the clip shown at the press says so after an auto-advance', () => {
  assert.equal(boardTapNote({ action: 'like', wasOn: false, title: 'The Servant Prophet', landedOnShown: false }), 'Liked The Servant Prophet')
  assert.equal(boardTapNote({ action: 'save', wasOn: false, title: 'The Servant Prophet', landedOnShown: false }), 'Saved The Servant Prophet')
  assert.equal(boardTapNote({ action: 'save', wasOn: true, title: 'X', landedOnShown: false }), 'Removed X from Saved')
  assert.equal(boardTapNote({ action: 'like', wasOn: false, title: 'X', landedOnShown: true }), null, 'no note when the board still shows that clip')
  assert.match(between('const fave = (', 'const share = '), /boardTapNote\(\{ action: 'like', wasOn, title: [^\n]*landedOnShown: target\.id === item\?\.id \}\)/)
  assert.match(between('const saveTap = () => {', 'const visiblePlayer'), /boardTapNote\(\{ action: 'save'/)
  assert.match(journey, /data-testid="save"[^\n]*onPointerUp=\{\(event\) => boardAction\(event, saveTap\)\} onClick=\{\(event\) => boardClick\(event, saveTap\)\}/)
})

// ---------- URL ----------

test('URL: the sheet keeps the exact address, query and hash included', () => {
  assert.equal(sheetUrl({ pathname: '/p/east-london/feed', search: '?lane=quiet&tester=x1', hash: '#a' }), '/p/east-london/feed?lane=quiet&tester=x1#a')
  assert.doesNotMatch(journey, /push\(window\.location\.pathname, \{ sheet: true \}\)/)
  assert.match(between('const openSheet = useCallback(', 'const dismissCoach'), /const here = sheetUrl\(window\.location\)/)
})

// ---------- C: closing the board never changes lane or clip ----------

test('C: simulated: two drag-closes on the handle never switch lane, even with a gesture left over', () => {
  let lane = 'quiet'
  let boardOpen = false
  let boardClosedAt = 0
  let gesture: { t: number; y: number; pointerId: number } | null = null
  let now = 0
  const feedUp = (y: number, pointerId: number) => {
    const start = gesture
    gesture = null
    if (!start) return
    if (!feedGestureCounts({ startedAt: start.t, boardOpen, boardClosedAt, pointerId: start.pointerId, upPointerId: pointerId })) return
    const dy = y - start.y
    if (!pictureIsTap(0, dy) && verticalSwipe(dy) === 'lane') lane = lane === 'quiet' ? 'talking' : 'trust'
  }
  for (let cycle = 0; cycle < 2; cycle += 1) {
    // A feed press is still in flight when More opens (the old path left it behind).
    now += 100
    gesture = { t: now, y: 300, pointerId: 7 }
    now += 50
    boardOpen = true
    now += 800
    // Drag the handle down 160px: the board closes on the lift.
    assert.equal(boardShouldClose(160, 0.4), true)
    boardOpen = false
    boardClosedAt = now
    // The same finger's lift, or a stray up, reaches the feed after the board went away.
    feedUp(460, 7)
    feedUp(460, 9)
  }
  assert.equal(lane, 'quiet')
  // A fresh swipe down after the board closed still switches lane as before.
  now += 300
  gesture = { t: now, y: 300, pointerId: 11 }
  feedUp(460, 11)
  assert.equal(lane, 'talking')
})

test('C: the feed gesture rule', () => {
  assert.equal(feedGestureCounts({ startedAt: 10, boardOpen: true, boardClosedAt: 0 }), false)
  assert.equal(feedGestureCounts({ startedAt: 10, boardOpen: false, boardClosedAt: 20 }), false)
  assert.equal(feedGestureCounts({ startedAt: 30, boardOpen: false, boardClosedAt: 20 }), true)
  assert.equal(feedGestureCounts({ startedAt: 30, boardOpen: false, boardClosedAt: 20, pointerId: 1, upPointerId: 2 }), false)
  assert.equal(pictureTapIgnored({ boardOpen: false, swallowUntil: 500, now: 400 }), true)
})

test('C: every feed gesture path checks the rule, and opening or closing the board drops a gesture in flight', () => {
  const up = between('const onUp = (event: ReactPointerEvent) => {', 'const onCancel = ')
  assert.match(up, /feedGestureCounts\(\{ startedAt: start\.t, boardOpen: boardOpenRef\.current, boardClosedAt: boardClosedAt\.current, pointerId: start\.pointerId, upPointerId: event\.pointerId \}\)/)
  assert.ok(up.indexOf('feedGestureCounts') < up.indexOf('nextLane()'))
  assert.match(between('const onCancel = ', 'const springBack = '), /feedGestureCounts\(/)
  assert.match(between('const onDown = (event: ReactPointerEvent) => {', 'const onMove = '), /if \(boardOpen \|\| boardOpenRef\.current\) return/)
  const iframeUp = between('const onPointerUp = (event: PointerEvent) => {', 'const onPointerCancel = ')
  assert.ok(iframeUp.indexOf('feedGestureCounts') >= 0 && iframeUp.indexOf('feedGestureCounts') < iframeUp.indexOf('nextLaneRef.current()'))
  const drawer = between('const dropFeedGesture = () => {', 'closeDrawerRef.current = closeDrawer')
  assert.match(drawer, /const openDrawer = \(\) => \{[\s\S]*?dropFeedGesture\(\)/)
  assert.match(drawer, /const closeDrawer = [\s\S]*boardClosedAt\.current = performance\.now\(\)[\s\S]*dropFeedGesture\(\)/)
})

test('C: a close button on the board, and Escape closes it', () => {
  const grab = between('data-testid="board-grab"', '{laneVisible ?')
  assert.match(grab, /<button\n\s+type="button"\n\s+className="j-board-close"\n\s+data-testid="board-close"\n\s+aria-label="Close"/)
  assert.match(grab, /onPointerDown=\{\(event\) => \{ event\.stopPropagation\(\) \}\}/)
  assert.match(grab, /onPointerUp=\{\(event\) => \{ event\.stopPropagation\(\); event\.preventDefault\(\); closeDrawer\(event\) \}\}/)
  assert.match(grab, /⌄/)
  assert.match(css, /\.j-board-close \{[\s\S]*?width: 36px;[\s\S]*?touch-action: none;/)
  assert.match(css, /\.j-board-grab \{\n\s+position: relative;/)
  const key = between('const onKey = (event: KeyboardEvent) => {', 'const onWheel')
  assert.match(key, /if \(event\.key === 'Escape' && boardOpenRef\.current && !sheetRef\.current\) \{\n\s+event\.preventDefault\(\)\n\s+closeDrawerRef\.current\(\)/)
})
