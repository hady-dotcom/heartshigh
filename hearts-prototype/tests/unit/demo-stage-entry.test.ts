import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { demoStageLoginHref, isDemoStageLogin, isDemoStageNext, loginFailurePath } from '../../src/lib/demo-stage-gate'

test('the demo sign-in returns to the stage and nowhere else', () => {
  assert.equal(isDemoStageNext('/demo-stage'), true)
  assert.equal(isDemoStageNext('/demo-stage?kept=1'), true)
  assert.equal(isDemoStageNext('/demo-stage-extra'), false)
  assert.equal(isDemoStageNext('//demo-stage'), false)
  assert.equal(isDemoStageNext('/login'), false)
  assert.equal(isDemoStageLogin('/demo-stage', undefined), true)
  assert.equal(isDemoStageLogin('/master', 'stage'), true)
  assert.equal(isDemoStageLogin('/master', 'other'), false)
  assert.equal(demoStageLoginHref(), '/login?next=%2Fdemo-stage&demo=stage')
  assert.equal(loginFailurePath('/demo-stage'), '/login?next=%2Fdemo-stage&demo=stage')
  assert.equal(loginFailurePath('/master'), '/login')
})

test('signed-out visitors get the demo entry instead of the ordinary login', () => {
  const page = readFileSync(new URL('../../src/app/(frontend)/demo-stage/page.tsx', import.meta.url), 'utf8')
  const entry = readFileSync(new URL('../../src/app/(frontend)/demo-stage/entry.tsx', import.meta.url), 'utf8')
  const login = readFileSync(new URL('../../src/app/(frontend)/login/page.tsx', import.meta.url), 'utf8')
  const handle = readFileSync(new URL('../../src/server/handle.ts', import.meta.url), 'utf8')

  assert.match(page, /if \(!session\.user \|\| !session\.actor\) return <DemoStageEntry \/>/)
  assert.match(page, /session\.user\.role !== 'master'/)
  assert.doesNotMatch(page, /requireMaster|requireUser|\/login/)
  assert.match(entry, /Hady Core Demo stage/)
  assert.match(entry, /A live four-screen walk-through: master, portal admin, teacher, learner\. Practice data only\. Nothing here changes real portals\./)
  assert.match(entry, /Sign in to open the Demo stage/)
  assert.match(entry, /#25214a/)
  assert.match(entry, /#1f8a78/)
  assert.match(entry, /#c48f2c/)
  assert.match(entry, /#7a4fa8/)
  assert.match(entry, /Master login/)
  assert.match(entry, /This sign-in is for the demo/)
  assert.doesNotMatch(entry, /hearts/i)
  assert.match(login, /isDemoStageLogin/)
  assert.match(login, /<DemoStageLogin/)
  assert.match(login, /Welcome back/)
  assert.match(handle, /loginFailurePath\(next\)/)
})
