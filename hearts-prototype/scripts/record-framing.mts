/** Record the live director at 390×844 against the local placeholder film. Output is mp4. */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.HEARTS_RECORD_BASE || 'http://127.0.0.1:3000'
const OUT = process.env.HEARTS_RECORD_OUT || path.join(process.cwd(), '..', 'artifacts', 'ai-director-v1')

const CLIPS = [
  { slug: 'demo-switch', query: 'fixture=switch&placeholder=1&autoplay=0&sound=0', times: [1, 6, 10, 14, 17, 20, 22.4], label: 'D then B then F' },
  { slug: 'offcentre', query: 'youtube=9gwe-HMwZv0&placeholder=1&autoplay=0&sound=0', times: [1006, 1012, 1018, 1022, 1026], label: 'D' },
  { slug: 'twoperson', query: 'youtube=45XUrfJS68Q&placeholder=1&autoplay=0&sound=0', times: [308, 313, 319, 326, 330], label: 'F words' },
  { slug: 'slidetext', query: 'youtube=9k7QxXtCzaQ&placeholder=1&autoplay=0&sound=0', times: [40, 46, 52, 58], label: 'B' },
  { slug: 'wide', query: 'youtube=TLCGBj4AlB0&placeholder=1&autoplay=0&sound=0', times: [2752, 2760, 2768, 2774], label: 'D' },
]

function ensurePlaceholder() {
  const dest = path.join(process.cwd(), 'public/framing/placeholder.mp4')
  if (existsSync(dest) && execFileSync('stat', ['-c', '%s', dest]).toString().trim() !== '0') return
  execFileSync('bash', [path.join(process.cwd(), 'scripts/framing/make-placeholder.sh')], { stdio: 'inherit' })
}

function toMp4(webm: string, mp4: string) {
  execFileSync('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'inherit' })
}

async function main() {
  ensurePlaceholder()
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  for (const clip of CLIPS) {
    const dir = path.join(OUT, clip.slug)
    mkdirSync(dir, { recursive: true })
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      recordVideo: { dir, size: { width: 390, height: 844 } },
    })
    await context.addInitScript(`{
      let time = 0
      window.__frClock = { now: function () { return time }, set: function (value) { time = value } }
    }`)
    const page = await context.newPage()
    await page.goto(`${BASE}/dev/framing?${clip.query}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('[data-testid="framing-player"]', { timeout: 30_000 })
    await page.waitForSelector('[data-testid="framing-media"]', { timeout: 15_000 }).catch(() => undefined)
    await page.evaluate(`{
      if (!window.__frClock) {
        let time = 0
        window.__frClock = { now: function () { return time }, set: function (value) { time = value } }
      }
    }`)
    const frames: string[] = []
    for (let i = 0; i < clip.times.length; i++) {
      const t = clip.times[i]
      await page.evaluate(`window.__frClock.set(${t})`)
      await page.waitForTimeout(450)
      const mode = await page.getAttribute('[data-testid="framing-player"]', 'data-framing-mode')
      const shown = await page.getAttribute('[data-testid="spoken-words"]', 'data-sentence')
      console.log(clip.slug, 't', t, 'mode', mode, shown ? `words=${shown.slice(0, 48)}` : '')
      const file = path.join(dir, `frame-${i}.png`)
      await page.screenshot({ path: file, type: 'png' })
      frames.push(file)
    }
    await context.close()
    const video = readdirSync(dir).find((name) => name.endsWith('.webm'))
    if (video) {
      const mp4 = path.join(OUT, `${clip.slug}-390x844.mp4`)
      toMp4(path.join(dir, video), mp4)
      console.log('video', mp4)
    }
    const grid = path.join(OUT, `${clip.slug}-frames.png`)
    try {
      execFileSync(
        'ffmpeg',
        ['-y', '-start_number', '0', '-i', path.join(dir, 'frame-%d.png'), '-frames:v', '1', '-update', '1', '-filter_complex', 'tile=4x2', grid],
        { stdio: 'inherit' },
      )
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
