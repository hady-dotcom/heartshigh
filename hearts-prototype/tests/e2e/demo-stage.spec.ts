import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const dir = process.env.SCREENSHOT_DIR || 'artifacts/screenshots'

async function openDemo(page: Page) {
  await page.goto('/demo-stage')
  await expect(page).toHaveURL(/\/demo-stage$/)
  await expect(page.getByTestId('login')).toHaveCount(0)
  await expect(page.getByTestId('demo-entry')).toBeVisible()
  await expect(page.getByTestId('demo-entry-title')).toContainText('Practice data only')
  await expect(page.getByTestId('demo-entry-title')).toContainText('nothing you do here changes real portals')
  await page.getByTestId('demo-start').click()
  await expect(page.getByTestId('demo-stage')).toBeVisible()
  await expect(page.getByTestId('demo-cast')).toBeVisible()
}

test.describe.configure({ timeout: 180_000 })

async function showCast(page: Page) {
  await expect(page.getByTestId('demo-cast-master')).toBeVisible()
  await expect(page.getByTestId('demo-cast-admin')).toBeVisible()
  await expect(page.getByTestId('demo-cast-teacher')).toBeVisible()
  await expect(page.getByTestId('demo-cast-learner')).toBeVisible()
  await expect(page.getByTestId('demo-cast-master')).toHaveValue('Leon (HEARTS)')
  await expect(page.getByTestId('demo-cast-portal-prompt')).toHaveText('Who would look after your mosque?')
  await page.getByTestId('demo-cast-kind-school').click()
  await expect(page.getByTestId('demo-cast-portal-prompt')).toHaveText('Who would look after your school?')
  await page.getByTestId('demo-cast-kind-mosque').click()
  await expect(page.getByTestId('demo-cast-admin')).toHaveValue('Rafiq')
  await expect(page.getByTestId('demo-cast-portal')).toHaveValue('Al-Noor Mosque')
  await expect(page.getByTestId('demo-cast-teacher')).toHaveValue('Sami')
  await expect(page.getByTestId('demo-cast-learner')).toHaveValue('Abdallah')
  await expect(page.getByTestId('demo-cast-show')).toHaveText('Show all four')
  await page.getByTestId('demo-cast-show').click()
}

