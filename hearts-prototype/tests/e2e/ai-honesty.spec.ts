import { expect, test, type Page } from '@playwright/test'
import { AI_OFF_NOTE, PRACTICE_DRAFT_LABEL, SEASONAL_APPROVAL, aiAccountLine } from '../../src/lib/ai-honesty'

const WIDTHS = [
  { name: '1280', width: 1280, height: 800 },
  { name: '390', width: 390, height: 844 },
] as const

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function noteSitsUnder(page: Page, formId: string, buttonId: string) {
  const form = page.getByTestId(formId)
  const note = form.getByTestId('portal-ai-off')
  const button = form.getByTestId(buttonId)
  await note.scrollIntoViewIfNeeded()
  await expect(note).toBeVisible()
  await expect(note).toHaveText(AI_OFF_NOTE)
  await expect(form.getByTestId('portal-ai-confirm')).toHaveCount(0)
  const order = await form.evaluate((node) => [...node.querySelectorAll('[data-testid]')].map((item) => item.getAttribute('data-testid')))
  expect(order.indexOf(buttonId)).toBeGreaterThanOrEqual(0)
  expect(order.indexOf(buttonId)).toBeLessThan(order.indexOf('portal-ai-off'))
  const noteBox = await note.boundingBox()
  const buttonBox = await button.boundingBox()
  expect(noteBox && buttonBox && noteBox.y >= buttonBox.y + buttonBox.height - 1).toBeTruthy()
}

test('AI tools say when no portal AI is connected, at phone and desk width', async ({ page }) => {
  test.setTimeout(180_000)
  await signIn(page, '/master/ai/hors-doeuvre')

  for (const size of WIDTHS) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.goto('/master/ai/hors-doeuvre')
    await expect(page.getByTestId('ai-step-page')).toBeVisible()
    await expect(page.getByTestId('desk-narrow')).toBeHidden()

    await noteSitsUnder(page, 'ai-try-draft', 'ai-try-submit')
    await expect(page.getByTestId('ai-try-submit')).toHaveText('Compare with the live output')

    await noteSitsUnder(page, 'ai-rerun', 'ai-rerun-submit')
    await expect(page.getByTestId('ai-rerun-submit')).toHaveText('Re-run')
    const scope = page.getByTestId('ai-scope')
    await expect(scope.locator('option')).toHaveText(['One talk', 'A selection', 'A course'])
    await expect(scope.locator('option', { hasText: 'Everything' })).toHaveCount(0)

    await page.goto('/master/calendar')
    await expect(page.getByTestId('calendar-desk')).toBeVisible()
    const seasonal = page.getByTestId('seasonal-approval')
    await seasonal.scrollIntoViewIfNeeded()
    await expect(seasonal).toHaveText(SEASONAL_APPROVAL)
    await expect(page.getByTestId('calendar-desk')).not.toContainText('AI drafts need your approval')

    await page.goto('/master/portals/east-london')
    await expect(page.getByTestId('portal-edit')).toBeVisible()
    const account = page.getByTestId('portal-ai-account')
    await expect(account).toHaveText(aiAccountLine(false))
    await expect(account).toHaveAttribute('data-connected', 'no')
    await expect(account.locator('input, textarea, select')).toHaveCount(0)
  }

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/master/ai/hors-doeuvre')
  await page.getByTestId('ai-try-submit').click()
  await expect(page.getByTestId('notice')).toContainText('No AI was used')
  await expect(page.getByTestId('ai-try-compare')).toHaveAttribute('data-builtin', 'yes')
  await expect(page.getByTestId('try-draft-label')).toHaveText(PRACTICE_DRAFT_LABEL)
  await expect(page.getByTestId('try-live-label')).toHaveText(PRACTICE_DRAFT_LABEL)
  await expect(page.getByTestId('ai-try-compare')).toContainText('From the box above.')
  await expect(page.getByTestId('ai-try-compare')).toContainText('From the saved words.')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.getByTestId('ai-step-page')).toBeVisible()
  await expect(page.getByTestId('try-draft-label')).toHaveText(PRACTICE_DRAFT_LABEL)
  await expect(page.getByTestId('try-live-label')).toHaveText(PRACTICE_DRAFT_LABEL)
})
