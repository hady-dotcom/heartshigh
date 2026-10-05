import { pausedSinceMessage } from './account-rules'
import { contrastRatio, deskTokens } from './desk-tokens'

export type MailKind =
  | 'test'
  | 'reset'
  | 'password-changed'
  | 'confirm'
  | 'email-changed-new'
  | 'email-changed-old'
  | 'suspended'
  | 'restored'
  | 'delete-requested'
  | 'delete-cancelled'
  | 'delete-done'
  | 'data-ready'
  | 'teacher-reply'
  | 'future-question'
  | 'live-soon'
  | 'gather-tomorrow'
  | 'study-plan'
  | 'weekly'
  | 'join-link'
  | 'temp-password'
  | 'two-step-reset'

export type MailVars = {
  name?: string
  portalName?: string
  buttonUrl?: string
  buttonLabel?: string
  extra?: string
  why?: string
  since?: string
}

export type RenderedMail = { subject: string; text: string; html: string }

const TEAL = deskTokens.page
const GOLD = deskTokens.gold
const GOLD_INK = deskTokens.goldInk
const CREAM = deskTokens.ink

export const MAIL_CONTRAST = {
  header: contrastRatio(CREAM, TEAL),
  button: contrastRatio(GOLD_INK, GOLD),
}

const SUBJECT: Record<MailKind, string> = {
  test: 'A test email from HEARTS',
  reset: 'Reset your HEARTS password',
  'password-changed': 'Your HEARTS password was changed',
  confirm: 'Confirm your email for HEARTS',
  'email-changed-new': 'Confirm your new HEARTS email',
  'email-changed-old': 'Your HEARTS email is being changed',
  suspended: 'Your HEARTS account has been paused',
  restored: 'Your HEARTS account is open again',
  'delete-requested': 'We have started deleting your HEARTS account',
  'delete-cancelled': 'Your HEARTS account will stay',
  'delete-done': 'Your HEARTS account has been deleted',
  'data-ready': 'Your HEARTS data is ready to download',
  'teacher-reply': 'Your teacher replied',
  'future-question': 'A new question is waiting for you',
  'live-soon': 'A live sitting starts in about an hour',
  'gather-tomorrow': 'A gathering is tomorrow',
  'study-plan': 'A study plan has been shared with you',
  weekly: 'Your week on HEARTS',
  'join-link': 'You are invited to HEARTS',
  'temp-password': 'A temporary HEARTS password',
  'two-step-reset': 'Your two-step sign-in was reset',
}

const BODY: Record<MailKind, (portal: string) => string> = {
  test: () => 'This is a test from the HEARTS desk, so you can see that mail is working.',
  reset: () => 'Use the button to choose a new password. The link lasts one hour.',
  'password-changed': () => 'Your password was changed just now. If that was not you, please speak to your teacher or masjid.',
  confirm: () => 'Please confirm this email belongs to you. You can keep using HEARTS in the meantime.',
  'email-changed-new': () => 'A request was made to use this address for a HEARTS account. Confirm it to finish the change.',
  'email-changed-old': () => 'A request was made to change the email on this HEARTS account. If that was not you, sign in and speak to your teacher.',
  suspended: () => 'This account is paused. Your learning is kept. Please speak to your masjid or school.',
  restored: () => 'This account is open again. You can sign in as before.',
  'delete-requested': () => 'We will delete this account in 14 days. Signing in before then cancels the request.',
  'delete-cancelled': () => 'You signed in, so we have cancelled the request to delete this account.',
  'delete-done': () => 'This HEARTS account and the personal data we held for it have been deleted.',
  'data-ready': () => 'Your download is ready. The link lasts 24 hours and only works for you.',
  'teacher-reply': () => 'Your teacher left a reply on something you shared.',
  'future-question': () => 'A question that was waiting has opened. It is in your workbook.',
  'live-soon': () => 'A live sitting begins in about an hour. You can add it to your calendar from the button.',
  'gather-tomorrow': () => 'A gathering you are part of is tomorrow. We hope to see you there.',
  'study-plan': () => 'Your teacher has shared a study plan with you. Open HEARTS to see the days.',
  weekly: () => 'A quiet look at your week: what you opened, and what is waiting.',
  'join-link': (portal) => `You have been invited to join ${portal} on HEARTS. The button opens the join page.`,
  'temp-password': () => 'Your teacher set a temporary password. Sign in with it, then choose one of your own.',
  'two-step-reset': () => 'A master reset your two-step sign-in. Next time you sign in you will set it up again.',
}

