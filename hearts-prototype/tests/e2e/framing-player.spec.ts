import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const TITLE = 'How to Live Like the Prophet'
const switching = JSON.parse(readFileSync(path.join(process.cwd(), 'tests/fixtures/framing-switch.json'), 'utf8')) as {
  start: number
  end: number
  sentences: { text: string; s: number; e: number }[]
}

async function setTime(page: Page, time: number) {
  await page.evaluate((value) => (window as unknown as { __frClock: { set(value: number): void } }).__frClock.set(value), time)
  await page.waitForFunction((value) => {
    const el = document.querySelector('[data-testid="framing-player"]')
    return el && Math.abs(Number(el.getAttribute('data-framing-time')) - value) < 0.2
  }, time)
}

async function assertMediaInViewport(page: Page) {
  const media = page.locator('[data-testid="framing-media"], [data-testid="framing-host"] iframe, .fr-film iframe').first()
  await expect(media).toBeVisible()
  const box = await media.boundingBox()
  expect(box).toBeTruthy()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.y).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(391)
  expect(box!.y + box!.height).toBeLessThanOrEqual(845)
  expect(box!.width).toBeGreaterThan(200)
  const film = await page.getByTestId('framing-film').boundingBox()
  expect(film).toBeTruthy()
  expect(film!.x).toBeGreaterThanOrEqual(-1)
  expect(film!.x + film!.width).toBeLessThanOrEqual(391)
  expect(film!.y).toBeGreaterThanOrEqual(-1)
  expect(film!.y + film!.height).toBeLessThanOrEqual(845)
}

test.describe('AI director player', () => {
  test('at 390x844 the film stays on screen and modes switch on the clock', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript((track) => {
      let time = track.start
      ;(window as unknown as { __frClock?: { now(): number; set(value: number): void } }).__frClock = {
        now: () => time,
        set: (value) => {
          time = value
        },
      }
    }, switching)

    await page.goto(`/dev/framing?fixture=switch&placeholder=1&autoplay=0&sound=0&title=${encodeURIComponent(TITLE)}`)
    const player = page.getByTestId('framing-player')
    await expect(player).toBeVisible()
    await expect(player).toHaveAttribute('data-framing-source', 'placeholder')
    const box = await player.boundingBox()
    expect(box?.width).toBe(390)
    expect(box?.height).toBe(844)

    await setTime(page, 1)
    await expect(player).toHaveAttribute('data-framing-mode', 'D')
    await assertMediaInViewport(page)
    const face = page.getByTestId('placeholder-face')
    await expect(face).toBeAttached()
    const faceBox = await face.boundingBox()
    expect(faceBox).toBeTruthy()
    expect(faceBox!.x).toBeGreaterThanOrEqual(-1)
    expect(faceBox!.y).toBeGreaterThanOrEqual(-1)
    expect(faceBox!.x + faceBox!.width).toBeLessThanOrEqual(391)
    expect(faceBox!.y + faceBox!.height).toBeLessThanOrEqual(845)
    expect(faceBox!.x).toBeGreaterThan(4)
    expect(faceBox!.width).toBeGreaterThan(80)
    const timeAt1 = await page.getByTestId('framing-media').evaluate((el) => (el as HTMLVideoElement).currentTime)
    expect(timeAt1).toBeGreaterThan(0.6)
    expect(timeAt1).toBeLessThan(1.5)

    await setTime(page, 5)
    await expect(player).toHaveAttribute('data-framing-mode', 'D')
    await assertMediaInViewport(page)
    const timeAt5 = await page.getByTestId('framing-media').evaluate((el) => (el as HTMLVideoElement).currentTime)
    expect(timeAt5).toBeGreaterThan(4.5)
    expect(timeAt5).toBeLessThan(5.5)
    expect(timeAt5).toBeGreaterThan(timeAt1 + 3)
    const faceLater = await face.boundingBox()
    expect(faceLater!.x).toBeGreaterThanOrEqual(-1)
    expect(faceLater!.x + faceLater!.width).toBeLessThanOrEqual(391)

    await setTime(page, 10)
    await expect(player).toHaveAttribute('data-framing-mode', 'B')
    await assertMediaInViewport(page)
    const letter = await page.getByTestId('framing-film').boundingBox()
    expect(letter!.width).toBeGreaterThan(380)
    expect(letter!.x).toBeLessThan(2)
    const videoAtB = await page.getByTestId('framing-media').evaluate((el) => (el as HTMLVideoElement).currentTime)
    expect(videoAtB).toBeGreaterThan(9)
    expect(videoAtB).toBeLessThan(11)

    await setTime(page, 17)
    await expect(player).toHaveAttribute('data-framing-mode', 'F')
    await assertMediaInViewport(page)
    const at17 = switching.sentences.find((row) => row.s <= 17 && 17 < row.e)!.text
    await expect(page.getByTestId('spoken-words')).toHaveAttribute('data-sentence', at17)
    expect(at17).not.toBe(TITLE)
    await expect(page.getByTestId('spoken-words')).not.toHaveAttribute('data-sentence', TITLE)
    await expect(page.getByTestId('spoken-words').locator('.fr-key')).toHaveText('winning')

    await setTime(page, 18.45)
    await expect(page.getByTestId('spoken-words')).toHaveAttribute('data-empty', 'yes')
    await expect(page.getByTestId('spoken-words')).not.toHaveAttribute('data-sentence', TITLE)

    await setTime(page, 19.8)
    const at198 = switching.sentences.find((row) => row.s <= 19.8 && 19.8 < row.e)!.text
    await expect(page.getByTestId('spoken-words')).toHaveAttribute('data-sentence', at198)
    expect(at198).not.toBe(TITLE)

    await setTime(page, 22)
    const at22 = switching.sentences.find((row) => row.s <= 22 && 22 < row.e)!.text
    await expect(page.getByTestId('spoken-words')).toHaveAttribute('data-sentence', at22)
    expect(at22).not.toBe(TITLE)
    await expect(page.getByTestId('spoken-words')).not.toHaveAttribute('data-sentence', /still is okay/)

    const gap = await page.locator('.fr-words-line').first().evaluate((el) => getComputedStyle(el).columnGap)
    expect(Number.parseFloat(gap)).toBeGreaterThan(8)
    await page.screenshot({ path: 'test-results/spoken-words-f.png', type: 'png' })
  })
})
