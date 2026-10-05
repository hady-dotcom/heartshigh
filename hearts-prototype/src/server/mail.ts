import type { Payload } from 'payload'
import { mailTransportMode, mailTransportOn } from '@/lib/email-adapter'
import { mailFrom, renderMail, type MailKind, type MailVars } from '@/lib/email-templates'
import { logError } from '@/lib/log'
import { publicBaseURL, serverURL } from '@/lib/env'

export type SendMailResult = { sent: true } | { sent: false; reason: 'transport-off' | 'send-failed' | 'no-address' }

export function mailPublicUrl(path: string, requestOrigin?: string | null) {
  const e2e = process.env.HEARTS_E2E === '1' ? requestOrigin || process.env.NEXT_PUBLIC_SITE_URL || '' : ''
  const base = publicBaseURL(process.env, requestOrigin) || serverURL() || e2e || requestOrigin || ''
  const origin = base.replace(/\/$/, '')
  const href = path.startsWith('/') ? path : `/${path}`
  return origin ? `${origin}${href}` : href
}

export async function sendMail(
  payload: Payload,
  args: { to?: string | null; kind: MailKind; vars?: MailVars; unsubscribeUrl?: string },
): Promise<SendMailResult> {
  const to = (args.to || '').trim().toLowerCase()
  if (!to || !to.includes('@')) return { sent: false, reason: 'no-address' }
  const rendered = renderMail(args.kind, args.vars)
  const from = mailFrom()
  const footer = args.unsubscribeUrl
    ? `\n\nStop these emails: ${args.unsubscribeUrl}`
    : ''
  const htmlFooter = args.unsubscribeUrl
    ? `<p style="margin:24px 0 0;font-size:12px"><a href="${args.unsubscribeUrl}">Stop these emails</a></p>`
    : ''
  if (!mailTransportOn()) {
    console.info(JSON.stringify({ time: new Date().toISOString(), level: 'info', event: 'email not sent: transport off', to, kind: args.kind }))
    return { sent: false, reason: 'transport-off' }
  }
  try {
    await payload.sendEmail({
      from: `${from.name} <${from.address}>`,
      to,
      subject: rendered.subject,
      text: `${rendered.text}${footer}`,
      html: rendered.html.replace('</div>\n</body>', `${htmlFooter}</div></body>`),
    })
    return { sent: true }
  } catch (error) {
    logError('email send failed', error, { kind: args.kind, to })
    return { sent: false, reason: 'send-failed' }
  }
}

export function transportBanner() {
  const mode = mailTransportMode()
  if (mode === 'off') return 'Email is off. Set SMTP_URL or RESEND_API_KEY, and MAIL_FROM. Nothing is being sent.'
  if (mode === 'catcher') return 'Email is writing to the local catcher used in tests. Set SMTP_URL or RESEND_API_KEY for real mail.'
  if (mode === 'smtp') return 'Email is sending through SMTP.'
  return 'Email is sending through Resend.'
}

export { mailTransportOn, mailTransportMode }
