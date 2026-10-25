import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const SHOTS = process.env.DOOR_SHOTS || 'artifacts/screenshots'
const SIZES = [
  { name: '360x844', width: 360, height: 844 },
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
  await signIn(page, '/p/east-london/courses')
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.goto('/p/east-london/garden')
    await expect(page).toHaveURL(/\/courses$/)
    await expect(page.getByTestId('course-home')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible()
    await expect(page.getByTestId('garden-scene')).toHaveCount(0)
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
