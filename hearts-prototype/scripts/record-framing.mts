/** Record the live director at 390×844 for the four prototype clips. */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.HEARTS_RECORD_BASE || 'http://127.0.0.1:3000'
const OUT = process.env.HEARTS_RECORD_OUT || path.join(process.cwd(), '..', 'artifacts', 'ai-director-v1')

const CLIPS = [
  { id: '9gwe-HMwZv0', slug: 'offcentre', seconds: 24, start: 1005.2 },
  { id: '45XUrfJS68Q', slug: 'twoperson', seconds: 24, start: 307.25 },
  { id: '9k7QxXtCzaQ', slug: 'slidetext', seconds: 22, start: 38 },
  { id: 'TLCGBj4AlB0', slug: 'wide', seconds: 24, start: 2751 },
]

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=user-gesture-required=0',
      '--disable-features=UserAgentClientHint',
    ],
  })
  for (const clip of CLIPS) {
    const dir = path.join(OUT, clip.slug)
    mkdirSync(dir, { recursive: true })
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      recordVideo: { dir, size: { width: 390, height: 844 } },
    })
    const page = await context.newPage()
    await page.goto(`${BASE}/dev/framing?youtube=${clip.id}&autoplay=1&sound=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('[data-testid="framing-player"]', { timeout: 30_000 })
    await page.waitForSelector('[data-framing-ready="yes"]', { timeout: 45_000 }).catch(() => undefined)
    await page.waitForFunction(
      (start) => {
        const el = document.querySelector('[data-testid="framing-player"]')
        const t = Number(el?.getAttribute('data-framing-time'))
        const windowOk = el?.getAttribute('data-framing-window') === 'in'
        return windowOk || (Number.isFinite(t) && t >= start - 2 && t < start + 12)
      },
      clip.start,
      { timeout: 28_000 },
    ).catch(() => undefined)
    await page.waitForTimeout(1200)
    const mode = await page.getAttribute('[data-testid="framing-player"]', 'data-framing-mode')
    const time = await page.getAttribute('[data-testid="framing-player"]', 'data-framing-time')
    const windowAt = await page.getAttribute('[data-testid="framing-player"]', 'data-framing-window')
    console.log(clip.slug, 'mode', mode, 't', time, 'window', windowAt)
    const frames: string[] = []
    const step = Math.max(2800, Math.floor((clip.seconds * 1000) / 6))
    for (let i = 0; i < 6; i++) {
      const file = path.join(dir, `frame-${i}.png`)
      await page.screenshot({ path: file, type: 'png' })
      frames.push(file)
      await page.waitForTimeout(step)
    }
    await context.close()
    const video = readdirSync(dir).find((name) => name.endsWith('.webm'))
    if (video) {
      const dest = path.join(OUT, `${clip.slug}-390x844.webm`)
      execFileSync('mv', [path.join(dir, video), dest])
      console.log('video', dest)
    }
    const grid = path.join(OUT, `${clip.slug}-frames.png`)
    try {
      execFileSync('ffmpeg', ['-y', '-start_number', '0', '-i', path.join(dir, 'frame-%d.png'), '-filter_complex', 'tile=3x2', grid], { stdio: 'inherit' })
    } catch {
      writeFileSync(path.join(OUT, `${clip.slug}-frames.txt`), frames.join('\n'))
    }
  }
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
