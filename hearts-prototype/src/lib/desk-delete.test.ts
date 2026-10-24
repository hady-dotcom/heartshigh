import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BULK_DELETE_LIMIT,
  codesStillJoin,
  confirmRefusal,
  KINDS,
  courseRemovedFromDesk,
  deleteRefusal,
  detachCourse,
  detachPack,
  roleMayDelete,
  undoSentence,
} from './desk-delete'

test('a portal admin cannot delete another portal’s course, or a library original', () => {
  const admin = { role: 'portal-admin', portalId: 2 }
  assert.equal(deleteRefusal(admin, 'course', { portalId: 9, origin: 'local' }), 'That is in another portal.')
  assert.match(deleteRefusal(admin, 'course', { portalId: 2, origin: 'master' }) || '', /library/)
  assert.equal(deleteRefusal(admin, 'course', { portalId: 2, origin: 'local' }), null)
  assert.equal(deleteRefusal({ role: 'teacher', portalId: 2 }, 'course', { portalId: 2, origin: 'local' }), 'Only a portal admin can delete that.')
  assert.equal(deleteRefusal({ role: 'teacher', portalId: 2 }, 'gathering', { portalId: 2 }), null)
  assert.equal(deleteRefusal(admin, 'portal', { portalId: 2 }), 'Only the master desk can delete that.')
  assert.equal(deleteRefusal({ role: 'master', portalId: null }, 'course', { portalId: 9, origin: 'local' }), null)
  assert.equal(roleMayDelete('teacher', 'announcement'), true)
  assert.equal(roleMayDelete('teacher', 'code'), false)
})

test('deleting a course leaves every join code, with the same packs', () => {
  const packs = [
    { id: 1, courses: [10, 11] },
    { id: 2, courses: [12] },
  ]
  const codes = [
    { id: 7, code: 'ELM-1', packs: [1], requiredCourses: [10, 12] },
    { id: 8, code: 'ELM-2', packs: [1, 2], requiredCourses: [] },
  ]
  const plan = detachCourse(10, packs, codes)
  assert.deepEqual(plan.packs[0].courses, [11])
  assert.equal(plan.packs[1].changed, false)
  assert.deepEqual(plan.codes[0].requiredCourses, [12])
  assert.deepEqual(plan.codes[0].packs, [1])
  assert.equal(plan.codes[0].code, 'ELM-1')
  assert.equal(plan.codes[1].changed, false)
  assert.equal(codesStillJoin(codes, plan.codes), true)
  assert.equal(codesStillJoin(codes, plan.codes.map((code) => ({ ...code, packs: [] }))), false)
})

test('deleting a pack takes it off codes and leaves the codes', () => {
  const codes = [{ id: 7, code: 'ELM-1', packs: [1, 3], requiredCourses: [10] }]
  const next = detachPack(1, codes)
  assert.deepEqual(next[0].packs, [3])
  assert.equal(next[0].code, 'ELM-1')
  assert.deepEqual(next[0].requiredCourses, [10])
  assert.equal(codesStillJoin(codes, [{ id: 7, code: 'ELM-1', packs: [3] }]), false)
  assert.equal(codes[0].packs.includes(1), true)
})

test('a portal delete needs the name, and other deletes need the tick', () => {
  assert.match(confirmRefusal('portal', { sure: true, typed: 'Harbour', title: 'Bin Harbour' }) || '', /Bin Harbour/)
  assert.equal(confirmRefusal('portal', { sure: false, typed: 'Bin Harbour', title: 'Bin Harbour' }), null)
  assert.match(confirmRefusal('course', { sure: false, typed: '', title: 'Notes' }) || '', /Tick Yes/)
  assert.equal(confirmRefusal('course', { sure: true, typed: '', title: 'Notes' }), null)
  assert.match(confirmRefusal('lesson', { sure: false, typed: '', title: 'Names' }) || '', /move it to the bin/)
  assert.equal(confirmRefusal('lesson', { sure: true, typed: '', title: 'Names' }), null)
  assert.equal(undoSentence('course'), 'You can undo this from the bin.')
  assert.equal(undoSentence('lesson'), 'You can put it back from the bin.')
  assert.equal(KINDS.lesson.mode, 'hide')
  assert.equal(undoSentence('sheet'), "This can't be undone.")
  assert.equal(courseRemovedFromDesk({ hidden: true, hiddenNote: 'Deleted from the desk.' }), true)
  assert.equal(courseRemovedFromDesk({ hidden: true, hiddenNote: 'Paused' }), false)
  assert.equal(BULK_DELETE_LIMIT, 25)
})
