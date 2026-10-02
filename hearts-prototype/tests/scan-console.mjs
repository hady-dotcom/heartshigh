import { chromium } from '@playwright/test'

const base = process.env.BASE_URL || 'http://127.0.0.1:3000'
const visits = [
  ['elm-learner@hearts.test', 'portal-learner', ['/p/east-london/feed', '/p/east-london/path', '/p/east-london/grow', '/p/east-london/chapter', '/p/east-london/schedule', '/p/east-london/night', '/p/east-london/notifications', '/p/east-london/watch/1']],
  ['elm-admin@hearts.test', 'portal-admin', ['/p/east-london/admin', '/p/east-london/admin/courses', '/p/east-london/admin/adopt', '/p/east-london/admin/codes', '/p/east-london/admin/teach', '/p/east-london/admin/settings', '/p/east-london/schedule', '/p/east-london/night']],
  ['master@hearts.test', 'hearts-master', ['/master', '/master/questions']],
]

const browser = await chromium.launch()
let problems = 0
for (const [email, password, paths] of visits) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const log = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') log.push(`${msg.type()}: ${msg.text().slice(0, 400)}`)
  })
  page.on('pageerror', (error) => log.push(`pageerror: ${error.message.slice(0, 400)}`))
  await page.goto(`${base}/login`)
  await page.fill('[data-testid=login-email]', email)
  await page.fill('[data-testid=login-password]', password)
  await page.click('[data-testid=login-submit]')
  await page.waitForLoadState('networkidle')
  for (const path of ['/', ...paths]) {
    log.length = 0
    const response = await page.goto(`${base}${path}`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(800)
    const issues = await page.evaluate(() => {
      const portal = document.querySelector('nextjs-portal')
      const text = portal?.shadowRoot?.textContent || ''
      const match = text.match(/(\d+)\s*Issues?/)
      return match ? match[0] : ''
    })
    const status = response?.status()
    if (log.length || issues || (status && status >= 400)) {
      problems += 1
      console.log(`\n${email} ${path} status=${status} ${issues}`)
      for (const line of log) console.log('  ', line)
    }
  }
  await context.close()
}
await browser.close()
console.log(problems ? `\n${problems} screens with problems` : 'No console or runtime problems found.')
process.exit(problems ? 1 : 0)
