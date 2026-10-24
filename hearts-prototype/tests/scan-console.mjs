import { chromium } from '@playwright/test'

const base = process.env.BASE_URL || 'http://127.0.0.1:3000'
const elm = '/p/east-london'
const learnerPaths = ['', '/lanes', '/speaker/mikaeel-smith', '/course/3', '/course/1', '/garden', '/garden/general', '/garden/jibril', '/garden/jibril/10', '/garden/ghunya', '/garden/harvest', '/garden/workbook', '/me', '/me/plan', '/me/circle', '/me/settings', '/welcome?step=placing', '/welcome?step=done'].map((path) => `${elm}${path}`)
const adminPaths = ['', '/content', '/content/3', '/content/4', '/library', '/access', '/teach', '/plans', '/nights', '/settings', '/wizard'].map((path) => `${elm}/admin${path}`)
const visits = [
  ['elm-learner@hearts.test', 'portal-learner', learnerPaths, { width: 390, height: 844 }],
  ['elm-admin@hearts.test', 'portal-admin', adminPaths, { width: 1440, height: 900 }],
  ['elm-teacher@hearts.test', 'portal-teacher', [`${elm}/admin`, `${elm}/admin/teach`, `${elm}/admin/plans`, `${elm}/admin/nights`], { width: 1440, height: 900 }],
  ['master@hearts.test', 'hearts-master', ['/master', '/master/library', '/master/library/3', '/master/packs', '/master/questions'], { width: 1440, height: 900 }],
]

const browser = await chromium.launch()
let problems = 0
let thirdPartyCount = 0
for (const [email, password, paths, viewport] of visits) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const log = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return
    const where = msg.location()?.url || ''
    const thirdParty = /youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com/.test(where) || (!where && /web-share|No available adapters|compute-pressure/.test(msg.text()))
    if (thirdParty) thirdPartyCount += 1
    else log.push(`${msg.type()}: ${msg.text().slice(0, 400)} ${where}`)
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
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    if (log.length || issues || overflow || (status && status >= 400)) {
      problems += 1
      console.log(`\n${email} ${path} status=${status} ${issues}${overflow ? ' horizontal-overflow' : ''}`)
      for (const line of log) console.log('  ', line)
    }
  }
  await context.close()
}
await browser.close()
console.log(problems ? `\n${problems} screens with problems` : 'No console or runtime problems found in our code.')
if (thirdPartyCount) console.log(`${thirdPartyCount} messages came from inside the YouTube embed and are not ours to fix.`)
process.exit(problems ? 1 : 0)
