import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deskScreenName } from '../../src/lib/action-error'
import { TOOL } from '../../src/lib/desk-help'
import { humanDate, broughtInCourseName } from '../../src/lib/human-date'
import { bringInStatusLabel, CAPTION_QUEUE_DETAIL, readBringInFlags, stampBringInFlags } from '../../src/lib/youtube'

test('plain tips and status labels match the desk brief', () => {
  assert.equal(TOOL.bringInGiveHolders, 'Ticked: people who already joined get this course too. Untick only if you want it for new joiners only.')
  assert.equal(TOOL.bringInSpeaker, 'Who is speaking. We fill it from the line, the course, then the channel.')
  assert.equal(TOOL.bringInHelper, 'Runs on your computer to fetch captions YouTube blocks from our server. Leave it alone unless support asks.')
  assert.equal(TOOL.bringInPublish, 'Publish = learners can see it. Talks still fetching captions publish themselves once ready')
  assert.equal(TOOL.requiredCourses, 'Optional. Tick courses everyone with this code must finish.')
  assert.equal(TOOL.extract, "Free, built-in. (Optional: use your own AI account; that's billed to you.)")
  assert.equal(TOOL.sheetScope, 'Download the blank template to start. "This portal" only includes courses you made.')
  assert.equal(bringInStatusLabel('waiting'), 'Getting captions… (usually under 30 min)')
  assert.equal(bringInStatusLabel('processed'), 'Ready to publish')
  assert.equal(bringInStatusLabel('failed'), "Couldn't get captions: upload a transcript")
  assert.equal(CAPTION_QUEUE_DETAIL, "Saved. We'll fetch captions in the background")
  assert.equal(humanDate('2026-09-30'), '30 Sep')
  assert.equal(broughtInCourseName(new Date('2026-10-13T00:00:00.000Z')), 'Brought in 13 Oct 2026')
  const stamped = stampBringInFlags('Bring-in: waiting. [lang:en] Held.', { autoPublish: true, giveHolders: true })
  assert.equal(readBringInFlags(stamped).autoPublish, true)
  assert.equal(readBringInFlags(stamped).giveHolders, true)
  assert.equal(deskScreenName('/p/east-london/admin/bring-in'), 'Bring in')
  assert.equal(deskScreenName('/p/east-london/admin/access'), 'Codes')
  assert.equal(deskScreenName('/p/east-london/admin/teach'), 'Teach')
})
