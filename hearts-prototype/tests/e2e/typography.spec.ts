import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

const PORTAL = 'east-london'
const DESK = { width: 1440, height: 900 }
const TALK = 'ECaTWkof57E'

let master: APIRequestContext

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
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

test('Typography panel lists the five styles and can stand in for the hors d’oeuvre', async ({ page }) => {
  const lesson = (await (await master.get(`/api/lessons?where[youtubeId][equals]=${TALK}&depth=0`)).json()).docs[0] as { id: number }
  const tier = (await (await master.get(`/api/talk-tiers?where[lesson][equals]=${lesson.id}&depth=0`)).json()).docs[0] as { id: number; hook: string }
  const clip = Object.values(((await (await master.get(`/api/hearts/opening?portal=${PORTAL}`)).json()) as { clips: Record<string, { cutId: number; lessonId: number; hook: string }> }).clips).find((row) => row.lessonId === lesson.id)!

  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `/p/${PORTAL}/feed?clip=${clip.cutId}&play=appetiser`)
  for (const size of [{ width: 390, height: 844 }, { width: 360, height: 780 }] as const) {
    await page.setViewportSize(size)
    await page.goto(`/p/${PORTAL}/feed?clip=${clip.cutId}&play=appetiser`)
    await expect(page.getByTestId('journey')).toHaveAttribute('data-mode', 'appetiser', { timeout: 20_000 })
    const rail = page.getByTestId('beat-rail')
    await expect(rail).toBeVisible()
    await expect(rail).toHaveAttribute('data-beat', 'hook')
    await expect(rail).toContainText('Hook')
    await expect(rail).toContainText('Turn')
    await expect(rail).toContainText('Land')
    const caption = page.getByTestId('caption')
    await expect(caption).toHaveAttribute('data-role', 'hook')
    await expect(caption).toHaveText(clip.hook)
    expect((await caption.innerText()).trim().split(/\s+/).length).toBeLessThanOrEqual(22)
    const panel = page.getByTestId('caption-panel')
    const backing = await panel.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(backing).toMatch(/rgba?\(20,\s*18,\s*14(?:,\s*0\.9)?\)/)
    const parts = ['caption-panel', 'caption', 'share', 'fave', 'save', 'learn-more']
    const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {}
    for (const id of parts) {
      const box = (await page.getByTestId(id).count()) ? await page.getByTestId(id).boundingBox() : null
      if (box) boxes[id] = box
    }
    const speakerCard = (await page.locator('.speaker-card').count()) ? await page.locator('.speaker-card').boundingBox() : null
    if (speakerCard) boxes['speaker-card'] = speakerCard
    const names = Object.keys(boxes)
    const overlaps = (a: (typeof boxes)[string], b: (typeof boxes)[string]) => a.x < b.x + b.width - 1 && a.x + a.width - 1 > b.x && a.y < b.y + b.height - 1 && a.y + a.height - 1 > b.y
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (names[i] === 'caption-panel' && names[j] === 'caption') continue
        if (names[j] === 'caption-panel' && names[i] === 'caption') continue
        expect(overlaps(boxes[names[i]], boxes[names[j]]), `${size.width}x${size.height} ${names[i]} overlaps ${names[j]}`).toBeFalsy()
      }
    }
    for (const box of Object.values(boxes)) expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1)
    if (size.width === 390 && process.env.HEARTS_SHOT) await page.screenshot({ path: process.env.HEARTS_SHOT })
  }

  await page.setViewportSize(DESK)
  await signIn(page, 'master@hearts.test', 'hearts-master', `/master/tiers/${tier.id}`)
  await page.goto(`/master/tiers/${tier.id}`)
  const panel = page.getByTestId('typography-panel')
  await expect(panel).toBeVisible()
  for (const style of ['kinetic', 'windows', 'conversation', 'cinema', 'unfold']) {
    await expect(page.getByTestId(`typography-style-${style}`)).toBeVisible()
  }
  await page.getByTestId('typography-style-cinema').check()
  await page.getByTestId('typography-in-place').check()
  await page.getByTestId('typography-save').click()
  await expect(page.getByTestId('typography-in-place')).toBeChecked()
  await expect(page.getByTestId('typography-style-cinema')).toBeChecked()
  const preview = page.getByTestId('typography-preview-cinema')
  const rendered = (await preview.count()) > 0
  if (rendered) await expect(preview).toHaveAttribute('src', new RegExp(`/typography/${TALK}/cinema\\.mp4`))

  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `/p/${PORTAL}/feed?clip=${clip.cutId}`)
    await page.goto(`/p/${PORTAL}/feed?clip=${clip.cutId}`)
    const player = page.getByTestId('typography-player')
    if (rendered) {
      await expect(player).toBeVisible({ timeout: 20_000 })
      await expect(player).toHaveAttribute('src', new RegExp(`/typography/${TALK}/cinema\\.mp4`))
      await expect(player).toHaveAttribute('data-style', 'cinema')
    }
  } finally {
    const cleared = await master.post('/api/hearts', { form: { action: 'typography-save', tier: String(tier.id), next: '/master/tiers', typographyStyle: '' }, maxRedirects: 0 })
    expect(cleared.status()).toBeLessThan(400)
    expect(decodeURIComponent(cleared.headers()['location'] || '')).not.toContain('error=')
    void tier.hook
  }
})
