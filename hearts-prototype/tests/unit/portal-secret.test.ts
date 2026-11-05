import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import React, { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Portals } from '../../src/collections'
import { portalForClient, presentPortal } from '../../src/lib/portal-public'

Object.assign(globalThis, { React })
const { LearnerTabBar } = await import('../../src/components/app/learner-bar')
const { Frame } = await import('../../src/screens/app/garden')

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '../..')
const SECRET = 'iv.tag.SECRETKEYMATERIAL'
const poisoned = {
  id: 7,
  slug: 'east-london',
  name: 'East London',
  features: { garden: true },
  aiConnection: { kind: 'openai-compatible', baseUrl: 'https://portal-a.test/v1', model: 'model-a', keyCipher: SECRET, keyHint: 'AAAA' },
  notificationEmails: 'lead@x.test',
}

function flight(element: ReactElement) {
  return JSON.stringify(element.props)
}

test('a portal handed to the browser omits the AI connection and other server-only fields', () => {
  const presented = presentPortal({ ...poisoned, aiConnection: { ...poisoned.aiConnection }, notificationEmails: poisoned.notificationEmails })
  assert.equal(presented.aiConnection.keyCipher, SECRET)
  assert.equal(Object.keys(presented).includes('aiConnection'), false)
  assert.equal(Object.keys(presented).includes('notificationEmails'), false)
  assert.equal(JSON.stringify(presented).includes(SECRET), false)
  assert.equal(JSON.stringify(presented).includes('lead@x.test'), false)
  assert.equal(JSON.stringify({ ...presented }).includes('portal-a.test'), false)

  const routes: { path: string; active: 'home' | 'garden' | 'me' | 'lanes' }[] = [
    { path: '/p/east-london', active: 'home' },
    { path: '/p/east-london/garden', active: 'garden' },
    { path: '/p/east-london/garden/harvest', active: 'garden' },
    { path: '/p/east-london/me', active: 'me' },
    { path: '/p/east-london/lanes', active: 'lanes' },
  ]
  for (const route of routes) {
    const raw = { ...poisoned, aiConnection: { ...poisoned.aiConnection } }
    const client = LearnerTabBar({ base: route.path, active: route.active, portal: raw })
    const payload = flight(client as ReactElement)
    assert.equal(payload.includes('aiConnection'), false, route.path)
    assert.equal(payload.includes('keyCipher'), false, route.path)
    assert.equal(payload.includes(SECRET), false, route.path)
    assert.equal(payload.includes('portal-a.test'), false, route.path)
    assert.equal(payload.includes('lead@x.test'), false, route.path)
    const html = renderToStaticMarkup(client as ReactElement)
    assert.equal(html.includes(SECRET), false, route.path)
    assert.equal(html.includes('aiConnection'), false, route.path)
  }

  const harvestPortal = { ...poisoned, aiConnection: { ...poisoned.aiConnection } }
  const harvest = renderToStaticMarkup(createElement(Frame, {
    base: '/p/east-london',
    title: 'Harvest',
    testId: 'garden-harvest',
    unread: 0,
    portal: harvestPortal,
    children: 'A saved line',
  }))
  assert.match(harvest, /data-testid="garden-harvest"/)
  assert.match(harvest, /data-testid="tabbar"/)
  assert.equal(harvest.includes(SECRET), false)
  assert.equal(harvest.includes('aiConnection'), false)
  assert.equal(harvest.includes('lead@x.test'), false)

  const stripped = portalForClient(poisoned)
  assert.equal(JSON.stringify(stripped).includes(SECRET), false)
})

test('REST cannot read the portal AI connection', () => {
  const field = Portals.fields.find((item) => 'name' in item && item.name === 'aiConnection')
  assert.ok(field && 'access' in field && field.access && typeof field.access.read === 'function')
  assert.equal(field.access.read({} as never), false)
  assert.equal(field.access.create?.({} as never), false)
  assert.equal(field.access.update?.({} as never), false)
  const collections = readFileSync(path.join(root, 'src/collections.ts'), 'utf8')
  assert.match(collections, /payloadAPI === 'local'[\s\S]*delete \(doc as \{ aiConnection\?: unknown \}\)\.aiConnection/)
})

test('learner pages pass the portal through the server tab bar', () => {
  const screens = ['home.tsx', 'garden.tsx', 'me.tsx', 'course.tsx', 'harvest.tsx', 'compass.tsx', 'gather.tsx']
  for (const name of screens) {
    const text = readFileSync(path.join(root, 'src/screens/app', name), 'utf8')
    assert.equal(/<TabBar\b[^>]*portal=\{portal\}/.test(text), false, name)
  }
  assert.match(readFileSync(path.join(root, 'src/screens/app/home.tsx'), 'utf8'), /LearnerTabBar/)
  assert.match(readFileSync(path.join(root, 'src/screens/app/garden.tsx'), 'utf8'), /LearnerTabBar/)
  assert.match(readFileSync(path.join(root, 'src/screens/app/me.tsx'), 'utf8'), /LearnerTabBar/)
  assert.match(readFileSync(path.join(root, 'src/screens/app/course.tsx'), 'utf8'), /LearnerTabBar/)
  assert.match(readFileSync(path.join(root, 'src/components/app/learner-bar.tsx'), 'utf8'), /portalForClient/)
})
