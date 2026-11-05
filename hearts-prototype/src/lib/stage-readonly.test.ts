import assert from 'node:assert/strict'
import test from 'node:test'
import { LOOP_NOTE, SEED_NOTE, phoneToasts, reduceDemo, seedDemo } from './demo-stage'
import { stageEmbed, stageFlagRedirect, stageWriteBlocked } from './stage-readonly'

test('a stage frame blocks writes and lets reads through', () => {
  assert.equal(stageWriteBlocked('POST', '/api/hearts?stage=1', null), true)
  assert.equal(stageWriteBlocked('POST', '/api/hearts', 'https://hearts.example/master?stage=1'), true)
  assert.equal(stageWriteBlocked('DELETE', '/master/library', 'https://hearts.example/p/east-london/admin?stage=1&tab=1'), true)
  assert.equal(stageWriteBlocked('POST', '/api/hearts', 'https://hearts.example/master'), false)
  assert.equal(stageWriteBlocked('POST', '/api/hearts?stage=2', null), false)
  assert.equal(stageWriteBlocked('GET', '/api/hearts?stage=1', null), false)
  assert.equal(stageWriteBlocked('HEAD', '/master?stage=1', null), false)
  assert.equal(stageEmbed('/master?stage=1&x=2', null), true)
  assert.equal(stageEmbed('/master', null), false)
})

test('only a real page load inside the frame keeps the read-only flag', () => {
  const referer = 'https://hearts.example/p/east-london/admin?stage=1'
  assert.equal(stageFlagRedirect({ method: 'GET', url: '/p/east-london/admin/teach', referer, dest: 'document' }), true)
  assert.equal(stageFlagRedirect({ method: 'GET', url: '/p/east-london/admin/teach', referer, dest: 'iframe' }), true)
  assert.equal(stageFlagRedirect({ method: 'GET', url: '/p/east-london/admin/teach?stage=1', referer, dest: 'document' }), false)
  assert.equal(stageFlagRedirect({ method: 'GET', url: '/master?_rsc=1', referer, dest: 'empty' }), false)
  assert.equal(stageFlagRedirect({ method: 'GET', url: '/master', referer, dest: null }), false)
  assert.equal(stageFlagRedirect({ method: 'POST', url: '/api/hearts', referer, dest: 'document' }), false)
  assert.equal(stageFlagRedirect({ method: 'GET', url: '/api/hearts', referer, dest: 'document' }), false)
  assert.equal(stageFlagRedirect({ method: 'GET', url: '/demo-stage', referer, dest: 'document' }), false)
  assert.equal(stageFlagRedirect({ method: 'GET', url: '/login', referer, dest: 'document' }), false)
  assert.equal(stageFlagRedirect({ method: 'GET', url: '/master', referer: 'https://hearts.example/demo-stage', dest: 'iframe' }), false)
})

test('phone toasts show the seed note, then the new announcement', () => {
  assert.equal(phoneToasts(seedDemo())[0]?.text, SEED_NOTE)
  const next = reduceDemo(seedDemo(), { type: 'post-note', body: LOOP_NOTE })
  assert.equal(phoneToasts(next)[0]?.text, LOOP_NOTE)
  const quiet = reduceDemo(seedDemo(), { type: 'toggle-garden' })
  assert.equal(phoneToasts(quiet).some((row) => row.text === 'Garden path is off'), true)
})
