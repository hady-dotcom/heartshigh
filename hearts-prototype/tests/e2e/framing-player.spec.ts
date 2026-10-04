import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const switching = JSON.parse(readFileSync(path.join(process.cwd(), 'tests/fixtures/framing-switch.json'), 'utf8')) as {
  start: number
  end: number
}

async function setTime(page: Page, time: number) {
  await page.evaluate((value) => (window as unknown as { __frClock: { set(value: number): void } }).__frClock.set(value), time)
  await page.waitForTimeout(120)
}

async function assertMediaInViewport(page: Page) {
  const media = page.getByTestId('framing-media')
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

    await page.goto('/dev/framing?fixture=switch&placeholder=1&autoplay=0&sound=0')
    const player = page.getByTestId('framing-player')
    await expect(player).toBeVisible()
    await expect(player).toHaveAttribute('data-framing-source', 'placeholder')
    const box = await player.boundingBox()
    expect(box?.width).toBe(390)
    expect(box?.height).toBe(844)

    await setTime(page, 2)
    await expect(player).toHaveAttribute('data-framing-mode', 'D')
    await assertMediaInViewport(page)

    await setTime(page, 10)
    await expect(player).toHaveAttribute('data-framing-mode', 'B')
    await assertMediaInViewport(page)
    const letter = await page.getByTestId('framing-film').boundingBox()
    expect(letter!.width).toBeGreaterThan(380)
    expect(letter!.x).toBeLessThan(2)

    await setTime(page, 17)
    await expect(player).toHaveAttribute('data-framing-mode', 'F')
    await assertMediaInViewport(page)
    await expect(page.getByTestId('spoken-words')).toHaveAttribute('data-sentence', 'And they seem to be winning as well.')
    await expect(page.getByTestId('spoken-words').locator('.fr-key')).toHaveText('winning')

    await setTime(page, 19.8)
    await expect(page.getByTestId('spoken-words')).toHaveAttribute('data-sentence', 'They seem to be overcoming you.')

    await setTime(page, 22)
    await expect(page.getByTestId('spoken-words')).toHaveAttribute('data-sentence', 'Your dignity still stands.')
    await expect(page.getByTestId('spoken-words')).not.toHaveAttribute('data-sentence', /still is okay/)

    const gap = await page.locator('.fr-words-line').first().evaluate((el) => getComputedStyle(el).columnGap)
    expect(Number.parseFloat(gap)).toBeGreaterThan(8)
    await page.screenshot({ path: 'test-results/spoken-words-f.png', type: 'png' })
  })
})
