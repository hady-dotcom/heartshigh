import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const SHOTS = process.env.DOOR_SHOTS || 'artifacts/screenshots'
const PLAQUES = ['ISLAM', 'IMAN', 'IHSAN', 'THE HOUR', 'THE SITTING']
const NOTES = [
  'Islam: what you do',
  'Iman: what you believe',
  'Ihsan: worship as though you see Him',
  "The Hour: what's coming",
  'The Sitting: how Jibril came to teach',
]
const SIZES = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x800', width: 1280, height: 800 },
] as const

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('garden plaques and lane doors at phone and wide size', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true })
  await signIn(page, '/p/east-london/garden')
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.goto('/p/east-london/garden')
    await expect(page.getByTestId('garden')).toBeVisible()
    await expect(page.getByTestId('garden-scene')).toBeVisible()
    const plaques = page.locator('.plaque-name')
    await expect(plaques).toHaveCount(5)
    await expect(plaques).toHaveText(PLAQUES)
    const notes = page.getByTestId('plaque-note')
    await expect(notes).toHaveCount(5)
    await expect(notes).toHaveText(NOTES)
    const scene = page.getByTestId('garden-scene')
    const sceneBox = await scene.boundingBox()
    expect(sceneBox).toBeTruthy()
    for (const note of await notes.all()) {
      const box = await note.boundingBox()
      expect(box).toBeTruthy()
      expect(box!.x).toBeGreaterThanOrEqual(sceneBox!.x - 2)
      expect(box!.x + box!.width).toBeLessThanOrEqual(sceneBox!.x + sceneBox!.width + 2)
    }
    await page.screenshot({ path: `${SHOTS}/garden-${size.name}.png`, caret: 'initial' })

    await page.goto('/p/east-london/lanes')
    await expect(page.getByTestId('lanes')).toBeVisible()
    const grows = page.getByTestId('lane-grows')
    await expect(grows.first()).toBeVisible()
    const growText = await grows.allTextContents()
    expect(growText.length).toBeGreaterThan(0)
    for (const line of growText) expect(line).toMatch(/^Grows your .+ tree$/)
    const doors = await page.getByTestId('lane-doors').allTextContents()
    expect(doors.length).toBe(growText.length)
    for (const line of doors) expect(line.trim().length).toBeGreaterThan(0)
    await expect(page.getByTestId('lanes')).not.toContainText(/\bclauses?\b/i)
    await page.screenshot({ path: `${SHOTS}/lanes-${size.name}.png`, fullPage: true, caret: 'initial' })
  }
})
