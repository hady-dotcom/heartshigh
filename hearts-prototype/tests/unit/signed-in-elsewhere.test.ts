import assert from 'node:assert/strict'
import { test } from 'node:test'
import { signedInElsewhere } from '../../src/lib/landing'

test('the door names who is signed in, and which role, when the master desk is not theirs', () => {
  assert.equal(
    signedInElsewhere('Maryam Begum', 'learner'),
    "You're signed in as Maryam Begum (Learner). Sign in as someone else",
  )
  assert.equal(signedInElsewhere('Idris Rahman', 'teacher'), "You're signed in as Idris Rahman (Teacher). Sign in as someone else")
  assert.equal(signedInElsewhere('Amina Yusuf', 'portal-admin'), "You're signed in as Amina Yusuf (Portal admin). Sign in as someone else")
  assert.equal(signedInElsewhere('  ', 'parent'), "You're signed in as this account (Parent). Sign in as someone else")
  assert.equal(signedInElsewhere('Maryam Begum', 'learner').includes('The master desk is not yours'), false)
})
