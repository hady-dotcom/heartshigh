import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EXPERIMENT_HELP, PAGE, TOOL } from '../../src/lib/desk-help'
import { FEATURES } from '../../src/lib/features'
import { LEARNER_HELP, helpFor } from '../../src/lib/page-help'

const PAGES = [
  'home', 'feed', 'appetiser', 'start', 'welcome', 'join', 'lanes', 'garden', 'garden-general',
  'garden-jibril', 'garden-ghunya', 'garden-workbook', 'garden-harvest', 'me', 'settings', 'plan',
  'learner-path', 'course', 'course-overview', 'circle', 'speaker', 'help', 'login', 'door',
  'placing', 'placing-result', 'saved', 'support-page', 'parent-workbook', 'shaped-page', 'mission-page', 'live-screen',
  'gather', 'gather-detail', 'gather-propose', 'gather-door', 'gather-reflect', 'recalibrate',
  'closed', 'feature-unavailable',
]

/** Words the owner asked us to drop, plus the marketing voice. */
const BANNED = /\b(ingest|pipelines?|schemas?|tiers?|tokens?|temperature|providers?|might|perhaps|could|seems|generally|typically|usually|leverage|seamless|robust)\b/i

function sentences(text: string) {
  return text.trim().split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean)
}

test('learner and desk ? tips stay in everyday words', () => {
  const chunks: [string, string][] = []
  for (const key of PAGES) {
    const copy = helpFor(key)
    chunks.push([key, [copy.title, ...copy.body].join(' ')])
    const count = sentences(copy.body.join(' ')).length
    assert.ok(count >= 2 && count <= 4, `${key} has ${count} sentences`)
  }
  chunks.push(['default', helpFor('missing-page').body.join(' ')])
  for (const [key, text] of Object.entries(LEARNER_HELP)) chunks.push([`learner ${key}`, text])
  for (const [key, text] of Object.entries(PAGE)) chunks.push([`desk ${key}`, text])
  for (const [key, text] of Object.entries(TOOL)) chunks.push([`tool ${key}`, text])
  for (const feature of FEATURES) chunks.push([`feature ${feature.key}`, feature.help])
  for (const line of EXPERIMENT_HELP) chunks.push(['experiment', `${line.title || ''} ${line.body}`])
  for (const [key, text] of chunks) {
    assert.equal(BANNED.test(text), false, `${key}: ${text.match(BANNED)?.[0]}`)
  }
})
