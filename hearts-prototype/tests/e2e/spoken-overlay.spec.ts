import { expect, test } from '@playwright/test'
import { fakeYouTube } from './fake-youtube'
import { settled } from './feed-step'

const BASE = '/p/east-london'
const fold = (value: string) => value.replace(/[.?!]+$/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

test('a talking picture never shows a title, a frozen line or an untimed quote', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await fakeYouTube(page)
  await page.goto(`/login?next=${encodeURIComponent(`${BASE}/feed`)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  await expect(page.getByTestId('poster-title')).toHaveCount(0)
  const lesson = fold((await feed.getAttribute('data-lesson-title')) || '')
  const course = fold((await feed.getAttribute('data-course-title')) || '')
  const caption = page.getByTestId('caption')
  if (await caption.count()) {
    const shown = fold(await caption.innerText())
    if (lesson) expect(shown, 'caption must not be the lesson title').not.toBe(lesson)
    if (course) expect(shown, 'caption must not be the series title').not.toBe(course)
    expect(shown).not.toMatch(/extended cut|learn more/)
  }
  const speaker = page.locator('.j-speaker small, .speaker-card small')
  if (await speaker.count()) {
    const shown = fold((await speaker.allInnerTexts()).join(' '))
    if (lesson) expect(shown, 'speaker card must not show the YouTube title').not.toBe(lesson)
    if (course) expect(shown, 'speaker card must not show the series title').not.toBe(course)
  }
})