async function downAndUp(page: Page, course: string, note: string, learner = 'Abdallah') {
  await expect(page.getByTestId('demo-waiting-count')).toHaveText('3')
  await expect(page.getByTestId('demo-done-count')).toHaveText('2')
  await expect(page.getByTestId('demo-num-courses')).toHaveText('3')
  await expect(page.getByTestId('demo-num-stuck')).toHaveText('5')
  await expect(page.getByTestId('demo-library')).toContainText('A quiet hour')
  const frame = page.frameLocator('[data-testid="demo-learner-frame"]')
  await expect(page.getByTestId('demo-learner-frame')).toHaveAttribute('src', /\/p\/(hearts-demo|east-london)\/feed$/)
  await expect(page.getByTestId('demo-learner-frame')).toHaveAttribute('width', '390')
  await expect(page.getByTestId('demo-learner-frame')).toHaveAttribute('height', '844')
  await expect(frame.getByTestId('journey')).toBeVisible({ timeout: 60_000 })
  await expect(frame.getByTestId('journey')).toHaveAttribute('data-framing', 'F')
  await expect(frame.getByTestId('tab-garden')).toBeVisible({ timeout: 20_000 })
  await expect(frame.getByTestId('tab-lanes')).toBeVisible()
  await expect(frame.getByTestId('tab-me')).toBeVisible()
  await expect(page.getByTestId('demo-phone-toasts')).toContainText('Circle meets after Maghrib tonight.')
  await expect(page.getByTestId('demo-queue')).toContainText('Can we sit with this again on Friday?')
  await expect(page.getByTestId('demo-queue')).toContainText('I missed two days')
  await expect(page.getByTestId('demo-activity')).toContainText('Maryam sent a comment.')
  await expect(page.getByTestId('demo-stuck')).toContainText('Hamza')

  await page.getByTestId('demo-loop-note').click()
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-actor', 'portal')
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-focus', 'portal learner')
  await expect(page.locator('.demo-cell.is-dim')).toHaveCount(2)
  await expect(page.locator('.demo-cell.is-live')).toHaveCount(2)
  await expect.poll(() => page.getByTestId('demo-panel-teacher').evaluate((el) => Number(getComputedStyle(el.parentElement as HTMLElement).opacity))).toBeLessThan(0.5)
  await expect.poll(() => page.getByTestId('demo-panel-portal').evaluate((el) => Number(getComputedStyle(el.parentElement as HTMLElement).opacity))).toBeGreaterThan(0.95)
  await expect(page.getByTestId('demo-phone-toasts')).toContainText('Bring a notebook to the circle tonight.')
  const teacherTint = await page.getByTestId('demo-panel-teacher').locator('.demo-strip').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(teacherTint).toBe('rgb(196, 143, 44)')
  await page.getByTestId('demo-focus').click()
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-focus', 'off')
  await expect(page.locator('.demo-cell.is-dim')).toHaveCount(0)
  await page.getByTestId('demo-focus').click()

  await page.getByTestId('demo-course-title').fill(course)
  await page.getByTestId('demo-add-course').click()
  await expect(page.getByTestId('demo-library')).toContainText(course)
  await expect(page.getByTestId('demo-phone-toasts')).toContainText(course)
  await expect(page.getByTestId('demo-master-courses')).toContainText(course)
  await expect(page.getByTestId('demo-num-courses')).toHaveText('4')
  await expect(page.getByTestId('demo-activity')).toContainText(course)
  await expect(page.getByTestId('demo-ticker')).toContainText(course)
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-actor', 'master')
  await expect(page.locator('.demo-panel.is-glow, [data-fresh="1"]').first()).toBeVisible()

  await page.getByTestId('demo-note-body').fill(note)
  await page.getByTestId('demo-post-note').click()
  await expect(page.getByTestId('demo-phone-toasts')).toContainText(note)

  await page.getByTestId('demo-prompt-text').fill('What did you notice?')
  await page.getByTestId('demo-set-question').click()
  await expect(page.getByTestId('demo-phone-toasts')).toContainText('What did you notice?')

  await page.getByTestId('demo-loop-answer').click()
  await expect(page.getByTestId('demo-queue')).toContainText('I will try ten quiet minutes.')
  await expect(page.getByTestId('demo-waiting-count')).toHaveText('4')
  await expect(page.getByTestId('demo-num-waiting')).toHaveText('4')
  await expect(page.getByTestId('demo-activity')).toContainText(`${learner} answered a question.`)

  const card = page.getByTestId('demo-queue-item').filter({ hasText: 'I will try ten quiet minutes.' })
  await card.locator('textarea').fill('I am glad you noticed it.')
  await card.getByRole('button', { name: 'Send reply' }).click()
  await expect(card).toHaveAttribute('data-done', 'true')
  await expect(card.getByTestId('demo-done-mark')).toBeVisible()
  await expect(page.getByTestId('demo-phone-toasts')).toContainText('I am glad you noticed it.')
  await expect(page.getByTestId('demo-waiting-count')).toHaveText('3')
  await expect(page.getByTestId('demo-done-count')).toHaveText('3')
  await expect(page.getByTestId('demo-num-done')).toHaveText('3')
  await expect(page.getByTestId('demo-num-waiting')).toHaveText('3')
  await expect(page.getByTestId('demo-activity')).toContainText(`Sami wrote back to ${learner}.`)
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-focus', /learner/)
}

test('the loop on a 1920 screen and a 1280 screen', async ({ page }) => {
  mkdirSync(dir, { recursive: true })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await openDemo(page)
  await showCast(page)
  for (const slot of ['master', 'portal', 'teacher', 'learner']) {
    await expect(page.getByTestId(`demo-panel-${slot}`)).toBeVisible()
  }
  await expect(page.getByText('Leon (HEARTS), running the whole system')).toBeVisible()
  await expect(page.getByText('Rafiq, looking after Al-Noor Mosque')).toBeVisible()
  await expect(page.getByText('Sami, guiding the learners')).toBeVisible()
  await expect(page.getByText('Abdallah, a learner at Al-Noor Mosque')).toBeVisible()
  await expect(page.getByTestId('demo-name-learner')).toHaveText('Abdallah')
  const phone = page.getByTestId('demo-phone')
  const wide = await phone.boundingBox()
  expect(wide?.width || 0).toBeGreaterThan(280)
  expect(wide?.width || 0).toBeLessThan(420)

  await downAndUp(page, 'River path', 'Quiz night is on Thursday.')
  await page.screenshot({ path: `${dir}/demo-loop-1920x1080.png`, fullPage: false })

  await page.getByTestId('demo-name-learner').click()
  await page.getByTestId('demo-name-learner-input').fill('Layla')
  await page.getByTestId('demo-name-learner-input').press('Enter')
  await expect(page.getByTestId('demo-name-learner')).toHaveText('Layla')
  await expect(page.getByTestId('demo-queue-item').filter({ hasText: 'I will try ten quiet minutes.' })).toContainText('Layla')

  await page.getByTestId('demo-edit-cast').click()
  await expect(page.getByTestId('demo-cast-learner')).toHaveValue('Layla')
  await expect(page.getByTestId('demo-cast-show')).toHaveText('Done')
  await page.getByTestId('demo-cast-pick').filter({ hasText: /^Maryam$/ }).click()
  await page.getByTestId('demo-cast-show').click()
  await expect(page.getByTestId('demo-name-learner')).toHaveText('Maryam')
  await expect(page.getByText('Maryam, a learner at Al-Noor Mosque')).toBeVisible()

  await page.getByTestId('demo-play').click()
  await expect(page.getByTestId('demo-step-say')).toHaveAttribute('data-status', 'done', { timeout: 30_000 })
  await expect(page.getByTestId('demo-phone-toasts')).toContainText('Ten quiet minutes is enough')
  await expect(page.getByTestId('demo-library')).toContainText('Night walk')
  await expect(page.getByTestId('demo-queue')).toContainText('I will try ten quiet minutes.')
  await expect(page.getByTestId('demo-queue')).toContainText('I held the door for someone.')
  await expect(page.getByTestId('demo-queue')).toContainText('Can I ask about the last part?')
  await expect(page.getByTestId('demo-queue-item').filter({ hasText: 'I will try ten quiet minutes.' })).toHaveAttribute('data-done', 'true')
  await expect(page.getByTestId('demo-num-courses')).toHaveText('4')
  await expect(page.getByTestId('demo-done-count')).toHaveText('3')
  await page.screenshot({ path: `${dir}/demo-play-1920x1080.png`, fullPage: false })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByTestId('demo-reset').click()
  await page.getByTestId('demo-layout-row').click()
  await expect(page.getByTestId('demo-name-learner')).toHaveText('Maryam')
  const narrow = await page.getByTestId('demo-phone').boundingBox()
  expect(narrow?.width || 0).toBeGreaterThan(180)
  await downAndUp(page, 'Hill path', 'Bring a friend on Thursday.', 'Maryam')
  await page.screenshot({ path: `${dir}/demo-loop-1280x800.png`, fullPage: false })
})

