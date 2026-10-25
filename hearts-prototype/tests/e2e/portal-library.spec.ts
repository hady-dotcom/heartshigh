import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const PHONE = { width: 390, height: 844 }
const SHOTS = '/opt/cursor/artifacts/screenshots'
const suffix = Date.now().toString().slice(-7)
const slug = `north-house-${suffix}`
const portalName = `North House ${suffix}`
const brand = 'North Home'
const courseTitle = `North Films ${suffix}`
const filmTitle = `North kitchen table ${suffix}`
const adminCode = `N${suffix}A`
const teacherCode = `N${suffix}T`
const groupCode = `N${suffix}L`
const password = 'north-home'
const adminEmail = `north-admin-${suffix}@hearts.test`
const teacherEmail = `north-teacher-${suffix}@hearts.test`
const learnerEmail = `north-learner-${suffix}@hearts.test`

const sheetPath = path.join(tmpdir(), `north-sheet-${suffix}.csv`)
const answersPath = path.join(tmpdir(), `north-answers-${suffix}.csv`)

writeFileSync(sheetPath, [
  'order,module,title,public_title,vimeo_id,vimeo_link,final_video_drive,transcript,callouts',
  `1,Home,${filmTitle},${filmTitle},123456789,https://vimeo.com/123456789,,,"[12 question] What will you try at the table?"`,
].join('\n'))
writeFileSync(answersPath, [
  'phase,video_order,callout_second,question,answer',
  'Phase 1,1,12,What will you try at the table?,We sit down for ten minutes.',
].join('\n'))

async function hideDevBadge(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }' }).catch(() => undefined)
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true })
  await hideDevBadge(page)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

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

