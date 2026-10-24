import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deskScreenName } from '../../src/lib/action-error'
import { TOOL } from '../../src/lib/desk-help'
import { humanDate, broughtInCourseName } from '../../src/lib/human-date'
import { bringInStatusLabel, CAPTION_QUEUE_DETAIL, readBringInFlags, stampBringInFlags } from '../../src/lib/youtube'

test('plain tips and status labels match the desk brief', () => {
  assert.equal(TOOL.bringInGiveHolders, 'Tick this to add the course to learners who already hold a pack that contains it and who keep a saved course list. Leave it unticked and those learners keep the list they joined with. People who read the pack live already see new courses in that pack.')
  assert.equal(TOOL.bringInSpeaker, 'The speaker on the row is saved on that film. It starts from the name on the line, then the course, then a channel you have matched. The YouTube channel name is never used on its own.')
  assert.equal(TOOL.bringInHelper, 'The caption helper runs on your own machine, where YouTube is not blocked. The code can only list talks waiting for their words, and attach them. It is stored scrambled, shown once, and you can cancel it here.')
  assert.equal(TOOL.bringInPublish, 'Publish makes a draft visible to learners who already have this course, including a draft from the master sheet. Talks still waiting for their words stay hidden until those words are attached. You can publish one row or several at once.')
  assert.equal(TOOL.requiredCourses, 'Optional. Tick courses everyone with this code must finish.')
  assert.equal(TOOL.extract, 'This drafts clips from the words of the talk. Clips you have already approved stay. The built-in run needs no account. A portal admin can tick the portal AI box, confirm the one call, and that run is billed to the portal.')
  assert.equal(TOOL.sheetScope, 'This says what the workbook covers: the whole library, this portal’s own courses, or one course. A portal export skips library courses, so it can be empty. The blank template is always safe to download.')
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
