import { expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test'
import { authenticator } from 'otplib'
import { E2E_BASE, seedCode } from '../env'

export const PORTAL = 'east-london'
export const BASE = `/p/${PORTAL}`
export const SETTINGS = `${BASE}/me/settings`
export const CALM_FORGOT = 'If that email has an account, we have sent a reset link.'
export const RESET_STALE = 'That reset link is not valid any more.'

export function uniqueEmail(label: string) {
  return `${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@hearts.test`
}

export async function asUser(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { accept: 'application/json' } })
  const login = await ctx.post('/api/users/login', { data: { email, password } })
  expect(login.ok(), `login ${email} (${login.status()})`).toBeTruthy()
  return ctx
}

export async function signIn(page: Page, email: string, password: string, next = SETTINGS) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
}

export async function joinLearner(page: Page, name: string, email: string, password: string, code = seedCode('elm-learner')) {
  await page.goto(`/join?code=${code}`)
  await page.getByTestId('join-name').fill(name)
  await page.getByTestId('join-email').fill(email)
  await page.getByTestId('join-password').fill(password)
  await page.getByTestId('join-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/join'))
}

export async function caughtMail() {
  const res = await fetch(`${E2E_BASE}/api/hearts/mail`)
  expect(res.ok(), `mail catcher ${res.status()}`).toBeTruthy()
  const body = (await res.json()) as { emails: { id: string; to: string; subject: string; text: string; html: string }[] }
  return body.emails || []
}

export async function waitForMail(to: string, subjectPart?: string, afterId?: string) {
  const want = to.trim().toLowerCase()
  for (let i = 0; i < 40; i += 1) {
    const emails = await caughtMail()
    const found = [...emails].reverse().find((row) => {
      if (afterId && row.id <= afterId) return false
      if (!row.to.toLowerCase().includes(want)) return false
      if (subjectPart && !row.subject.toLowerCase().includes(subjectPart.toLowerCase())) return false
      return true
    })
    if (found) return found
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`No caught mail to ${to}${subjectPart ? ` about ${subjectPart}` : ''}`)
}

export function mailLink(mail: { text: string; html: string }, pathStart: string) {
  const blob = `${mail.text}\n${mail.html}`
  const escaped = pathStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const absolute = blob.match(new RegExp(`https?://\\S*${escaped}\\S*`, 'i'))
  if (absolute) return absolute[0].replace(/[).,;"']+$/, '')
  const relative = blob.match(new RegExp(`(?:href=["'])?(${escaped.startsWith('/') ? '' : '/'}${escaped}\\S*)`, 'i'))
  return relative ? relative[1].replace(/[).,;"']+$/, '') : null
}

export async function confirmFromInbox(page: Page, email: string) {
  const mail = await waitForMail(email, 'Confirm your email')
  const href = mailLink(mail, '/confirm')
  expect(href, 'confirm link in the email').toBeTruthy()
  await page.goto(href!)
  await expect(page.getByTestId('notice')).toContainText('confirmed')
}

export async function findUserId(master: APIRequestContext, email: string) {
  const body = await (await master.get(`/api/users?where[email][equals]=${encodeURIComponent(email)}&depth=0&limit=1`)).json()
  const id = body.docs?.[0]?.id
  expect(id, `user ${email}`).toBeTruthy()
  return Number(id)
}

export async function findPortalId(master: APIRequestContext, slug: string) {
  const body = await (await master.get(`/api/portals?where[slug][equals]=${slug}&depth=0&limit=1`)).json()
  const id = body.docs?.[0]?.id
  expect(id, `portal ${slug}`).toBeTruthy()
  return Number(id)
}

export async function postAction(ctx: APIRequestContext, fields: Record<string, string>, maxRedirects = 0) {
  return ctx.post('/api/hearts', { form: fields, maxRedirects })
}

export function totpNow(secret: string) {
  return authenticator.generate(secret.replace(/\s+/g, ''))
}

export function secretFromSetup(text: string) {
  const match = text.match(/Or type this key:\s*([A-Z2-7]+)/i)
  expect(match, 'setup secret on the page').toBeTruthy()
  return match![1]
}
