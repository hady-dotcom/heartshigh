import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dest = process.env.R5C_BEFORE || join(dirname(fileURLToPath(import.meta.url)), '../artifacts/r5c-look/before')
const base = process.env.R5C_BASE || 'http://127.0.0.1:3200'
mkdirSync(dest, { recursive: true })

async function signIn(page, email, password, next) {
  await page.goto(`${base}/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function shot(page, name, href) {
  await page.goto(`${base}${href}`)
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(dest, `${name}.png`), caret: 'initial' })
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
await shot(page, 'welcome', '/p/east-london/welcome?step=start')
await shot(page, 'home', '/p/east-london')
await shot(page, 'lanes', '/p/east-london/lanes')
await shot(page, 'workbook', '/p/east-london/garden/workbook')
await shot(page, 'me', '/p/east-london/me')
const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await signIn(desk, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/compass')
await desk.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
await desk.waitForTimeout(500)
await desk.screenshot({ path: join(dest, 'compass.png'), caret: 'initial' })
await browser.close()
console.log(`before shots in ${dest}`)
