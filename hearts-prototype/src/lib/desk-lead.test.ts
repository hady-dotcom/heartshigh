import assert from 'node:assert/strict'
import test from 'node:test'
import { deskLead } from './desk-lead'

const MASTER = ['portals', 'learners', 'library', 'bring-in', 'live', 'packs', 'plans', 'circle', 'nights', 'missions', 'safety', 'announcements', 'opening', 'lanes', 'experiments', 'insights', 'calendar', 'framing', 'sheet', 'transcripts', 'simulator', 'personas', 'review', 'tiers', 'create', 'questions', 'trends']

test('master desk pages say who the result is for, except the shipped Codes and AI pages', () => {
  assert.equal(deskLead('codes', '/master'), null)
  assert.equal(deskLead('ai', '/master'), null)
  for (const key of MASTER) {
    const lead = deskLead(key, '/master')
    assert.ok(lead, key)
    assert.match(lead!.line, /Learners|desk|person|newcomer/i)
    assert.ok(lead!.primary.href.startsWith('/') || lead!.primary.href.startsWith('#'))
  }
})

test('a portal primary stays inside that portal', () => {
  const lead = deskLead('gather', '/p/east-london/admin')
  assert.equal(lead?.primary.href, '/p/east-london/admin/gather/attendance')
  assert.match(lead?.line || '', /Learners/)
  const circle = deskLead('circle', '/p/east-london/admin')
  assert.equal(circle?.primary.href, '#circle-index')
})
