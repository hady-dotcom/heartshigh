import { expect, request as playwrightRequest, test } from '@playwright/test'
import { E2E_BASE } from '../env'

const PLAYLIST = 'https://www.youtube.com/playlist?list=PLheartsround2'
const LOOSE = 'https://www.youtube.com/watch?v=B4KtRL_2aXY'

async function signIn(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login?next=%2Fmaster%2Fbring-in')
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await expect(page.getByTestId('bring-in')).toBeVisible()
}

test('a blank new course takes the playlist title and the channel, and the example stays readable', async ({ page }) => {
  await signIn(page)
  const placeholder = await page.getByTestId('bring-in-urls').evaluate((el) => {
    const style = getComputedStyle(el, '::placeholder')
    return { color: style.color, opacity: style.opacity }
  })
  expect(placeholder.color === 'rgb(168, 152, 120)' || placeholder.color === 'rgba(168, 152, 120, 1)').toBeTruthy()
  expect(Number(placeholder.opacity)).toBeCloseTo(1, 1)
  await expect(page.getByTestId('bring-in-urls')).toHaveAttribute('placeholder', /^e\.g\./)
  await page.getByTestId('bring-in-urls').fill(PLAYLIST)
  await page.getByTestId('bring-in-more').locator('summary').click()
  await page.getByTestId('bring-in-course').selectOption('new')
  await page.getByTestId('bring-in-lookup').click()
  await expect(page.getByTestId('bring-in-preview')).toBeVisible()
  await expect(page.getByTestId('error')).toHaveCount(0)
  await expect(page.getByTestId('bring-in')).not.toContainText('Pick a course, or type a name')
  await expect(page.getByTestId('bring-in-review-title')).toHaveValue('Round two sitting')
  await expect(page.getByTestId('bring-in-review-speaker')).toHaveValue('HEARTS channel')
  await expect(page.locator('[data-testid="bring-in-row"][data-id="fresh000001"] [data-testid="bring-in-row-speaker"]')).toHaveValue('HEARTS channel')
  await expect(page.locator('[data-testid="bring-in-row"][data-id="fresh000001"] [data-testid="bring-in-row-jibril"]')).toHaveValue('')
  await expect(page.locator('[data-testid="bring-in-row"][data-id="fresh000001"] [data-testid="bring-in-row-ghunya"]')).toHaveValue('')
  await expect(page.locator('[data-testid="bring-in-row"][data-id="fresh000001"] [data-testid="bring-in-row-place"]')).toContainText('No captions yet')
  await expect(page.locator('[data-testid="bring-in-row"][data-id="nocaps00001"] [data-testid="bring-in-row-place"]')).toContainText('No captions on this film')
})

test('a loose link takes the film title, and the review boxes can be changed before saving', async ({ page }) => {
  const title = `Autofill ${Date.now().toString().slice(-6)}`
  await signIn(page)
  await page.getByTestId('bring-in-urls').fill(LOOSE)
  await page.getByTestId('bring-in-more').locator('summary').click()
  await page.getByTestId('bring-in-course').selectOption('new')
  await page.getByTestId('bring-in-lookup').click()
  await expect(page.getByTestId('bring-in-review-title')).toHaveValue(/^Brought in \d{1,2} \w{3} \d{4}$/)
  await expect(page.getByTestId('bring-in-review-speaker')).toHaveValue('HEARTS channel')
  await page.getByTestId('bring-in-review-title').fill(title)
  await page.getByTestId('bring-in-review-speaker').fill('Shaykh Test')
  await page.getByTestId('bring-in-commit').click()
  await expect(page.getByTestId('bring-in-result')).toBeVisible()

  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const courses = await (await master.get(`/api/courses?where[title][equals]=${encodeURIComponent(title)}&limit=1&depth=0`)).json()
  const course = courses.docs?.[0]
  expect(course?.title).toBe(title)
  expect(course?.speaker).toBe('Shaykh Test')
  const lessons = await (await master.get(`/api/lessons?where[course][equals]=${course.id}&limit=5&depth=0`)).json()
  expect(lessons.docs?.[0]?.speaker).toBe('Shaykh Test')
  expect(lessons.docs?.[0]?.title).toBe('Goals for the month')
  for (const lesson of lessons.docs || []) await master.delete(`/api/lessons/${lesson.id}`)
  if (course?.id) await master.delete(`/api/courses/${course.id}`)
  await master.dispose()
})

test('saving still asks for a course name when the review box is cleared', async ({ page }) => {
  await signIn(page)
  await page.getByTestId('bring-in-urls').fill('https://www.youtube.com/watch?v=kM7LVppIMl0')
  await page.getByTestId('bring-in-more').locator('summary').click()
  await page.getByTestId('bring-in-course').selectOption('new')
  await page.getByTestId('bring-in-new-title').fill('')
  await page.getByTestId('bring-in-lookup').click()
  await expect(page.getByTestId('bring-in-preview')).toBeVisible()
  await expect(page.getByTestId('error')).toHaveCount(0)
  await expect(page.getByTestId('bring-in-review-title')).toHaveValue(/^Brought in \d{1,2} \w{3} \d{4}$/)
  await page.getByTestId('bring-in-review-title').fill('')
  await page.getByTestId('bring-in-commit').click()
  await expect(page.getByTestId('error')).toContainText('Type a name for the new course')
})
