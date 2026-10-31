import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { rememberedDoor } from '../../src/lib/door-brand'
import { middleware } from '../../src/middleware'

test('a sign-in address keeps the portal in next, and otherwise the one last opened', () => {
  assert.deepEqual(rememberedDoor('/p/parenting/me', 'hearts-demo'), { slug: 'parenting', explicit: true })
  assert.deepEqual(rememberedDoor('/', 'parenting'), { slug: 'parenting', explicit: false })
  assert.deepEqual(rememberedDoor('/', ''), { slug: '', explicit: false })
  assert.deepEqual(rememberedDoor('/', '../etc'), { slug: '', explicit: false })
  assert.deepEqual(rememberedDoor('/login', 'Parenting'), { slug: 'Parenting', explicit: false })
  const opened = middleware(new NextRequest('https://hearts.example/p/parenting/courses'))
  assert.equal(opened.cookies.get('hh_door')?.value, 'parenting')
  const plain = middleware(new NextRequest('https://hearts.example/login'))
  assert.equal(plain.cookies.get('hh_door'), undefined)
})
