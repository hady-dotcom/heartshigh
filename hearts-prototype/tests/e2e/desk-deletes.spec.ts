import { expect, request as playwrightRequest, test, type Page } from '@playwright/test'

const VIEWS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
}

async function formPost(page: Page, path: string, fields: Record<string, string>) {
  const response = await page.request.post(path, { form: fields, maxRedirects: 0 })
  const location = response.headers().location || ''
  const url = new URL(location || path, 'http://127.0.0.1')
  const error = url.searchParams.get('error')
  if (error) throw new Error(`${path} ${fields.action || ''}: ${error}`)
  return url
}

async function restCreate(page: Page, collection: string, data: Record<string, unknown>) {
  const response = await page.request.post(`/api/${collection}`, { data })
  if (!response.ok()) throw new Error(`${collection} ${response.status()} ${await response.text()}`)
  const body = (await response.json()) as { doc?: { id?: number }; id?: number }
  const id = Number(body.doc?.id || body.id)
  if (!id) throw new Error(`${collection} did not return an id`)
  return id
}

async function confirmDelete(page: Page, testId: string) {
  const form = page.getByTestId(`${testId}-form`)
  await form.scrollIntoViewIfNeeded()
  await form.getByTestId(`${testId}-sure`).check()
  await form.getByTestId(testId).click()
  await expect(page.getByTestId('notice')).toBeVisible()
}

