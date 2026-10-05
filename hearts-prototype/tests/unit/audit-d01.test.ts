import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { audit, flushAuditWrites, staffAuditAfterChange } from '../../src/server/audit'

function fakePayload() {
  const created: Record<string, unknown>[] = []
  return {
    created,
    payload: {
      create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        assert.equal(collection, 'audit-log')
        created.push(data)
        return { id: created.length, ...data }
      },
    } as never,
  }
}

const ACTIONS = [
  { event: 'access-codes.create', portal: 3 },
  { event: 'access-codes.update', portal: 3 },
  { event: 'users.grant', portal: 3, target: 9 },
  { event: 'users.role', portal: 3, target: 9 },
  { event: 'users.suspend', portal: 3, target: 9 },
  { event: 'users.restore', portal: 3, target: 9 },
  { event: 'users.delete', portal: 3, target: 9 },
  { event: 'portals.update', portal: 3 },
  { event: 'people.export', portal: 3 },
  { event: 'people.import', portal: 3 },
  { event: 'people.bulk', portal: 3 },
  { event: 'view_as.start', portal: 3, target: 9 },
]

describe('D01 audit helper', () => {
  it('writes exactly one row with an actor and a portal for each listed action', async () => {
    for (const action of ACTIONS) {
      const { created, payload } = fakePayload()
      await audit(payload, action.event, {
        actor: { id: 2, role: 'portal-admin' },
        target: action.target,
        portal: action.portal,
        reason: 'A short reason',
        detail: { password: 'must-not-store', fields: ['role'] },
      })
      assert.equal(created.length, 1, action.event)
      assert.equal(created[0].event, action.event)
      assert.equal(created[0].actor, 2)
      assert.equal(created[0].portal, 3)
      assert.equal((created[0].detail as { password?: string })?.password, undefined)
    }
  })

  it('skips learner self-edits and records a staff user change once', async () => {
    const { created, payload } = fakePayload()
    await staffAuditAfterChange({
      doc: { id: 9, role: 'learner', name: 'Yusuf', portal: 3 },
      previousDoc: { id: 9, role: 'learner', name: 'Yusuf' },
      operation: 'update',
      collection: { slug: 'users' },
      req: { user: { id: 9, role: 'learner' }, payload },
    })
    assert.equal(created.length, 0)

    await staffAuditAfterChange({
      doc: { id: 9, role: 'learner', extraCourses: [1, 2], portal: 3 },
      previousDoc: { id: 9, role: 'learner', extraCourses: [1] },
      operation: 'update',
      collection: { slug: 'users' },
      req: { user: { id: 2, role: 'portal-admin' }, payload },
    })
    assert.equal(created.length, 0)
    await flushAuditWrites()
    assert.equal(created.length, 1)
    assert.equal(created[0].event, 'users.grant')
    assert.equal(created[0].actor, 2)
    assert.equal(created[0].target, 9)
    assert.equal(created[0].portal, 3)
  })

  it('a failed audit write does not fail the staff change', async () => {
    const payload = {
      create: async () => {
        throw new Error('insert or update on table "audit_log" violates foreign key constraint')
      },
    } as never
    await staffAuditAfterChange({
      doc: { id: 22, role: 'teacher', name: 'By Master', portal: 3 },
      operation: 'create',
      collection: { slug: 'users' },
      req: { user: { id: 1, role: 'master' }, payload },
    })
    await flushAuditWrites()
  })
})
