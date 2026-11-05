import assert from 'node:assert/strict'
import { test } from 'node:test'
import { offerJoinedNotice, offerOnCodeNotice } from '../../src/lib/course-offer'

test('a course on a code tells the desk who can open it', () => {
  const plain = offerOnCodeNotice({ course: 'Night class', code: 'ELM-LEARN', copied: false, given: 0, live: 0 })
  assert.match(plain, /Night class is on ELM-LEARN/)
  assert.match(plain, /join with that code/)
  assert.equal(plain.includes('library set'), false)
  const copied = offerOnCodeNotice({ course: 'Night class', code: 'ELM-LEARN', copied: true, given: 2, live: 1 })
  assert.match(copied, /own set with this course added/)
  assert.match(copied, /2 people who have already joined/)
  assert.match(copied, /1 already read the set live/)
})

test('giving a course to people who joined does not pretend a new person has it', () => {
  assert.match(offerJoinedNotice(0), /Nobody has joined yet/)
  assert.match(offerJoinedNotice(1), /1 person who has already joined/)
  assert.match(offerJoinedNotice(1), /still needs it on a code/)
  assert.match(offerJoinedNotice(3), /3 people who have already joined/)
})
