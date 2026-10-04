import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const sample = JSON.parse(readFileSync(path.join(process.cwd(), 'tests/fixtures/framing-track.json'), 'utf8')) as {
  start: number
  end: number
  youtubeId: string
  segments: { start: number; end: number; mode: string }[]
}

test.describe('AI director player', () => {
  test('at 390x844 the live crop follows the sample track', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript((track) => {
      let time = track.start
      ;(window as unknown as { __frClock?: { now(): number; set(value: number): void } }).__frClock = {
        now: () => time,
        set: (value) => {
          time = value
        },
      }
      type Options = { playerVars?: { start?: number }; events: { onReady: (e: unknown) => void; onStateChange: (e: { data: number }) => void } }
      class Player {
        private state = -1
        private muted = false
        private frame: HTMLIFrameElement
        constructor(el: HTMLElement, private options: Options) {
          this.frame = document.createElement('iframe')
          this.frame.dataset.fake = 'youtube'
          el.replaceWith(this.frame)
          window.setTimeout(() => {
            options.events.onReady({ target: this })
            options.events.onStateChange({ data: 1 })
          }, 20)
        }
        playVideo() { this.state = 1 }
        pauseVideo() { this.state = 2 }
        stopVideo() { this.state = 5 }
        mute() { this.muted = true }
        unMute() { this.muted = false }
        isMuted() { return this.muted }
        cueVideoById() { this.state = 5 }
        seekTo(seconds: number) { (window as unknown as { __frClock: { set(value: number): void } }).__frClock.set(seconds) }
        getCurrentTime() { return (window as unknown as { __frClock: { now(): number } }).__frClock.now() }
        getDuration() { return 600 }
        getPlayerState() { return this.state }
        getIframe() { return this.frame }
        unloadModule() {}
        setOption() {}
        destroy() { this.frame.remove() }
      }
      ;(window as unknown as { YT: unknown }).YT = { Player }
    }, sample)

    await page.goto('/dev/framing?autoplay=1&sound=0&fixture=sample')
    const player = page.getByTestId('framing-player')
    await expect(player).toBeVisible()
    const box = await player.boundingBox()
    expect(box?.width).toBe(390)
    expect(box?.height).toBe(844)

    const setTime = async (time: number) => {
      await page.evaluate((value) => (window as unknown as { __frClock: { set(value: number): void } }).__frClock.set(value), time)
      await page.waitForTimeout(80)
    }

    await setTime(12)
    await expect(player).toHaveAttribute('data-framing-mode', 'D')
    await setTime(18)
    await expect(player).toHaveAttribute('data-framing-mode', 'B')
    await setTime(24)
    await expect(player).toHaveAttribute('data-framing-mode', 'F')
    await expect(page.getByTestId('spoken-words')).toBeVisible()
    await expect(page.getByTestId('spoken-words')).toContainText('And they seem to be winning')
    const spoken = await page.getByTestId('spoken-words').innerText()
    expect(spoken.replace(/\s+/g, ' ')).toMatch(/And they seem to be winning/)
    expect(spoken).not.toMatch(/Andtheyseem/)
  })
})