test('a new portal keeps its own films and questions, and HEARTS stays separate', async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize(PHONE)

  await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
  await page.getByTestId('create-portal-name').fill(portalName)
  await page.getByTestId('create-portal-slug').fill(slug)
  await page.locator('select[name="kind"]').selectOption('other')
  await page.getByTestId('create-portal-brand').fill(brand)
  await page.getByTestId('create-portal-colour').fill('#1f3a5f')
  await page.getByTestId('create-portal-accent').fill('#e07a5f')
  await page.getByTestId('create-portal-logo').fill('/icons/hady-home.svg')
  await page.locator('textarea[name="welcome"]').fill('Welcome. Watch the films in order.')
  await page.getByTestId('create-portal-submit').click()
  await expect(page.getByTestId('notice')).toContainText('is open')

  await page.getByTestId('code-portal').selectOption(slug)
  await page.getByTestId('code-value').fill(adminCode)
  await page.getByTestId('code-role').selectOption('admin')
  await page.getByTestId('create-code').click()
  await expect(page.getByTestId('notice')).toContainText(adminCode)

  await join(page, adminCode, 'North Admin', adminEmail)
  await page.goto(`/p/${slug}/admin/settings`)
  await expect(page.getByTestId('brand-name')).toHaveValue(brand)
  await expect(page.getByTestId('logo-url')).toHaveValue('/icons/hady-home.svg')
  await expect(page.getByTestId('portal-colour')).toHaveValue('#1f3a5f')
  await expect(page.getByTestId('accent-colour')).toHaveValue('#e07a5f')

  await page.goto(`/p/${slug}/admin/opening`)
  await page.getByTestId('portal-own-caption').fill('How old are the children at home?')
  await page.locator('#portal-own-form input[name="subline"]').fill('Go with your first thought.')
  await page.getByTestId('portal-own-opt1').fill('Under 5')
  await page.getByTestId('portal-own-opt2').fill('5 to 11')
  await page.getByTestId('portal-own-opt3').fill('12 to 16')
  await page.getByTestId('portal-own-opt4').fill('Mixed ages')
  await page.getByTestId('portal-own-save').click()
  await expect(page.getByTestId('notice')).toContainText('Question added')
  await expect(page.getByTestId('portal-own-replaces')).toBeVisible()
  await expect(page.getByText('A little unexpected')).toHaveCount(0)

  await page.goto(`/p/${slug}/admin/bring-in`)
  await page.getByTestId('portal-sheet-title').fill(courseTitle)
  await page.getByTestId('portal-sheet').setInputFiles(sheetPath)
  await page.getByTestId('portal-sheet-save').click()
  await expect(page.getByTestId('notice')).toContainText('Updated the course')
  await shot(page, 'portal-sheet-brought-in')

  await page.getByTestId('questions-tab').click()
  await expect(page.getByTestId('portal-questions')).toBeVisible()
  await page.getByTestId('portal-answers').setInputFiles(answersPath)
  await page.getByTestId('portal-answer-gaps').check()
  await page.getByTestId('portal-answers-save').click()
  await expect(page.getByTestId('notice')).toContainText('answers saved')
  const callout = page.getByTestId('callout-prompt')
  await expect(callout).toHaveValue('What will you try at the table?')
  await callout.fill('What will you try first?')
  await page.getByTestId('callout-save').click()
  await expect(page.getByTestId('notice')).toContainText('Question saved')
  await expect(page.getByTestId('callout-prompt')).toHaveValue('What will you try first?')
  await shot(page, 'portal-questions-tab')

  await page.goto(`/p/${slug}/admin/access`)
  await page.getByTestId('new-code').fill(teacherCode)
  await page.getByTestId('new-code-role').selectOption('teacher')
  await page.getByTestId('library-search').fill(courseTitle)
  await page.locator('[data-testid="library-course-check"]').filter({ hasText: courseTitle }).locator('input').check()
  await page.getByTestId('new-code-submit').click()
  await expect(page.getByTestId('notice')).toContainText(teacherCode)

  await join(page, teacherCode, 'North Teacher', teacherEmail)
  await page.goto(`/p/${slug}/admin/teach`)
  await page.getByTestId('group-code').fill(groupCode)
  await page.getByTestId('group-code-save').click()
  await expect(page.getByTestId('notice')).toContainText(groupCode)
  await expect(page.getByTestId('group-code-row').filter({ hasText: groupCode })).toBeVisible()

  await join(page, groupCode, 'North Learner', learnerEmail)
  await expect(page.getByTestId('portal-brand')).toContainText(brand)
  await page.getByTestId('welcome-begin').click()
  await expect(page.getByTestId('lets-play')).toBeVisible()
  await page.getByTestId('lets-play').click()
  await expect(page.getByTestId('scene-caption')).toContainText('How old are the children at home?')
  await expect(page.locator('[data-scene="extra"]')).toHaveCount(0)
  await expect(page.getByText('Alhamdulillah')).toHaveCount(0)
  await expect(page.getByText('A little unexpected')).toHaveCount(0)
  await shot(page, 'portal-own-questions')
  await page.getByTestId('tile').first().click()

  await page.goto(`/p/${slug}/lanes`)
  await expect(page.getByTestId('lanes-empty')).toBeVisible()
  await expect(page.getByTestId('lane-card')).toHaveCount(0)
  await expect(page.getByTestId('path-course').filter({ hasText: courseTitle })).toBeVisible()
  await expect(page.getByText('Ar-Rabb')).toHaveCount(0)
  await page.getByTestId('path-course').filter({ hasText: courseTitle }).getByTestId('lesson-link').click()
  await expect(page.getByTestId('course-title')).toContainText('North Films')
  await expect(page.getByTestId('buffet-talk').filter({ hasText: filmTitle })).toBeVisible()
  await expect(page.getByText('Ar-Rabb')).toHaveCount(0)
  await expect(page.getByText(/Jibril/)).toHaveCount(0)
  await shot(page, 'portal-own-films')

  await page.goto(`/p/${slug}/garden`)
  await expect(page.getByTestId('ring-sections')).toHaveCount(0)
  await expect(page.getByText('Ar-Rabb')).toHaveCount(0)
  await expect(page.getByText(filmTitle)).toHaveCount(0)

  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/library')
  await expect(page.getByTestId('master-course').filter({ hasText: courseTitle })).toHaveCount(0)
  await expect(page.getByTestId('master-course').filter({ hasText: 'Guiding Home Learning' })).toHaveCount(0)
  await page.goto(`/master/library?q=${encodeURIComponent(filmTitle)}`)
  await expect(page.getByTestId('library-talk')).toHaveCount(0)
  await page.goto('/master/library?q=Guiding%20Home%20Learning')
  await expect(page.getByTestId('library-talk')).toHaveCount(0)
  await shot(page, 'hearts-library-without-portal-films')

  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/garden')
  await expect(page.getByText(courseTitle)).toHaveCount(0)
  await expect(page.getByText(filmTitle)).toHaveCount(0)
  await page.goto('/p/east-london/lanes')
  await expect(page.getByText(courseTitle)).toHaveCount(0)
  await expect(page.getByText(filmTitle)).toHaveCount(0)
  await expect(page.getByTestId('lane-card').first()).toBeVisible()

  await signIn(page, 'parenting-learner@hearts.test', 'portal-learner', '/p/parenting/start')
  if (await page.getByTestId('welcome-begin').count()) await page.getByTestId('welcome-begin').click()
  if (await page.getByTestId('lets-play').count()) await page.getByTestId('lets-play').click()
  await expect(page.getByText('Alhamdulillah')).toHaveCount(0)
  await expect(page.getByText('Ar-Rabb')).toHaveCount(0)
  await expect(page.locator('[data-scene="extra"]')).toHaveCount(0)
  await page.goto('/p/parenting/garden')
  await expect(page.getByText('Ar-Rabb')).toHaveCount(0)
  await expect(page.getByTestId('ring-sections')).toHaveCount(0)
})
