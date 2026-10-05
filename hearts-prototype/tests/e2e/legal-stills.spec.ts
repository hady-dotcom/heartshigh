import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { seedCode } from '../env'
import { signIn } from './legal-helpers'

const dir = path.resolve(process.cwd(), 'proto-test/verify/legal/round2')

async function shot(page: import('@playwright/test').Page, name: string) {
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true, caret: 'initial' })
}

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } })

test('proof stills: door, privacy, join, consent, search, children', async ({ page }) => {
  mkdirSync(dir, { recursive: true })
  await page.goto('/')
  await expect(page.getByTestId('link-privacy')).toBeVisible()
  await shot(page, 'still-door-legal-links')

  await page.getByTestId('link-privacy').click()
  await expect(page.getByTestId('privacy')).toBeVisible()
  await shot(page, 'still-privacy')

  await page.goto('/join')
  await expect(page.getByTestId('join-consent')).toBeVisible()
  await shot(page, 'still-join-consent-line')

  const suffix = Date.now().toString().slice(-6)
  await page.goto(`/join?code=${seedCode('elm-learner')}`)
  await page.getByTestId('join-name').fill('Still Learner')
  await page.getByTestId('join-email').fill(`still-${suffix}@hearts.test`)
  await page.getByTestId('join-password').fill('still-pass-1')
  await page.getByTestId('join-consent').check()
  await page.getByTestId('join-submit').click()
  await expect(page.getByTestId('consent')).toBeVisible()
  await expect(page.getByTestId('consent-submit')).toBeDisabled()
  await shot(page, 'still-consent')
  await page.getByTestId('age-18+').check()
  await expect(page.getByTestId('consent-submit')).toBeDisabled()
  await page.getByTestId('consent-agree').check()
  await expect(page.getByTestId('consent-submit')).toBeEnabled()
  await page.getByTestId('consent-submit').click()
  await expect(page.getByTestId('welcome').or(page.getByTestId('splash')).first()).toBeVisible()
  await shot(page, 'still-after-consent')

  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/search?q=salah')
  await expect(page.getByTestId('search')).toBeVisible()
  await expect(page.getByTestId('search-snippet').first()).toBeVisible()
  await shot(page, 'still-search')

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'leeds-admin@hearts.test', 'portal-admin', '/p/leeds/admin/children')
  await expect(page.getByTestId('admin-children')).toBeVisible()
  await expect(page.getByTestId('guardian-status').first()).toContainText(/We’ll know once they answer the age question|Not needed|Waiting|Yes/)
  await shot(page, 'still-children-desk')

  await page.goto('/p/leeds/admin/contacts')
  await expect(page.getByTestId('admin-contacts')).toBeVisible()
  await shot(page, 'still-contacts-desk')
})
