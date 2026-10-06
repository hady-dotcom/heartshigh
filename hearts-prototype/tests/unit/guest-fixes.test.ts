import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { afterClipEnds, horsWindowEnded, keepVisiblePaused, livePictureTap, pictureTapPlan, sheetPollAction, shouldNudgePlay } from '../../src/lib/film-advance'
import { boardItemForPlayer, boardTapTarget } from '../../src/lib/feed-nav'
import { laneEndHref } from '../../src/lib/lanes'

const root = path.join(process.cwd(), 'src')
const journey = readFileSync(path.join(root, 'components/journey/journey.tsx'), 'utf8')
const sheet = readFileSync(path.join(root, 'components/journey/sheet.tsx'), 'utf8')
const portalPage = readFileSync(path.join(root, 'app/(frontend)/p/[slug]/[[...screen]]/page.tsx'), 'utf8')
const between = (from: string, to: string) => {
  const start = journey.indexOf(from)
  const end = journey.indexOf(to, start + from.length)
  assert.ok(start >= 0 && end > start, `${from} … ${to}`)
  return journey.slice(start, end)
}

// ---------- 1: Try another lane, signed out ----------

test('1: a guest at the lane end starts the next lane instead of meeting the login wall', () => {
  const lanes = ['company', 'trust', 'patience']
  const base = '/p/east-london'
  assert.equal(laneEndHref({ base, signedIn: false, current: 'company', lanes }), `${base}/feed?lane=trust`)
  assert.equal(laneEndHref({ base, signedIn: false, current: 'trust', lanes }), `${base}/feed?lane=patience`)
  assert.equal(laneEndHref({ base, signedIn: false, current: 'patience', lanes }), `${base}/feed?lane=company`, 'wraps round')
  assert.equal(laneEndHref({ base, signedIn: false, current: null, lanes }), `${base}/feed?lane=company`, 'the mixed feed hands over to the first lane')
  assert.equal(laneEndHref({ base, signedIn: false, current: 'company', lanes: ['company'] }), `${base}/feed`, 'no other lane: back to the feed')
  assert.equal(laneEndHref({ base, signedIn: false, current: 'company', lanes: [] }), `${base}/feed`)
  for (const current of [...lanes, null]) assert.doesNotMatch(laneEndHref({ base, signedIn: false, current, lanes }), /\/lanes|\/login/)
  assert.equal(laneEndHref({ base, signedIn: true, current: 'company', lanes }), `${base}/lanes`, 'signed in: the Lanes page as before')
})

test('1: the end card button uses that target, and the personal Lanes page stays behind login', () => {
  assert.match(journey, /data-testid="end-lanes" data-href=\{laneEndTarget\} onClick=\{\(\) => \{ window\.location\.assign\(laneEndTarget\) \}\}/)
  assert.match(journey, /const laneEndTarget = laneEndHref\(\{ base, signedIn, current: props\.lane \|\| item\?\.laneKey \|\| null, lanes: laneKeys \}\)/)
  assert.match(journey, /lanesWithClips\(opening\.route, opening\.clips, opening\.laneTitles\)\.map\(\(lane\) => lane\.key\)/)
  assert.doesNotMatch(journey, /assign\(`\$\{base\}\/lanes`\)/)
  assert.match(portalPage, /const OPEN_TO_ALL = new Set\(\['start', 'help', 'feed'\]\)/)
})

// ---------- 2: the sheet holds the clip ----------

test('2: while the sheet is open the poll pauses a running film and holds a paused one', () => {
  assert.equal(sheetPollAction({ sheetOpen: true, state: 1 }), 'pause')
  assert.equal(sheetPollAction({ sheetOpen: true, state: 3 }), 'pause')
  assert.equal(sheetPollAction({ sheetOpen: true, state: 2 }), 'hold')
  assert.equal(sheetPollAction({ sheetOpen: true, state: 5 }), 'hold')
  assert.equal(sheetPollAction({ sheetOpen: false, state: 1 }), 'run')
})

