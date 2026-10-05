import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canChangeRole,
  canHoldStaffRole,
  canResetByEmail,
  canSetTempPassword,
  canSuspend,
  deleteIsDue,
  exportAllowed,
  isQuietHour,
  isSuspended,
  pausedSinceMessage,
  tokenFresh,
  twoFactorNeeded,
} from './account-rules'

const master = { id: 1, role: 'master' as const, emailConfirmedAt: '2026-01-01', tenants: [] }
const admin = { id: 2, role: 'portal-admin' as const, emailConfirmedAt: '2026-01-01', tenants: [{ tenant: 10 }] }
const otherAdmin = { id: 3, role: 'portal-admin' as const, emailConfirmedAt: '2026-01-01', tenants: [{ tenant: 11 }] }
const teacher = { id: 4, role: 'teacher' as const, emailConfirmedAt: '2026-01-01', tenants: [{ tenant: 10 }] }
const learner = { id: 5, role: 'learner' as const, emailConfirmedAt: '2026-01-01', tenants: [{ tenant: 10 }] }
const unconfirmed = { id: 6, role: 'learner' as const, tenants: [{ tenant: 10 }] }

describe('account rules', () => {
  it('treats a pause as signed out', () => {
    assert.equal(isSuspended({ suspendedAt: '2026-10-04T00:00:00Z' }), true)
    assert.equal(isSuspended({ removed: true }), true)
    assert.equal(isSuspended({}), false)
  })

  it('refuses a password-reset email until the address is confirmed', () => {
    assert.equal(canResetByEmail(learner), true)
    assert.equal(canResetByEmail(unconfirmed), false)
    assert.equal(canResetByEmail({ ...learner, suspendedAt: '2026-10-04' }), false)
  })

  it('needs a confirmed email before a role above learner', () => {
    assert.equal(canHoldStaffRole(unconfirmed, 'teacher'), false)
    assert.equal(canHoldStaffRole(learner, 'teacher'), true)
    assert.equal(canHoldStaffRole(unconfirmed, 'learner'), true)
  })

  it('lets a portal admin pause only their own people', () => {
    assert.equal(canSuspend(admin, learner), null)
    assert.equal(canSuspend(otherAdmin, learner), 'That person is in another portal.')
    assert.equal(canSuspend(admin, master), 'The master account cannot be paused.')
    assert.equal(canSuspend(teacher, learner), 'Only a portal admin or the master can pause an account.')
    assert.equal(canSuspend(master, learner), null)
  })

  it('lets a teacher set a temporary password only for a linked learner', () => {
    assert.equal(canSetTempPassword(teacher, learner, true), null)
    assert.equal(canSetTempPassword(teacher, learner, false), 'That learner is not linked to you.')
    assert.equal(canSetTempPassword(admin, learner, false), null)
    assert.equal(canSetTempPassword(otherAdmin, learner, false), 'That person is in another portal.')
  })

  it('stops a portal admin making another portal admin', () => {
    assert.equal(canChangeRole(admin, learner, 'teacher'), null)
    assert.match(canChangeRole(admin, learner, 'portal-admin') || '', /teacher only/)
    assert.match(canChangeRole(admin, unconfirmed, 'teacher') || '', /confirm/)
    assert.equal(canChangeRole(master, learner, 'portal-admin'), null)
  })

  it('requires two-step in production for master, and whenever they have enrolled', () => {
    assert.equal(twoFactorNeeded({ id: 1, role: 'master' }, { NODE_ENV: 'production' }), true)
    assert.equal(twoFactorNeeded({ id: 1, role: 'master' }, { HEARTS_E2E: '1' }), false)
    assert.equal(twoFactorNeeded({ id: 1, role: 'master', totpEnabledAt: '2026-10-04' }, { HEARTS_E2E: '1' }), true)
    assert.equal(twoFactorNeeded({ id: 5, role: 'learner', totpEnabledAt: '2026-10-04' }, {}), false)
  })

  it('expires tokens and spaces data exports', () => {
    const now = new Date('2026-10-04T12:00:00Z')
    assert.equal(tokenFresh('2026-10-04T11:00:00Z', now), false)
    assert.equal(tokenFresh('2026-10-04T13:00:00Z', now), true)
    assert.equal(exportAllowed('2026-10-04T00:00:00Z', now), false)
    assert.equal(exportAllowed('2026-10-03T11:00:00Z', now), true)
    assert.equal(deleteIsDue('2026-09-20T12:00:00Z', now), true)
    assert.equal(deleteIsDue('2026-10-01T12:00:00Z', now), false)
  })

  it('writes the paused flash as since this time, then speak to the masjid', () => {
    assert.equal(pausedSinceMessage(''), 'This account is paused. Please speak to your masjid or school.')
    assert.equal(
      pausedSinceMessage('5 October 2026 at 00:16'),
      'This account is paused since 5 October 2026 at 00:16. Please speak to your masjid or school.',
    )
  })

  it('treats 22:00 to 07:00 in the portal zone as quiet', () => {
    assert.equal(isQuietHour(new Date('2026-10-04T21:30:00Z'), 'Europe/London'), true)
    assert.equal(isQuietHour(new Date('2026-10-04T12:00:00Z'), 'Europe/London'), false)
    assert.equal(isQuietHour(new Date('2026-10-19T02:00:00Z'), 'America/Toronto'), true)
    assert.equal(isQuietHour(new Date('2026-10-19T01:30:00Z'), 'America/Toronto'), false)
  })
})
