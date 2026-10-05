import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { seedCode } from '../env'
import { joinWithConsent, signIn } from './legal-helpers'

const dir = path.resolve(process.cwd(), 'proto-test/verify/legal')

test.use({ video: { dir, size: { width: 390, height: 844 } } })

async function shot(page: import('@playwright/test').Page, name: string) {
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true, caret: 'initial' })
}

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
  await joinWithConsent(page, seedCode('elm-learner'), 'Still Learner', `still-${suffix}@hearts.test`, 'still-pass-1')
  await expect(page.getByTestId('welcome').or(page.getByTestId('splash')).first()).toBeVisible()
  await shot(page, 'still-after-consent')

  await page.goto('/p/east-london/search?q=jibril')
  await expect(page.getByTestId('search')).toBeVisible()
  await shot(page, 'still-search')

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'leeds-admin@hearts.test', 'portal-admin', '/p/leeds/admin/children')
  await expect(page.getByTestId('admin-children')).toBeVisible()
  await shot(page, 'still-children-desk')

  await page.goto('/p/leeds/admin/contacts')
  await expect(page.getByTestId('admin-contacts')).toBeVisible()
  await shot(page, 'still-contacts-desk')
})
