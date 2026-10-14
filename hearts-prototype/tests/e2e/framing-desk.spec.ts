import { expect, test, type Locator, type Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/login?next=%2Fmaster%2Fframing')
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => url.pathname.startsWith('/master/framing'))
}

async function openFirstClip(page: Page) {
  await expect(page.getByTestId('master-framing')).toBeVisible()
  await page.getByTestId('framing-open').first().click()
  await expect(page.getByTestId('framing-clip')).toBeVisible()
  await expect(page.getByTestId('framing-explainer')).toContainText('words underneath')
  const count = (await page.getByTestId('segment-count').innerText()).trim()
  expect(count).toMatch(/^\d+ segments?$/)
  expect(count).not.toBe('1 segments')
}

async function ratio(stage: Locator, film: Locator) {
  const outer = await stage.boundingBox()
  const inner = await film.boundingBox()
  expect(outer && inner).toBeTruthy()
  return {
    height: inner!.height / outer!.height,
    top: (inner!.y - outer!.y) / outer!.height,
  }
}

async function learnerShape(page: Page) {
  const root = page.getByTestId('learner-preview')
  const player = root.getByTestId('framing-player')
  await expect(player).toHaveAttribute('data-framing-mode', 'F')
  await expect(player).toHaveAttribute('data-framing-source', 'placeholder')
  const shape = await ratio(player, root.getByTestId('framing-film'))
  expect(shape.height).toBeLessThan(0.4)
  expect(shape.top).toBeLessThan(0.14)
  return shape
}

test('the framing desk shows the learner phone, and the lab crop changes at both sizes', async ({ page }) => {
  test.setTimeout(240_000)
  await signIn(page)

  await page.setViewportSize({ width: 1280, height: 800 })
  await openFirstClip(page)
  await learnerShape(page)
  await page.getByTestId('learner-preview').screenshot({ path: 'test-results/framing-learner-1280.png' })

  await page.getByTestId('for-techies').locator('summary').click()
  const lab = page.getByTestId('lab-preview')
  await expect(lab).toBeVisible()
  const face = page.getByTestId('face-track-note')
  const faceLabel = await page.locator('[data-testid="framing-mode-select"] option[value="D"]').innerText()
  if (faceLabel.includes('not run')) {
    await expect(face).toHaveText("Face tracking hasn't been run on this clip.")
  } else {
    await expect(face).toHaveCount(0)
  }

  await page.getByTestId('framing-mode-select').selectOption('A')
  const labPlayer = lab.getByTestId('framing-player')
  await expect(labPlayer).toHaveAttribute('data-framing-mode', 'A')
  await expect.poll(async () => (await ratio(labPlayer, lab.getByTestId('framing-film'))).height).toBeGreaterThan(0.9)
  await learnerShape(page)
  await lab.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/framing-lab-a-1280.png' })

  await page.getByTestId('framing-mode-select').selectOption('B')
  await expect(labPlayer).toHaveAttribute('data-framing-mode', 'B')
  await expect.poll(async () => (await ratio(labPlayer, lab.getByTestId('framing-film'))).height).toBeLessThan(0.45)
  await expect.poll(async () => (await ratio(labPlayer, lab.getByTestId('framing-film'))).top).toBeGreaterThan(0.15)
  await learnerShape(page)
  await page.screenshot({ path: 'test-results/framing-lab-b-1280.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await learnerShape(page)
  await page.getByTestId('framing-mode-select').selectOption('A')
  await expect(labPlayer).toHaveAttribute('data-framing-mode', 'A')
  await expect.poll(async () => (await ratio(labPlayer, lab.getByTestId('framing-film'))).height).toBeGreaterThan(0.9)
  await lab.scrollIntoViewIfNeeded()
  await lab.screenshot({ path: 'test-results/framing-lab-a-390.png' })
  await page.getByTestId('learner-preview').screenshot({ path: 'test-results/framing-learner-390.png' })
  await page.screenshot({ path: 'test-results/framing-page-390.png' })

  await page.getByTestId('framing-mode-select').selectOption('B')
  await expect.poll(async () => (await ratio(labPlayer, lab.getByTestId('framing-film'))).top).toBeGreaterThan(0.15)
  await lab.screenshot({ path: 'test-results/framing-lab-b-390.png' })

  await page.getByTestId('framing-save').click()
  await expect(page.getByTestId('notice')).toContainText('Learners still see')
  await expect(page.getByTestId('learner-preview').getByTestId('framing-player')).toHaveAttribute('data-framing-mode', 'F')
  await page.getByTestId('for-techies').locator('summary').click()
  await expect(page.getByTestId('framing-mode-select')).toHaveValue('B')
  await expect(page.getByTestId('lab-preview').getByTestId('framing-player')).toHaveAttribute('data-framing-mode', 'B')
  await learnerShape(page)
})
