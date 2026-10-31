import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const shots = '/opt/cursor/artifacts'

async function signIn(page: Page) {
  await page.goto('/login?next=/master/library')
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('master-library')).toBeVisible({ timeout: 30_000 })
}

async function noOverflow(page: Page) {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
  expect(fits).toBe(true)
}

async function expectLibrary(page: Page) {
  const totals = page.getByTestId('library-totals')
  await totals.scrollIntoViewIfNeeded()
  const text = (await totals.innerText()).replace(/\s+/g, ' ').trim()
  expect(text).toMatch(/^\d+ courses · \d+ films · \d+ playable · \d+ clips$/)
  const courses = Number(await totals.getAttribute('data-courses'))
  const films = Number(await totals.getAttribute('data-films'))
  const playable = Number(await totals.getAttribute('data-playable'))
  const clips = Number(await totals.getAttribute('data-clips'))
  expect(text).toBe(`${courses} courses · ${films} films · ${playable} playable · ${clips} clips`)
  expect(courses).toBeGreaterThan(0)
  expect(films).toBeGreaterThan(0)
  expect(playable).toBeGreaterThan(0)
  expect(playable).toBeLessThanOrEqual(films)
  expect(clips).toBeGreaterThan(0)
  const cards = await page.getByTestId('master-course').count()
  expect(cards).toBe(Math.min(24, courses))

  const card = page.getByTestId('master-course').filter({ has: page.getByTestId('course-watch') }).first()
  await card.scrollIntoViewIfNeeded()
  const src = await card.getByTestId('course-thumb').getAttribute('src')
  expect(src).toMatch(/^https:\/\/img\.youtube\.com\/vi\/[A-Za-z0-9_-]{11}\/mqdefault\.jpg$/)
  const id = src!.split('/')[4]
  await expect(card.getByTestId('course-watch')).toHaveAttribute('href', `https://www.youtube.com/watch?v=${id}`)
  await expect(card.getByTestId('course-films')).toContainText(/\d+ films?/)
  await expect(card.getByTestId('course-approved')).toContainText(/\d+ approved clips?/)
  await noOverflow(page)
}

async function openCourse(page: Page, name: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const card = page.getByTestId('master-course').filter({ hasText: name })
    if (await card.count()) {
      await card.first().getByTestId('course-open').click()
      await expect(page.getByTestId('film-grid')).toBeVisible()
      return
    }
    const next = page.getByTestId('page-next')
    if (!(await next.count())) break
    const status = page.getByTestId('page-status')
    const before = (await status.innerText()).trim()
    await next.click()
    await expect(status).not.toHaveText(before)
  }
  throw new Error(`No library course matching ${name}`)
}

async function expectCourse(page: Page) {
  await expect(page.getByTestId('film-grid')).toBeVisible()
  const total = Number((await page.getByTestId('film-total').innerText()).split(' ')[0])
  expect(total).toBeGreaterThan(0)
  const shown = await page.getByTestId('film-card').count()
  expect(shown).toBe(Math.min(48, total))
  const film = page.getByTestId('film-card').filter({ has: page.getByTestId('film-watch') }).first()
  await film.scrollIntoViewIfNeeded()
  await expect(film.locator('img')).toHaveAttribute('src', /^https:\/\/img\.youtube\.com\/vi\/[A-Za-z0-9_-]{11}\/mqdefault\.jpg$/)
  await expect(film.getByTestId('film-watch')).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/)
  const used = page.getByTestId('used-in')
  await used.scrollIntoViewIfNeeded()
  await expect(used.getByRole('heading', { name: 'Used in' })).toBeVisible()
  await expect(used.getByTestId('used-codes')).toContainText(/\w/)
  await expect(used.getByTestId('used-portals')).toContainText(/East London|Leeds|Harbour/)
  await noOverflow(page)
}

test('library totals, thumbnails and the course films fit a desktop window', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page)
  await expectLibrary(page)
  mkdirSync(shots, { recursive: true })
  await page.getByTestId('library-totals').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${shots}/library_desktop_list.png`, fullPage: false })
  await openCourse(page, 'Ar-Rabb')
  await expectCourse(page)
  await page.getByTestId('film-grid').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${shots}/library_desktop_course.png`, fullPage: false })
})

test('the same library fits a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await expect(page.getByTestId('desk-narrow')).toBeHidden()
  await expectLibrary(page)
  mkdirSync(shots, { recursive: true })
  await page.getByTestId('master-course').filter({ has: page.getByTestId('course-watch') }).first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${shots}/library_phone_list.png`, fullPage: false })
  await openCourse(page, 'Ar-Rabb')
  await expectCourse(page)
  await page.getByTestId('film-grid').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${shots}/library_phone_course.png`, fullPage: false })
})
