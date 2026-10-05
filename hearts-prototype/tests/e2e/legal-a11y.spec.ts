import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { signIn } from './legal-helpers'

const outDir = path.resolve(process.cwd(), 'proto-test/verify/legal')

async function scan(page: import('@playwright/test').Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  mkdirSync(outDir, { recursive: true })
  writeFileSync(path.join(outDir, `axe-${name}.json`), JSON.stringify(results, null, 2))
  const serious = results.violations.filter((row) => row.impact === 'serious' || row.impact === 'critical')
  return { results, serious }
}

test('X01 axe-core on main learner and desk pages', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('skip-link')).toBeAttached()
  const door = await scan(page, 'after-door')
  expect(door.serious, door.serious.map((row) => row.id).join(', ')).toEqual([])

  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.getByTestId('home').or(page.getByTestId('welcome')).first()).toBeVisible()
  const home = await scan(page, 'after-home')
  expect(home.serious, home.serious.map((row) => row.id).join(', ')).toEqual([])

  await page.goto('/p/east-london/me')
  const me = await scan(page, 'after-me')
  expect(me.serious, me.serious.map((row) => row.id).join(', ')).toEqual([])

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'leeds-admin@hearts.test', 'portal-admin', '/p/leeds/admin')
  await expect(page.getByTestId('admin-overview').or(page.locator('.desk')).first()).toBeVisible()
  const overview = await scan(page, 'after-desk')
  expect(overview.serious, overview.serious.map((row) => row.id).join(', ')).toEqual([])
})

test('H01 help mark is on learner and desk frames', async ({ page }) => {
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.locator('[data-help]').first()).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'leeds-admin@hearts.test', 'portal-admin', '/p/leeds/admin/contacts')
  await expect(page.getByTestId('desk-help').or(page.locator('[data-help]')).first()).toBeVisible()
})
