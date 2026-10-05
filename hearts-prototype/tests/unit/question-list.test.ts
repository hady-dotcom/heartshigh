import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { comingQuestionLabel, filmClock, questionRowRevealed } from '../../src/lib/question-list'

test('a hidden row names the question and the time on its dot, never the prompt', () => {
  assert.equal(filmClock(760), '12:40')
  assert.equal(comingQuestionLabel(2, 760), 'Question 2 comes at 12:40')
  assert.equal(comingQuestionLabel(1, 30), 'Question 1 comes at 0:30')
})

test('a row stays hidden until the film reaches it, then stays revealed', () => {
  assert.equal(questionRowRevealed({ id: 2, second: 90, time: 0, revealedIds: [] }), false)
  assert.equal(questionRowRevealed({ id: 2, second: 90, time: 90, revealedIds: [] }), true)
  assert.equal(questionRowRevealed({ id: 2, second: 90, time: 0, revealedIds: [2] }), true)
  assert.equal(questionRowRevealed({ id: 2, second: 90, time: 0, revealedIds: [], answered: true }), true)
})

test('the evening answer sheet is a solid card, not glass', () => {
  const root = path.join(process.cwd(), 'src/app/(frontend)')
  const app = readFileSync(path.join(root, 'app.css'), 'utf8')
  const theme = readFileSync(path.join(root, 'theme.css'), 'utf8')
  assert.match(app, /\.sheet\[data-testid="popup"\][\s\S]*?background:\s*#0F2E2C/)
  assert.match(app, /@keyframes sheetUp \{ from \{ transform: translate\(-50%, 40px\); \} to \{ transform: translate\(-50%, 0\); \} \}/)
  assert.doesNotMatch(theme, /html\[data-theme='evening'\] \.sheet,\s*html\[data-theme='evening'\] \.j-sheet \{\s*background: rgba/)
})
