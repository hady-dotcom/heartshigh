import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import nodemailer from 'nodemailer'
import type { EmailAdapter, SendEmailOptions } from 'payload'
import { mailFrom } from './email-templates'
import { mailCatcherOn, recordCaughtMail } from './mail-catcher'

export type TransportMode = 'smtp' | 'resend' | 'catcher' | 'off'

export function mailTransportMode(env: Record<string, string | undefined> = process.env): TransportMode {
  if (mailCatcherOn(env) && !env.SMTP_URL && !env.RESEND_API_KEY) return 'catcher'
  if ((env.SMTP_URL || '').trim()) return 'smtp'
  if ((env.RESEND_API_KEY || '').trim()) return 'resend'
  if (mailCatcherOn(env)) return 'catcher'
  return 'off'
}

export function mailTransportOn(env: Record<string, string | undefined> = process.env) {
  return mailTransportMode(env) !== 'off'
}

function addressOf(item: unknown) {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object' && 'address' in item && typeof (item as { address?: unknown }).address === 'string') {
    return (item as { address: string }).address
  }
  return ''
}

function addresses(value: SendEmailOptions['to']) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(addressOf).join(', ')
  return addressOf(value)
}

function record(message: SendEmailOptions, from: string) {
  recordCaughtMail({
    to: addresses(message.to),
    subject: String(message.subject || ''),
    text: typeof message.text === 'string' ? message.text : '',
    html: typeof message.html === 'string' ? message.html : '',
    from,
  })
}

function logOff(message: SendEmailOptions) {
  console.info(
    JSON.stringify({
      time: new Date().toISOString(),
      level: 'info',
      event: 'email not sent: transport off',
      to: addresses(message.to),
      subject: message.subject || '',
    }),
  )
}

function wrap(adapter: EmailAdapter, env: Record<string, string | undefined>): EmailAdapter {
  return ({ payload }) => {
    const inner = adapter({ payload })
    return {
      ...inner,
      sendEmail: async (message) => {
        const from = typeof message.from === 'string' ? message.from : message.from?.address || `${inner.defaultFromName} <${inner.defaultFromAddress}>`
        if (mailCatcherOn(env)) record(message, from)
        return inner.sendEmail(message)
      },
    }
  }
}

function offAdapter(from: { name: string; address: string }): EmailAdapter {
  return () => ({
    name: 'hearts-off',
    defaultFromName: from.name,
    defaultFromAddress: from.address,
    sendEmail: async (message) => {
      logOff(message)
      return { accepted: [], rejected: [addresses(message.to)], pending: true }
    },
  })
}

function catcherAdapter(from: { name: string; address: string }): EmailAdapter {
  return () => ({
    name: 'hearts-catcher',
    defaultFromName: from.name,
    defaultFromAddress: from.address,
    sendEmail: async (message) => {
      record(message, `${from.name} <${from.address}>`)
      return { accepted: [addresses(message.to)], rejected: [] }
    },
  })
}

function resendAdapter(from: { name: string; address: string }, apiKey: string, env: Record<string, string | undefined>): EmailAdapter {
  return () => ({
    name: 'hearts-resend',
    defaultFromName: from.name,
    defaultFromAddress: from.address,
    sendEmail: async (message) => {
      const to = addresses(message.to)
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${from.name} <${from.address}>`,
          to: to.split(',').map((item) => item.trim()).filter(Boolean),
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(`Resend refused the email (${response.status}): ${detail.slice(0, 200)}`)
      }
      if (mailCatcherOn(env)) record(message, `${from.name} <${from.address}>`)
      return response.json()
    },
  })
}

/**
 * Payload `email` adapter. SMTP_URL (nodemailer) wins, then RESEND_API_KEY, then a catcher in tests.
 * When nothing is set, mail is logged as not sent. We never invent a success.
 */
export function emailAdapter(env: Record<string, string | undefined> = process.env): EmailAdapter | Promise<EmailAdapter> {
  const from = mailFrom(env)
  const mode = mailTransportMode(env)
  if (mode === 'smtp') {
    const transport = nodemailer.createTransport((env.SMTP_URL || '').trim())
    return nodemailerAdapter({
      defaultFromAddress: from.address,
      defaultFromName: from.name,
      skipVerify: env.HEARTS_E2E === '1' || env.HEARTS_MAIL_CATCHER === '1',
      transport,
    }).then((adapter) => wrap(adapter, env))
  }
  if (mode === 'resend') return resendAdapter(from, (env.RESEND_API_KEY || '').trim(), env)
  if (mode === 'catcher') return catcherAdapter(from)
  return offAdapter(from)
}
