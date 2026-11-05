import assert from 'node:assert/strict'
import { test } from 'node:test'
import { workbookParentEmail } from '../../src/lib/demo-workbook'
import { portalPeopleNote, sampleParentEmails, tallyPortalPeople } from '../../src/lib/portal-people'

test('the people tile counts only real people on the list it is given', () => {
  const sample = sampleParentEmails()
  assert.ok(sample.has('amina.khan@hady.home'))
  assert.ok(sample.has(workbookParentEmail('Nadia Hussain')))
  const tally = tallyPortalPeople([
    { email: 'amina.khan@hady.home', role: 'learner' },
    { email: workbookParentEmail('Hannah Smith'), role: 'learner' },
    { email: 'parenting-admin@hearts.test', role: 'portal-admin' },
    { email: 'parenting-learner@hearts.test', role: 'learner' },
    { email: 'amina.walk@hady.home', role: 'learner' },
    { email: 'rafiq@example.com', role: 'portal-admin' },
    { email: 'hannah@example.com', role: 'teacher' },
    { email: 'left@example.com', role: 'learner', removed: true },
  ])
  assert.deepEqual(tally, { joined: 3, learners: 1, team: 2, sample: 2, demo: 2 })
  assert.match(portalPeopleNote(tally), /1 learner has joined, and 2 people are on the team/)
  assert.match(portalPeopleNote(tally), /2 sample people are on the films and not counted/)
  assert.match(portalPeopleNote(tally), /2 demo sign-ins are not counted/)
})

test('a portal with only sample people says nobody has joined', () => {
  const tally = tallyPortalPeople([{ email: 'amina.khan@hady.home', role: 'learner' }])
  assert.equal(tally.joined, 0)
  assert.equal(tally.sample, 1)
  assert.match(portalPeopleNote(tally), /Nobody has joined yet/)
})
