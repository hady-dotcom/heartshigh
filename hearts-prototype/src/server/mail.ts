/**
 * Outbound mail. A no-op unless a mail transport is configured.
 * In-app notifications and messages are the real path; this is only a hook.
 */

export type MailInput = { to: string; subject: string; text: string }

export function mailConfigured() {
  return Boolean(process.env.MAIL_URL || process.env.SMTP_URL || process.env.MAIL_FROM)
}

export async function sendMail(input: MailInput): Promise<{ sent: boolean; reason?: string }> {
  if (!mailConfigured()) return { sent: false, reason: 'not-configured' }
  // A later pass can plug in SMTP. Until then we refuse to pretend a letter went out.
  return { sent: false, reason: 'transport-not-wired' }
}

export async function sendMailToMany(addresses: string[], subject: string, text: string) {
  const results = []
  for (const to of addresses) {
    if (!to || !to.includes('@')) continue
    results.push(await sendMail({ to, subject, text }))
  }
  return results
}
