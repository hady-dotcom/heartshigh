import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'
import { fakeYouTube } from './fake-youtube'
import { noIssueBadge } from './no-issue-badge'
import { ensureProofCourse, PROOF_COURSE } from './proof-course'

const PORTAL = 'east-london'
const BASE = `/p/${PORTAL}`
const PHONE = { width: 390, height: 844 }
const DESK = { width: 1440, height: 900 }
const PROOF = path.join(process.cwd(), 'test-results', 'r5b-proof')

function proofShot(page: Page, name: string) {
  mkdirSync(PROOF, { recursive: true })
  return page.screenshot({ path: path.join(PROOF, `${name}.png`), fullPage: false })
}

let master: APIRequestContext

test.beforeAll(async () => {
  master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
})

test.afterAll(async () => {
  await master?.dispose()
})

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function json(path: string) {
  return (await (await master.get(path)).json().catch(() => ({}))) as { docs?: Record<string, unknown>[] }
}

async function aCourse() {
  const lessons = ((await json('/api/lessons?limit=80&depth=0')).docs || []) as { id: number; course: number; title?: string; durationSeconds?: number }[]
  const byCourse = new Map<number, typeof lessons>()
  for (const lesson of lessons) {
    const list = byCourse.get(lesson.course) || []
    list.push(lesson)
    byCourse.set(lesson.course, list)
  }
  const courses = ((await json('/api/courses?limit=80&depth=0')).docs || []) as { id: number; title?: string }[]
  const sitting = courses.find((course) => course.title === PROOF_COURSE)
  const names = courses.find((course) => course.title === 'The Names')
  const multi = [...byCourse.entries()].filter(([, own]) => own.length >= 2).sort((a, b) => b[1].length - a[1].length)[0]
  const courseId = sitting?.id || names?.id || multi?.[0] || lessons[0]?.course
  const own = byCourse.get(courseId) || []
  const points = ((await json(`/api/engagement-points?where[lesson][equals]=${own[0]?.id || 0}&limit=20&depth=0`)).docs || []) as { id: number; second?: number; prompt?: string }[]
  return { courseId, lessons: own, points }
}

