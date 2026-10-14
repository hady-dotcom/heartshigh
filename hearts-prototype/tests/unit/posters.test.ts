import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { posterFor, shownPoster, talkStill } from '../../src/server/learner'

const root = path.join(process.cwd())

test('shownPoster keeps YouTube frames and local /clips/ copies', () => {
  assert.equal(shownPoster('https://i.ytimg.com/vi/NIR88RRpat4/hqdefault.jpg'), 'https://i.ytimg.com/vi/NIR88RRpat4/hqdefault.jpg')
  assert.equal(shownPoster('/clips/NIR88RRpat4.jpg'), '/clips/NIR88RRpat4.jpg')
  assert.equal(shownPoster('/theme/evening-courtyard.jpg'), '/theme/evening-courtyard.jpg')
  assert.equal(shownPoster(''), null)
  assert.equal(shownPoster(null), null)
})

test('posterFor only paints a real 11-character YouTube id', () => {
  assert.equal(posterFor('xxTESTFAKEid'), null)
  assert.equal(posterFor('short'), null)
  assert.ok(posterFor('NIR88RRpat4'))
})

test('talkStill falls back to courtyard art when there is no film or speaker still', () => {
  const still = talkStill(null, 'Nobody Here')
  assert.equal(still.fallback, true)
  assert.equal(still.src, '/theme/evening-courtyard.jpg')
})

test('the course garden card uses evening teal and gold, never purple or cream', () => {
  const css = `${readFileSync(path.join(root, 'src/app/(frontend)/app.css'), 'utf8')}\n${readFileSync(path.join(root, 'src/app/(frontend)/garden.css'), 'utf8')}`
  const block = [...css.matchAll(/\.garden-card[^{]*\{[^}]+\}/g)].map((row) => row[0]).join('\n')
  assert.match(block, /#0E2A2B/i)
  assert.match(block, /#D4A84B/i)
  assert.doesNotMatch(block, /#2a2448|#243628|#fff8ee|#F1E4C6/i)
})
