import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dismissGuestOffer, GUEST_DEVICE_KEY, guestOfferDismissed, readGuestDevice, rememberGuestAnswer, rememberGuestName, rememberGuestProgress, rememberGuestWeekdays } from './guest-device'

const memory = new Map<string, string>()

test('progress, a note and the week stay on the device', () => {
  const box = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value) },
    removeItem: (key: string) => { memory.delete(key) },
  }
  Object.defineProperty(globalThis, 'window', { value: { localStorage: box }, configurable: true })
  memory.clear()
  assert.equal(readGuestDevice().progress.length, 0)
  rememberGuestProgress({ lessonId: 4, courseId: 2, courseTitle: 'Guiding Home Learning', title: 'How to use this course', place: 1, seconds: 90, done: false })
  rememberGuestAnswer({ lessonId: 4, title: 'How to use this course', body: 'We watch in the evening' })
  rememberGuestName('Leon')
  rememberGuestWeekdays([1, 3, 1])
  const saved = readGuestDevice()
  assert.equal(saved.progress[0]?.title, 'How to use this course')
  assert.equal(saved.answers[0]?.body, 'We watch in the evening')
  assert.equal(saved.name, 'Leon')
  assert.deepEqual(saved.weekdays, [1, 3])
  assert.equal(guestOfferDismissed(), false)
  dismissGuestOffer()
  assert.equal(guestOfferDismissed(), true)
  assert.equal(memory.has(GUEST_DEVICE_KEY), true)
  rememberGuestAnswer({ lessonId: 4, title: 'How to use this course', body: '   ' })
  assert.equal(readGuestDevice().answers.length, 0)
})