test.describe('courses and planning', () => {
  test('B9: My week is one tap from the feed, and the bar keeps Lanes', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await signIn(page, `${BASE}/feed`)
    await expect(page.getByTestId('tabbar')).toBeVisible()
    await expect(page.getByTestId('tab-lanes')).toContainText('Lanes')
    await expect(page.getByTestId('tab-week')).toContainText('My week')
    await expect(page.getByTestId('tab-home')).not.toHaveAttribute('aria-current', 'page')
    await page.getByTestId('tab-week').click()
    await expect(page.getByTestId('plan')).toBeVisible()
    await expect(page.getByTestId('week-days')).toBeVisible()
    const first = page.getByTestId('week-day').first()
    await expect(first).toContainText('Mon')
  })

  test('B14 and B10: a main opens as a buffet, and scheduling lands on My week', async ({ page }) => {
    await page.setViewportSize(PHONE)
    const { courseId } = await aCourse()
    await signIn(page, `${BASE}/course/${courseId}`)
    await expect(page.getByTestId('course-overview')).toBeVisible()
    await expect(page.getByTestId('course-count')).toBeVisible()
    await expect(page.getByTestId('schedule-all')).toBeVisible()
    await expect(page.getByTestId('course-question')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('questions coming up')
    await proofShot(page, 'buffet-ten-sittings')
    await page.getByTestId('schedule-all').click()
    await expect(page.getByTestId('plan')).toBeVisible()
    await expect(page.getByTestId('schedule-course')).toHaveValue(String(courseId))
    await expect(page.getByTestId('schedule-course')).toContainText(/talk/)
    await expect(page.getByTestId('schedule-start-read')).not.toContainText(/\d{4}-\d{2}-\d{2}/)
    const box = await page.getByTestId('schedule-start').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
    expect(box.scroll).toBeLessThanOrEqual(box.client + 1)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
    expect(overflow).toBeTruthy()
  })

  test('B6, B11 and B15: the player pauses, thinks, and always has a next part', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await fakeYouTube(page)
    const { courseId, lessons, points } = await aCourse()
    const first = lessons[0]
    await signIn(page, `${BASE}/course/${courseId}?part=${first.id}`)
    await expect(page.getByTestId('player')).toBeVisible()
    await expect(page.getByTestId('up-next')).toBeVisible()
    if (points[0]) {
      await page.getByTestId('timeline-dot').first().click()
      await expect(page.getByTestId('popup')).toBeVisible()
      await expect(page.getByTestId('paused-note')).toContainText('Paused')
      await expect(page.getByTestId('think-about-this')).toBeVisible()
      const before = await page.getByTestId('player-time').textContent()
      await page.waitForTimeout(1200)
      const after = await page.getByTestId('player-time').textContent()
      expect(before).toBe(after)
      await page.getByTestId('think-about-this').click()
      await expect(page.getByTestId('popup')).toHaveCount(0)
    }
    await page.setViewportSize(DESK)
    await page.goto(`${BASE}/course/${courseId}?part=${first.id}`)
    await expect(page.getByTestId('up-next')).toBeVisible()
    await expect(page.getByTestId('player')).toBeVisible()
  })

  test('B25: the workbook summarises and links back to the talk', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await signIn(page, `${BASE}/garden/workbook`)
    await expect(page.getByTestId('workbook-summary')).toBeVisible()
    await expect(page.getByTestId('workbook-harvest')).toBeVisible()
    if (await page.getByTestId('open-question').count()) {
      await expect(page.getByTestId('answer-in-talk').first()).toBeVisible()
    }
    await page.getByTestId('workbook-harvest').click()
    await expect(page).toHaveURL(/harvest/)
  })

  test('Home shows This week at both sizes', async ({ page }) => {
    for (const size of [PHONE, DESK]) {
      await page.setViewportSize(size)
      await signIn(page, BASE)
      await expect(page.getByTestId('week-strip')).toBeVisible()
      await expect(page.getByTestId('week-day').first()).toContainText('Mon')
    }
  })

  test('a short course is spaced across the study-day span, not bunched in week one', async ({ page }) => {
    await page.setViewportSize(PHONE)
    const picked = await aCourse()
    const byCount = new Map<number, typeof picked.lessons>()
    const lessons = ((await json('/api/lessons?limit=80&depth=0')).docs || []) as { id: number; course: number }[]
    for (const lesson of lessons) {
      const list = byCount.get(lesson.course) || []
      list.push(lesson)
      byCount.set(lesson.course, list)
    }
    const short = [...byCount.entries()].find(([, own]) => own.length >= 2 && own.length <= 4)
    const courseId = short?.[0] || picked.courseId
    const own = short?.[1] || picked.lessons
    const span = Array.from({ length: 12 }, (_, index) => `2026-10-${String(index + 5).padStart(2, '0')}`)
    await signIn(page, `${BASE}/week?course=${courseId}&view=new&start=2026-10-05&end=2026-10-16&days=0,1,2,3,4,5,6&minutes=20`)
    await expect(page.getByTestId('schedule-course')).toHaveValue(String(courseId))
    await expect(page.getByTestId('weekday-1')).toBeChecked()
    await page.getByTestId('schedule-submit').click()
    await expect(page.getByTestId('schedule-plan')).toBeVisible()
    await expect(page.getByTestId('schedule-course')).toHaveValue(String(courseId))
    const slots = page.getByTestId('schedule-plan').first().getByTestId('schedule-slot')
    await expect(slots).toHaveCount(own.length)
    const dates = await slots.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-date') || ''))
    if (own.length === 1) {
      await expect(page.getByTestId('spread-note')).toContainText('1 talk')
      expect(dates).toEqual([span[0]])
    } else if (own.length < 12) {
      await expect(page.getByTestId('spread-note')).toContainText('spaced across the span')
      const expected = own.map((_, index) => span[Math.floor((index * 12) / own.length)])
      expect(dates).toEqual(expected)
    }
    await expect(page.getByTestId('plan-calendar')).toBeVisible()
    await expect(page.getByTestId('plan-ics')).toBeVisible()
    const ics = await page.request.get('/api/hearts/week.ics')
    expect(ics.ok()).toBeTruthy()
    expect(ics.headers()['content-type']).toMatch(/text\/calendar/)
    const calendar = await ics.text()
    expect(calendar).toContain('BEGIN:VCALENDAR')
    expect(calendar).toContain('BEGIN:VEVENT')
    expect(calendar).toContain('DTSTART;VALUE=DATE:')
    expect(calendar).toContain('SUMMARY:')
    expect(calendar).toMatch(/DTSTAMP:\d{8}T\d{6}Z/)
    expect(calendar).not.toMatch(/SUMMARY:[^:\n]*\|/)
    expect(calendar).toMatch(/URL:https?:\/\//)
    mkdirSync(PROOF, { recursive: true })
    writeFileSync(path.join(PROOF, 'week.ics'), calendar)
    await expect(page.getByTestId('schedule-slot').first()).toContainText('›')
    await proofShot(page, 'plan-row-tappable')
    await page.getByTestId('schedule-slot').first().click()
    await expect(page.getByTestId('player')).toBeVisible()
    await proofShot(page, 'plan-row-opened-talk')
  })

  test('Ten sittings splits 3,3,2,2 and keeps the days row after sharing out', async ({ page }) => {
    await page.setViewportSize(PHONE)
    const sitting = await ensureProofCourse(master)
    await signIn(page, `${BASE}/week?course=${sitting.courseId}&view=new&start=2026-10-05&end=2026-10-08&days=0,1,2,3,4,5,6&minutes=20`)
    await expect(page.getByTestId('schedule-course')).toHaveValue(String(sitting.courseId))
    await expect(page.getByTestId('weekday-1')).toBeChecked()
    await page.getByTestId('schedule-submit').click()
    await noIssueBadge(page)
    await expect(page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE })).toBeVisible()
    await expect(page.getByTestId('schedule-course')).toHaveValue(String(sitting.courseId))
    await expect(page.getByTestId('weekday-1')).toBeChecked()
    await expect(page.getByTestId('week-days')).toBeVisible()
    await expect(page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE }).getByTestId('plan-counts')).toContainText('3, 3, 2, 2')
    await expect(page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE }).getByTestId('plan-day-list')).toBeVisible()
    const dates = await page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE }).getByTestId('schedule-slot').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-date') || ''))
    const counts = dates.reduce((map, date) => map.set(date, (map.get(date) || 0) + 1), new Map<string, number>())
    expect([...counts.values()]).toEqual([3, 3, 2, 2])
    await expect(page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE }).getByTestId('over-minutes')).toBeVisible()
    await expect(page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE }).getByTestId('spread-note')).toHaveCount(0)
    await expect(page.getByTestId('week-days')).toBeVisible()
    await page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE }).scrollIntoViewIfNeeded()
    await page.getByTestId('week-days').scrollIntoViewIfNeeded()
    await proofShot(page, 'split-3322-days-kept')
    await page.getByTestId('new-plan').scrollIntoViewIfNeeded()
    await proofShot(page, 'split-3322-days-row')
  })

  test('a teacher plan locks against another teacher and tells the learner', async ({ page }) => {
    await page.setViewportSize(DESK)
    const sitting = await ensureProofCourse(master, PORTAL, 'Teacher sittings')
    await page.goto(`/login?next=${encodeURIComponent(`${BASE}/admin/plans`)}`)
    await page.getByTestId('login-email').fill('elm-teacher@hearts.test')
    await page.getByTestId('login-password').fill('portal-teacher')
    await page.getByTestId('login-submit').click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
    await expect(page.getByTestId('admin-plans')).toBeVisible()
    await page.getByTestId('schedule-course').selectOption(String(sitting.courseId))
    await page.getByTestId('schedule-start').fill('2026-10-05')
    await page.getByTestId('schedule-end').fill('2026-10-08')
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      const box = page.getByTestId(`weekday-${day}`)
      if (!(await box.isChecked())) await page.locator(`label:has([data-testid=weekday-${day}])`).click()
    }
    await page.locator('label:has([data-testid=plan-learner])').filter({ hasText: 'Maryam' }).click()
    await page.getByTestId('schedule-submit').click()
    await expect(page.getByTestId('notice')).toContainText('talks are on')

    await page.goto(`/login?next=${encodeURIComponent(`${BASE}/admin/plans`)}`)
    await page.getByTestId('login-email').fill('elm-admin@hearts.test')
    await page.getByTestId('login-password').fill('portal-admin')
    await page.getByTestId('login-submit').click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
    await page.getByTestId('schedule-course').selectOption(String(sitting.courseId))
    await page.getByTestId('schedule-start').fill('2026-10-05')
    await page.getByTestId('schedule-end').fill('2026-10-08')
    await page.locator('label:has([data-testid=weekday-1])').click()
    await page.locator('label:has([data-testid=plan-learner])').filter({ hasText: 'Maryam' }).click()
    await page.getByTestId('schedule-submit').click()
    await expect(page.getByTestId('error')).toContainText('another teacher')
    await expect(page.getByTestId('schedule-course')).toHaveValue(String(sitting.courseId))
    await expect(page.getByTestId('schedule-start')).toHaveValue('2026-10-05')
    await expect(page.getByTestId('schedule-end')).toHaveValue('2026-10-08')
    await proofShot(page, 'teacher-lock-refused')

    await page.setViewportSize(PHONE)
    await signIn(page, `${BASE}/week`)
    await expect(page.getByTestId('plan-locked')).toBeVisible()
    await page.getByTestId('plan-locked').scrollIntoViewIfNeeded()
    await proofShot(page, 'teacher-plan-locked')
    await page.goto(`${BASE}/me`)
    const note = page.getByTestId('notification').filter({ hasText: 'A study plan was made for you' })
    await expect(note).toBeVisible()
    await expect(note).not.toContainText(/^Done\./)
    await expect(note).not.toContainText('Done.')
    await note.scrollIntoViewIfNeeded()
    await proofShot(page, 'teacher-plan-notified')
  })
})
