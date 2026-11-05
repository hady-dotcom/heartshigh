import assert from 'node:assert/strict'
import { test } from 'node:test'
import { firstSpoken, guestDescription, knownSeconds, vimeoPlayerEvent } from './guest-film'

test('a guest blurb uses the first spoken sentence, then the course line', () => {
  const vtt = 'WEBVTT\n\nNOTE English captions, repeats removed.\n\n00:00:00.400 --> 00:00:03.420\nWelcome to this film. More words follow.'
  assert.equal(firstSpoken(vtt), 'Welcome to this film.')
  assert.equal(guestDescription({ transcript: vtt, summary: 'Watch the films in order.', place: 1, count: 107, courseTitle: 'Guiding Home Learning' }), 'Welcome to this film.')
  assert.equal(guestDescription({ transcript: '', summary: 'Watch the films in order.', place: 1, count: 107, courseTitle: 'Guiding Home Learning' }), 'Watch the films in order.')
  assert.equal(guestDescription({ transcript: '', summary: '', place: 1, count: 107, courseTitle: 'Guiding Home Learning' }), 'Film 1 of 107 in Guiding Home Learning.')
})

test('a length under five seconds stays unknown', () => {
  assert.equal(knownSeconds(0), null)
  assert.equal(knownSeconds(4), null)
  assert.equal(knownSeconds(5), 5)
  assert.equal(knownSeconds(12.2), 12)
  assert.equal(knownSeconds('no'), null)
})

test('a play message is not the end of the film', () => {
  assert.equal(vimeoPlayerEvent('{"event":"play"}'), 'play')
  assert.equal(vimeoPlayerEvent({ event: 'ended' }), 'ended')
  assert.equal(vimeoPlayerEvent('not json'), '')
  assert.equal(vimeoPlayerEvent({ method: 'ready' }), '')
})
