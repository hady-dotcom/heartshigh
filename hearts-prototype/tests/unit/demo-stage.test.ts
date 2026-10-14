import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEMO_POLL_MS,
  DEMO_REFRESH_WITHIN_MS,
  DEMO_SLOTS,
  DEMO_STAGE_EMAILS,
  canClaimPortal,
  cookieHeaderForSlot,
  countsTowardMetrics,
  demoWriteDecision,
  eventsAfter,
  excludedFromAnalytics,
  foldActivity,
  includeInSwarmCount,
  isDemoStageEmail,
  isDemoStageWipeTarget,
  parseDemoFrame,
  shouldStoreInsight,
  swarmHiddenWhere,
  tickerForAction,
} from '../../src/lib/demo-stage'

describe('demo stage namespace', () => {
  it('uses the demo-stage namespace and never @hearts.test', () => {
    for (const email of Object.values(DEMO_STAGE_EMAILS)) {
      assert.equal(isDemoStageEmail(email), true)
      assert.equal(email.endsWith('@hearts.test'), false)
      assert.equal(email.endsWith('@demo-stage.hearts'), true)
    }
    assert.equal(isDemoStageEmail('elm-learner@hearts.test'), false)
    assert.equal(isDemoStageEmail('master@hearts.test'), false)
  })
})

describe('analytics isolation', () => {
  it('drops demo accounts and the sandbox portal from metrics, insights and swarm counts', () => {
    const demo = { email: 'learner@demo-stage.hearts', portalIsDemo: true }
    const real = { email: 'elm-learner@hearts.test', portalIsDemo: false }
    assert.equal(excludedFromAnalytics(demo), true)
    assert.equal(countsTowardMetrics(demo), false)
    assert.equal(shouldStoreInsight(demo), false)
    assert.equal(includeInSwarmCount(demo), false)
    assert.equal(excludedFromAnalytics({ email: 'teacher@demo-stage.hearts', portalIsDemo: false }), true)
    assert.equal(excludedFromAnalytics({ email: 'layla@masjid.org', portalIsDemo: true }), true)
    assert.equal(countsTowardMetrics(real), true)
    assert.equal(shouldStoreInsight(real), true)
    assert.equal(includeInSwarmCount(real), true)
    assert.deepEqual(swarmHiddenWhere(9), { and: [{ swarmHidden: { equals: true } }, { portal: { not_equals: 9 } }] })
    assert.deepEqual(swarmHiddenWhere(null), { swarmHidden: { equals: true } })
  })
})

describe('sandbox writes', () => {
  it('refuses a demo account that would change a real portal or the library', () => {
    const demo = { actorIsDemo: true, targetIsDemo: true, demoPortalId: 9, targetPortalId: 9 }
    assert.equal(demoWriteDecision({ ...demo, action: 'portal-features' }), 'allow')
    assert.equal(demoWriteDecision({ ...demo, action: 'announce', targetPortalId: 2, targetIsDemo: false }), 'refuse')
    assert.equal(demoWriteDecision({ ...demo, action: 'create-course', origin: 'master' }), 'refuse')
    assert.equal(demoWriteDecision({ ...demo, action: 'create-course', actorRole: 'master', origin: '' }), 'refuse')
    assert.equal(demoWriteDecision({ ...demo, action: 'create-course', actorRole: 'portal-admin', origin: 'local' }), 'allow')
    assert.equal(demoWriteDecision({ ...demo, action: 'answer', targetPortalId: null, targetIsDemo: false }), 'allow')
    assert.equal(demoWriteDecision({ ...demo, action: 'answer', targetPortalId: 2, targetIsDemo: false }), 'refuse')
    assert.equal(demoWriteDecision({ ...demo, action: 'create-portal' }), 'refuse')
    assert.equal(demoWriteDecision({ ...demo, action: 'deactivate', targetPortalId: 2, targetIsDemo: false }), 'refuse')
    assert.equal(demoWriteDecision({ action: 'deactivate', actorIsDemo: false, targetPortalId: 2, targetIsDemo: false, demoPortalId: 9 }), 'allow')
  })

  it('will not claim a real portal that already has the demo address, and only wipes sandbox rows', () => {
    assert.equal(canClaimPortal(null), 'create')
    assert.equal(canClaimPortal({ slug: 'demo-stage', isDemo: true }), 'use')
    assert.equal(canClaimPortal({ slug: 'demo-stage', isDemo: false }), 'refuse')
    assert.equal(canClaimPortal({ slug: 'east-london', isDemo: false }), 'refuse')
    assert.equal(isDemoStageWipeTarget({ portalId: 9, demoPortalId: 9 }), true)
    assert.equal(isDemoStageWipeTarget({ email: 'learner@demo-stage.hearts', demoPortalId: 9 }), true)
    assert.equal(isDemoStageWipeTarget({ portalId: 2, email: 'elm-learner@hearts.test', demoPortalId: 9 }), false)
    assert.equal(isDemoStageWipeTarget({ email: 'master@hearts.test', demoPortalId: 9 }), false)
  })
})

