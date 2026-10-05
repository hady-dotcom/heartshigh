import { expect, type Page } from '@playwright/test'

/** Seek to a question's timestamp so hide-until-moment lets it open. */
export async function reachQuestionMoment(page: Page, index = 0) {
  const dot = page.getByTestId('timeline-dot').nth(index)
  await expect(dot).toBeVisible()
  const second = Number((await dot.getAttribute('data-second')) || 0)
  if ((await dot.getAttribute('data-moment')) === 'reached' || second <= 0) return second
  const url = new URL(page.url())
  url.searchParams.set('t', String(second))
  await page.goto(`${url.pathname}${url.search}${url.hash}`)
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(page.getByTestId('timeline-dot').nth(index)).toHaveAttribute('data-moment', 'reached', { timeout: 10_000 })
  return second
}

export async function openReachedQuestion(page: Page, index = 0) {
  await reachQuestionMoment(page, index)
  const answer = page.getByTestId('answer-point')
  if (await answer.isEnabled()) await answer.click()
  else await page.getByTestId('timeline-dot').nth(index).click()
  await expect(page.getByTestId('popup')).toBeVisible()
}
