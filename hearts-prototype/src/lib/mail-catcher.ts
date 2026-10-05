import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export type CaughtMail = {
  id: string
  at: string
  to: string
  subject: string
  text: string
  html: string
  from?: string
}

function filePath(env: Record<string, string | undefined> = process.env) {
  return env.HEARTS_MAIL_CATCHER_FILE || path.join(process.cwd(), 'data', 'mail-catcher.json')
}

export function mailCatcherOn(env: Record<string, string | undefined> = process.env) {
  return env.HEARTS_MAIL_CATCHER === '1' || env.HEARTS_E2E === '1'
}

export function readCaughtMail(env: Record<string, string | undefined> = process.env): CaughtMail[] {
  const file = filePath(env)
  if (!existsSync(file)) return []
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function recordCaughtMail(mail: Omit<CaughtMail, 'id' | 'at'>, env: Record<string, string | undefined> = process.env) {
  const file = filePath(env)
  mkdirSync(path.dirname(file), { recursive: true })
  const rows = readCaughtMail(env)
  const entry: CaughtMail = {
    id: `mail-${Date.now()}-${rows.length + 1}`,
    at: new Date().toISOString(),
    ...mail,
  }
  rows.push(entry)
  writeFileSync(file, JSON.stringify(rows, null, 2))
  return entry
}

export function clearCaughtMail(env: Record<string, string | undefined> = process.env) {
  const file = filePath(env)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, '[]')
}

export function latestMailTo(to: string, env: Record<string, string | undefined> = process.env) {
  const want = to.trim().toLowerCase()
  return [...readCaughtMail(env)].reverse().find((row) => row.to.toLowerCase().includes(want)) || null
}

export function linkFromMail(mail: CaughtMail | null, pathStart: string) {
  if (!mail) return null
  const blob = `${mail.text}\n${mail.html}`
  const escaped = pathStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const absolute = blob.match(new RegExp(`https?://[^\\s"'<>]*${escaped}[^\\s"'<>]*`, 'i'))
  if (absolute) return absolute[0].replace(/[).,;"']+$/, '')
  const relative = blob.match(new RegExp(`(?:href=["'])(${escaped.startsWith('/') ? '' : '/'}${escaped}[^\\s"'<>]*)`, 'i'))
  return relative ? relative[1].replace(/[).,;"']+$/, '') : null
}
