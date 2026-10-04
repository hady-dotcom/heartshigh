import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { expect, request as playwrightRequest, test, type Page } from '@playwright/test'
import { E2E_BASE, E2E_DATABASE } from '../env'

const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const shots = process.env.SCREENSHOT_DIR || '/opt/cursor/artifacts/library-teach'

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

test('library packs are summaries, and the course picker is the door tree', async ({ page }) => {
  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/library')
  const pack = page.getByTestId('library-pack').filter({ hasText: 'Jibril sittings' })
  await pack.scrollIntoViewIfNeeded()
  await expect(pack.getByTestId('pack-counts')).toContainText(/\d+ talks · \d+ courses/)
  await expect(pack.getByTestId('pack-summary')).toBeVisible()
  await expect(pack.getByTestId('pack-summary')).not.toContainText(/,.*,.*,/)
  await expect(pack.getByText('In this portal')).toBeVisible()
  await expect(page.getByText('Link this pack')).toHaveCount(0)
  await expect(pack.getByTestId('adopt-help')).toContainText('Learners only see them once an access code or a personal grant includes them.')
  await expect(page.getByTestId('pack-open')).toHaveCount(0)
  await shot(page, 'library-pack-closed')

  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const created = await master.post('/api/packs', { data: { title: 'Evening sample', owner: 'master', summary: 'A short pack that is not in this portal yet.', courses: [] } })
  expect(created.ok()).toBeTruthy()
  await master.dispose()
  await page.reload()

  await pack.getByText('Show the courses').click()
  const opened = page.getByTestId('pack-open')
  await expect(opened).toBeVisible()
  await opened.locator('[data-testid=door-tile][data-empty=no]').first().click()
  const course = opened.getByTestId('pack-course').first()
  if (!(await course.isVisible())) await opened.getByTestId('seat-group').first().locator('summary').click()
  await expect(course).toBeVisible()
  const fresh = page.getByTestId('library-pack').filter({ hasText: 'Evening sample' })
  await fresh.scrollIntoViewIfNeeded()
  await shot(page, 'library-pack-open')
  await fresh.scrollIntoViewIfNeeded()
  await expect(fresh.getByTestId('adopt-pack')).toHaveText('Add to this portal (stays in sync)')
  await expect(fresh.getByTestId('adopt-help')).toContainText('Learners only see them once an access code or a personal grant includes them.')

  const tree = page.getByTestId('split-tree')
  await tree.scrollIntoViewIfNeeded()
  await tree.getByTestId('course-tree-search').fill('zzzz-no-course')
  await expect(tree).toContainText('No courses match.')
  await tree.getByTestId('course-tree-search').fill('Names')
  await expect(tree.getByTestId('tree-door').first()).toBeVisible()
  await tree.getByTestId('door-select-all').first().check()
  await expect(tree.getByTestId('selected-count')).not.toHaveText('0 courses selected')
  await expect(tree.getByTestId('split-course').first()).toBeVisible()
  await shot(page, 'smaller-pack')

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
  await expect(page.getByTestId('learner-row')).toHaveCount(4)
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
