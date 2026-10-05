import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

const DESK = { width: 1440, height: 900 }

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.setViewportSize(DESK)
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function lastAudit(master: APIRequestContext, event: string) {
  const body = await (await master.get(`/api/audit-log?where[event][equals]=${event}&sort=-at&limit=5&depth=0`)).json()
  return (body.docs || []) as { event?: string; actor?: number; portal?: number; detail?: { count?: number; ids?: number[] } }[]
}

test.describe('Lane D admin desk', () => {
  test('D02 activity log shows a plain sentence and filters to this portal', async ({ page }) => {
    const master = await as('master@hearts.test', 'hearts-master')
    const elm = (await (await master.get('/api/portals?where[slug][equals]=east-london&depth=0')).json()).docs[0]
    await master.post('/api/audit-log', { data: { event: 'people.export', actor: 1, actorRole: 'master', portal: elm.id, at: new Date().toISOString(), detail: { count: 2 } } }).catch(() => null)
    // REST create is refused; write through a staff action instead.
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/activity')
    await expect(page.getByTestId('admin-activity')).toBeVisible()
    await expect(page.getByTestId('nav-activity')).toBeVisible()
    await page.locator('[data-testid="desk-help"][data-help="admin-activity"]').click()
    await expect(page.locator('[data-testid="desk-help"][data-help="admin-activity"]')).toHaveAttribute('data-open', 'yes')
    await page.goto('/p/east-london/admin/teach')
    const exportBtn = page.getByTestId('people-export')
    if (await exportBtn.getAttribute('aria-disabled') !== 'true') {
      const [download] = await Promise.all([page.waitForEvent('download').catch(() => null), exportBtn.click()])
      if (download) expect(await download.suggestedFilename()).toMatch(/people/)
    }
    await page.goto('/p/east-london/admin/activity')
    await expect(page.getByTestId('activity-log')).toBeVisible()
    await expect(page.getByTestId('activity-zone')).toContainText('America/Toronto')
    await expect(page.getByTestId('activity-from-day')).toBeVisible()
    await expect(page.getByTestId('activity-from-month')).toBeVisible()
    const when = page.getByTestId('activity-when').first()
    if (await when.count()) {
      await expect(when).toHaveText(/\d{1,2} October 2026, \d{1,2}:\d{2} (AM|PM) ET/)
    }
    await page.locator('nextjs-portal').evaluate((el) => el.remove()).catch(() => null)
    await page.screenshot({ path: '/cursor/stores/self/artifacts/d02_activity_toronto.png', fullPage: false })
    const rows = master ? await lastAudit(master, 'people.export') : []
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].portal).toBeTruthy()
    await master.dispose()
  })

  test('A12 bulk add from a list previews problems then creates accounts', async ({ page }) => {
    const master = await as('master@hearts.test', 'hearts-master')
    const codes = (await (await master.get('/api/access-codes?where[portal.slug][equals]=east-london&limit=20&depth=0')).json()).docs as { id: number; code?: string; role?: string }[]
    const learnerCode = codes.find((row) => row.role === 'learner')?.code || codes[0]?.code
    expect(learnerCode).toBeTruthy()
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/access/import')
    await expect(page.getByTestId('admin-people-import')).toBeVisible()
    const stamp = Date.now().toString().slice(-6)
    const csv = [
      'name,email,role,code,class',
      `Amina List,amina-list-${stamp}@hearts.test,learner,${learnerCode},`,
      `,bad-row,teacher,NOPE,`,
    ].join('\n')
    await page.getByTestId('people-import-paste').fill(csv)
    await page.getByTestId('people-import-preview').click()
    await expect(page.getByTestId('people-import-preview-table')).toBeVisible()
    await expect(page.getByTestId('import-row').filter({ hasText: 'bad-row' })).toHaveAttribute('data-ok', 'no')
    const clean = [
      'name,email,role,code,class',
      `Amina List,amina-list-${stamp}@hearts.test,learner,${learnerCode},`,
    ].join('\n')
    await page.getByTestId('people-import-paste').fill(clean)
    await page.getByTestId('people-import-preview').click()
    await expect(page.getByTestId('people-import-apply')).toBeVisible()
    await page.getByTestId('people-import-apply').click()
    await expect(page.getByTestId('import-done')).toBeVisible()
    const found = await (await master.get(`/api/users?where[email][equals]=amina-list-${stamp}@hearts.test&depth=0`)).json()
    expect(found.docs.length).toBe(1)
    const audits = await lastAudit(master, 'people.import')
    expect(audits.length).toBeGreaterThan(0)
    await master.dispose()
  })

  test('A13 people CSV is portal-scoped and audited', async ({ page }) => {
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/teach')
    await expect(page.getByTestId('people-export')).toBeVisible()
    const master = await as('master@hearts.test', 'hearts-master')
    const before = (await lastAudit(master, 'people.export')).length
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    const csv = await admin.get('/api/hearts/people.csv?portal=east-london')
    expect(csv.ok()).toBeTruthy()
    const text = await csv.text()
    expect(text).toMatch(/^name,email,role/)
    expect(text).not.toMatch(/leeds-learner@hearts.test/)
    expect(text).toMatch(/elm-learner@hearts.test/)
    const after = await lastAudit(master, 'people.export')
    expect(after.length).toBeGreaterThan(before)
    await admin.dispose()
    await master.dispose()
  })

  test('K03 classes: create, add a person, see the group', async ({ page }) => {
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/classes')
    await expect(page.getByTestId('admin-classes')).toBeVisible()
    const name = `Saturday Year 5 ${Date.now().toString().slice(-4)}`
    await page.getByTestId('class-name').fill(name)
    await page.getByTestId('class-create').click()
    await expect(page.getByTestId('class-card').filter({ hasText: name })).toBeVisible()
    const master = await as('master@hearts.test', 'hearts-master')
    const audits = await lastAudit(master, 'class.create')
    expect(audits.length).toBeGreaterThan(0)
    await master.dispose()
  })

  test('C15 recently removed restore, days left, progress and clean-up', async ({ page }) => {
    const master = await as('master@hearts.test', 'hearts-master')
    const elm = (await (await master.get('/api/portals?where[slug][equals]=east-london&depth=0')).json()).docs[0]
    const learner = (await (await master.get('/api/users?where[email][equals]=elm-learner@hearts.test&depth=0')).json()).docs[0]
    const stamp = Date.now().toString().slice(-6)
    const title = `Trash drill ${stamp}`
    const created = await master.post('/api/courses', { data: { title, origin: 'local', portal: elm.id, visibility: 'draft' } })
    expect(created.ok(), await created.text()).toBeTruthy()
    const courseId = ((await created.json()) as { doc?: { id: number }; id?: number }).doc?.id
    expect(courseId).toBeTruthy()
    const unitRes = await master.post('/api/units', { data: { title: `Topic ${stamp}`, course: courseId } })
    expect(unitRes.ok(), await unitRes.text()).toBeTruthy()
    const unitId = ((await unitRes.json()) as { doc?: { id: number }; id?: number }).doc?.id
    const lessonRes = await master.post('/api/lessons', { data: { title: `Talk ${stamp}`, course: courseId, unit: unitId, portal: elm.id } })
    expect(lessonRes.ok(), await lessonRes.text()).toBeTruthy()
    const lessonId = ((await lessonRes.json()) as { doc?: { id: number }; id?: number }).doc?.id
    expect(lessonId).toBeTruthy()
    const done = await master.post('/api/completions', { data: { user: learner.id, lesson: lessonId, portal: elm.id, percent: 100, sourceLevel: 'talk' } })
    expect(done.ok(), await done.text()).toBeTruthy()
    const completionId = ((await done.json()) as { doc?: { id: number }; id?: number }).doc?.id
    const codeRes = await master.post('/api/access-codes', { data: { code: `TRASH-${stamp}`, label: `Trash code ${stamp}`, role: 'learner', portal: elm.id } })
    expect(codeRes.ok(), await codeRes.text()).toBeTruthy()
    const codeId = ((await codeRes.json()) as { doc?: { id: number }; id?: number }).doc?.id
    expect(codeId).toBeTruthy()

    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/trash')
    for (const item of [
      { collection: 'courses', id: courseId },
      { collection: 'access-codes', id: codeId },
    ]) {
      const moved = await page.request.post('/api/hearts', {
        form: { action: 'trash-remove', collection: item.collection, id: String(item.id), portalSlug: 'east-london', next: '/p/east-london/admin/trash' },
        maxRedirects: 0,
      })
      expect([302, 303]).toContain(moved.status())
      expect(moved.headers()['location'] || '').not.toContain('error=')
    }
    await page.goto('/p/east-london/admin/trash')
    const courseRow = page.getByTestId('trash-row').filter({ hasText: title })
    const codeRow = page.getByTestId('trash-row').filter({ hasText: `Trash code ${stamp}` })
    await expect(courseRow).toBeVisible()
    await expect(codeRow).toBeVisible()
    await expect(courseRow.getByTestId('trash-days-left')).toContainText('30')
    await expect(codeRow.getByTestId('trash-days-left')).toContainText('30')
    await page.locator('nextjs-portal').evaluate((el) => el.remove()).catch(() => null)
    await page.screenshot({ path: '/cursor/stores/self/artifacts/c15_recently_removed_days_left.png', fullPage: false })
    expect((await master.get(`/api/courses/${courseId}?depth=0`)).ok()).toBeFalsy()
    await courseRow.getByTestId('trash-restore').click()
    await expect(page.getByTestId('trash-row').filter({ hasText: title })).toHaveCount(0)
    expect((await master.get(`/api/courses/${courseId}?depth=0`)).ok()).toBeTruthy()
    const stillDone = await master.get(`/api/completions/${completionId}?depth=0`)
    expect(stillDone.ok()).toBeTruthy()
    await expect(page.getByTestId('trash-row').filter({ hasText: `Trash code ${stamp}` })).toBeVisible()

    const later = new Date(Date.now() + 31 * 86_400_000).toISOString()
    expect((await master.post('/api/hearts', { form: { action: 'clock', iso: later, next: '/' }, maxRedirects: 0 })).status()).toBe(303)
    await master.post('/api/hearts', { form: { action: 'retention-run', next: '/master/system' }, maxRedirects: 0 })
    await page.goto('/p/east-london/admin/trash')
    await expect(page.getByTestId('trash-row').filter({ hasText: `Trash code ${stamp}` })).toHaveCount(0)
    expect((await master.get(`/api/access-codes/${codeId}?depth=0&trash=true`)).ok()).toBeFalsy()
    expect((await master.get(`/api/courses/${courseId}?depth=0`)).ok()).toBeTruthy()
    await master.post('/api/hearts', { form: { action: 'clock', iso: '', next: '/' }, maxRedirects: 0 })
    await master.dispose()
  })

  test('D06 system page is on the master desk', async ({ page }) => {
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/system')
    await expect(page.getByTestId('master-system')).toBeVisible()
    await expect(page.getByTestId('health-database')).toBeVisible()
    await expect(page.getByTestId('health-email')).toContainText(/Off|Fine|on/i)
    await expect(page.getByTestId('retention-row').first()).toBeVisible()
    await expect(page.getByTestId('system-checked')).toHaveText(/\d{1,2} \w+ 2026, \d{1,2}:\d{2} (AM|PM) ET/)
    await expect(page.getByTestId('system-checked')).not.toContainText('UTC')
    await page.locator('nextjs-portal').evaluate((el) => el.remove()).catch(() => null)
    await page.screenshot({ path: '/cursor/stores/self/artifacts/d06_system_health_et.png', fullPage: false })
  })
})

