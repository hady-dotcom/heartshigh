import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const dir = process.env.SCREENSHOT_DIR || '/opt/cursor/artifacts/cms-library'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
}

async function shot(page: Page, name: string) {
  mkdirSync(dir, { recursive: true })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true })
}

test('library search, filters and the bin at phone size', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/library')
  await expect(page.getByTestId('master-library')).toBeVisible()
  await expect(page.getByTestId('library-talk-search')).toBeVisible()
  await expect(page.getByTestId('filter-teacher')).toBeVisible()
  await expect(page.getByTestId('filter-door')).toBeVisible()
  const teacherOptions = await page.getByTestId('filter-teacher').locator('option').allTextContents()
  expect(teacherOptions.some((option) => /Mikaeel Smith/.test(option))).toBeTruthy()
  expect(teacherOptions.some((option) => /Amina Yusuf/.test(option))).toBeFalsy()
  const doorOptions = await page.getByTestId('filter-door').locator('option').allTextContents()
  expect(doorOptions.some((option) => option.startsWith('HJ1'))).toBeTruthy()
  expect(doorOptions.some((option) => option.startsWith('HJ20'))).toBeTruthy()
  expect(doorOptions.some((option) => option.startsWith('HJ21'))).toBeFalsy()

  await page.goto('/master/codes')
  const keptCode = (await page.getByTestId('code-value').first().innerText()).trim()
  expect(keptCode.length).toBeGreaterThan(2)

  const title = `Aaa cms bin ${Date.now()}`
  const made = await page.request.post('/api/hearts', {
    form: {
      action: 'create-course',
      title,
      speaker: 'Mikaeel Smith',
      lesson: title,
      duration: '10:00',
      origin: 'master',
      next: '/master/library',
    },
    maxRedirects: 0,
  })
  expect(made.status()).toBeLessThan(400)
  await page.goto('/master/library')
  const courseCard = page.getByTestId('master-course').filter({ hasText: title })
  await expect(courseCard).toBeVisible()
  const courseHref = await courseCard.getByTestId('course-open').getAttribute('href')
  const courseId = Number(courseHref?.split('/').pop())
  expect(courseId).toBeGreaterThan(0)
  await page.goto(`/master/library/${courseId}`)
  const lessonButton = page.locator('[data-testid^="delete-lesson-"]').first()
  await expect(lessonButton).toBeVisible()
  const lessonId = Number((await lessonButton.getAttribute('data-testid'))?.replace('delete-lesson-', ''))
  expect(lessonId).toBeGreaterThan(0)
  const patched = await page.request.patch(`/api/lessons/${lessonId}`, {
    data: {
      youtubeId: 'NIR88RRpat4',
      videoProvider: 'youtube',
      durationSeconds: 600,
      speaker: 'Mikaeel Smith',
      jibrilSection: 'W10',
      publishState: 'published',
      transcriptSource: 'youtube',
      transcript: 'A line about the light of the name.',
      sourceTitle: title,
    },
  })
  expect(patched.ok(), await patched.text()).toBeTruthy()

  await page.goto(`/master/library?q=${encodeURIComponent(title)}&teacher=mikaeel-smith&door=HJ10&status=published&length=5-15&source=youtube`)
  const card = page.getByTestId('library-talk').filter({ hasText: title })
  await expect(card).toBeVisible()
  await shot(page, '01-library-search-phone')
  await card.getByTestId('talk-open').click()
  await expect(page.getByTestId('talk-detail')).toBeVisible()
  await expect(page.getByTestId('talk-watch')).toBeVisible()
  await expect(page.getByTestId('talk-course')).toBeVisible()
  await expect(page.getByTestId('talk-bin')).toBeVisible()
  await shot(page, '02-talk-detail-phone')

  await page.getByTestId('talk-bin-sure').check()
  await page.getByTestId('talk-bin').click()
  await expect(page.getByTestId('notice')).toContainText('bin')
  await expect(page.getByTestId('bin-row').filter({ hasText: title })).toBeVisible()
  await page.goto(`/master/library/${courseId}`)
  await expect(page.getByTestId(`delete-lesson-${lessonId}`)).toHaveCount(0)
  await page.goto('/master/codes')
  await expect(page.getByTestId('code-value').filter({ hasText: keptCode }).first()).toBeVisible()

  await page.goto('/master/bin')
  await shot(page, '03-bin-phone')
  const row = page.getByTestId('bin-row').filter({ hasText: title })
  await row.getByTestId('bin-open').click()
  await expect(page.getByTestId('talk-hidden-reason')).toContainText('bin')
  await page.getByTestId('talk-restore').click()
  await expect(page.getByTestId('notice')).toContainText('back')
  await page.goto(`/master/library/${courseId}`)
  await expect(page.getByTestId(`delete-lesson-${lessonId}`)).toBeVisible()

  await page.goto(`/master/library/talk/${lessonId}`)
  await page.getByTestId('talk-bin-sure').check()
  await page.getByTestId('talk-bin').click()
  await expect(page.getByTestId('bin-row').filter({ hasText: title })).toBeVisible()
  await page.getByTestId('empty-bin-sure').check()
  await page.getByTestId('empty-bin').click()
  await expect(page.getByTestId('notice')).toContainText('Join codes are unchanged')
  await expect(page.getByTestId('bin-row').filter({ hasText: title })).toHaveCount(0)
  await page.goto('/master/codes')
  await expect(page.getByTestId('code-value').filter({ hasText: keptCode }).first()).toBeVisible()

  await page.goto('/p/east-london/admin/library')
  await expect(page.getByTestId('admin-library')).toBeVisible()
  await expect(page.getByTestId('library-talk-search')).toBeVisible()
  await shot(page, '04-admin-library-phone')
})