test('2: simulated: Save opens the sheet mid-clip; nothing nudges, nothing advances; closing resumes the same clip', () => {
  const clips = [{ title: 'The Servant Prophet', start: 0, end: 15 }, { title: 'Our Character', start: 0, end: 15 }]
  const film = { index: 0, time: 4, state: 1 as number }
  let sheetOpen = false
  let advanced = 0
  const tick = (elapsedSinceLoad: number) => {
    // The nudge loop and the paused-state nudge: armed only while no sheet is up.
    if (shouldNudgePlay(film.state, !sheetOpen, false, elapsedSinceLoad)) film.state = 1
    const step = sheetPollAction({ sheetOpen, state: film.state })
    if (step === 'pause') film.state = 2
    if (step !== 'run' || film.state !== 1) return
    film.time += 0.25
    const clip = clips[film.index]
    if (horsWindowEnded(film.time, clip.start, clip.end)) {
      const next = afterClipEnds({ nextIndex: film.index + 1 < clips.length ? film.index + 1 : null })
      if (next.kind === 'advance') {
        advanced += 1
        film.index = next.next
        film.time = 0
      }
    }
  }
  // The guest taps Save 4s in: the sheet opens and the film is paused.
  sheetOpen = true
  film.state = 2
  for (let i = 0; i < 400; i += 1) tick(i * 250)
  assert.equal(advanced, 0, 'no auto-advance behind the sheet')
  assert.equal(clips[film.index].title, 'The Servant Prophet')
  assert.equal(film.state, 2)
  assert.equal(film.time, 4, 'the clip did not run on')
  // Closing resumes this clip where it stopped; the advance comes only when it really ends.
  sheetOpen = false
  film.state = 1
  tick(0)
  assert.equal(clips[film.index].title, 'The Servant Prophet')
  assert.ok(film.time > 4)
  for (let i = 0; i < 60; i += 1) tick(99_999)
  assert.equal(advanced, 1)
  assert.equal(clips[film.index].title, 'Our Character')
})

