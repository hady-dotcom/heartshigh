// Dev helper: screenshots of a few screens on the running dev server. Usage: node scripts/peek.mjs <name> <path> [email password] [width height]
import { chromium } from '@playwright/test'

const [name, target, email, password, width = '390', height = '844'] = process.argv.slice(2)
const base = process.env.PEEK_BASE || 'http://localhost:3000'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } })
if (email) {
  await page.goto(`${base}/login?next=${encodeURIComponent(target)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 })
}
await page.goto(`${base}${target}`, { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => {})
await page.waitForTimeout(Number(process.env.PEEK_WAIT || 2500))
await page.screenshot({ path: `/tmp/peek-${name}.png` })
console.log(`/tmp/peek-${name}.png`, page.url())
await browser.close()
