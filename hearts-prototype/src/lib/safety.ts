import { hasMarkup, killHits } from './text-safety'
import { screenAnswer } from './answer-moderation'

export const REPORT_REASONS = ['unkind', 'misleading', 'spam', 'at-risk', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_LABEL: Record<ReportReason, string> = {
  unkind: 'Unkind or hurtful',
  misleading: 'Wrong or misleading about the deen',
  spam: 'Spam or selling',
  'at-risk': 'Someone may be at risk',
  other: 'Something else',
}

export const TARGET_TYPES = ['answer', 'circle-answer', 'live-question', 'gather-photo', 'teacher-reply'] as const
export type TargetType = (typeof TARGET_TYPES)[number]

export const ANNOUNCE_AUDIENCES = ['everyone', 'teachers', 'code'] as const
export type AnnounceAudience = (typeof ANNOUNCE_AUDIENCES)[number]

export const SLOW_DOWN = "Let's slow down a moment. Try again in a few minutes."
export const REPORT_THANKS = 'Thank you. A person will look at this.'
export const SAFEGUARD_EMAIL_SUBJECT = 'A learner may need support'
export const SAFEGUARD_EMAIL_BODY = 'A learner may need support. Please look today.'
export const ANNOUNCE_MAX = 500

const ANNOUNCE_KILL = ['quiz', 'survey', 'test', 'score', 'assessment']

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === 'string' && (REPORT_REASONS as readonly string[]).includes(value)
}

export function isTargetType(value: unknown): value is TargetType {
  return typeof value === 'string' && (TARGET_TYPES as readonly string[]).includes(value)
}

export function isAnnounceAudience(value: unknown): value is AnnounceAudience {
  return typeof value === 'string' && (ANNOUNCE_AUDIENCES as readonly string[]).includes(value)
}

export function reportNoteProblems(note: string) {
  const text = String(note || '').trim()
  if (text.length > 500) return ['Keep the note under 500 characters.']
  if (hasMarkup(text)) return ['The note is plain text: no HTML or code.']
  return []
}

/** Three ordinary reports, or one at-risk report, hide the item until staff look. */
export function shouldAutoHide(reasons: ReportReason[]) {
  if (reasons.includes('at-risk')) return true
  return reasons.length >= 3
}

export function safeguardingFromReport(reason: ReportReason) {
  return reason === 'at-risk'
}

export function safeguardingFromText(text: string) {
  return screenAnswer(text).atRisk
}

export function announceProblems(body: string) {
  const text = String(body || '').trim()
  if (!text) return ['Write a short message.']
  if (text.length > ANNOUNCE_MAX) return [`Keep the message under ${ANNOUNCE_MAX} characters.`]
  if (hasMarkup(text)) return ['Announcements are plain text: no HTML or code.']
  const hits = killHits(text, ANNOUNCE_KILL)
  if (hits.length) return ['Please say this in ordinary words, without marks or tests.']
  return []
}

export function announceAudienceLabel(audience: string) {
  if (audience === 'teachers') return 'Teachers only'
  if (audience === 'code') return 'One access code'
  return 'Everyone in the portal'
}

export type SafetyRole = 'master' | 'portal-admin' | 'teacher' | 'learner' | string

export function canModerate(role: SafetyRole | null | undefined) {
  return role === 'master' || role === 'portal-admin' || role === 'teacher'
}

export function canSeeAlertContent(user: { id: number; role?: string | null }, leadUserId: number | null) {
  if (user.role === 'master') return true
  if (leadUserId && user.id === leadUserId) return true
  return false
}

export function tealMailHtml(title: string, body: string, href?: string, button = 'Open Hady Core') {
  const link = href
    ? `<p style="margin:24px 0"><a href="${href}" style="background:#D4A84B;color:#1A1408;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">${button}</a></p>`
    : `<p style="margin:24px 0;color:#D4A84B">Open Care and safety in Hady Core.</p>`
  return `<!doctype html><html lang="en-GB"><body style="margin:0;font-family:Georgia,serif;background:#F6EEDC;color:#1A1408">
<div style="background:#0E2A2B;color:#F6EEDC;padding:18px 24px"><strong>${title}</strong></div>
<div style="padding:24px;max-width:32rem">${body}${link}<p style="color:#5a4a2a;font-size:13px">You received this because you are named as a contact for this portal.</p></div>
</body></html>`
}
