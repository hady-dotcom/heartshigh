import { expect, request as playwrightRequest, test, type Page } from '@playwright/test'
import { E2E_BASE, seedCode } from '../env'
import path from 'node:path'

const suffix = Date.now().toString().slice(-7)
const slug = `harbour-${suffix}`
const portalName = `Harbour ${suffix}`
const adminEmail = `admin-${suffix}@hearts.test`
const teacherEmail = `teacher-${suffix}@hearts.test`
const learnerEmail = `learner-${suffix}@hearts.test`
const otherEmail = `other-${suffix}@hearts.test`
const adminCode = `H${suffix}A`
const teacherCode = `H${suffix}T`
const learnerCode = `H${suffix}L`
const BY_PROPHET = ['The Prophet', 'Somewhere calm to sit', 'I go quiet', 'With the Prophet']
const BY_NAMES = ['My Lord', 'Knowing the names of Allah', 'I look for a verse', 'With Allah as Lord']
const PHONE = { width: 390, height: 844 }
const DESK = { width: 1440, height: 900 }

const shared: { courseId?: string; cutId?: string; entryId?: string; eventId?: string; lessonId?: string } = {}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function join(page: Page, code: string, name: string, email: string, password: string) {
  await page.goto(`/join?code=${code}`)
  await page.getByTestId('join-name').fill(name)
  await page.getByTestId('join-email').fill(email)
  await page.getByTestId('join-password').fill(password)
  await page.getByTestId('join-submit').click()
}

async function placing(page: Page, picks: string[]) {
  await page.getByTestId('welcome-begin').click()
  await page.waitForURL(/step=(films|placing)/)
  if (page.url().includes('step=films')) await page.getByTestId('welcome-continue').click()
  const questions = page.getByTestId('placing-question')
  await expect(questions).toHaveCount(picks.length)
  for (const [index, pick] of picks.entries()) await questions.nth(index).getByLabel(pick, { exact: true }).check()
  await page.getByTestId('placing-submit').click()
  await expect(page.getByTestId('starting-clause')).toBeVisible()
}

async function masterRequest() {
  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  return master
}

async function post(page: Page, form: Record<string, string>) {
  const response = await page.request.post('/api/hearts', { form, maxRedirects: 0 })
  expect(response.status()).toBe(303)
  return decodeURIComponent((response.headers().location || '').replace(/\+/g, ' '))
}

async function openPoint(page: Page, prompt: RegExp) {
  const dots = page.getByTestId('timeline-dot')
  const count = await dots.count()
  for (let index = 0; index < count; index += 1) {
    await expect(async () => {
      await dots.nth(index).click()
      await expect(page.getByTestId('popup-prompt')).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 15_000 })
    if (prompt.test((await page.getByTestId('popup-prompt').textContent()) || '')) return page.getByTestId('popup')
    await page.getByTestId('popup-close').click()
  }
  throw new Error(`No point matching ${prompt}`)
}

