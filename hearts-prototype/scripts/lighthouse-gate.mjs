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

async function cookieFor(email, password) {
  const response = await fetch(`${base}/api/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const lines = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  const pairs = lines.map((line) => line.split(';')[0]).filter((line) => line.includes('token='))
  if (!response.ok || !pairs.length) {
    const text = await response.text()
    throw new Error(`Login failed for ${email} (${response.status}): ${text.slice(0, 240)}`)
  }
  return pairs.join('; ')
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
    HEARTS_DIST_DIR: dist,
    DATABASE_URL: 'file:./data/hearts-lighthouse.db',
    PAYLOAD_SECRET: 'lighthouse-local-gate-secret-32chars-min',
    SERVER_URL: base,
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
  try {
    for (const page of pages) {
      const cookie = await cookieFor(page.email, page.password)
      const result = await lighthouse(`${base}${page.path}`, {
        port: chrome.port,
        onlyCategories: ['accessibility', 'performance'],
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
        extraHeaders: { Cookie: cookie },
        output: 'json',
        logLevel: 'error',
      })
      const accessibility = Math.round((result?.lhr?.categories?.accessibility?.score || 0) * 100)
      const performance = Math.round((result?.lhr?.categories?.performance?.score || 0) * 100)
      const row = { name: page.name, path: page.path, accessibility, performance }
      scores.push(row)
      console.log(`${page.name}: accessibility ${accessibility}, performance ${performance}`)
      if (accessibility < 95 || performance < 80) failed = true
    }
  } finally {
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
