import { expect, request as playwrightRequest, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'
import { fakeYouTube } from './fake-youtube'
import { captionIsSpoken } from './feed-step'
import { ensureProofCourse, PROOF_COURSE } from './proof-course'

const PHONE = { width: 390, height: 844 }
const PORTAL = '/p/east-london'
const OUT = process.env.HEARTS_ARTIFACTS || path.join(process.cwd(), 'test-results', 'integration-r5-walk')

test.use({ video: { mode: 'on', size: PHONE }, viewport: PHONE })

async function signIn(page: Page, email = 'elm-learner@hearts.test', next = `${PORTAL}/feed`) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(email.includes('admin') ? 'portal-admin' : 'portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function hideInstall(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('hearts.install.dismissed', '1')
    } catch {
      // Private browsing still hides the sheet for this walk.
    }
    document.cookie = 'hearts.install.dismissed=1; Path=/; SameSite=Lax'
  })
}

async function shot(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), animations: 'disabled' })
}

test('integration-r5 phone walk: bar, captions, course, desk, hostile file', async ({ page, playwright }) => {
  test.setTimeout(240_000)
  mkdirSync(OUT, { recursive: true })
  const notes: string[] = []
  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const proof = await ensureProofCourse(master)

  await hideInstall(page)
  await fakeYouTube(page)
  await signIn(page, 'elm-learner@hearts.test', PORTAL)
  await expect(page.getByTestId('tabbar')).toBeVisible()
  const labels = (await page.getByTestId('tabbar').locator('a').allTextContents()).map((row) => row.replace(/\s+/g, ' ').trim())
  expect(labels).toEqual(['Home', 'Lanes', 'My week', 'Garden', 'Me'])
  expect(labels).not.toContain('Gather')
  notes.push(`tabbar: ${labels.join(' · ')}`)
  await shot(page, '01-tabbar-home')

  await page.goto(`${PORTAL}/feed`)
  const feed = page.getByTestId('journey')
  await expect(feed).toBeVisible({ timeout: 20_000 })
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  if (await page.getByTestId('caption').count()) {
    const text = (await page.getByTestId('caption').innerText()).trim()
    const lessonTitle = (await feed.getAttribute('data-lesson-title')) || ''
    const courseTitle = (await feed.getAttribute('data-course-title')) || ''
    if (text) {
      expect(text).not.toEqual(lessonTitle)
      expect(text).not.toEqual(courseTitle)
      expect(text).not.toMatch(/The Names Class 20/)
    }
    await captionIsSpoken(page, [])
    notes.push(`caption: ${text || '(none — no timed line)'}`)
  } else {
    notes.push('caption: none on this card')
  }
  await shot(page, '02-feed-caption')

  await page.goto(`${PORTAL}/course/${proof.courseId}`)
  await expect(page.getByTestId('course-overview')).toBeVisible()
  await expect(page.getByTestId('schedule-all')).toContainText('Schedule all of these')
  await expect(page.getByTestId('question-strip')).toHaveCount(0)
  notes.push('course overview: Schedule all of these, no question preview')
  await shot(page, '03-course-overview')

  const firstTalk = page.getByTestId('buffet-talk').first()
  if (await firstTalk.count()) {
    await firstTalk.click()
    if (await page.getByTestId('question-strip').count()) {
      await expect(page.getByTestId('strip-dot').first()).toHaveAttribute('data-revealed', 'no')
      notes.push('player: first question still hidden')
    } else {
      notes.push('player: question strip waits until its moment (none on screen yet)')
    }
    const cta = page.getByTestId('learn-more').or(page.getByTestId('clip-cta'))
    if (await cta.count()) {
      const line = (await cta.first().innerText()).trim()
      notes.push(`cta: ${line}`)
      if (/\d+\s*min/.test(line)) notes.push('friday/talk CTA shows real minutes')
    }
    await shot(page, '04-course-player')
  }

  await page.context().clearCookies()
  await signIn(page, 'elm-admin@hearts.test', `${PORTAL}/admin`)
  await page.goto(`${PORTAL}/admin`)
  const desk = page.getByTestId('desk-nav')
  await expect(desk).toBeVisible()
  await expect(desk).toContainText('Beginner')
  await expect(desk).toContainText('Intermediate')
  await expect(desk).toContainText('In-depth')
  notes.push('desk nav: Beginner / Intermediate / In-depth')
  await shot(page, '05-desk-depths')

  const alice = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  const bob = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await alice.post('/api/users/login', { data: { email: 'elm-learner2@hearts.test', password: 'portal-learner' } })).ok()).toBeTruthy()
  expect((await bob.post('/api/users/login', { data: { email: 'elm-learner@hearts.test', password: 'portal-learner' } })).ok()).toBeTruthy()
  const nur = ((await (await master.get('/api/lessons?where[youtubeId][equals]=NIR88RRpat4&depth=0')).json()) as { docs: { id: number }[] }).docs[0]
  const point = ((await (await master.get(`/api/engagement-points?where[lesson][equals]=${nur.id}&where[kind][equals]=reflection&where[status][equals]=published&depth=0&limit=10`)).json()) as { docs: { id: number }[] }).docs[0]
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  const saved = await alice.post('/api/answers', {
    multipart: {
      pointId: String(point.id),
      body: `r5 walk private ${Date.now()}`,
      keepPrivate: 'on',
      image: { name: 'r5-walk.png', mimeType: 'image/png', buffer: png },
    },
  })
  expect(saved.ok(), await saved.text()).toBeTruthy()
  const answerId = ((await saved.json()) as { answerId?: number }).answerId
  const answer = (await (await alice.get(`/api/answers/${answerId}?depth=0`)).json()) as { image?: { id?: number } | number }
  const mediaId = typeof answer.image === 'object' && answer.image ? Number(answer.image.id) : Number(answer.image)
  const hostile = await bob.get(`/api/hearts/file/${mediaId}`)
  expect(hostile.status()).toBe(403)
  notes.push(`hostile file: learner B got ${hostile.status()} for media ${mediaId}`)

  writeFileSync(path.join(OUT, 'notes.txt'), `${notes.join('\n')}\ncourse=${PROOF_COURSE}\n`)
  await master.dispose()
  await alice.dispose()
  await bob.dispose()
})
