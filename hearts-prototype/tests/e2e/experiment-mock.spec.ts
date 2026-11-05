import { expect, test, type Page } from '@playwright/test'
import { artifactDir } from './artifact-dir'

const DESK = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }
const SHOTS = artifactDir('screenshots')

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

function watch(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500 && !response.url().includes('favicon')) errors.push(`${response.status()} ${response.url()}`)
  })
  return errors
}

test.describe('Experiment phone mocks', () => {
  test('desk width: list, detail, and setup preview show both versions', async ({ page }) => {
    test.setTimeout(120_000)
    const errors = watch(page)
    await page.setViewportSize(DESK)
    await signIn(page, '/master/experiments')
    const feed = page.locator('[data-testid=experiment-card][data-key=feed-cta-label]')
    const mock = feed.getByTestId('experiment-mock')
    await expect(mock).toBeVisible()
    await expect(mock).toHaveAttribute('data-screen', 'The feed')
    await expect(mock.getByTestId('experiment-mock-version')).toHaveCount(2)
    await expect(mock.getByTestId('experiment-mock-target').nth(0)).toContainText('Ready for more?')
    await expect(mock.getByTestId('experiment-mock-target').nth(1)).toContainText('Watch the 3-minute version')
    await expect(mock.getByTestId('experiment-mock-callout').first()).toContainText('This button changes')
    await mock.screenshot({ path: `${SHOTS}/experiment-mock-list-1280.png` })

    const lanes = page.locator('[data-testid=experiment-card][data-key=lanes-tab-label]')
    await expect(lanes.getByTestId('experiment-mock')).toHaveAttribute('data-kind', 'lanes-tab')
    await expect(lanes.getByTestId('experiment-mock-target').nth(0)).toHaveText('Lanes')
    await expect(lanes.getByTestId('experiment-mock-target').nth(1)).toHaveText('Explore')
    await expect(lanes.getByTestId('experiment-mock-callout').first()).toContainText('This tab changes')

    await feed.click()
    await expect(page.getByTestId('experiment-detail')).toBeVisible()
    const detail = page.getByTestId('experiment-mock')
    await expect(detail.getByTestId('experiment-mock-version')).toHaveCount(2)
    await expect(detail.getByTestId('experiment-mock-target').nth(0)).toContainText('Ready for more?')
    await detail.screenshot({ path: `${SHOTS}/experiment-mock-detail-1280.png` })

    await page.goto('/master/experiments/new')
    await page.getByTestId('experiment-goal').fill('the invitation into the whole talk')
    await page.getByTestId('experiment-show-setup').click()
    const preview = page.getByTestId('experiment-preview').getByTestId('experiment-mock')
    await expect(preview).toBeVisible()
    await expect(preview).toHaveAttribute('data-kind', 'talk-button')
    await expect(preview.getByTestId('experiment-mock-target').nth(0)).toContainText('Watch the whole talk')
    await expect(preview.getByTestId('experiment-mock-target').nth(1)).toContainText('Start this course')
    await page.getByTestId('experiment-preview-version').nth(1).fill('Begin the sitting')
    await expect(preview.getByTestId('experiment-mock-target').nth(1)).toHaveText('Begin the sitting')
    await preview.screenshot({ path: `${SHOTS}/experiment-mock-preview-1280.png` })
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('phone width: the same pair of versions stays side by side', async ({ page }) => {
    test.setTimeout(120_000)
    const errors = watch(page)
    await page.setViewportSize(PHONE)
    await signIn(page, '/master/experiments')
    const lanes = page.locator('[data-testid=experiment-card][data-key=lanes-tab-label]')
    const mock = lanes.getByTestId('experiment-mock')
    await expect(mock).toBeVisible()
    await expect(mock.getByTestId('experiment-mock-version')).toHaveCount(2)
    const box = await mock.boundingBox()
    expect(box && box.width).toBeLessThanOrEqual(390)
    const versions = mock.getByTestId('experiment-mock-version')
    const left = await versions.nth(0).boundingBox()
    const right = await versions.nth(1).boundingBox()
    expect(left && right && left.x < right.x).toBeTruthy()
    expect(left && right && Math.abs(left.y - right.y)).toBeLessThan(24)
    await mock.screenshot({ path: `${SHOTS}/experiment-mock-list-390.png` })

    await page.goto('/master/experiments/new')
    await page.getByTestId('experiment-goal').fill('the button under a short clip')
    await page.getByTestId('experiment-show-setup').click()
    const preview = page.getByTestId('experiment-preview').getByTestId('experiment-mock')
    await expect(preview.getByTestId('experiment-mock-version')).toHaveCount(2)
    await expect(preview.getByTestId('experiment-mock-callout').first()).toContainText('This button changes')
    const a = await preview.getByTestId('experiment-mock-version').nth(0).boundingBox()
    const b = await preview.getByTestId('experiment-mock-version').nth(1).boundingBox()
    expect(a && b && a.x < b.x).toBeTruthy()
    await preview.screenshot({ path: `${SHOTS}/experiment-mock-preview-390.png` })
    expect(errors, errors.join('\n')).toEqual([])
  })
})
