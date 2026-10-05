import { expect, type APIRequestContext, type Page } from '@playwright/test'

export async function completeConsent(page: Page, age: 'under-13' | '13-17' | '18+' = '18+') {
  if (!page.url().includes('/consent')) {
    const slug = page.url().match(/\/p\/([^/?#]+)/)?.[1]
    if (!slug) return
    await page.goto(`/p/${slug}/consent`)
  }
  if ((await page.getByTestId('consent').count()) === 0) return
  await expect(page.getByTestId('consent')).toBeVisible()
  await page.getByTestId(`age-${age}`).check()
  await page.getByTestId('consent-agree').check()
  await page.getByTestId('consent-submit').click()
}

export async function joinWithConsent(
  page: Page,
  code: string,
  name: string,
  email: string,
  password: string,
  age: 'under-13' | '13-17' | '18+' = '18+',
) {
  await page.goto(`/join?code=${code}`)
  await page.getByTestId('join-name').fill(name)
  await page.getByTestId('join-email').fill(email)
  await page.getByTestId('join-password').fill(password)
  await page.getByTestId('join-consent').check()
  await page.getByTestId('join-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/join') && !url.pathname.startsWith('/login'))
  await completeConsent(page, age)
}

export async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

/** For API-joined e2e learners. UI joins still go through the consent screen. */
export async function acceptConsentViaApi(ctx: APIRequestContext, ageBand: 'under-13' | '13-17' | '18+' = '18+') {
  return ctx.post('/api/hearts', {
    form: { action: 'accept-consent', agree: 'on', ageBand, after: '/', next: '/' },
    maxRedirects: 0,
  })
}