test.describe.serial('HEARTS journeys', () => {
  test.describe.configure({ timeout: 120_000 })
  test('an empty sign-in is refused', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email').evaluate((el) => el.removeAttribute('required'))
    await page.getByTestId('login-password').evaluate((el) => el.removeAttribute('required'))
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('error')).toBeVisible()
  })

  test('master opens a portal, a pack and its codes', async ({ page }) => {
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
    await expect(page.getByTestId('master')).toBeVisible()
    await page.getByTestId('create-portal-name').fill(portalName)
    await page.getByTestId('create-portal-slug').fill(slug)
    await page.getByTestId('create-portal-submit').click()
    await expect(page.getByTestId('notice')).toBeVisible()
    await expect(page.getByTestId('portal-card').filter({ hasText: `/p/${slug}` })).toContainText('Active')
    await page.getByTestId('pack-portal').selectOption(slug)
    await page.getByTestId('portal-pack-title').fill('Harbour sittings')
    await page.getByTestId('portal-pack-save').click()
    await expect(page.getByTestId('notice')).toBeVisible()
    for (const [code, role, teacher] of [[adminCode, 'admin', ''], [teacherCode, 'teacher', ''], [learnerCode, 'learner', teacherCode]]) {
      await page.getByTestId('code-portal').selectOption(slug)
      await page.getByTestId('code-value').fill(code)
      await page.getByTestId('code-role').selectOption(role)
      await page.getByTestId('code-pack').selectOption({ label: 'Harbour sittings' })
      if (teacher) await page.getByTestId('code-teacher').selectOption({ label: teacher })
      await page.getByTestId('create-code').click()
      await expect(page.getByTestId('notice')).toContainText(code)
    }
  })

  test('admin builds a course, extracts and approves a cut with its clause and seat, and places questions', async ({ page }) => {
    await page.setViewportSize(DESK)
    await join(page, adminCode, 'Harbour Admin', adminEmail, 'harbour-admin')
    await expect(page.getByTestId('admin-overview')).toBeVisible()
    await expect(page.getByTestId('org-name')).toContainText(portalName)
    await expect(page.getByTestId('own-courses')).toHaveText('0')
    await expect(page.getByTestId('portal-address')).toContainText(`/p/${slug}`)
    await expect(page.getByTestId('portal-qr')).toBeVisible()
    await expect(page.getByTestId('chart-slot')).toHaveCount(14)

    await page.getByTestId('nav-content').click()
    await page.getByTestId('local-course-title').fill('Night class')
    await page.getByTestId('local-course-duration').fill('8')
    await page.getByTestId('local-course-pack').selectOption({ label: 'Harbour sittings' })
    await page.getByTestId('local-course-submit').click()
    await expect(page.getByTestId('notice')).toBeVisible()
    const row = page.getByTestId('course-row').filter({ hasText: 'Night class' })
    await expect(row).toHaveAttribute('data-origin', 'local')
    await row.getByRole('link').first().click()
    await expect(page.getByTestId('admin-course')).toBeVisible()
    shared.courseId = page.url().match(/content\/(\d+)/)?.[1]

    await page.getByTestId('youtube-url').fill('https://example.com/a-share-link')
    await page.getByTestId('ingest-submit').click()
    await expect(page.getByTestId('error')).toBeVisible()
    await page.getByTestId('transcript-file').setInputFiles(path.join(process.cwd(), 'content/transcripts/fahmy-session6.md'))
    await page.getByTestId('transcript-submit').click()
    await expect(page.getByTestId('has-transcript')).toBeVisible()
    await page.getByTestId('extract-submit').click()
    const first = page.getByTestId('cut-draft').first()
    await expect(first).toBeVisible({ timeout: 60_000 })
    shared.cutId = (await first.getAttribute('data-cut')) || undefined
    await first.getByTestId('cut-clause').selectOption('3')
    await first.getByTestId('approve-cut').click()
    await expect(page.getByTestId('notice')).toContainText('approved')
    const tagged = page.locator(`[data-testid=cut-draft][data-cut="${shared.cutId}"]`)
    await expect(tagged).toHaveAttribute('data-status', 'approved')
    await expect(tagged.getByTestId('cut-clause')).toHaveValue('3')
    const seat = tagged.getByTestId('cut-seat')
    const seatValue = await seat.locator('option').nth(1).getAttribute('value')
    expect(seatValue).toBeTruthy()
    await seat.selectOption(seatValue!)
    await tagged.getByTestId('approve-cut').click()
    await expect(page.locator(`[data-testid=cut-draft][data-cut="${shared.cutId}"]`).getByTestId('cut-seat')).toHaveValue(seatValue!)

    await page.getByTestId('point-timestamp').fill('2')
    await page.getByTestId('point-prompt').fill('What is one manner you want to keep?')
    await page.getByTestId('point-timing').selectOption('immediate')
    await page.getByTestId('point-submit').click()
    await expect(page.getByTestId('notice')).toContainText('Question placed')
    await page.getByTestId('point-timestamp').fill('6')
    await page.getByTestId('point-prompt').fill('What changed after two days?')
    await page.getByTestId('point-timing').selectOption('future')
    await page.getByTestId('point-delay').fill('2')
    await page.getByTestId('point-delay-unit').selectOption('day')
    await page.getByTestId('point-contingent').selectOption({ label: 'What is one manner you want to keep?' })
    await page.getByTestId('point-submit').click()
    await expect(page.getByTestId('point-row').filter({ hasText: 'two days' })).toContainText('2 days after answering')

    await page.getByPlaceholder('Part 2').fill('Part 2')
    await page.getByRole('button', { name: 'Add film' }).click()
    await page.getByPlaceholder('Part 2').fill('Part 3')
    await page.getByRole('button', { name: 'Add film' }).click()
    await expect(page.getByTestId('tree-lesson')).toHaveCount(3)

    await page.getByTestId('nav-nights').click()
    await page.getByTestId('event-title').fill('Harbour night')
    await page.getByTestId('event-starts').fill('2026-10-08T19:30')
    await page.getByTestId('event-submit').click()
    await expect(page.getByTestId('event').filter({ hasText: 'Harbour night' })).toBeVisible()
  })

  test('the approved cut reaches the learner feed; placing answers choose the first course', async ({ page }) => {
    await join(page, learnerCode, 'Harbour Learner', learnerEmail, 'harbour-learner')
    await expect(page.getByTestId('splash')).toBeVisible()
    await placing(page, BY_PROPHET)
    await expect(page.getByTestId('first-course')).toContainText('Night class')
    await page.getByTestId('go-feed').click()
    await expect(page.getByTestId('journey')).toHaveAttribute('data-cuts', new RegExp(`(^| )${shared.cutId}( |$)`))
    await page.goto(`/p/${slug}/lanes`)
    await expect(page.getByTestId('visible-courses')).toContainText('1 course open to you')
    await expect(page.getByTestId('path-course')).toHaveCount(1)
    await expect(page.getByText('How to Live Like the Prophet')).toHaveCount(0)

    await join(page, seedCode('elm-learner'), 'Placed by Prophet', `p1-${suffix}@hearts.test`, 'placing-one')
    await placing(page, BY_PROPHET)
    await expect(page.getByTestId('starting-clause')).toContainText('3')
    await expect(page.getByTestId('first-course')).toContainText('How to Live Like the Prophet')
    await join(page, ` ${seedCode('elm-learner').toLowerCase()} `, 'Placed by Names', `p2-${suffix}@hearts.test`, 'placing-two')
    await placing(page, BY_NAMES)
    await expect(page.getByTestId('starting-clause')).toContainText('22')
    await expect(page.getByTestId('first-course')).toContainText('Ar-Rabb')
  })

  test('learner answers, meets the contingent question, and the test clock opens it', async ({ page }) => {
    await signIn(page, learnerEmail, 'harbour-learner', `/p/${slug}/course/${shared.courseId}`)
    await expect(page.getByTestId('player')).toHaveAttribute('data-mode', 'practice')
    const waiting = await openPoint(page, /two days/)
    await expect(waiting).toHaveAttribute('data-state', 'waiting')
    await expect(page.getByTestId('waiting')).toContainText('one manner')
    await expect(page.getByTestId('answer-form')).toHaveCount(0)
    await page.getByTestId('popup-close').click()

    await expect(async () => {
      await page.getByTestId('answer-point').click()
      await expect(page.getByTestId('popup-prompt')).toContainText('one manner', { timeout: 1000 })
    }).toPass({ timeout: 15_000 })
    await expect(page.getByTestId('swarm')).toHaveCount(0)
    await expect(page.getByTestId('answer-share-learners')).toHaveCount(0)
    await page.getByTestId('popup-close').click()
    await post(page, { action: 'me-pref', name: 'shareWithLearners', value: 'on', next: `/p/${slug}/course/${shared.courseId}` })
    await page.reload()
    await expect(async () => {
      await page.getByTestId('answer-point').click()
      await expect(page.getByTestId('popup-prompt')).toContainText('one manner', { timeout: 1000 })
    }).toPass({ timeout: 15_000 })
    await page.getByTestId('answer-text').fill('I want to keep a soft greeting.')
    await page.getByTestId('answer-private').uncheck()
    await page.getByTestId('answer-share').check()
    await page.getByTestId('answer-share-learners').check()
    await page.getByTestId('answer-submit').click()
    await expect(page.getByTestId('notice')).toContainText('shared with other learners')

    const countdown = await openPoint(page, /two days/)
    await expect(countdown).toHaveAttribute('data-state', 'countdown')
    await expect(page.getByTestId('countdown')).toContainText('days')
    const forged = await post(page, { action: 'answer', point: (await countdown.getAttribute('data-point'))!, body: 'Too early', next: `/p/${slug}/course/${shared.courseId}` })
    expect(forged).toContain('has not opened yet')
    await page.getByTestId('popup-close').click()

    const later = new Date(Date.now() + 3 * 86_400_000).toISOString()
    const master = await masterRequest()
    await expect(page.getByText('Test clock')).toHaveCount(0)
    expect((await master.post('/api/hearts', { form: { action: 'clock', iso: later, next: '/' }, maxRedirects: 0 })).status()).toBe(303)
    await page.reload()
    const open = await openPoint(page, /two days/)
    await expect(open).toHaveAttribute('data-state', 'open')
    await expect(page.getByTestId('countdown')).toHaveCount(0)
    await page.getByTestId('answer-text').fill('The greeting stayed.')
    await page.getByTestId('answer-submit').click()
    await expect(page.getByTestId('player').getByTestId('notice')).toContainText('workbook')
    await master.post('/api/hearts', { form: { action: 'clock', iso: '', next: '/' }, maxRedirects: 0 })
    await master.dispose()

    shared.lessonId = (await page.locator('form.watched-form input[name=lesson]').getAttribute('value')) || undefined
    const tooSoon = await post(page, { action: 'complete', lesson: shared.lessonId!, seconds: '1', next: `/p/${slug}/course/${shared.courseId}` })
    expect(tooSoon).toContain('error=')
    const done = await post(page, { action: 'complete', lesson: shared.lessonId!, seconds: '8', ended: 'yes', next: `/p/${slug}/course/${shared.courseId}` })
    expect(done).toContain('notice=')
  })

  test('a second learner sees the shared answer, and a private answer stays private', async ({ page }) => {
    await join(page, learnerCode, 'Second Learner', otherEmail, 'harbour-learner')
    await placing(page, BY_NAMES)
    await page.goto(`/p/${slug}/course/${shared.courseId}`)
    const before = await openPoint(page, /one manner/)
    await expect(before.getByTestId('swarm')).toHaveCount(0)
    await page.getByTestId('popup-close').click()
    await post(page, { action: 'me-pref', name: 'shareWithLearners', value: 'on', next: `/p/${slug}/course/${shared.courseId}` })
    await page.reload()
    const sheet = await openPoint(page, /one manner/)
    await expect(sheet.getByTestId('swarm-item').filter({ hasText: 'soft greeting' })).toBeVisible()
    await page.getByTestId('answer-text').fill('This one stays with me.')
    await expect(page.getByTestId('answer-private')).toBeChecked()
    await page.getByTestId('answer-submit').click()
    await expect(page.getByTestId('notice')).toContainText('privately')
    await signIn(page, learnerEmail, 'harbour-learner', `/p/${slug}/course/${shared.courseId}`)
    const mine = await openPoint(page, /one manner/)
    await expect(mine.getByTestId('swarm')).not.toContainText('stays with me')
  })

  test('teacher replies to a shared workbook entry and the learner is told', async ({ page }) => {
    await page.setViewportSize(DESK)
    await join(page, teacherCode, 'Harbour Teacher', teacherEmail, 'harbour-teacher')
    await page.goto(`/p/${slug}/admin/teach`)
    const review = page.getByTestId('workbook-review').filter({ hasText: 'soft greeting' })
    await expect(review).toBeVisible()
    await expect(page.getByTestId('workbook-inbox')).not.toContainText('stays with me')
    shared.entryId = (await review.locator('input[name=entry]').getAttribute('value')) || undefined
    await review.getByTestId('reply-text').fill('Keep that greeting. It is enough.')
    await review.getByTestId('reply-submit').click()
    await expect(page.getByTestId('notice')).toContainText('Reply saved')
    await expect(page.getByTestId('nav-content')).toHaveCount(0)

    await page.setViewportSize(PHONE)
    await signIn(page, learnerEmail, 'harbour-learner', `/p/${slug}/me`)
    await expect(page.getByTestId('unread-badge')).toBeVisible()
    await expect(page.getByTestId('notification').filter({ hasText: 'Your teacher replied' })).toHaveAttribute('data-read', 'no')
    await page.goto(`/p/${slug}/garden/workbook`)
    await expect(page.getByTestId('teacher-reply')).toContainText('Keep that greeting')
  })

  test('the schedule splitter shares three parts across Wednesdays and Fridays', async ({ page }) => {
    await signIn(page, learnerEmail, 'harbour-learner', `/p/${slug}/me/plan`)
    await page.getByTestId('schedule-course').selectOption({ label: 'Night class' })
    await page.getByTestId('schedule-start').fill('2026-10-07')
    await page.getByTestId('schedule-end').fill('2026-10-16')
    await page.locator('label:has([data-testid=weekday-3])').click()
    await page.locator('label:has([data-testid=weekday-5])').click()
    await expect(page.getByTestId('weekday-3')).toBeChecked()
    await page.getByTestId('schedule-submit').click()
    await expect(page.getByTestId('notice')).toContainText('The 3 sittings are spread across 4 study days')
    const slots = page.getByTestId('schedule-plan').first().getByTestId('schedule-slot')
    await expect(slots).toHaveCount(3)
    for (const text of await slots.allTextContents()) expect(text).toMatch(/Wed|Fri/)
    await page.getByTestId('schedule-submit').evaluate((el) => (el.closest('form') as HTMLFormElement).querySelectorAll('input[type=checkbox]').forEach((box) => ((box as HTMLInputElement).checked = false)))
    await page.getByTestId('schedule-submit').click()
    await expect(page.getByTestId('error')).toBeVisible()
  })

  test('RSVP gives an earned or held ticket, self check-in for earned, staff check-in for held', async ({ page }) => {
    await signIn(page, learnerEmail, 'harbour-learner', `/p/${slug}/me/circle`)
    const night = page.getByTestId('event').filter({ hasText: 'Harbour night' })
    shared.eventId = (await night.locator('input[name=event]').first().getAttribute('value')) || undefined
    await night.getByTestId('rsvp').click()
    await expect(page.getByTestId('ticket')).toHaveAttribute('data-kind', 'earned')
    await expect(page.getByTestId('ticket-code')).toHaveText(/^[A-Z]{4}-[A-Z0-9]{6}$/)
    await page.getByTestId('checkin').click()
    await expect(page.getByTestId('checked-in')).toBeVisible()

    await signIn(page, otherEmail, 'harbour-learner', `/p/${slug}/me/circle`)
    await page.getByTestId('event').filter({ hasText: 'Harbour night' }).getByTestId('rsvp').click()
    await expect(page.getByTestId('ticket')).toHaveAttribute('data-kind', 'held')
    await page.getByTestId('checkin').click()
    await expect(page.getByTestId('error')).toContainText('held')
    expect(await post(page, { action: 'checkin', event: shared.eventId!, override: 'on', next: '/' })).toContain('Only a teacher')

    await page.setViewportSize(DESK)
    await signIn(page, adminEmail, 'harbour-admin', `/p/${slug}/admin/nights`)
    const desk = page.getByTestId('event').filter({ hasText: 'Harbour night' })
    await expect(desk.getByTestId('rsvp-row')).toHaveCount(2)
    await desk.getByTestId('checkin-learner').selectOption({ label: 'Second Learner' })
    await desk.getByTestId('staff-checkin').click()
    await expect(page.getByTestId('notice')).toContainText('Checked in')
  })

  test('rooms stay apart, including forged ids and the raw API', async ({ page }) => {
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
    await page.goto(`/p/${slug}`)
    await expect(page.getByTestId('error')).toContainText('not yours')
    await page.goto('/p/leeds/garden/workbook')
    await expect(page.getByTestId('error')).toContainText('not yours')
    expect(await post(page, { action: 'rsvp', event: shared.eventId!, next: '/' })).toContain('not in your portal')
    expect(await post(page, { action: 'complete', lesson: shared.lessonId!, seconds: '8', ended: 'yes', next: '/' })).toContain('error=')
    const me = (await (await page.request.get('/api/workbook')).json()).learner?.id
    expect(me).toBeTruthy()
    for (const collection of ['users', 'answers', 'workbook-entries', 'notifications']) {
      const response = await page.request.get(`/api/${collection}?depth=0`)
      const body = response.ok() ? await response.json() : { docs: [] }
      const others = ((body.docs || []) as { id: number; user?: number | { id: number } }[]).filter((row) => {
        const owner = collection === 'users' ? row.id : typeof row.user === 'object' ? row.user?.id : row.user
        return owner !== me
      })
      expect(others, `/api/${collection} must not list anyone else's records to a learner`).toHaveLength(0)
    }

    await page.setViewportSize(DESK)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin')
    await page.goto(`/p/east-london/admin/content/${shared.courseId}`)
    await expect(page.getByTestId('error')).toContainText('not in this portal')
    await page.goto(`/p/${slug}/admin`)
    await expect(page.getByTestId('error')).toContainText('not yours')
    expect(await post(page, { action: 'cut-status', cut: shared.cutId!, status: 'rejected', next: '/' })).toContain('error=')
    expect(await post(page, { action: 'reply', entry: shared.entryId!, reply: 'Forged', next: '/' })).toContain('not in your portal')
    expect(await post(page, { action: 'create-code', portalSlug: slug, code: `X${suffix}`, role: 'admin', pack: '1', next: '/' })).toContain('error=')
    expect(await post(page, { action: 'create-point', lesson: shared.lessonId!, prompt: 'Forged', next: '/' })).toContain('not in your portal')
    expect(await post(page, { action: 'checkin', event: shared.eventId!, learner: '1', override: 'on', next: '/' })).toContain('not in your portal')

    await signIn(page, adminEmail, 'harbour-admin', `/p/${slug}/admin/content/${shared.courseId}`)
    await expect(page.locator(`[data-testid=cut-draft][data-cut="${shared.cutId}"]`)).toHaveAttribute('data-status', 'approved')
  })

  test('a learner on an admin address is sent back, and a closed portal shows the closed page', async ({ page }) => {
    const stranger = await page.context().browser()!.newContext({ baseURL: E2E_BASE })
    const anonymous = await stranger.request.post('/api/hearts', { form: { action: 'clock', iso: '2030-01-01T00:00:00Z', next: '/' }, maxRedirects: 0 })
    expect(anonymous.headers().location).toContain('/login')
    await stranger.close()
    await signIn(page, learnerEmail, 'harbour-learner', `/p/${slug}/admin/content`)
    await expect(page.getByTestId('error')).toContainText('portal team')
    await page.goto('/admin')
    await expect(page.getByTestId('error')).toContainText('master desk')
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
    await page.getByTestId('portal-card').filter({ hasText: `/p/${slug}` }).getByTestId('deactivate-portal').click()
    await expect(page.getByTestId('portal-card').filter({ hasText: `/p/${slug}` })).toContainText('Deactivated')
    await page.setViewportSize(PHONE)
    await signIn(page, learnerEmail, 'harbour-learner', `/p/${slug}`)
    await expect(page.getByTestId('portal-closed')).toBeVisible()
    expect(await post(page, { action: 'board', body: 'Still here?', next: `/p/${slug}` })).toContain('error=')
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
    await page.getByTestId('portal-card').filter({ hasText: `/p/${slug}` }).getByTestId('deactivate-portal').click()
    await expect(page.getByTestId('portal-card').filter({ hasText: `/p/${slug}` })).toContainText('Active')
  })

  test('feed swipes stay on one level, and learn more steps to that clip’s own parent', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/feed')
    const feed = page.getByTestId('journey')
    await expect(feed).toHaveAttribute('data-phase', 'feed')
    await expect(feed).toHaveAttribute('data-mode', 'hors')
    await expect(feed).toHaveAttribute('data-cuts', /\d+ \d+/)
    const first = await feed.getAttribute('data-cut')
    const swipe = async (dx: number, dy: number) => {
      const box = (await page.getByTestId('gesture-layer').boundingBox())!
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      await page.mouse.move(cx + dx, cy + dy, { steps: 8 })
      await page.mouse.up()
    }
    await swipe(0, -220)
    await expect(feed).toHaveAttribute('data-mode', 'hors')
    await expect(feed).not.toHaveAttribute('data-cut', first!)
    await swipe(0, 220)
    await expect(feed).toHaveAttribute('data-mode', 'hors')
    await expect(feed).toHaveAttribute('data-cut', first!)
    await expect(page.getByText('More on this topic')).toHaveCount(0)
    const horsMore = page.getByTestId('learn-more')
    expect(await horsMore.getAttribute('data-parent')).toMatch(/^appetiser:/)
    expect(await horsMore.getAttribute('data-parent-level')).toBe('appetiser')
    await horsMore.click()
    await expect(feed).toHaveAttribute('data-mode', 'appetiser')
    await expect(feed).toHaveAttribute('data-cut', first!)
    await swipe(-220, 0)
    await expect(feed).toHaveAttribute('data-mode', 'appetiser')
    await expect(feed).not.toHaveAttribute('data-cut', first!)
    const lesson = await feed.getAttribute('data-lesson')
    const talkMore = page.getByTestId('learn-more')
    expect(await talkMore.getAttribute('data-parent-level')).toBe('talk')
    expect(await talkMore.getAttribute('data-parent')).toMatch(/^talk:/)
    expect(await talkMore.getAttribute('href')).toContain(`part=${lesson}`)
    expect(await talkMore.getAttribute('href')).toMatch(/[?&]t=0$/)
    await expect(page.getByTestId('resume-main')).toHaveCount(0)
    await expect(page.getByTestId('mains-shelf')).toHaveCount(0)
  })

  test('the main screens load without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const where = message.location().url || ''
      if (/youtube|ytimg|googlevideo|doubleclick/.test(where) || /youtube|Permissions policy|WebGPU|compute-pressure/i.test(message.text())) return
      errors.push(`${page.url()}: ${message.text()}`)
    })
    page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`))
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
    for (const screen of ['', '/feed', '/lanes', '/garden', '/garden/jibril', '/garden/jibril/22', '/garden/ghunya', '/garden/workbook', '/me', '/me/circle', '/me/plan', '/course/4']) {
      await page.goto(`/p/east-london${screen}`)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)
    }
    await page.setViewportSize(DESK)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin')
    for (const screen of ['', '/content', '/content/4', '/library', '/access', '/teach', '/plans', '/nights', '/settings', '/opening']) {
      await page.goto(`/p/east-london/admin${screen}`)
      await page.waitForLoadState('networkidle')
    }
    expect(errors).toEqual([])
  })
})
