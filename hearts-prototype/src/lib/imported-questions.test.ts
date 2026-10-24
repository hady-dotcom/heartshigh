import assert from 'node:assert/strict'
import test from 'node:test'
import { isImportedSheetDraft, SHEET_IMPORT_NOTE } from './imported-questions'
import { DRAFT_NOTE } from './tiers'

const sheet = { status: 'draft' as const, draftNote: SHEET_IMPORT_NOTE, author: null, reviewedBy: null }

test('bulk approve only touches untouched questions from the master sheet', () => {
  assert.equal(isImportedSheetDraft(sheet), true)
  assert.equal(isImportedSheetDraft({ ...sheet, draftNote: 'From the imam, check the wording' }), true)
  assert.equal(isImportedSheetDraft({ ...sheet, status: 'published' }), false)
  assert.equal(isImportedSheetDraft({ ...sheet, status: 'rejected' }), false)
  assert.equal(isImportedSheetDraft({ ...sheet, author: 4 }), false)
  assert.equal(isImportedSheetDraft({ ...sheet, reviewedBy: 4 }), false)
  assert.equal(isImportedSheetDraft({ status: 'draft', draftNote: DRAFT_NOTE }), false)
  assert.equal(isImportedSheetDraft({ status: 'draft', draftNote: 'AI draft from popup-drafter v1. Needs a human check.' }), false)
  assert.equal(isImportedSheetDraft({ status: 'draft', draftNote: 'Written on the master desk.', author: 2 }), false)
  assert.equal(isImportedSheetDraft({ status: 'draft', draftNote: 'Written on the master desk.' }), false)
  assert.equal(isImportedSheetDraft({ status: 'draft', draftNote: '' }), false)
  assert.equal(isImportedSheetDraft({ status: 'draft' }), false)
})
