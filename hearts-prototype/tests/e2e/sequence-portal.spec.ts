import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { E2E_BASE } from '../env'

const PHONE = { width: 390, height: 844 }
const SHOTS = '/opt/cursor/artifacts/screenshots'

async function hideDevBadge(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }' }).catch(() => undefined)
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true })
  await hideDevBadge(page)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/${name}.png`, caret: 'initial' })
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe.configure({ mode: 'serial' })

test('parenting course is a sequenced list with no hearts doors', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto(`${E2E_BASE}/p/parenting`)
  await expect(page.getByTestId('sequence-gate')).toBeVisible()
  await expect(page.getByTestId('sequence-film')).toHaveCount(10)
  await expect(page.getByTestId('sequence-name')).toHaveText('Parenting')
  await expect(page.getByText('Example 1 · How to raise successful kids')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/jibril|hadith|masjid|mosque|prayer|islam|garden/i)
  await shot(page, 'sequence-gate')

  await signIn(page, 'parenting-learner@hearts.test', 'portal-learner', '/p/parenting')
  await expect(page.getByTestId('sequence-home')).toBeVisible()
  await expect(page.getByTestId('sequence-count')).toHaveText('0 of 10 videos')
  await expect(page.getByTestId('tab-garden')).toHaveCount(0)
  await expect(page.getByTestId('tab-home')).toBeVisible()
  await expect(page.getByTestId('tab-me')).toBeVisible()
  await expect(page.getByTestId('sequence-lock').first()).toHaveText('Watch the previous one first.')
  await expect(page.locator('body')).not.toContainText(/jibril|hadith|masjid|prayer|islam|garden/i)
  await shot(page, 'sequence-home')

  await page.getByTestId('sequence-continue').click()
  await expect(page.getByTestId('sequence-course')).toBeVisible()
  await expect(page.getByTestId('sequence-question')).toContainText('What is one small thing you could try at home this week?')
  await expect(page.getByTestId('spoken-words')).toHaveAttribute('data-sentence', 'Listen first.')
  await expect(page.getByTestId('callout-hook')).toContainText('Listen first.')
  await expect(page.getByTestId('callout-turn')).toContainText('Turn toward what they need.')
  await expect(page.getByTestId('callout-land')).toContainText('Land on one small thing you can try this week.')
  await expect(page.getByTestId('kinetic-clip')).toContainText('Listen first.')
  await expect(page.getByTestId('kinetic-clip')).toHaveAttribute('data-start', '1')
  await expect(page.getByTestId('kinetic-clip')).toHaveAttribute('data-end', '18')
  await expect(page.getByTestId('up-next')).toBeVisible()
  await expect(page.getByTestId('course-garden')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(/appetiser|appetizer/i)
  await shot(page, 'sequence-video')

  const part = new URL(page.url()).searchParams.get('part')
  expect(part).toBeTruthy()
  const watch = await page.request.post('/api/hearts', {
    form: { action: 'watch', lesson: part || '', seconds: '30', at: '42' },
    headers: { accept: 'application/json' },
  })
  expect(watch.ok()).toBeTruthy()
  await page.reload()
  await expect(page.getByTestId('play-start')).toHaveAttribute('data-at', '42')

  await page.goto('/p/parenting')
  const second = page.getByTestId('sequence-film').nth(1)
  await second.locator('a').click()
  await expect(page.getByTestId('sequence-home')).toBeVisible()
  await expect(page.getByTestId('error')).toContainText('Watch the previous one first.')
})

test('admin can paste, retitle, reorder and export', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, 'parenting-admin@hearts.test', 'portal-admin', '/p/parenting/admin/sequence')
  await expect(page.getByTestId('sequence-desk')).toBeVisible()
  await expect(page.getByTestId('film-title').first()).toBeVisible()
  const before = await page.getByTestId('film-title').first().inputValue()
  await page.getByTestId('move-up').nth(1).click()
  await page.getByTestId('film-title').first().fill('Example film, moved up')
  await page.getByTestId('sequence-save-order').click()
  await expect(page.getByTestId('notice')).toContainText('Order saved')
  await expect(page.getByTestId('film-title').first()).toHaveValue('Example film, moved up')
  expect(before).not.toBe('Example film, moved up')

  await page.getByTestId('sequence-paste').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await page.getByTestId('sequence-import').click()
  await expect(page.getByTestId('notice')).toContainText(/Added 1 film/)
  await expect(page.getByTestId('film-title')).toHaveCount(11)

  const csv = 'title,url\nA short csv film,https://www.youtube.com/watch?v=jNQXAC9IVRw\n'
  await page.getByTestId('sequence-sheet').setInputFiles({ name: 'films.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByTestId('sequence-paste').fill('')
  await page.getByTestId('sequence-import').click()
  await expect(page.getByTestId('notice')).toContainText(/Added 1 film/)
  await shot(page, 'sequence-admin')

  const response = await page.request.get('/api/hearts/export-app?portal=parenting')
  expect(response.ok()).toBeTruthy()
  expect(response.headers()['content-type']).toContain('zip')
  const body = Buffer.from(await response.body())
  expect(body.readUInt32LE(0)).toBe(0x04034b50)
  const text = body.toString('utf8')
  expect(text).toContain('README.md')
  expect(text).toContain('Open index.html')
  expect(text).not.toMatch(/portal-learner|password|api[_-]?key/i)

  await page.goto('/p/parenting/admin/features')
  await expect(page.getByTestId('sequence-features')).toBeVisible()
  await expect(page.getByTestId('feature-kinetic')).toBeChecked()
  await expect(page.getByTestId('feature-garden')).not.toBeChecked()
  await expect(page.getByText('Progress', { exact: true })).toBeVisible()
  await expect(page.getByTestId('feature-playback')).toContainText('Watch in order')
  await expect(page.locator('body')).not.toContainText(/\bGarden\b|appetiser|appetizer|jibril|hadith|ghunya|masjid|mosque/i)
  await shot(page, 'sequence-features')

  await page.goto('/p/parenting/admin/library')
  await expect(page.getByTestId('sequence-features')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/main HEARTS library|Hadith|Jibril|Ghunya/i)

  await page.goto('/p/parenting/admin')
  await expect(page.getByTestId('sequence-overview')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/Maryam|Jibril|Ghunya|mosque|linked from the library/i)

  await page.goto('/p/parenting/admin/teach')
  await expect(page.getByTestId('sequence-learners')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/Maryam|mosque|Jibril|Ghunya/i)
})

test('an existing hearts portal still has the garden tab', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.getByTestId('tab-garden')).toBeVisible()
  await expect(page.getByTestId('tab-lanes')).toBeVisible()
  await expect(page.getByTestId('tab-week')).toBeVisible()
})