test.describe('desk list deletes', () => {
  test.describe.configure({ mode: 'serial' })

  for (const view of VIEWS) {
    test(`each new delete at ${view.width}`, async ({ page }) => {
      test.setTimeout(300_000)
      await page.setViewportSize({ width: view.width, height: view.height })
      const tag = `bin${view.width}`
      await signIn(page, 'master@hearts.test', 'hearts-master', '/master')

      await page.goto('/master/codes')
      const keptCode = (await page.getByTestId('code-value').first().innerText()).trim()
      expect(keptCode.length).toBeGreaterThan(2)

      await formPost(page, '/api/hearts', { action: 'create-course', title: `Aaa ${tag} course`, next: '/master/library' })
      await page.goto('/master/library')
      const courseCard = page.getByTestId('master-course').filter({ hasText: `Aaa ${tag} course` })
      await expect(courseCard).toBeVisible()
      const courseHref = await courseCard.getByTestId('course-open').getAttribute('href')
      const courseId = Number(courseHref?.split('/').pop())
      expect(courseId).toBeGreaterThan(0)

      await formPost(page, '/api/hearts', {
        action: 'adopt',
        kind: 'course',
        course: String(courseId),
        portalSlug: 'east-london',
        next: '/p/east-london/admin/library',
      })
      await page.goto('/p/east-london/admin/library')
      const linked = page.getByTestId('library-course').filter({ hasText: `Aaa ${tag} course` })
      await expect(linked).toBeVisible()
      await linked.getByTestId('remove-link-sure').check()
      await linked.getByTestId('remove-link').click()
      await expect(page.getByTestId('notice')).toBeVisible()
      await expect(page.getByTestId('library-course').filter({ hasText: `Aaa ${tag} course` })).toHaveCount(0)

      await page.goto(`/master/library/${courseId}`)
      const lessonButton = page.getByTestId(/^delete-lesson-/)
      await expect(lessonButton.first()).toBeVisible()
      const lessonTestId = await lessonButton.first().getAttribute('data-testid')
      expect(lessonTestId).toBeTruthy()
      const lessonId = Number(lessonTestId!.replace('delete-lesson-', ''))

      await page.getByTestId('point-prompt').fill(`A question for ${tag}`)
      await page.getByTestId('point-submit').click()
      await expect(page.getByTestId('notice')).toBeVisible()
      const pointTestId = await page.getByTestId(/^delete-point-/).first().getAttribute('data-testid')
      const pointId = pointTestId!.replace('delete-point-', '')
      await formPost(page, '/api/hearts', {
        action: 'circle-add',
        point: pointId,
        name: 'Amina',
        body: `A quiet thank you for ${tag}`,
        next: `/master/circle?lesson=${lessonId}`,
      })
      await page.goto(`/master/circle?lesson=${lessonId}`)
      const answer = page.getByTestId('circle-answer').filter({ hasText: `A quiet thank you for ${tag}` })
      await answer.getByTestId('circle-delete-sure').check()
      await answer.getByTestId('circle-delete').click()
      await expect(page.getByTestId('notice')).toContainText("can't be undone")
      await page.goto(`/master/library/${courseId}`)
      await confirmDelete(page, pointTestId!)

      const clipId = await restCreate(page, 'cuts', {
        lesson: lessonId,
        start: 1,
        end: 8,
        hook: `Hook ${tag}`,
        turn: `Turn ${tag}`,
        land: `Land ${tag}`,
        status: 'draft',
      })
      await page.goto(`/master/library/${courseId}`)
      await confirmDelete(page, `delete-clip-${clipId}`)

      const ladderId = await restCreate(page, 'ladder-items', {
        lesson: lessonId,
        kind: 'hors',
        start: 1,
        end: 8,
        quote: `Draft ${tag}`,
        status: 'draft',
      })
      await page.goto(`/master/library/${courseId}`)
      await confirmDelete(page, `delete-ladder-${ladderId}`)

      await confirmDelete(page, lessonTestId!)

      await page.goto('/master/library')
      await confirmDelete(page, `delete-course-${courseId}`)
      await expect(page.getByTestId('master-course').filter({ hasText: `Aaa ${tag} course` })).toHaveCount(0)
      await page.goto('/master/codes')
      await expect(page.getByTestId('code-value').filter({ hasText: keptCode }).first()).toBeVisible()
      await page.goto('/master/bin')
      const courseBin = page.getByTestId('bin-row').filter({ hasText: `Aaa ${tag} course` })
      await expect(courseBin).toBeVisible()
      await courseBin.getByTestId('bin-undo').click()
      await expect(page.getByTestId('notice')).toContainText('back')
      await page.goto('/master/library')
      await expect(page.getByTestId('master-course').filter({ hasText: `Aaa ${tag} course` })).toBeVisible()
      await confirmDelete(page, `delete-course-${courseId}`)

      await formPost(page, '/api/hearts', { action: 'create-pack', owner: 'master', title: `Aaa ${tag} pack`, next: '/master/packs' })
      await page.goto('/master/packs')
      const packRow = page.getByTestId('pack-row').filter({ hasText: `Aaa ${tag} pack` })
      await expect(packRow).toBeVisible()
      const packTestId = await packRow.getByTestId(/^delete-pack-/).getAttribute('data-testid')
      await confirmDelete(page, packTestId!)

      await formPost(page, '/api/hearts', {
        action: 'create-pack',
        portalSlug: 'east-london',
        title: `Aaa ${tag} portal pack`,
        next: '/p/east-london/admin/access',
      })
      await page.goto('/p/east-london/admin/access')
      await page.getByTestId('codes-advanced').locator('summary').click()
      const portalPack = page.getByTestId('portal-pack-row').filter({ hasText: `Aaa ${tag} portal pack` })
      const portalPackId = await portalPack.getByTestId(/^delete-pack-/).getAttribute('data-testid')
      await confirmDelete(page, portalPackId!)

      await page.goto('/master')
      await page.getByTestId('create-portal-name').fill(`Bin Harbour ${tag}`)
      await page.getByTestId('create-portal-slug').fill(`bin-harbour-${tag}`)
      await page.getByTestId('create-portal-submit').click()
      await page.goto('/master')
      const portalRow = page.getByTestId('portal-card').filter({ hasText: `Bin Harbour ${tag}` })
      const portalForm = portalRow.getByTestId(/^delete-portal-.*-form$/)
      await portalForm.getByTestId(/^delete-portal-.*-name$/).fill(`Bin Harbour ${tag}`)
      await portalForm.getByRole('button', { name: 'Delete portal' }).click()
      await expect(page.getByTestId('notice')).toBeVisible()
      await expect(page.getByTestId('portal-card').filter({ hasText: `Bin Harbour ${tag}` })).toHaveCount(0)

      await page.goto('/master/announcements')
      await page.getByTestId('announce-form').locator('textarea').fill(`Note ${tag} for home`)
      await page.getByTestId('announce-submit').click()
      await expect(page.getByTestId('announce-row').filter({ hasText: `Note ${tag} for home` })).toBeVisible()
      const note = page.getByTestId('announce-row').filter({ hasText: `Note ${tag} for home` })
      const noteId = await note.getByTestId(/^delete-announcement-/).getAttribute('data-testid')
      await confirmDelete(page, noteId!)
      const portalForNotes = await page.getByTestId('announce-portal').locator('option').first().getAttribute('value')
      expect(portalForNotes).toBeTruthy()
      await formPost(page, '/api/hearts', { action: 'announce', portal: portalForNotes || '', body: `Bulk one ${tag}`, audience: 'everyone', next: '/master/announcements' })
      await formPost(page, '/api/hearts', { action: 'announce', portal: portalForNotes || '', body: `Bulk two ${tag}`, audience: 'everyone', next: '/master/announcements' })
      await page.goto('/master/announcements')
      await page.getByTestId('announce-row').filter({ hasText: `Bulk one ${tag}` }).getByTestId('delete-pick').check()
      await page.getByTestId('announce-row').filter({ hasText: `Bulk two ${tag}` }).getByTestId('delete-pick').check()
      await page.getByTestId('bulk-announcement-sure').check()
      await page.getByTestId('bulk-announcement-go').click()
      await expect(page.getByTestId('notice')).toBeVisible()
      await expect(page.getByTestId('announce-row').filter({ hasText: `Bulk one ${tag}` })).toHaveCount(0)

      await formPost(page, '/api/hearts', {
        action: 'create-event',
        portalSlug: 'east-london',
        title: `Aaa ${tag} night`,
        kind: 'Night',
        startsAt: '2026-11-02T19:00',
        next: '/p/east-london/admin/nights',
      })
      await page.goto('/p/east-london/admin/nights')
      const night = page.getByTestId('event').filter({ hasText: `Aaa ${tag} night` })
      const nightId = await night.getByTestId(/^delete-night-/).getAttribute('data-testid')
      await confirmDelete(page, nightId!)

      await formPost(page, '/api/calendar', {
        action: 'season',
        key: tag,
        name: `Aaa ${tag} season`,
        theme: 'quiet',
        start: '1 November 2026',
        end: '8 November 2026',
        next: '/master/calendar',
      })
      await page.goto('/master/calendar')
      const season = page.getByTestId('season-row').filter({ hasText: `Aaa ${tag} season` })
      const seasonId = await season.getByTestId(/^delete-season-/).getAttribute('data-testid')
      await confirmDelete(page, seasonId!)

      await formPost(page, '/api/calendar', {
        action: 'copy',
        slot: 'feed-cta-label',
        context: 'friday',
        label: `Line ${tag} before Jumu'ah`,
        next: '/master/calendar',
      })
      await page.goto('/master/calendar')
      const copy = page.getByTestId('copy-row').filter({ hasText: `Line ${tag}` })
      const copyId = await copy.getByTestId(/^delete-copy-/).getAttribute('data-testid')
      await confirmDelete(page, copyId!)

      await formPost(page, '/api/gather', {
        action: 'save',
        portal: 'east-london',
        title: `Aaa ${tag} gathering`,
        kind: 'circle',
        audience: 'all',
        startsAt: '2026-11-03T19:00',
        place: 'The hall',
        next: '/p/east-london/admin/gather',
      })
      await page.goto('/p/east-london/admin/gather')
      const gathering = page.getByTestId('desk-gather-row').filter({ hasText: `Aaa ${tag} gathering` })
      const gatheringId = await gathering.getByTestId(/^delete-gathering-/).getAttribute('data-testid')
      await confirmDelete(page, gatheringId!)

      await formPost(page, '/api/live', {
        action: 'save',
        portal: 'east-london',
        title: `Aaa ${tag} live`,
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        when: '2026-11-04T19:00',
        next: '/p/east-london/admin/live',
      })
      await page.goto('/p/east-london/admin/live')
      const live = page.getByTestId('desk-scheduled-row').filter({ hasText: `Aaa ${tag} live` })
      const liveId = await live.getByTestId(/^delete-live-/).getAttribute('data-testid')
      await confirmDelete(page, liveId!)

      await formPost(page, '/api/missions', {
        action: 'create',
        title: `Aaa ${tag} mission`,
        ask: 'Listen for a few minutes',
        why: 'A thank you',
        minutesAsked: '5',
        startsAt: '1 November 2026',
        endsAt: '8 November 2026',
        target: '3',
        next: '/master/missions',
      })
      await page.goto('/master/missions')
      const mission = page.getByTestId('mission-card').filter({ hasText: `Aaa ${tag} mission` })
      await expect(mission).toBeVisible()
      const missionId = await mission.locator('xpath=..').getByTestId(/^delete-mission-/).getAttribute('data-testid')
      await confirmDelete(page, missionId!)

      const experiment = await formPost(page, '/api/experiments', {
        action: 'create',
        key: tag,
        name: `Aaa ${tag} experiment`,
        slot: 'feed-cta-label',
        primaryMetric: 'clip_cta_tap',
        variants: 'a | Alpha line\nb | Beta line',
        next: '/master/experiments',
      })
      await page.goto(experiment.pathname)
      if (await page.getByTestId('delete-experiment').count()) await confirmDelete(page, 'delete-experiment')
      else {
        await page.goto('/master/experiments')
        const card = page.getByTestId('experiment-card').filter({ hasText: `Aaa ${tag} experiment` })
        const experimentId = await card.locator('xpath=..').getByTestId(/^delete-experiment-/).getAttribute('data-testid')
        await confirmDelete(page, experimentId!)
      }

      const sceneId = await restCreate(page, 'opening-scenes', {
        key: tag,
        order: 0,
        caption: `A quiet ${tag}`,
        status: 'draft',
        options: [
          { key: 'a', label: 'One' },
          { key: 'b', label: 'Two' },
          { key: 'c', label: 'Three' },
          { key: 'd', label: 'Four' },
        ],
      })
      await page.goto('/master/opening')
      await confirmDelete(page, `delete-scene-${sceneId}`)
      await expect(page.locator(`[data-scene=${tag}]`)).toHaveCount(0)

      const laneId = await restCreate(page, 'lanes', { key: tag, title: `Aaa ${tag} lane` })
      await page.goto('/master/lanes')
      await confirmDelete(page, `delete-lane-${laneId}`)

      await page.goto('/master/questions')
      await page.getByTestId('placing-prompt').fill(`Where do you start ${tag}?`)
      await page.getByTestId('placing-options').fill('At home\nAt the masjid')
      await page.getByTestId('placing-save').click()
      await expect(page.getByTestId('notice')).toBeVisible()
      const placing = page.getByTestId('placing-row').filter({ hasText: `Where do you start ${tag}?` })
      const placingId = await placing.getByTestId(/^delete-placing-/).getAttribute('data-testid')
      await confirmDelete(page, placingId!)

      const sheetId = await restCreate(page, 'sheet-imports', {
        desk: 'master',
        state: 'applied',
        fileName: `${tag}.xlsx`,
        summary: { fileName: `${tag}.xlsx` },
      })
      await page.goto('/master/sheet')
      await expect(page.getByTestId('sheet-last')).toContainText(`${tag}.xlsx`)
      await confirmDelete(page, 'delete-sheet')
      expect(sheetId).toBeGreaterThan(0)

      await page.goto('/master/see-how')
      await expect(page.getByTestId('see-how-reset-copy').first()).toContainText("can't be undone")

      await page.goto('/p/east-london/admin/opening')
      await page.getByTestId('portal-own-caption').fill(`A quiet afternoon ${tag}`)
      await page.getByTestId('portal-own-opt1').fill('Work')
      await page.getByTestId('portal-own-opt2').fill('Family')
      await page.getByTestId('portal-own-save').click()
      const own = page.getByTestId('portal-own-scene').filter({ hasText: `A quiet afternoon ${tag}` })
      await own.getByTestId('portal-own-sure').check()
      await own.getByTestId('portal-own-remove').click()
      await expect(page.getByTestId('notice')).toBeVisible()

      await page.getByTestId('contact-label').fill(`Line ${tag}`)
      await page.getByTestId('contact-phone').fill('0800 000 000')
      await page.locator('#add-help-contact button[type=submit]').click()
      const contact = page.getByTestId('help-contact').filter({ hasText: `Line ${tag}` })
      await contact.getByTestId('help-contact-sure').check()
      await contact.getByTestId('help-contact-remove').click()
      await expect(page.getByTestId('notice')).toBeVisible()

      const people = await page.request.get('/api/users?limit=1&where[email][equals]=master@hearts.test')
      expect(people.ok()).toBeTruthy()
      const person = (await people.json()) as { docs?: { id?: number }[] }
      const personId = Number(person.docs?.[0]?.id)
      expect(personId).toBeGreaterThan(0)
      const diaryId = await restCreate(page, 'workbook-entries', { user: personId, body: `Diary words ${tag}`, consent: true })
      await page.goto(`/master/diaries/${diaryId}`)
      await expect(page.getByTestId('diary-delete-copy')).toContainText("can't be undone")
      await page.getByTestId('diary-delete-sure').check()
      await page.getByTestId('diary-delete').click()
      await expect(page.getByTestId('notice')).toBeVisible()
      await page.goto('/master/diaries')
      await expect(page.getByTestId('diary-bulk')).toBeVisible()

      const planId = await restCreate(page, 'schedules', {
        name: `Aaa ${tag} plan`,
        startDate: '1 November 2026',
        endDate: '8 November 2026',
        weekdays: [1, 3],
        slots: [],
      })
      await page.goto(`/master/plans/${planId}`)
      await expect(page.getByTestId('plan-delete-copy')).toContainText("can't be undone")
      await page.getByTestId('plan-delete-sure').check()
      await page.getByTestId('plan-delete').click()
      await expect(page.getByTestId('notice')).toBeVisible()

      await page.goto('/master')
      const packValue = await page.getByTestId('code-pack').locator('option').first().getAttribute('value')
      expect(packValue).toBeTruthy()
      const joinCode = `BIN${view.width}CODE`.slice(0, 32)
      await formPost(page, '/api/hearts', {
        action: 'create-code',
        portalSlug: 'east-london',
        role: 'admin',
        pack: packValue || '',
        code: joinCode,
        next: '/master/codes',
      })
      await page.goto('/master/codes')
      const codeRow = page.getByTestId('master-code-row').filter({ hasText: joinCode })
      await expect(codeRow).toBeVisible()
      const codeTestId = await codeRow.getByTestId(/^delete-code-/).getAttribute('data-testid')
      await confirmDelete(page, codeTestId!)
      await expect(page.getByTestId('code-value').filter({ hasText: keptCode }).first()).toBeVisible()
      await expect(page.getByTestId('bulk-code')).toBeVisible()
    })
  }

  test('a portal admin cannot delete outside their portal, and a teacher cannot delete a course', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/library')
    await formPost(page, '/api/hearts', { action: 'create-course', title: 'Aaa other portal course', origin: 'local', portalSlug: 'leeds', next: '/p/leeds/admin/content' })
    await page.goto('/p/leeds/admin/content')
    const row = page.getByTestId('course-row').filter({ hasText: 'Aaa other portal course' })
    const testId = await row.getByTestId(/^delete-course-/).getAttribute('data-testid')
    const courseId = Number(testId?.replace('delete-course-', ''))
    expect(courseId).toBeGreaterThan(0)

    const elm = await playwrightRequest.newContext()
    const signed = await elm.post('/api/hearts', { form: { action: 'login', email: 'elm-admin@hearts.test', password: 'portal-admin', next: '/p/east-london/admin' }, maxRedirects: 0 })
    expect(signed.status()).toBe(303)
    const refused = await elm.post('/api/hearts', {
      form: { action: 'desk-delete', kind: 'course', id: String(courseId), sure: 'yes', next: '/p/east-london/admin/content' },
      maxRedirects: 0,
    })
    expect(decodeURIComponent(refused.headers().location || '').replace(/\+/g, ' ')).toMatch(/another portal|library/)
    await elm.dispose()

    const teacher = await playwrightRequest.newContext()
    await teacher.post('/api/hearts', { form: { action: 'login', email: 'elm-teacher@hearts.test', password: 'portal-teacher', next: '/p/east-london/admin' }, maxRedirects: 0 })
    const blocked = await teacher.post('/api/hearts', {
      form: { action: 'desk-delete', kind: 'course', id: String(courseId), sure: 'yes', next: '/p/east-london/admin' },
      maxRedirects: 0,
    })
    expect(decodeURIComponent(blocked.headers().location || '').replace(/\+/g, ' ')).toMatch(/portal admin|master desk/)
    await teacher.dispose()
  })
})
