import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canReadLinkedAnswer, canReadMedia, mediaListWhere } from './media-access'

const alice = { id: 2, role: 'learner', tenants: [{ tenant: 1 }] }
const bob = { id: 3, role: 'learner', tenants: [{ tenant: 1 }] }
const teacher = { id: 4, role: 'teacher', tenants: [{ tenant: 1 }] }
const admin = { id: 5, role: 'portal-admin', tenants: [{ tenant: 1 }] }
const master = { id: 1, role: 'master', tenants: [] }
const otherAdmin = { id: 6, role: 'portal-admin', tenants: [{ tenant: 9 }] }

const privateAnswer = { user: 2, portal: 1, keepPrivate: true, shareWithTeacher: false, shareWithLearners: false }
const sharedTeacher = { user: 2, portal: 1, keepPrivate: false, shareWithTeacher: true, shareWithLearners: false }
const sharedCircle = { user: 2, portal: 1, keepPrivate: false, shareWithTeacher: true, shareWithLearners: true }
const media = { id: 10, owner: 2, purpose: 'answer', portal: 1 }

describe('S05 media access', () => {
  it('a learner reads only their own answer media', () => {
    assert.equal(canReadMedia(alice, media, privateAnswer), true)
    assert.equal(canReadMedia(bob, media, privateAnswer), false)
    assert.equal(canReadMedia(bob, media, sharedCircle), true)
    assert.equal(canReadLinkedAnswer(bob, privateAnswer), false)
  })

  it('staff follow the answer rules; a teacher cannot open an unshared answer file', () => {
    assert.equal(canReadMedia(teacher, media, privateAnswer), false)
    assert.equal(canReadMedia(teacher, media, sharedTeacher), true)
    assert.equal(canReadMedia(admin, media, privateAnswer), false)
    assert.equal(canReadMedia(admin, media, sharedTeacher), true)
    assert.equal(canReadMedia(otherAdmin, media, sharedTeacher), false)
  })

  it('the master cannot open media on a private answer', () => {
    assert.equal(canReadMedia(master, media, privateAnswer), false)
    assert.equal(canReadMedia(master, media, sharedTeacher), true)
  })

  it('portal assets and films stay readable to members; listing never includes answer files', () => {
    const film = { id: 11, owner: 1, purpose: 'film', portal: 1 }
    assert.equal(canReadMedia(bob, film, null), true)
    assert.equal(canReadMedia(bob, media, privateAnswer, true), false)
    assert.equal(canReadMedia(alice, media, privateAnswer, true), false)
    const list = mediaListWhere(bob)
    assert.deepEqual(list, { and: [{ portal: { equals: 1 } }, { purpose: { in: ['portal-asset', 'film'] } }] })
  })

  it('signed-out people read nothing', () => {
    assert.equal(canReadMedia(null, media, sharedCircle), false)
  })
})
