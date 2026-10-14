import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { E2E_DATABASE } from '../env'
import { artifactDir } from './artifact-dir'

const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const shots = process.env.SCREENSHOT_DIR || artifactDir('library-teach')

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function shot(page: Page, name: string) {
  mkdirSync(shots, { recursive: true })
  await page.screenshot({ path: `${shots}/${name}.png`, caret: 'initial' })
}

test.describe.configure({ mode: 'serial' })

test('the library says who can open each course, and a new code picks from that list', async ({ page }) => {
  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/library')
  await expect(page.getByTestId('library-pack')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Library packs' })).toHaveCount(0)
  const course = page.getByTestId('library-course').first()
  await expect(course.getByTestId('opened-by')).toBeVisible()
  await expect(course.getByTestId('opened-by')).toContainText(/can open|No code or portal opens this yet/)
  const size = await course.getByTestId('opened-by').evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))
  expect(size).toBeGreaterThanOrEqual(16)
  await shot(page, 'library-opened-by')

  await page.goto('/p/east-london/admin/access')
  const required = page.getByTestId('required-tree')
  await required.scrollIntoViewIfNeeded()
  await expect(required.getByTestId('course-tree-search')).toBeVisible()
  await required.locator('.tree-door-name').first().click()
  await required.getByTestId('door-select-all').first().check()
  await expect(required.getByTestId('selected-count')).not.toHaveText('0 courses selected')
  await expect(required.getByTestId('required-course').first()).toBeVisible()
  await page.getByTestId('new-code-submit').scrollIntoViewIfNeeded()
  await shot(page, 'access-picker')
})

test('demo learners show varied on-time fractions on Teach', async ({ page }) => {
  execSync('npm run demo:timed-learners', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: E2E_DATABASE } })
  await page.setViewportSize(DESK)
  await signIn(page, 'demo-admin@hearts-demo.test', 'demo-timed', '/p/hearts-demo/admin/teach')
  await expect(page.getByTestId('on-time-header')).toHaveAttribute('title', /study plan/)
  await expect(page.getByTestId('on-time-header')).toHaveAttribute('title', /due by today/)

  const row = (name: string) => page.getByTestId('learner-row').filter({ hasText: name })
  await expect(row('Layla Rahman (demo)').getByTestId('learner-progress')).toHaveText('7')
  await expect(row('Layla Rahman (demo)').getByTestId('on-time')).toHaveText('7 of 7')
  await expect(row('Layla Rahman (demo)').getByTestId('learner-answers')).toHaveText('4')
  await expect(row('Yusuf Karim (demo)').getByTestId('learner-progress')).toHaveText('3')
  await expect(row('Yusuf Karim (demo)').getByTestId('on-time')).toHaveText('1 of 7')
  await expect(row('Yusuf Karim (demo)').getByTestId('learner-answers')).toHaveText('1')
  await expect(row('Amina Shah (demo)').getByTestId('learner-progress')).toHaveText('9')
  await expect(row('Amina Shah (demo)').getByTestId('on-time')).toHaveText('7 of 7')
  await expect(row('Amina Shah (demo)').getByTestId('learner-answers')).toHaveText('6')
  await expect(row('Hassan Malik (demo)').getByTestId('learner-progress')).toHaveText('5')
  await expect(row('Hassan Malik (demo)').getByTestId('on-time')).toHaveText('5 of 7')
  await expect(row('Hassan Malik (demo)').getByTestId('learner-answers')).toHaveText('5')
  await expect(page.getByTestId('learner-row').filter({ hasText: '(demo)' })).toHaveCount(4)
  await shot(page, 'teach-demo')
})

test('the workbook empty state is the arch and a sentence, with no bird art', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, 'leeds-learner@hearts.test', 'portal-learner', '/p/leeds/garden/workbook?filter=replied')
  const empty = page.getByTestId('workbook-empty')
  await empty.scrollIntoViewIfNeeded()
  await expect(empty).toBeVisible()
  await expect(empty.locator('img')).toHaveCount(0)
  await expect(empty).toContainText('Nothing here with this filter.')
  await expect(empty.getByRole('link', { name: 'Show every answer' })).toBeVisible()
  await expect(empty.locator('svg')).toHaveCount(1)
  await expect(page.locator('img[src*="/brand/"]')).toHaveCount(0)
  await shot(page, 'workbook-empty')
})
