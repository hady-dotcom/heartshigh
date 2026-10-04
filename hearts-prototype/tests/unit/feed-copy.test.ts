import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clipStepUpLabel, forbiddenLearnerWords, poolEndToast, READY_FOR_MORE, talkStepUpLabel, withTalkDetail } from '../../src/lib/feed-copy'

test('level buttons use one set of words, with minutes rounded up', () => {
  assert.equal(clipStepUpLabel(), 'Watch the 3-minute version')
  assert.equal(READY_FOR_MORE, 'Ready for more?')
  assert.equal(talkStepUpLabel(1, 58 * 60), 'Watch the whole talk (58 min)')
  assert.equal(talkStepUpLabel(1, 58 * 60 + 1), 'Watch the whole talk (59 min)')
  assert.equal(talkStepUpLabel(6, 3600), 'See the whole course (6 talks)')
  assert.equal(withTalkDetail('Sit with the Friday talk ›', 1, 12 * 60), 'Sit with the Friday talk (12 min) ›')
  assert.equal(withTalkDetail('Sit with the Friday talk ›', 5), 'Sit with the Friday talk (5 talks) ›')
  assert.equal(withTalkDetail('Watch the whole talk', 1, 12 * 60), 'Watch the whole talk (12 min)')
  for (const line of [clipStepUpLabel(), READY_FOR_MORE, talkStepUpLabel(1, 120), talkStepUpLabel(3)]) {
    assert.equal(forbiddenLearnerWords(line), false, line)
  }
  assert.equal(forbiddenLearnerWords('Learn more'), true)
  assert.equal(forbiddenLearnerWords('Extended cut'), true)
  assert.equal(forbiddenLearnerWords("hors d'oeuvre"), true)
  assert.equal(forbiddenLearnerWords('Appetiser'), true)
  assert.equal(poolEndToast(), "You've seen everything here, try another lane.")
  assert.equal(forbiddenLearnerWords(poolEndToast()), false)
})