describe('session cookies', () => {
  it('gives a frame its own token without replacing the master session header', () => {
    const master = 'payload-token=MASTER; hearts_device=abc'
    const swapped = cookieHeaderForSlot(master, 'TEACHER-TOKEN')
    assert.match(swapped, /payload-token=TEACHER-TOKEN/)
    assert.equal(swapped.includes('payload-token=MASTER'), false)
    assert.match(swapped, /hearts_device=abc/)
    assert.equal(master, 'payload-token=MASTER; hearts_device=abc')
    assert.equal(cookieHeaderForSlot(master, null).includes('payload-token='), false)
    const frame = parseDemoFrame('/demo-stage/as/learner/p/demo-stage')
    assert.deepEqual(frame, { slot: 'learner', rest: '/p/demo-stage' })
    assert.equal(parseDemoFrame('/demo-stage'), null)
    assert.equal(parseDemoFrame('/master'), null)
  })
})

describe('refresh bus', () => {
  it('refreshes the other panels within two seconds and glows the one that changed', () => {
    assert.ok(DEMO_POLL_MS <= DEMO_REFRESH_WITHIN_MS)
    assert.equal(DEMO_REFRESH_WITHIN_MS, 2000)
    const events = eventsAfter(
      [
        { id: 1, slot: 'portal', kind: 'course', text: 'Course published: The next sitting', at: 1 },
        { id: 2, slot: 'learner', kind: 'answer', text: 'Learner answered: I will keep one quiet hour this week.', at: 2 },
        { id: 3, slot: 'teacher', kind: 'reply', text: 'Teacher replied', at: 3 },
      ],
      1,
    )
    assert.deepEqual(events.map((event) => event.id), [2, 3])
    const folded = foldActivity(events)
    assert.deepEqual(folded.glow, ['learner', 'teacher'])
    assert.ok(folded.refresh.includes('master'))
    assert.ok(folded.refresh.includes('portal'))
    assert.ok(folded.refresh.includes('learner'))
    assert.ok(folded.refresh.includes('teacher'))
    const onlyLearner = foldActivity([{ id: 4, slot: 'learner', kind: 'answer', text: 'Learner answered: a quiet hour', at: 4 }])
    assert.deepEqual(onlyLearner.glow, ['learner'])
    assert.deepEqual(onlyLearner.refresh, ['master', 'portal', 'teacher'])
    assert.equal(onlyLearner.refresh.includes('learner'), false)
    assert.deepEqual(DEMO_SLOTS.filter((slot) => slot !== 'learner'), onlyLearner.refresh)
    const line = tickerForAction('answer', 'learner', { body: 'I will keep one quiet hour this week.' })
    assert.equal(line?.text, 'Learner answered: I will keep one quiet hour this week.')
    assert.equal(tickerForAction('reply', 'teacher', { reply: 'Keep that hour.' })?.text, 'Teacher replied')
    assert.equal(tickerForAction('answer', 'learner', { body: 'real' })?.slot, 'learner')
  })
})