const DEFAULT_WHY: Record<MailKind, string> = {
  test: 'You asked the desk to send a test email.',
  reset: 'someone asked to reset the password on this address.',
  'password-changed': 'We tell you when the password on this account changes.',
  confirm: 'this address was used to join HEARTS.',
  'email-changed-new': 'someone asked to move a HEARTS account to this address.',
  'email-changed-old': 'This was the email on a HEARTS account that is being changed.',
  suspended: 'a teacher or admin paused this account.',
  restored: 'a teacher or admin opened this account again.',
  'delete-requested': 'You asked us to delete this account.',
  'delete-cancelled': 'You signed in after asking us to delete this account.',
  'delete-done': 'The 14 days after your delete request have passed.',
  'data-ready': 'You asked to download a copy of your HEARTS data.',
  'teacher-reply': 'You chose to hear about replies from your teacher.',
  'future-question': 'You chose to hear when a waiting question opens.',
  'live-soon': 'You chose to hear before a live sitting.',
  'gather-tomorrow': 'You chose to hear the day before a gathering.',
  'study-plan': 'You chose to hear when a study plan is shared.',
  weekly: 'You chose a weekly note from HEARTS.',
  'join-link': 'A teacher or admin sent you this join link.',
  'temp-password': 'A teacher or admin set a temporary password for you.',
  'two-step-reset': 'The master desk reset two-step sign-in on this account.',
}

const DEFAULT_BUTTON: Partial<Record<MailKind, string>> = {
  test: 'Open HEARTS',
  reset: 'Choose a new password',
  confirm: 'Confirm this email',
  'email-changed-new': 'Confirm this email',
  'data-ready': 'Download my data',
  'teacher-reply': 'Open the reply',
  'future-question': 'Open the question',
  'live-soon': 'Open the sitting',
  'gather-tomorrow': 'Open the gathering',
  'study-plan': 'Open my plan',
  weekly: 'Open HEARTS',
  'join-link': 'Join HEARTS',
  'temp-password': 'Sign in',
}

export function greetingName(name?: string | null) {
  const trimmed = (name || '').trim()
  return trimmed || 'there'
}

export function mailPortalLabel(name?: string | null) {
  const trimmed = (name || '').trim()
  return trimmed && trimmed.toLowerCase() !== 'hearts' ? trimmed : 'this circle'
}

export function mailSignOff(portal: string) {
  return `${portal} on HEARTS`
}

export function mailIgnoreLine(kind: MailKind) {
  if (kind === 'reset') return "If this wasn't you, you can ignore this email. Your password stays the same."
  if (kind === 'confirm' || kind === 'email-changed-new') return "If this wasn't you, you can ignore this email."
  if (kind === 'suspended') return "If this wasn't you, please speak to your masjid or school."
  return ''
}

export function renderMail(kind: MailKind, vars: MailVars = {}): RenderedMail {
  const portal = mailPortalLabel(vars.portalName)
  const name = greetingName(vars.name)
  const body = kind === 'suspended' && vars.since
    ? [pausedSinceMessage(vars.since), 'Your learning is kept.', vars.extra].filter(Boolean).join(' ')
    : vars.extra ? `${BODY[kind](portal)} ${vars.extra}`.trim() : BODY[kind](portal)
  const why = vars.why || DEFAULT_WHY[kind]
  const ignore = mailIgnoreLine(kind)
  const signOff = mailSignOff(portal)
  const buttonLabel = vars.buttonLabel || DEFAULT_BUTTON[kind]
  const buttonUrl = vars.buttonUrl
  const subject = SUBJECT[kind]
  const textLines = [`Assalamu alaikum, ${name}.`, '', body]
  if (buttonUrl) textLines.push('', buttonLabel ? `${buttonLabel}: ${buttonUrl}` : buttonUrl)
  textLines.push('', `You received this because ${why}`)
  if (ignore) textLines.push('', ignore)
  textLines.push('', signOff)
  const text = textLines.join('\n')
  const button = buttonUrl
    ? `<p style="margin:28px 0 8px"><a href="${escapeHtml(buttonUrl)}" style="background:${GOLD};color:${GOLD_INK};padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;display:inline-block">${escapeHtml(buttonLabel || 'Open')}</a></p>`
    : ''
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#ffffff;font-family:Georgia,'Times New Roman',serif;color:#1A1408;line-height:1.5">
  <div style="background:${TEAL};color:${CREAM};padding:18px 24px;font-family:system-ui,sans-serif;letter-spacing:0.08em;font-size:13px;font-weight:700">HEARTS</div>
  <div style="padding:24px;max-width:32rem">
    <p style="margin:0 0 12px">Assalamu alaikum, ${escapeHtml(name)}.</p>
    <p style="margin:0 0 12px">${escapeHtml(body)}</p>
    ${button}
    <p style="margin:28px 0 0;font-size:13px;color:#5a4a28">You received this because ${escapeHtml(why)}</p>
    ${ignore ? `<p style="margin:12px 0 0;font-size:13px;color:#5a4a28">${escapeHtml(ignore)}</p>` : ''}
    <p style="margin:8px 0 0;font-size:13px;color:#5a4a28">${escapeHtml(signOff)}</p>
  </div>
</body></html>`
  return { subject, text, html }
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function mailFrom(env: Record<string, string | undefined> = process.env) {
  const raw = (env.MAIL_FROM || '').trim()
  if (raw.includes('<') && raw.includes('>')) {
    const name = raw.slice(0, raw.indexOf('<')).trim().replace(/^"|"$/g, '') || 'HEARTS'
    const address = raw.slice(raw.indexOf('<') + 1, raw.indexOf('>')).trim()
    if (address.includes('@')) return { name, address }
  }
  if (raw.includes('@')) return { name: 'HEARTS', address: raw }
  return { name: 'HEARTS', address: 'noreply@hearts.local' }
}
