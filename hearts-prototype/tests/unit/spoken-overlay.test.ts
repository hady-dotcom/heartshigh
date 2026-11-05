import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = path.join(process.cwd(), 'src')

test('talk overlays never fall back to a title or an untimed quote', () => {
  const journey = readFileSync(path.join(root, 'components/journey/journey.tsx'), 'utf8')
  const feed = readFileSync(path.join(root, 'components/app/feed.tsx'), 'utf8')
  const helper = readFileSync(path.join(root, 'lib/spoken-caption.ts'), 'utf8')
  assert.match(journey, /feedFilmCaption\(/)
  assert.match(helper, /export function spokenCaption/)
  assert.match(helper, /spokenCaption\(/)
  assert.match(helper, /export function feedFilmCaption/)
  assert.doesNotMatch(journey, /captionText\s*\|\|\s*item\?\.(lessonTitle|courseTitle)/)
  assert.doesNotMatch(journey, /horsLine\s*\|\|\s*item\?\.(lessonTitle|courseTitle|quote)/)
  assert.doesNotMatch(journey, /j-poster-title/)
  assert.doesNotMatch(journey, /EXTENDED CUT|Extended cut/)
  assert.doesNotMatch(feed, /piece\.quote/)
  assert.doesNotMatch(feed, /lines\?\.\[0\]\?\.tidy \|\| piece\.quote/)
})
