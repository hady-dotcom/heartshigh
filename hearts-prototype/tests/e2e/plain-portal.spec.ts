import { expect, test, type Page } from '@playwright/test'

const PHONE = { width: 390, height: 844 }
const suffix = Date.now().toString().slice(-7)
const slug = `plain-room-${suffix}`
const portalName = `Plain Room ${suffix}`
const brand = 'Plain Room'
const learnerCode = `P${suffix}L`
const password = 'plain-room'
const learnerEmail = `plain-learner-${suffix}@hearts.test`

const BANNED = /\b(hearts|islam|iman|ihsan|jibril|ghunya|qur['’]?an|hadith|mosque|masjid|allah|isha|imam|tafsir|jumu|ramadan|prophet|donations|appetiser)\b/i

async function signIn(page: Page, email: string, passwordValue: string, next: string) {
  await page.context().clearCookies()
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(passwordValue)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
}

async function join(page: Page, code: string, name: string, email: string) {
  await page.context().clearCookies()
  await page.goto(`/join?code=${code}`)
  await page.getByTestId('join-name').fill(name)
  await page.getByTestId('join-email').fill(email)
  await page.getByTestId('join-password').fill(password)
  await page.getByTestId('join-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/join'), { timeout: 30_000 })
}

async function assertClean(page: Page, label: string) {
  const root = page.locator('main').first()
  const text = ((await root.count()) ? await root.innerText() : await page.locator('body').innerText()).replace(/@hearts\.test/gi, '')
  expect(text, label).not.toMatch(BANNED)
  const images = await page.evaluate(() => {
    const hits: string[] = []
    document.querySelectorAll('body *').forEach((node) => {
      const el = node as HTMLElement
      const bg = getComputedStyle(el).backgroundImage || ''
      if (/evening-courtyard|lattice\.svg/i.test(bg)) hits.push(bg.slice(0, 160))
      if (el instanceof HTMLImageElement && /evening-courtyard|lattice\.svg/i.test(el.currentSrc || el.src)) hits.push(el.currentSrc || el.src)
    })
    return hits
  })
  expect(images, label).toEqual([])
}

test('a brand-new portal shows no HEARTS strings or images on learner pages', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(PHONE)

  await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
  await page.getByTestId('create-portal-name').fill(portalName)
  await page.getByTestId('create-portal-slug').fill(slug)
  await page.getByTestId('create-portal-brand').fill(brand)
  await page.getByTestId('create-portal-submit').click()
  await expect(page.getByTestId('notice')).toContainText('is open')

  await page.getByTestId('code-portal').selectOption(slug)
  await page.getByTestId('code-value').fill(learnerCode)
  await page.getByTestId('code-role').selectOption('learner')
  await page.getByTestId('create-code').click()
  await expect(page.getByTestId('notice')).toContainText(learnerCode)

  await join(page, learnerCode, 'Plain Learner', learnerEmail)
  await expect(page.getByTestId('portal-brand')).toContainText(brand)
  await expect(page.getByTestId('powered-by-donations')).toHaveCount(0)
  await assertClean(page, 'welcome')
  await page.getByTestId('welcome-begin').click()

  await expect(page.getByTestId('lets-play')).toBeVisible()
  await expect(page.getByTestId('opener-caption')).not.toContainText(/shine|dust|Alhamdulillah/i)
  await assertClean(page, 'opening')
  await page.getByTestId('just-show').click()
  await expect(page.getByTestId('feed-screen')).toBeVisible({ timeout: 30_000 })
  await assertClean(page, 'feed')

  const pages: [string, string][] = [
    ['home', `/p/${slug}`],
    ['courses', `/p/${slug}/courses`],
    ['lanes', `/p/${slug}/lanes`],
    ['week', `/p/${slug}/week`],
    ['me', `/p/${slug}/me`],
    ['gather', `/p/${slug}/gather`],
    ['live', `/p/${slug}/live`],
  ]
  for (const [label, href] of pages) {
    await page.goto(href)
    await assertClean(page, label)
  }

  await page.goto(`/p/${slug}/courses`)
  await page.getByTestId('page-help-open').click()
  await expect(page.getByTestId('page-help-title')).toHaveText('How to use the Garden')
  const help = (await page.getByTestId('page-help-sheet').innerText()).replace(/@hearts\.test/gi, '')
  expect(help, 'courses help').not.toMatch(BANNED)
  await page.getByTestId('page-help-close').click()

  await page.goto(`/p/${slug}/garden/jibril`)
  await expect(page).toHaveURL(new RegExp(`/p/${slug}/courses`))
  await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible()
  await assertClean(page, 'jibril redirect')
})
