import { expect, test } from '@playwright/test'
import { seedCode } from '../env'
import { joinWithConsent, signIn } from './legal-helpers'

const suffix = Date.now().toString().slice(-6)

test('L03 join records consent and opens the welcome', async ({ page }) => {
  const email = `legal-join-${suffix}@hearts.test`
  await joinWithConsent(page, seedCode('elm-learner'), 'Legal Joiner', email, 'legal-join-1')
  await expect(page.getByTestId('welcome').or(page.getByTestId('splash')).first()).toBeVisible()
})

test('L01 L02 legal pages are linked from the door and show a draft mark', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('link-privacy').click()
  await expect(page.getByTestId('privacy')).toBeVisible()
  await expect(page.getByTestId('legal-draft')).toContainText('Draft for adviser review')
  await expect(page.getByTestId('legal-summary')).toBeVisible()
  await expect(page.getByTestId('legal-body')).toContainText('What we keep')
  await page.goto('/guidelines')
  await expect(page.getByTestId('guidelines')).toBeVisible()
  await page.goto('/terms')
  await expect(page.getByTestId('terms')).toBeVisible()
})

test('H02 get help files a broken note', async ({ page }) => {
  const { signIn } = await import('./legal-helpers')
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/me/help')
  await expect(page.getByTestId('help-request')).toBeVisible()
  await page.getByTestId('help-broken-note').fill('The film did not start.')
  await page.getByTestId('help-broken-send').click()
  await expect(page.getByTestId('notice')).toContainText(/look at what broke|Thank you/i)
})

test('seeded learners already agreed and can open home', async ({ page }) => {
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.getByTestId('home').or(page.getByTestId('welcome')).first()).toBeVisible()
})
