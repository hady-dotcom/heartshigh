import { expect, test } from '@playwright/test'

async function signIn(page: import('@playwright/test').Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('a learner who opens the master desk is told who they are, then can sign in as someone else', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await page.goto('/master')
  await expect(page).toHaveURL(/\/\?other=1$/)
  await expect(page.getByTestId('door')).toBeVisible()
  await expect(page.getByTestId('signed-as')).toHaveText("You're signed in as Maryam Begum (Learner). Sign in as someone else")
  await expect(page.getByTestId('door')).not.toContainText('The master desk is not yours.')
  await page.getByTestId('sign-in-else').click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByTestId('login')).toBeVisible()
  await page.goto('/master')
  await expect(page).toHaveURL(/\/login/)
})

test('a teacher who opens the master codes page is told they are a teacher', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/teach')
  await page.goto('/master/codes')
  await expect(page.getByTestId('signed-as')).toHaveText("You're signed in as Idris Rahman (Teacher). Sign in as someone else")
  await expect(page.getByTestId('door')).not.toContainText('The master desk is not yours.')
})