test('a nav change reaches the phone and a learner note comes back up', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await openDemo(page)
  await showCast(page)

  await page.getByTestId('demo-nav-master-calendar').click()
  await page.getByTestId('demo-cover-input-master-calendar').fill('Open evening')
  await page.getByTestId('demo-cover-go-master-calendar').click()
  await expect(page.getByTestId('demo-phone-toasts')).toContainText('Open evening')
  await expect(page.getByTestId('demo-alerts-learner')).toContainText('Open evening')
  await page.getByTestId('demo-nav-portal-calendar').click()
  await expect(page.getByTestId('demo-live-portal-calendar')).toContainText('Open evening')

  await page.getByTestId('demo-nav-master-learners').click()
  await page.getByTestId('demo-cover-go-master-learners').click()
  await expect(page.getByTestId('demo-phone-toasts')).toContainText('Your place is paused')

  await page.getByTestId('demo-nav-portal-safety').click()
  await page.getByTestId('demo-cover-input-portal-safety').fill('We will sit with you today')
  await page.getByTestId('demo-cover-go-portal-safety').click()
  await expect(page.getByTestId('demo-phone-toasts')).toContainText('We will sit with you today')
  await page.getByTestId('demo-nav-teacher-diaries').click()
  await expect(page.getByTestId('demo-live-teacher-diaries')).toContainText('I sat for ten minutes on Sunday.')
  await page.getByTestId('demo-nav-master-library').click()
  await expect(page.getByTestId('demo-course-title')).toBeVisible()
  await expect(page.getByTestId('demo-num-courses')).toHaveText('3')
})

test('a signed-out person gets the demo door, not the app login', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/demo-stage')
  await expect(page).toHaveURL(/\/demo-stage$/)
  await expect(page.getByTestId('login-email')).toHaveCount(0)
  await expect(page.locator('.garden-door')).toHaveCount(0)
  await expect(page.getByTestId('demo-entry')).not.toContainText('HEARTS')
  await expect(page.getByTestId('demo-entry-title')).toHaveText('Hady Core Demo stage: a live four-screen walk-through (master, portal admin, teacher, learner). Practice data only; nothing you do here changes real portals.')
  await expect(page.getByTestId('demo-start')).toHaveText('Start the Demo stage')
  const colours = {
    master: 'rgb(37, 33, 74)',
    portal: 'rgb(31, 138, 120)',
    teacher: 'rgb(196, 143, 44)',
    learner: 'rgb(122, 79, 168)',
  }
  for (const [key, colour] of Object.entries(colours)) {
    await expect.poll(() => page.getByTestId(`demo-dot-${key}`).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(colour)
  }
  const door = await page.getByTestId('demo-entry').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(door).not.toBe('rgb(243, 238, 228)')
  await page.getByTestId('demo-start').click()
  await expect(page.getByTestId('demo-cast')).toBeVisible()
  await expect(page.getByTestId('demo-entry')).toHaveCount(0)
  await expect(page.getByTestId('demo-header-title')).toHaveText('Hady Core Demo stage')
  await expect(page.locator('.demo-title .demo-kicker')).toHaveText('Hady Core · sample only')
})