test('2: every path that could restart or advance the film checks the sheet first', () => {
  const runEnd = between('const runEndAdvance = useCallback(', 'runEndAdvanceRef.current = runEndAdvance')
  assert.match(runEnd, /^const runEndAdvance = useCallback\(\(source: EndAdvanceSource, eventKey\?: string \| null\) => \{\n\s+\/\/[^\n]*\n\s+if \(sheetRef\.current \|\| modeRef\.current !== 'hors'\) return/)
  const arm = between('const armPlay = useCallback(', 'const tryPlay = useCallback(')
  assert.match(arm, /const armed = [^\n]*&& !sheetRef\.current\n/)
  const onState = between('const onPlayerState = useCallback(', 'const prepare = useCallback(')
  assert.match(onState, /!userPausedRef\.current && !sheetRef\.current && id && again\.playerId === id/)
  assert.match(onState, /shouldNudgePlay\(state, wantPlayRef\.current === host\.spec\?\.key && Boolean\(host\.playerId\) && !sheetRef\.current,/)
  const poll = between('// Poll while playing', 'const needsAccount = ')
  const hold = poll.indexOf("sheetPollAction({ sheetOpen: Boolean(sheetRef.current), state: realState })")
  assert.ok(hold > 0 && hold < poll.indexOf('if (realState !== STATE.PLAYING || !player) return'), 'the hold runs before the window and end checks')
  assert.ok(hold < poll.indexOf("runEndAdvanceRef.current('window'"))
  const open = between('const openSheet = useCallback(', 'const dismissCoach')
  assert.match(open, /sheetRef\.current = reason\n\s+window\.clearInterval\(playWatch\.current\)\n\s+if \(host\.playerId\) getPlayer\(host\.playerId\)\?\.pauseVideo\(\)/)
  assert.match(journey, /if \(clipEndedRef\.current \|\| sheetRef\.current\) return/)
  const tryPlay = between('const tryPlay = useCallback(', 'const onPlayerState')
  assert.match(tryPlay, /sheetRef\.current\) return/)
  assert.match(between('const closeSheet = (', '// Poll while playing'), /window\.setTimeout\(\(\) => tryPlay\(\), 0\)/)
})

// ---------- 2b: the board stays open across an advance; its taps land on the titled clip ----------

test('2b: Like or Save lands on the clip the board was titled with at the press, not the one after an advance', () => {
  const items = [{ id: 'a', cutId: 7, lessonTitle: 'The Servant Prophet' }, { id: 'b', cutId: 8, lessonTitle: 'Our Character' }]
  // Finger down while the board shows clip 7.
  const shownAtPress = boardItemForPlayer(items, 0, '7:hors')
  // An auto-advance re-titles the board before the finger lifts.
  const shownAtLift = boardItemForPlayer(items, 1, '8:hors')
  assert.equal(shownAtPress?.lessonTitle, 'The Servant Prophet')
  assert.equal(shownAtLift?.lessonTitle, 'Our Character')
  assert.equal(boardTapTarget(shownAtPress, shownAtLift)?.id, 'a')
  // No advance in between: the same clip either way. No press recorded: what the board shows.
  assert.equal(boardTapTarget(shownAtLift, shownAtLift)?.id, 'b')
  assert.equal(boardTapTarget(null, shownAtLift)?.id, 'b')
  // Mid-swap the board follows the visible player, not the index that has already moved.
  assert.equal(boardItemForPlayer(items, 1, '7:hors')?.id, 'a')
})

test('2b: the board buttons record the clip on press and act on it on lift; Follow remounts with the clip', () => {
  assert.match(journey, /data-testid="fave" data-cut=\{item\.cutId\} onPointerDown=\{\(event\) => pressBoard\(event, item\)\} onPointerUp=\{\(event\) => boardAction\(event, \(\) => fave\(boardTapTarget\(boardPress\.current, item\)\)\)\}/)
  assert.match(journey, /data-testid="save" data-cut=\{item\.cutId\} onPointerDown=\{\(event\) => pressBoard\(event, item\)\} onPointerUp=\{\(event\) => boardAction\(event, saveTap\)\}/)
  assert.match(between('const saveTap = () => {', 'const visiblePlayer'), /const target = boardTapTarget\(boardPress\.current, item\)\n\s+if \(target && !needsAccount\('save'\)\) \{[\s\S]*toggleSave\(target\.id\)/)
  const fave = between('const fave = (', 'const share = ')
  assert.match(fave, /toggleFave\(target\.id\)/)
  assert.match(fave, /signal\('fave', tagsOf\(target\)\)/)
  const action = between('const boardAction = (', 'const openBoard = ')
  assert.match(action, /fn\(\)\n\s+boardPress\.current = null/)
  // Follow sits in the speaker row, keyed by the clip: a press that spans an advance lands on a new button and does not click.
  assert.match(journey, /<div className="j-speaker j-speaker-plate" key=\{item\.cutId\}[^>]*>[\s\S]{0,600}<FollowButton slug=\{item\.speakerSlug\} \/>/)
})

// ---------- 3: the first resume tap always works ----------

test('3: a guest with sound off: pause, then ONE tap resumes (it no longer leaves the film paused)', () => {
  const flags = { userPaused: false, pauseWhenReady: false }
  const film = { state: 1 }
  let sound = false
  const tap = () => {
    const plan = pictureTapPlan({ action: livePictureTap({ state: film.state, stalled: false }), hasSound: sound, hasPlayer: true })
    if (plan.pause) {
      flags.userPaused = true
      flags.pauseWhenReady = true
      film.state = 2
      return
    }
    if (plan.clearPause) {
      flags.userPaused = false
      flags.pauseWhenReady = false
    }
    if (plan.soundOn) sound = true
    film.state = 1
  }
  // The 250ms paused-cover loop that keeps a user-paused film paused.
  const coverLoop = () => {
    if (keepVisiblePaused({ userPaused: flags.userPaused, liveState: film.state, wantsPlay: false })) film.state = 2
  }
  tap()
  coverLoop()
  assert.equal(film.state, 2, 'first tap pauses')
  tap()
  for (let i = 0; i < 8; i += 1) coverLoop()
  assert.equal(film.state, 1, 'the second tap resumes and stays playing')
  assert.equal(sound, true, 'and turns sound on')
  assert.equal(flags.userPaused, false)
  // The old path turned sound on but kept userPaused: the loop paused it again.
  assert.equal(keepVisiblePaused({ userPaused: true, liveState: 1, wantsPlay: false }), true)
})

test('3: the tap plan for each state', () => {
  assert.deepEqual(pictureTapPlan({ action: 'pause', hasSound: false, hasPlayer: true }), { pause: true, clearPause: false, soundOn: false, resume: 'none' })
  assert.deepEqual(pictureTapPlan({ action: 'play', hasSound: false, hasPlayer: true }), { pause: false, clearPause: true, soundOn: true, resume: 'direct' })
  assert.deepEqual(pictureTapPlan({ action: 'play', hasSound: true, hasPlayer: true }), { pause: false, clearPause: true, soundOn: false, resume: 'catcher' })
  assert.deepEqual(pictureTapPlan({ action: 'none', hasSound: true, hasPlayer: true }), { pause: false, clearPause: true, soundOn: false, resume: 'direct' })
  assert.deepEqual(pictureTapPlan({ action: 'none', hasSound: true, hasPlayer: false }), { pause: false, clearPause: true, soundOn: false, resume: 'try' })
  for (const state of [2, 5]) assert.equal(livePictureTap({ state, stalled: false }), 'play')
})

test('3: tapPicture clears the pause before it turns sound on', () => {
  const tap = between('const tapPicture = () => {', 'const runPictureTap = () => {')
  const clear = tap.indexOf('if (plan.clearPause) {')
  const sound = tap.indexOf('if (plan.soundOn) {')
  assert.ok(clear > 0 && sound > clear)
  assert.match(tap.slice(clear, sound), /userPausedRef\.current = false/)
  assert.match(tap.slice(clear, sound), /pauseWhenReadyRef\.current = false/)
  assert.doesNotMatch(tap, /if \(!hasSound\(\)\) \{\n\s+tapSound\(\)\n\s+return/)
})

// ---------- 4: the sheet title fits why it opened ----------

test('4: tabs, Me, the speaker page and the full talk ask to keep your place; Save, Like and Follow keep their own title', () => {
  assert.match(sheet, /save: 'Want us to keep that one for you\?'/)
  assert.match(sheet, /place: 'Want us to keep your place\?'/)
  assert.match(sheet, /<h2 id="keep-title" data-testid="keep-title">\{SHEET_TITLES\[reason\]\}<\/h2>/)
  const guard = between('onGuard={(event) => {', '/>')
  assert.match(guard, /needsAccount\('place'\)/)
  assert.doesNotMatch(guard, /needsAccount\('save'\)/)
  assert.match(journey, /data-testid="speaker-link" onClick=\{\(event\) => \{ if \(needsAccount\('place'\)\) event\.preventDefault\(\) \}\}/)
  assert.match(between('const watchFull = () => {', 'const fave = ('), /needsAccount\('place'\)/)
  assert.match(journey, /<span onClickCapture=\{\(event\) => \{ if \(needsAccount\('save'\)\)[^\n]*<FollowButton/)
  assert.match(between('const fave = (', 'const share = '), /needsAccount\('save'\)/)
  assert.match(journey, /data-testid="save"[^\n]*boardAction\(event, saveTap\)/)
  assert.match(between('const saveTap = () => {', 'const visiblePlayer'), /needsAccount\('save'\)/)
})
