import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  auditSentence,
  changedFieldNames,
  eventForStaffChange,
  isAuditedCollection,
  safeAuditDetail,
} from './audit-events'

describe('D01 audit events', () => {
  it('names every listed staff action', () => {
    const events = [
      'access-codes.create',
      'access-codes.update',
      'access-codes.delete',
      'users.grant',
      'users.role',
      'users.suspend',
      'users.restore',
      'users.delete',
      'portals.update',
      'people.export',
      'people.import',
      'people.bulk',
      'view_as.start',
      'trash.remove',
      'trash.restore',
      'trash.empty',
    ]
    for (const event of events) {
      const sentence = auditSentence({ event, actorName: 'Aisha', actorRole: 'portal-admin', targetName: 'Yusuf', portalName: 'East London', reason: 'Lost phone' })
      assert.ok(sentence.includes('Aisha'), event)
      assert.doesNotMatch(sentence, /password|secret/i)
    }
    assert.match(
      auditSentence({ event: 'users.suspend', actorName: 'Aisha', actorRole: 'portal-admin', targetName: 'Yusuf', reason: 'Lost phone' }),
      /paused Yusuf's account.*Lost phone/,
    )
  })

  it('records only field names, never passwords or answers', () => {
    const fields = changedFieldNames(
      { name: 'A', password: 'old', extraCourses: [1], body: 'private' },
      { name: 'B', password: 'new-secret', extraCourses: [1, 2], body: 'still private' },
    )
    assert.ok(fields.includes('name'))
    assert.ok(fields.includes('password'))
    assert.ok(fields.includes('extraCourses'))
    assert.ok(fields.includes('body'))
    const detail = safeAuditDetail({ password: 'new-secret', body: 'a reflection', fields, courseId: 9 })
    assert.equal(detail?.password, undefined)
    assert.equal(detail?.body, undefined)
    assert.deepEqual(detail?.fields, fields)
    assert.equal(detail?.courseId, 9)
  })

  it('maps collection edits to one event name', () => {
    assert.equal(eventForStaffChange('users', 'update', ['removed']), 'users.suspend')
    assert.equal(eventForStaffChange('users', 'update', ['removed', 'removed:false']), 'users.restore')
    assert.equal(eventForStaffChange('users', 'update', ['role']), 'users.role')
    assert.equal(eventForStaffChange('users', 'update', ['extraCourses']), 'users.grant')
    assert.equal(eventForStaffChange('access-codes', 'create', []), 'access-codes.create')
    assert.equal(isAuditedCollection('users'), true)
    assert.equal(isAuditedCollection('watch-sessions'), false)
  })
})
