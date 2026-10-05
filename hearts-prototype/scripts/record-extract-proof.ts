import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const BASE = process.env.PROOF_BASE || 'http://127.0.0.1:3000'
const DEST = path.resolve(process.cwd(), 'artifacts/talk-extracts')
mkdirSync(DEST, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: DEST, size: { width: 1440, height: 900 } },
})
const page = await context.newPage()

async function signIn(email: string, password: string, next: string) {
  await page.goto(`${BASE}/login?next=${encodeURIComponent(next)}`)
  if (page.url().includes('/login')) {
    await page.getByTestId('login-email').fill(email)
    await page.getByTestId('login-password').fill(password)
    await page.getByTestId('login-submit').click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  }
}

await signIn('master@hearts.test', 'hearts-master', '/master/library/10?part=10&extract=703')
await page.goto(`${BASE}/master/library/10?part=10&extract=703`)
await page.getByTestId('extract-review').waitFor({ timeout: 20_000 })
await page.getByTestId('extract-review-approve').click()
await page.waitForURL(/extract=/, { timeout: 20_000 })
if (/extract=703/.test(page.url())) throw new Error(`Approve did not advance: ${page.url()}`)
await page.waitForTimeout(1500)

await page.setViewportSize({ width: 390, height: 844 })
await page.context().clearCookies()
await signIn('elm-learner@hearts.test', 'portal-learner', '/p/east-london/feed?clip=45')
await page.goto(`${BASE}/p/east-london/feed?clip=45`)
await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
const feed = page.getByTestId('journey')
await feed.waitFor({ timeout: 20_000 })
await page.getByTestId('learn-more').first().click()
await page.waitForTimeout(2500)
await page.getByTestId('learn-more').first().click()
await page.waitForURL(/\/course\/10/, { timeout: 20_000 })
await page.waitForTimeout(1500)

const video = page.video()
await context.close()
await browser.close()
const recorded = video ? await video.path() : ''
console.log(`Recorded ${recorded}`)
console.log(`Admin advanced off extract=703. Learner opened course/10.`)
