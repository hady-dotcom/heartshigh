/**
 * Mobile Lighthouse gate for key learner pages.
 * Serves the production bundle (`next start`) against the local e2e database.
 * HEARTS_BUILD=1 is set only so this computer's sqlite file can boot; the
 * hosting checks (Postgres, object storage) still apply on Railway.
 * Fails when accessibility is under 95 or performance is under 80.
 * No paid service.
 */
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { launch as launchChrome } from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { chromium } from '@playwright/test'

const port = process.env.HEARTS_LH_PORT || '3105'
const base = `http://127.0.0.1:${port}`
const dist = process.env.HEARTS_DIST_DIR || '.next-lighthouse'
const reportPath = '/opt/cursor/artifacts/lighthouse-gate.json'

const pages = [
  { name: 'hady-home', path: '/p/parenting', email: 'parenting-learner@hearts.test', password: 'portal-learner' },
  { name: 'hady-courses', path: '/p/parenting/courses', email: 'parenting-learner@hearts.test', password: 'portal-learner' },
  { name: 'hady-me', path: '/p/parenting/me', email: 'parenting-learner@hearts.test', password: 'portal-learner' },
  { name: 'hearts-home', path: '/p/east-london', email: 'elm-learner@hearts.test', password: 'portal-learner' },
  { name: 'hearts-courses', path: '/p/east-london/courses', email: 'elm-learner@hearts.test', password: 'portal-learner' },
]

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`))))
  })
}

async function waitForHealth() {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`)
      if (response.ok) return
    } catch {
      // Server still booting.
    }
    await delay(2000)
  }
  throw new Error(`No health response from ${base}`)
}

async function tokenFor(email, password) {
  const response = await fetch(`${base}/api/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const lines = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  const token = lines.map((line) => line.split(';')[0]).find((line) => line.startsWith('payload-token='))?.slice('payload-token='.length)
  if (!response.ok || !token) {
    const text = await response.text()
    throw new Error(`Login failed for ${email} (${response.status}): ${text.slice(0, 240)}`)
  }
  return token
}

async function plantSession(browser, token) {
  const context = browser.contexts()[0]
  await context.clearCookies()
  await context.addCookies([{ name: 'payload-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }])
  const page = context.pages()[0] || (await context.newPage())
  const session = await context.newCDPSession(page)
  await session.send('Network.clearBrowserCache').catch(() => {})
  await session.detach()
}

if (!existsSync('data/hearts-test.db')) {
  console.error('Missing data/hearts-test.db. Run the e2e suite once so the local database is seeded.')
  process.exit(1)
}
mkdirSync('data', { recursive: true })
copyFileSync('data/hearts-test.db', 'data/hearts-lighthouse.db')

if (process.env.HEARTS_LH_SKIP_BUILD !== '1') {
  await run('npx', ['next', 'build'], {
    HEARTS_BUILD: '1',
    HEARTS_DIST_DIR: dist,
    NODE_OPTIONS: '--max-old-space-size=3072',
  })
}

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', port], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HEARTS_BUILD: '1',
    HEARTS_E2E: '1',
    HEARTS_DIST_DIR: dist,
    DATABASE_URL: 'file:./data/hearts-lighthouse.db',
    PAYLOAD_SECRET: 'lighthouse-local-gate-secret-32chars-min',
    HEARTS_TRUSTED_PROXY_HOPS: '0',
    PORT: port,
  },
})

const scores = []
let failed = false
try {
  await waitForHealth()
  const chrome = await launchChrome({
    chromePath: chromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  })
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`)
  try {
    for (const page of pages) {
      // Chrome drops a Cookie extra header after the first navigation. Plant the
      // session in the profile instead, and keep storage so that cookie survives.
      // The cache is cleared above so a later page is not scored from a warm disk.
      await plantSession(browser, await tokenFor(page.email, page.password))
      const result = await lighthouse(`${base}${page.path}`, {
        port: chrome.port,
        onlyCategories: ['accessibility', 'performance'],
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
        extraHeaders: { 'Sec-CH-Prefers-Color-Scheme': 'light' },
        disableStorageReset: true,
        output: 'json',
        logLevel: 'error',
      })
      const accessibility = Math.round((result?.lhr?.categories?.accessibility?.score || 0) * 100)
      const performance = Math.round((result?.lhr?.categories?.performance?.score || 0) * 100)
      const audits = result?.lhr?.audits || {}
      const opportunities = Object.values(audits)
        .filter((audit) => audit.details?.type === 'opportunity' && audit.numericValue > 0)
        .map((audit) => ({ id: audit.id, title: audit.title, savingsMs: Math.round(audit.numericValue) }))
        .sort((a, b) => b.savingsMs - a.savingsMs)
        .slice(0, 6)
      const finalUrl = result?.lhr?.finalUrl || ''
      const row = { name: page.name, path: page.path, finalUrl, accessibility, performance, opportunities }
      scores.push(row)
      console.log(`${page.name}: accessibility ${accessibility}, performance ${performance} ${finalUrl.replace(base, '')}`)
      if (accessibility < 95 || performance < 80) failed = true
    }
  } finally {
    await browser.close().catch(() => {})
    await chrome.kill()
  }
} finally {
  server.kill('SIGTERM')
  mkdirSync('/opt/cursor/artifacts', { recursive: true })
  writeFileSync(reportPath, JSON.stringify({ scores, failed }, null, 2))
}

if (failed || !scores.length) {
  console.error('Lighthouse gate failed. Accessibility must be at least 95 and performance at least 80.')
  process.exit(1)
}
console.log('Lighthouse gate passed.')
