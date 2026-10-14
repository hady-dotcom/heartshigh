/**
 * Film a short silent demo of each help page.
 *
 *   npm run see-how:record
 *
 * Starts (or reuses) the app on port 3100 with a seeded database, walks
 * src/lib/see-how-pages.ts, and writes:
 *   public/see-how/<page>.webm
 *   public/see-how/<page>.jpg
 *   src/lib/see-how-manifest.json
 *   public/see-how/manifest.json
 *
 * SEE_HOW_ONLY=home,feed films just those pages and merges them into the manifest.
 * SEE_HOW_REUSE=1 keeps a server that is already on port 3100 with the test clock.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import sharp from 'sharp'
import {
  SEE_HOW_ACCOUNTS,
  SEE_HOW_PAGES,
  SEE_HOW_SKIPPED,
  SEE_HOW_VIEWPORTS,
  seeHowKeyOwners,
  type SeeHowDiscover,
  type SeeHowPageSpec,
  type SeeHowRole,
  type SeeHowStep,
} from '../src/lib/see-how-pages'
import type { SeeHowManifest } from '../src/lib/see-how'

const ROOT = process.cwd()
const PORT = Number(process.env.HEARTS_SEE_HOW_PORT || process.env.HEARTS_E2E_PORT || 3100)
const BASE = `http://127.0.0.1:${PORT}`
const DATABASE = process.env.HEARTS_SEE_HOW_DATABASE || 'file:./data/hearts-see-how.db'
const OUT = path.join(ROOT, 'public/see-how')
const TMP = path.join(ROOT, '.see-how-tmp')
const HOLD_MS = 1500
const MAX_SECONDS = 28

const only = new Set(
  (process.env.SEE_HOW_ONLY || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
)

const serverEnv = {
  ...process.env,
  DATABASE_URL: DATABASE,
  HEARTS_E2E: '1',
  HEARTS_TEST_CLOCK: '1',
  HEARTS_DIST_DIR: process.env.HEARTS_DIST_DIR || '.next-see-how',
  HEARTS_TRUSTED_PROXY_HOPS: '1',
  HEARTS_SEARCH_FIXTURE: 'tests/fixtures/youtube-search.json',
  HEARTS_TRANSCRIPT_FIXTURE: 'tests/fixtures/transcripts.json',
}

let server: ChildProcess | null = null

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function clockOn() {
  try {
    const response = await fetch(`${BASE}/api/hearts`)
    if (!response.ok) return false
    return ((await response.json()) as { testClock?: boolean }).testClock === true
  } catch {
    return false
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 180; attempt++) {
    if (await clockOn()) return
    await sleep(1000)
  }
  throw new Error(`No test-clock server answered at ${BASE}.`)
}

function startServer() {
  server = spawn('npx', ['next', 'dev', '--hostname', '127.0.0.1', '--port', String(PORT)], {
    cwd: ROOT,
    env: serverEnv,
    stdio: 'inherit',
    detached: true,
  })
}

function stopServer() {
  if (!server?.pid) return
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    server.kill('SIGTERM')
  }
}

function learnerCode() {
  for (const name of ['seed-codes-test.json', 'seed-codes.json']) {
    try {
      const codes = JSON.parse(readFileSync(path.join(ROOT, 'data', name), 'utf8')) as Record<string, string>
      if (codes['elm-learner']) return codes['elm-learner']
    } catch {
      // The other seed file may be the one this run wrote.
    }
  }
  throw new Error('Seeded learner code was not written.')
}

function shell(command: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn('bash', ['-lc', command], { cwd: ROOT })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => {
      out += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      err += String(chunk)
    })
    child.on('close', (code) => {
      if (code === 0) resolve(out.trim())
      else reject(new Error(`${command}\n${err || out}`))
    })
  })
}

async function encode(raw: string, dest: string, wide: boolean) {
  const width = wide ? 960 : 390
  const encodeAt = async (crf: number, target: number) => {
    await shell(
      `ffmpeg -y -i ${JSON.stringify(raw)} -an -t ${MAX_SECONDS} -c:v libvpx-vp9 -crf ${crf} -b:v 0 -cpu-used 8 -deadline realtime -row-mt 1 -threads 4 -vf fps=10,scale=${target}:-2 ${JSON.stringify(dest)}`,
    )
  }
  await encodeAt(42, width)
  if (statSync(dest).size > 850_000) await encodeAt(52, wide ? 800 : 360)
}

async function durationOf(file: string) {
  const out = await shell(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(file)}`)
  return Number(out)
}

function overlayScript(bottom: number) {
  return `(() => {
    const mount = () => {
      if (document.getElementById('see-how-cursor')) return
      const cursor = document.createElement('div')
      cursor.id = 'see-how-cursor'
      cursor.style.cssText = 'position:fixed;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:3px solid #D4A84B;background:rgba(212,168,75,0.35);box-shadow:0 0 0 6px rgba(212,168,75,0.2);z-index:2147483646;pointer-events:none;left:48px;top:120px;'
      const bar = document.createElement('div')
      bar.id = 'see-how-caption'
      bar.style.cssText = 'position:fixed;left:10px;right:10px;bottom:${bottom}px;z-index:2147483646;background:rgba(14,42,43,0.94);color:#fffaf0;font:650 18px/1.35 "Source Sans 3",sans-serif;padding:10px 14px;border-radius:12px;pointer-events:none;'
      document.documentElement.append(cursor, bar)
      window.addEventListener('mousemove', (event) => {
        cursor.style.left = event.clientX + 'px'
        cursor.style.top = event.clientY + 'px'
      }, true)
    }
    if (document.documentElement) mount()
    document.addEventListener('DOMContentLoaded', mount)
  })()`
}

async function arm(context: BrowserContext, viewport: 'phone' | 'desk') {
  await context.addInitScript({ content: overlayScript(viewport === 'phone' ? 96 : 16) })
  await context.route(/youtube\.com|googlevideo|ytimg|vimeo|mux\.com/i, (route) => route.abort())
}

async function caption(page: Page, text: string) {
  await page.evaluate((line) => {
    const bar = document.getElementById('see-how-caption')
    if (bar) bar.textContent = line
  }, text).catch(() => {})
}

async function pointAt(page: Page, selector: string) {
  const loc = page.locator(selector).first()
  if (!(await loc.count())) return null
  await loc.scrollIntoViewIfNeeded().catch(() => {})
  const box = await loc.boundingBox()
  if (box) {
    await page.mouse.move(box.x + Math.min(box.width / 2, 80), box.y + Math.min(box.height / 2, 24), { steps: 12 })
  }
  await loc.evaluate((el) => {
    const node = el as HTMLElement
    node.style.outline = '3px solid #D4A84B'
    node.style.outlineOffset = '2px'
  }).catch(() => {})
  return loc
}

async function runStep(page: Page, step: SeeHowStep, say: (text: string) => Promise<void>, elapsed: () => number) {
  await say(step.caption)
  if (step.optional && elapsed() > 22) {
    await page.waitForTimeout(400)
    return
  }
  if (step.op === 'hold' || !step.selector) {
    await page.waitForTimeout(HOLD_MS)
    return
  }
  const loc = await pointAt(page, step.selector)
  if (!loc) {
    if (!step.optional) throw new Error(`Missing ${step.selector}`)
    await page.waitForTimeout(HOLD_MS)
    return
  }
  await page.waitForTimeout(280)
  try {
    if (step.op === 'click' || step.op === 'check') {
      await loc.click({ timeout: 8000 })
    } else if (step.op === 'fill') {
      await loc.click({ timeout: 8000 })
      await loc.fill('')
      await loc.pressSequentially(step.value || '', { delay: 28 })
    } else if (step.op === 'select') {
      const value = step.value || await loc.evaluate((el) => {
        const select = el as HTMLSelectElement
        const options = Array.from(select.options)
        const next = options.find((option) => option.value && option.value !== select.value) || options.find((option) => option.value)
        return next?.value || ''
      })
      if (value) await loc.selectOption(value)
    }
  } catch (error) {
    if (!step.optional) throw error
  }
  if (step.waitFor) await page.locator(step.waitFor).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  await caption(page, step.caption)
  await page.waitForTimeout(HOLD_MS)
}

async function hrefOf(page: Page, selector: string) {
  const loc = page.locator(selector).first()
  if (!(await loc.count())) return null
  const href = await loc.getAttribute('href')
  return href || null
}

async function discoverPath(browser: Browser, spec: SeeHowPageSpec, storage?: string) {
  const viewport = SEE_HOW_VIEWPORTS[spec.viewport]
  const context = await browser.newContext({
    baseURL: BASE,
    viewport,
    storageState: storage,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(12_000)
  const kind = spec.discover as SeeHowDiscover
  try {
    if (kind === 'course') {
      await page.goto('/p/east-london/course/1')
      return hrefOf(page, '[data-testid=start-part]')
    }
    if (kind === 'gather-detail' || kind === 'gather-reflect' || kind === 'gather-door') {
      await page.goto('/p/east-london/gather')
      const open = await hrefOf(page, '[data-testid=gather-open]')
      if (!open) return null
      if (kind === 'gather-detail') return open
      if (kind === 'gather-reflect') return open.replace(/\/?$/, '') + '/reflect'
      await page.goto(open)
      return hrefOf(page, '[data-testid=door-link]')
    }
    if (kind === 'live') {
      await page.goto('/p/east-london')
      return hrefOf(page, 'a[href*="/live/"]')
    }
    if (kind === 'mission') {
      await page.goto('/p/east-london')
      return hrefOf(page, 'a[href*="/mission/"]')
    }
    if (kind === 'compass-learner') {
      await page.goto('/p/east-london/admin/compass')
      return hrefOf(page, '[data-testid=compass-learner]')
    }
    if (kind === 'ai-step') {
      await page.goto('/master/ai')
      return hrefOf(page, '[data-testid=ai-step]')
    }
    if (kind === 'tier') {
      await page.goto('/master/tiers')
      return hrefOf(page, '[data-testid=tier-open]')
    }
    return spec.path
  } catch {
    return null
  } finally {
    await context.close()
  }
}

async function signIn(browser: Browser, role: Exclude<SeeHowRole, 'anon'>) {
  const account = SEE_HOW_ACCOUNTS[role]
  const next = role === 'master' ? '/master' : role === 'learner' ? '/p/east-london' : '/p/east-london/admin'
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(account.email)
  await page.getByTestId('login-password').fill(account.password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
  const file = path.join(TMP, `${role}.json`)
  await context.storageState({ path: file })
  await context.close()
  return file
}

function round(n: number) {
  return Math.round(n * 10) / 10
}

async function film(browser: Browser, spec: SeeHowPageSpec, storage: string | undefined, targetPath: string) {
  const viewport = SEE_HOW_VIEWPORTS[spec.viewport]
  const videoDir = path.join(TMP, spec.id)
  rmSync(videoDir, { recursive: true, force: true })
  mkdirSync(videoDir, { recursive: true })
  const context = await browser.newContext({
    baseURL: BASE,
    viewport,
    storageState: storage,
    recordVideo: { dir: videoDir, size: viewport },
  })
  await arm(context, spec.viewport)
  const page = await context.newPage()
  page.setDefaultTimeout(12_000)
  page.on('dialog', (dialog) => dialog.accept().catch(() => {}))
  page.on('download', () => {})
  const marks: { t: number; text: string }[] = []
  const started = Date.now()
  const say = async (text: string) => {
    marks.push({ t: (Date.now() - started) / 1000, text })
    await caption(page, text)
  }
  const elapsed = () => (Date.now() - started) / 1000
  try {
    await page.goto(targetPath, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.locator(spec.ready).first().waitFor({ state: 'visible', timeout: 45_000 })
    const posterPng = path.join(videoDir, 'poster.png')
    await page.screenshot({ path: posterPng, animations: 'disabled' })
    for (const step of spec.steps) await runStep(page, step, say, elapsed)
    await page.waitForTimeout(400)
    const webm = path.join(OUT, `${spec.id}.webm`)
    const poster = path.join(OUT, `${spec.id}.jpg`)
    await page.close()
    const raw = await page.video()?.path()
    await context.close()
    if (!raw) throw new Error('Playwright did not write a video.')
    await encode(raw, webm, spec.viewport === 'desk')
    await sharp(posterPng).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 68 }).toFile(poster)
    const seconds = await durationOf(webm)
    const captions = marks.map((row, index) => ({
      start: round(row.t),
      end: round(marks[index + 1]?.t ?? Math.max(row.t + HOLD_MS / 1000, seconds)),
      text: row.text,
    }))
    if (captions.length) {
      captions[0].start = 0
      captions[captions.length - 1].end = round(Math.max(captions[captions.length - 1].end, seconds))
    }
    return { seconds: round(seconds), captions, bytes: statSync(webm).size }
  } catch (error) {
    await page.screenshot({ path: path.join(TMP, `${spec.id}-failed.png`) }).catch(() => {})
    await context.close().catch(() => {})
    throw error
  }
}

function writeManifest(manifest: SeeHowManifest) {
  const body = JSON.stringify(manifest, null, 2) + '\n'
  writeFileSync(path.join(ROOT, 'src/lib/see-how-manifest.json'), body)
  writeFileSync(path.join(OUT, 'manifest.json'), body)
}

async function main() {
  seeHowKeyOwners()
  mkdirSync(OUT, { recursive: true })
  mkdirSync(TMP, { recursive: true })
  const reuse = process.env.SEE_HOW_REUSE === '1'
  if (await clockOn()) {
    if (!reuse) console.log(`Reusing the test-clock server already on ${BASE}.`)
  } else {
    try {
      const response = await fetch(`${BASE}/api/hearts`)
      if (response.ok) throw new Error(`Something is already serving ${BASE} without HEARTS_TEST_CLOCK=1. Stop it, then run this again.`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('HEARTS_TEST_CLOCK')) throw error
    }
    console.log(`Seeding ${DATABASE}`)
    await new Promise<void>((resolve, reject) => {
      const child = spawn('npx', ['tsx', 'src/seed/seed.ts', '--reset'], { cwd: ROOT, env: serverEnv, stdio: 'inherit' })
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Seed exited ${code}`))))
    })
    console.log(`Starting the app on ${BASE}`)
    startServer()
    await waitForServer()
  }

  const code = learnerCode()
  const pages = SEE_HOW_PAGES.filter((page) => !only.size || only.has(page.id))
  const browser = await chromium.launch({ headless: true })
  const storage = new Map<string, string>()
  const manifest: SeeHowManifest = only.size
    ? JSON.parse(readFileSync(path.join(ROOT, 'src/lib/see-how-manifest.json'), 'utf8'))
    : { pages: {}, keys: {}, skipped: {} }
  manifest.skipped = { ...SEE_HOW_SKIPPED, ...manifest.skipped }
  const failures: string[] = []

  try {
    for (const spec of pages) {
      const role = spec.role
      if (role !== 'anon' && !storage.has(role)) {
        console.log(`Signing in ${role}`)
        storage.set(role, await signIn(browser, role))
      }
      const state = role === 'anon' ? undefined : storage.get(role)
      let target = spec.path.replace('{{learnerCode}}', encodeURIComponent(code))
      if (spec.discover) {
        const found = await discoverPath(browser, spec, state)
        if (!found) {
          const reason = `The seeded demo has no ${spec.title} screen to open.`
          for (const key of spec.keys) {
            delete manifest.keys[key]
            manifest.skipped[key] = reason
          }
          delete manifest.pages[spec.id]
          console.log(`skip ${spec.id}: ${reason}`)
          writeManifest(manifest)
          continue
        }
        target = found
      }
      process.stdout.write(`film ${spec.id} … `)
      try {
        const filmed = await film(browser, spec, state, target)
        if (filmed.seconds > 32) throw new Error(`Video is ${filmed.seconds}s, over 30s.`)
        manifest.pages[spec.id] = {
          title: spec.title,
          video: `/see-how/${spec.id}.webm`,
          poster: `/see-how/${spec.id}.jpg`,
          captions: filmed.captions,
          overrideVideo: manifest.pages[spec.id]?.overrideVideo || '',
          seconds: filmed.seconds,
        }
        for (const key of spec.keys) {
          delete manifest.skipped[key]
          manifest.keys[key] = spec.id
        }
        console.log(`${filmed.seconds}s ${(filmed.bytes / 1024).toFixed(0)}KB`)
        writeManifest(manifest)
      } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
        if (spec.soft) {
          const reason = `The seeded demo could not open ${spec.title}: ${message}`
          for (const key of spec.keys) {
            delete manifest.keys[key]
            manifest.skipped[key] = reason
          }
          delete manifest.pages[spec.id]
          console.log(`skip ${message}`)
          writeManifest(manifest)
        } else {
          failures.push(`${spec.id}: ${message}`)
          console.log(`FAIL ${message}`)
          writeManifest(manifest)
        }
      }
    }
  } finally {
    await browser.close()
    stopServer()
  }

  writeManifest(manifest)
  if (failures.length) {
    console.error(`\n${failures.length} page(s) failed:\n${failures.join('\n')}`)
    process.exit(1)
  }
  console.log(`Wrote ${Object.keys(manifest.pages).length} demos, ${Object.keys(manifest.keys).length} help keys, ${Object.keys(manifest.skipped).length} skipped.`)
}

main().catch((error) => {
  stopServer()
  console.error(error)
  process.exit(1)
})
