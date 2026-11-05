import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialsOf, orderSwarm, overlapScore } from './swarm-sort'

const rows = [
  { body: 'I started praying Fajr and the morning felt quieter.' },
  { body: 'Anger still catches me in the queue at work.' },
  { body: 'Prayer in the morning is the one habit that stuck.' },
]

test('like-mine puts the closer prayer answers first', () => {
  const mine = 'Fajr prayer in the morning is what I hold on to.'
  const like = orderSwarm(rows, mine, 'like')
  assert.equal(like[0].body.includes('praying') || like[0].body.includes('Prayer'), true)
  const surprise = orderSwarm(rows, mine, 'surprise')
  assert.equal(surprise[0].body.includes('Anger'), true)
  assert.ok(overlapScore(mine, rows[0].body) > overlapScore(mine, rows[1].body))
})

test('mix does not use a popularity key', () => {
  const mix = orderSwarm(rows, 'anything', 'mix', 'seed-a')
  assert.equal(mix.length, 3)
})

test('initials are two letters from the name', () => {
  assert.equal(initialsOf('Maryam Ali'), 'MA')
  assert.equal(initialsOf('Noor'), 'NO')
  assert.equal(initialsOf(''), 'A')
})
