import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { fakeYouTube } from './fake-youtube'

const TALK = 'ECaTWkof57E'
const shots = process.env.HEARTS_SHOT_DIR || '/tmp/desk-kinetic'

let master: APIRequestContext

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.beforeAll(async () => {
  master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
})

test.afterAll(async () => {
  await master?.dispose()
})

test('the clip editor previews hook, turn and land as text on the talk audio', async ({ page }) => {
  mkdirSync(shots, { recursive: true })
  const lesson = (await (await master.get(`/api/lessons?where[youtubeId][equals]=${TALK}&depth=0`)).json()).docs[0] as { id: number }
  const tier = (await (await master.get(`/api/talk-tiers?where[lesson][equals]=${lesson.id}&depth=0`)).json()).docs[0] as { id: number }
  const href = `/master/tiers/${tier.id}`

  for (const size of [{ width: 1280, height: 800, name: '1280' }, { width: 390, height: 844, name: '390' }] as const) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await fakeYouTube(page)
    await signIn(page, href)
    await page.goto(href)
    await expect(page.getByTestId('master-tier')).toBeVisible()
    await expect(page.getByTestId('desk-narrow')).toBeHidden()
    const stage = page.getByTestId('kinetic-stage')
    await stage.scrollIntoViewIfNeeded()
    await expect(stage).toBeVisible()
    const box = await stage.boundingBox()
    expect(box, `${size.name} stage box`).toBeTruthy()
    expect(box!.width).toBeGreaterThan(80)
    expect(box!.height).toBeGreaterThan(120)
    expect(box!.x).toBeGreaterThanOrEqual(-1)
    expect(box!.y).toBeGreaterThanOrEqual(-1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 2)
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 2)

    await expect(stage).toHaveAttribute('data-bg', 'gradient')
    await expect(page.getByTestId('kinetic-bg-blur')).toHaveCount(0)
    const hook = (await page.getByTestId('tier-hook').inputValue()).trim()
    await expect(stage).toHaveAttribute('data-beat', 'hook')
    await expect(stage.locator('[data-role="hook"].now')).toBeVisible()
    await expect(stage.locator('[data-role="hook"].now')).toContainText(hook.slice(0, 24))
    await expect(stage.locator('[data-role="turn"]')).toBeHidden()
    await expect(stage.locator('[data-role="land"]')).toBeHidden()

    const jumps = page.getByTestId('kinetic-jumps')
    await jumps.scrollIntoViewIfNeeded()
    const hookBox = await page.getByTestId('kinetic-jump-hook').boundingBox()
    const turnBox = await page.getByTestId('kinetic-jump-turn').boundingBox()
    const landBox = await page.getByTestId('kinetic-jump-land').boundingBox()
    expect(hookBox && turnBox && landBox).toBeTruthy()
    expect(hookBox!.x).toBeLessThan(turnBox!.x)
    expect(turnBox!.x).toBeLessThan(landBox!.x)
    await expect(jumps).toBeVisible()

    await page.getByTestId('kinetic-jump-turn').click()
    await expect(stage).toHaveAttribute('data-beat', 'turn')
    const turn = (await page.getByTestId('tier-turn').inputValue()).trim()
    await expect(stage.locator('[data-role="turn"].now')).toContainText(turn.slice(0, 24))
    await expect(stage.locator('[data-role="hook"]')).toBeHidden()
    await expect(stage.locator('[data-role="land"]')).toBeHidden()

    await page.getByTestId('kinetic-bg-mask').click()
    await expect(stage).toHaveAttribute('data-bg', 'mask')
    await expect(stage).toHaveAttribute('data-mask', 'arch')
    const mask = stage.locator('.kinetic-mask')
    await expect(mask).toHaveCSS('opacity', '1')
    const clip = await mask.evaluate((node) => getComputedStyle(node).clipPath)
    expect(clip).not.toBe('none')

    const before = Number(await stage.getAttribute('data-t'))
    await page.getByTestId('kinetic-play').click()
    await expect(stage).toHaveAttribute('data-playing', '1', { timeout: 8000 })
    await expect.poll(async () => Number(await stage.getAttribute('data-t')), { timeout: 8000 }).toBeGreaterThan(before)
    const audio = stage.locator('[data-testid="kinetic-audio"] iframe')
    await expect(audio).toHaveCount(1)
    const frame = await audio.boundingBox()
    expect(frame!.width).toBeLessThan(8)
    expect(frame!.height).toBeLessThan(8)

    await page.screenshot({ path: path.join(shots, `desk_kinetic_${size.name}.png`) })
    await page.getByTestId('kinetic-play').click()
  }
})
