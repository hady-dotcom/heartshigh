import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanQuote, quoteNeedsClean } from './quote-clean'

test('capitalises Allah, I and the Prophet ﷺ, and finishes the sentence', () => {
  assert.equal(cleanQuote('allah sees the heart when i turn'), 'Allah sees the heart when I turn.')
  assert.equal(cleanQuote('the prophet said be gentle'), 'The Prophet ﷺ said be gentle.')
  assert.equal(cleanQuote('How did allah speak to the prophet'), 'How did Allah speak to the Prophet ﷺ?')
})

test('keeps single quotes and puts the stop inside them', () => {
  assert.equal(cleanQuote('"be mindful of allah"'), "'Be mindful of Allah.'")
  assert.equal(cleanQuote('already clean.'), 'Already clean.')
  assert.equal(quoteNeedsClean('allah'), true)
  assert.equal(quoteNeedsClean('Allah.'), false)
})
