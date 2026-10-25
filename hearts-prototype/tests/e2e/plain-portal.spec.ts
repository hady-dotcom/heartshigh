import { expect, test } from '@playwright/test'

const PHONE = { width: 390, height: 844 }
const BANNED = /\b(HEARTS|Islam|Iman|Ihsan|Jibril|Ghunya|Qur['’]?an|hadith|mosque|masjid|Allah)\b|evening-courtyard|powered by donations/i

async function signIn(page: import('@playwright/test').Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('a brand-new portal shows no HEARTS content on learner pages', async ({ page }) => {
  test.setTimeout(180_000)
  const stamp = Date.now().toString(36)
  const slug = `plain-${stamp}`
  const code = `PLAIN${stamp}`.replace(/[^A-Z0-9]/gi, '').slice(0, 12).toUpperCase()
  await page.setViewportSize(PHONE)

  await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
  await page.getByTestId('create-portal-name').fill(`Plain ${stamp}`)
  await page.getByTestId('create-portal-slug').fill(slug)
  await page.locator('select[name="kind"]').selectOption('other')
  await page.locator('textarea[name="welcome"]').fill('Welcome. Watch the films here.')
  await page.getByTestId('create-portal-submit').click()
  await expect(page.getByTestId('notice')).toContainText('is open')

  await page.getByTestId('code-portal').selectOption(slug)
  await page.getByTestId('code-value').fill(code)
  await page.getByTestId('code-role').selectOption('learner')
  await page.getByTestId('create-code').click()
  await expect(page.getByTestId('notice')).toContainText(code)

  await page.goto(`/join?code=${code}`)
  await page.getByTestId('join-name').fill('Plain Learner')
  await page.getByTestId('join-email').fill(`plain-${stamp}@hearts.test`)
  await page.getByTestId('join-password').fill('portal-learner')
  await page.getByTestId('join-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/join'), { timeout: 30_000 })

  for (const path of ['/welcome', '/courses', '/lanes', '/me']) {
    await page.goto(`/p/${slug}${path}`)
    await expect(page.locator('body')).toBeVisible()
    const text = await page.locator('body').innerText()
    const html = await page.content()
    expect(text, path).not.toMatch(BANNED)
    expect(html, path).not.toMatch(/evening-courtyard|lattice\.svg/)
  }
})
