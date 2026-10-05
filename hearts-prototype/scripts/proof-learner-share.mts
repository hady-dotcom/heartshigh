import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const OUT = path.resolve('artifacts/learner-share')
mkdirSync(OUT, { recursive: true })
const BASE = 'http://127.0.0.1:3100'
const code = JSON.parse(readFileSync('data/seed-codes-test.json', 'utf8')) as { 'elm-learner': string }

const browser = await chromium.launch()
const phone = await browser.newContext({ viewport: { width: 390, height: 844 } })
const p = await phone.newPage()

async function shot(name: string) {
  await p.waitForTimeout(400)
  await p.screenshot({ path: path.join(OUT, `${name}.png`), caret: 'initial' })
}

await p.goto(`${BASE}/`)
await p.getByTestId('door').waitFor()
await shot('01-door')

await p.goto(`${BASE}/login`)
await p.getByTestId('login').waitFor()
await shot('02-login')

await p.goto(`${BASE}/join?code=${code['elm-learner']}`)
await p.getByTestId('join').waitFor()
await shot('03-join')

const email = `share-${Date.now().toString().slice(-6)}@hearts.test`
await p.getByTestId('join-name').fill('Share Learner')
await p.getByTestId('join-email').fill(email)
await p.getByTestId('join-password').fill('share-learner')
await p.getByTestId('join-submit').click()
await p.getByTestId('welcome-films').or(p.getByTestId('splash')).waitFor()
if (await p.getByTestId('welcome-begin').count()) {
  await shot('04-welcome-splash')
  await p.getByTestId('welcome-begin').click()
}
await p.getByTestId('welcome-films').waitFor()
await shot('05-welcome-film')
await p.getByTestId('welcome-skip').click()
await p.getByTestId('welcome-intro').waitFor()
await shot('06-intro-film')
await p.getByTestId('welcome-skip').click()
await p.waitForURL(/\/p\/east-london/)
await shot('07-opening')

await phone.close()

const maryam = await browser.newContext({ viewport: { width: 390, height: 844 } })
const m = await maryam.newPage()
await m.goto(`${BASE}/login?next=${encodeURIComponent('/p/east-london')}`)
await m.getByTestId('login-email').fill('elm-learner@hearts.test')
await m.getByTestId('login-password').fill('portal-learner')
await m.getByTestId('login-submit').click()
await m.getByTestId('home').waitFor()
await m.screenshot({ path: path.join(OUT, '08-home.png'), caret: 'initial' })

const routes: [string, string][] = [
  ['09-feed', '/p/east-london/feed'],
  ['10-lanes', '/p/east-london/lanes'],
  ['11-speaker', '/p/east-london/speaker/mikaeel-smith'],
  ['12-garden', '/p/east-london/garden'],
  ['13-harvest', '/p/east-london/garden/harvest'],
  ['14-week', '/p/east-london/week'],
  ['15-me', '/p/east-london/me'],
]
for (const [name, href] of routes) {
  await m.goto(`${BASE}${href}`)
  await m.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
  await m.waitForTimeout(500)
  await m.screenshot({ path: path.join(OUT, `${name}.png`), caret: 'initial' })
}

await browser.close()
console.log('wrote learner share shots to', OUT)
