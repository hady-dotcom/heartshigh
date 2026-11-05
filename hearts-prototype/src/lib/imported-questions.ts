import { DRAFT_NOTE } from './tiers'

/** The note the master sheet writes when a question row has no notes cell of its own. */
export const SHEET_IMPORT_NOTE = 'Written by a person on the master sheet.'

const AI_NOTE = /^AI draft from /i
const DESK_NOTE = /written on the master desk/i
const MACHINE_NOTE = /machine|captions/i

export type QuestionStamp = {
  status?: unknown
  draftNote?: unknown
  author?: unknown
  reviewedBy?: unknown
}

/**
 * A draft that arrived on the master sheet and has not been claimed on the desk.
 * Published and rejected questions are left alone, so approving this set twice changes nothing.
 * Machine captions, AI drafts and questions a person wrote on the desk stay drafts.
 */
export function isImportedSheetDraft(point: object): boolean {
  const row = point as QuestionStamp
  if (row.status !== 'draft') return false
  if (row.author || row.reviewedBy) return false
  const note = typeof row.draftNote === 'string' ? row.draftNote.trim() : ''
  if (!note) return false
  if (note === DRAFT_NOTE || MACHINE_NOTE.test(note)) return false
  if (AI_NOTE.test(note) || DESK_NOTE.test(note)) return false
  return true
}
