import { expect, test, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { fakeYouTube } from './fake-youtube'
import { settled, stepFeed } from './feed-step'
import { ensureProofCourse } from './proof-course'
import { openReachedQuestion } from './question-moment'

const PHONE = { width: 390, height: 844 }
const PORTAL = '/p/east-london'

async function signIn(page: Page, next = `${PORTAL}/feed`, email = 'elm-learner@hearts.test') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('Ready for more? is on the first talk and on a scenic card', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').filter(Boolean).length
  for (let tries = 0; tries < total && (await feed.getAttribute('data-card')) !== 'talk'; tries++) await stepFeed(page)
  await expect(feed).toHaveAttribute('data-card', 'talk')
  const more = page.getByTestId('learn-more')
  await expect(more).toBeVisible()
  await expect(more).toHaveText(/Ready for more\?/)
  await more.click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await expect(page.getByTestId('level-chip')).toHaveText('Ready for more?')
  await page.goto(`${PORTAL}/feed`)
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  for (let tries = 0; tries < Math.max(8, total); tries++) {
    if ((await feed.getAttribute('data-card')) === 'scene') break
    await stepFeed(page)
  }
  if ((await feed.getAttribute('data-card')) === 'scene') {
    const sceneNext = page.getByTestId('scene-next')
    await expect(sceneNext).toBeVisible()
    await expect(sceneNext).toHaveText(/Ready for more\?/)
    await sceneNext.click()
    await expect(feed).toHaveAttribute('data-mode', 'appetiser')
    await expect(page.getByTestId('level-chip')).toHaveText('Ready for more?')
  }
})

test('questions stay hidden until their moment, and the buffet never previews them', async ({ page, playwright }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  const master = await playwright.request.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const proof = await ensureProofCourse(master)
  await signIn(page, `${PORTAL}/course/${proof.courseId}`, 'elm-learner2@hearts.test')
  await expect(page.getByTestId('course-overview')).toBeVisible()
  await expect(page.getByTestId('question-strip')).toHaveCount(0)
  await expect(page.getByTestId('answer-point')).toHaveCount(0)
  await expect(page.getByTestId('timeline-dot')).toHaveCount(0)
  await page.getByTestId('buffet-talk').first().click()
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(page.getByTestId('player-time')).toContainText('0:00')
  await expect(page.getByTestId('answer-point')).toHaveText(/Answer question 1/)
  await expect(page.getByTestId('answer-point')).toBeEnabled()
  await expect(page.getByTestId('timeline-dot').first()).toHaveAttribute('data-moment', 'waiting')
  await expect(page.getByTestId('strip-dot').first()).toHaveAttribute('data-revealed', 'no')
  await expect(page.getByTestId('strip-dot').first()).toHaveText(/Question 1 comes at 0:30/)
  await page.getByTestId('timeline-dot').first().click()
  await expect(page.getByTestId('popup')).toBeVisible()
  await expect(page.getByTestId('player-time')).toContainText('0:30')
  await page.getByTestId('popup-close').click()
  await openReachedQuestion(page)
  await expect(page.getByTestId('player-time')).toContainText('0:30')
  await expect(page.getByTestId('popup-prompt')).toBeVisible()
  await page.getByTestId('popup-close').click()
  await expect(page.getByTestId('answer-point')).toContainText('Answer question 1')
  await expect(page.getByTestId('timeline-dot').first()).toHaveAttribute('data-moment', 'reached')
  await master.dispose()
})