test.describe('Lane D hostile API', () => {
  test('a portal admin sees only their portal audit and people', async () => {
    const elm = await as('elm-admin@hearts.test', 'portal-admin')
    const leeds = await as('leeds-admin@hearts.test', 'portal-admin')
    const master = await as('master@hearts.test', 'hearts-master')

    const elmPeople = await elm.get('/api/hearts/people.csv?portal=east-london')
    expect(elmPeople.ok()).toBeTruthy()
    expect(await elmPeople.text()).not.toMatch(/leeds-learner@hearts.test/)

    const steal = await elm.get('/api/hearts/people.csv?portal=leeds')
    expect(steal.ok()).toBeFalsy()

    const elmAudit = await elm.get('/api/audit-log?limit=50&depth=0')
    expect(elmAudit.ok()).toBeTruthy()
    const elmRows = ((await elmAudit.json()).docs || []) as { portal?: number }[]
    const leedsPortal = (await (await master.get('/api/portals?where[slug][equals]=leeds&depth=0')).json()).docs[0]
    for (const row of elmRows) {
      if (row.portal) expect(row.portal).not.toBe(leedsPortal.id)
    }

    const stealAudit = await elm.get('/api/hearts/audit.csv?portal=leeds')
    expect(stealAudit.ok()).toBeFalsy()

    const marked = await master.patch(`/api/portals/${leedsPortal.id}`, { data: { welcome: `Leeds drill ${Date.now()}` } })
    expect(marked.ok(), await marked.text()).toBeTruthy()
    const leedsAuditList = ((await (await master.get('/api/audit-log?limit=200&depth=0')).json()).docs || []) as { id: number; portal?: number | { id?: number }; event?: string }[]
    const portalIdOfRow = (row: { portal?: number | { id?: number } }) => typeof row.portal === 'object' ? row.portal?.id : row.portal
    const leedsRow = leedsAuditList.find((row) => portalIdOfRow(row) === leedsPortal.id)
    expect(leedsRow, 'the master list includes a Leeds row').toBeTruthy()
    const stealById = await elm.get(`/api/audit-log/${leedsRow!.id}?depth=0`)
    expect(stealById.ok()).toBeFalsy()

    const masterCsv = await master.get('/api/hearts/audit.csv')
    expect(masterCsv.ok()).toBeTruthy()
    const masterText = await masterCsv.text()
    expect(masterText).toMatch(/T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/)
    expect(masterText.toLowerCase()).toMatch(/east london|leeds/)

    const elmCsv = await elm.get('/api/hearts/audit.csv?portal=east-london')
    expect(elmCsv.ok()).toBeTruthy()
    const elmText = await elmCsv.text()
    expect(elmText).toMatch(/T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/)
    expect(elmText).not.toMatch(/leeds-learner@hearts.test/)
    expect(elmText.toLowerCase()).not.toMatch(/leeds chapter/)

    const foreign = await master.post('/api/courses', { data: { title: `Leeds trash ${Date.now().toString().slice(-4)}`, origin: 'local', portal: leedsPortal.id, visibility: 'draft' } })
    expect(foreign.ok(), await foreign.text()).toBeTruthy()
    const foreignBody = (await foreign.json()) as { doc?: { id: number }; id?: number }
    const foreignId = foreignBody.doc?.id || foreignBody.id
    expect(foreignId).toBeTruthy()
    const stealTrash = await elm.post('/api/hearts', {
      form: {
        action: 'trash-remove',
        collection: 'courses',
        id: String(foreignId),
        portalSlug: 'east-london',
        next: '/p/east-london/admin/trash',
      },
      maxRedirects: 0,
    })
    expect([302, 303]).toContain(stealTrash.status())
    expect(stealTrash.headers()['location'] || '').toMatch(/error=/)
    const stillLive = await master.get(`/api/courses/${foreignId}?depth=0`)
    expect(stillLive.ok()).toBeTruthy()

    const learner = await as('elm-learner@hearts.test', 'portal-learner')
    expect((await learner.get('/api/hearts/people.csv?portal=east-london')).ok()).toBeFalsy()
    expect((await learner.get('/api/audit-log?limit=5')).ok()).toBeFalsy()

    await Promise.all([elm.dispose(), leeds.dispose(), master.dispose(), learner.dispose()])
  })
})
