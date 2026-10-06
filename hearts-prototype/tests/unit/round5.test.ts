import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { maybeWidenPlaylist, sessionPlaylist } from '../../src/lib/feed-mix'
import { seedTracksWithWords } from '../../src/lib/framing/store'
import { withCurrentQuery } from '../../src/lib/keep-query'
import { takeDedicatedLane } from '../../src/lib/lanes'
import { learnerEmbedSrc, PLAYER_HOST } from '../../src/lib/yt'
import type { FeedItem } from '../../src/server/learner'

const root = path.join(process.cwd(), 'src')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

test('A: the cover hold is 4.5s, restarts on buffer, and fades in 250ms', () => {
  const cover = readFileSync(path.join(process.cwd(), 'src/lib/yt-cover.ts'), 'utf8')
  const journeyCss = readFileSync(path.join(process.cwd(), 'src/app/(frontend)/journey.css'), 'utf8')
  const appCss = readFileSync(path.join(process.cwd(), 'src/app/(frontend)/app.css'), 'utf8')
  assert.match(cover, /YT_CHROME_HOLD_MS = 4500/)
  assert.match(cover, /YT_COVER_FADE_MS = 250/)
  assert.match(cover, /coverHoldShouldRestart/)
  assert.match(journeyCss, /transition: opacity 250ms ease/)
  assert.doesNotMatch(appCss, /height: 131\.6%/)
  assert.doesNotMatch(appCss, /top: -18\.4%/)
  assert.match(appCss, /aspect-ratio: 16 \/ 9/)
  assert.match(appCss, /object-fit: contain/)
})

test('B: no src/ file builds a YouTube embed or new YT.Player outside the helper', () => {
  assert.match(learnerEmbedSrc('jNQXAC9IVRw'), /^https:\/\/www\.youtube\.com\/embed\/jNQXAC9IVRw\?/)
  assert.equal(PLAYER_HOST, 'https://www.youtube.com')
  const helper = path.join(process.cwd(), 'src/lib/yt.ts')
  for (const file of walk(root)) {
    if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue
    const src = readFileSync(file, 'utf8')
    if (file === helper) {
      assert.doesNotMatch(src, /youtube-nocookie\.com/)
      continue
    }
    assert.doesNotMatch(src, /youtube-nocookie\.com\/embed/, file)
    assert.doesNotMatch(src, /https:\/\/www\.youtube\.com\/embed\//, file)
    assert.doesNotMatch(src, /new YT\.Player/, file)
  }
})

test('C: course cover sits above the iframe, one player, sticky band, schedule centred, debug kept', () => {
  const player = readFileSync(path.join(process.cwd(), 'src/components/app/course-player.tsx'), 'utf8')
  const course = readFileSync(path.join(process.cwd(), 'src/screens/app/course.tsx'), 'utf8')
  const css = readFileSync(path.join(process.cwd(), 'src/app/(frontend)/app.css'), 'utf8')
  assert.match(player, /PLAYER_ID = 'lesson'/)
  assert.match(player, /destroyPlayer\(PLAYER_ID\)/)
  assert.match(player, /poster\.is-clear|is-clear/)
  assert.match(player, /setYtState/)
  assert.match(player, /playerReadout/)
  assert.match(player, /coverHoldStep/)
  assert.match(player, /setInterval\(apply, 250\)/)
  assert.match(css, /\.app\[data-testid="course"\] \.course-film \{[\s\S]*position: sticky/)
  assert.match(css, /\.course-film-band \.poster[\s\S]*z-index: 5/)
  assert.match(css, /\[data-testid="schedule-this"\][\s\S]*display: flex/)
  assert.match(css, /\[data-testid="schedule-this"\][\s\S]*justify-content: center/)
  assert.match(course, /withCurrentQuery/)
  assert.match(course, /data-testid="start-part"/)
})

test('D: a swipe closes the board; auto-advance keeps it open', () => {
  const journey = readFileSync(path.join(process.cwd(), 'src/components/journey/journey.tsx'), 'utf8')
  assert.match(journey, /ignorePictureUntil/)
  assert.match(journey, /autoAdvanceClosesBoard/)
  assert.match(journey, /keepBoardOnShow/)
  assert.match(journey, /userPausedRef\.current = false/)
  assert.match(journey, /\{\.\.\.swipe\}/)
})

test('E: the board is keyed by the visible player spec', () => {
  const journey = readFileSync(path.join(process.cwd(), 'src/components/journey/journey.tsx'), 'utf8')
  assert.match(journey, /boardItemForPlayer\(items, index, hosts\.current\[visibleHost\]\.spec\?\.key\)/)
  const own = [{ cutId: 1 }, { cutId: 2 }, { cutId: 3 }] as FeedItem[]
  const mixed = [{ cutId: 9 }, { cutId: 1 }, { cutId: 2 }] as FeedItem[]
  assert.deepEqual(takeDedicatedLane('company', own, mixed).map((row) => row.cutId), [1, 2, 3])
  assert.deepEqual(maybeWidenPlaylist(own, mixed, 0, null, true).map((row) => row.cutId), [1, 2, 3])
  assert.ok(sessionPlaylist(mixed, own, 0, null).length >= mixed.length)
  assert.match(journey, /takeDedicatedLane/)
  assert.doesNotMatch(journey, /props\.lane \? clips : sessionPlaylist/)
})

test('F: seed clips with timed words are the framing tracks that ship sentences', () => {
  const tracks = seedTracksWithWords()
  assert.deepEqual(
    tracks.map((row) => `${row.youtubeId} ${row.start}-${row.end}`),
    ['45XUrfJS68Q 307.25-332', '9gwe-HMwZv0 1005.2-1028.9', '9k7QxXtCzaQ 38-65', 'TLCGBj4AlB0 2751-2778'],
  )
  assert.ok(tracks.every((row) => row.sentences > 0))
})

test('G: Answer question 1 and Course garden do not wait on data-theme for their type', () => {
  const css = readFileSync(path.join(process.cwd(), 'src/app/(frontend)/app.css'), 'utf8')
  const layout = readFileSync(path.join(process.cwd(), 'src/app/(frontend)/layout.tsx'), 'utf8')
  assert.match(css, /\.eyebrow \{[^}]*text-transform: none/)
  assert.match(css, /\.answer-btn \{[^}]*background: var\(--gold\)/)
  assert.match(layout, /data-theme="evening"/)
})

test('course and feed links keep ?debug=yt', () => {
  assert.equal(withCurrentQuery('/p/demo/course/24?part=9', 'debug=yt'), '/p/demo/course/24?part=9&debug=yt')
  assert.equal(withCurrentQuery('/p/demo/course/24?part=11', { part: '9', debug: 'yt' }), '/p/demo/course/24?part=11&debug=yt')
  assert.equal(withCurrentQuery('/p/demo/lanes', '?debug=yt&clip=4'), '/p/demo/lanes?debug=yt&clip=4')
})
