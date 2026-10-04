import { expect, type Locator, type Page } from '@playwright/test'

export async function settled(page: Page, feed = page.getByTestId('journey')) {
  let last = ''
  await expect(async () => {
    const now = `${await feed.getAttribute('data-index')}:${await feed.getAttribute('data-mode')}`
    const same = now === last
    last = now
    expect(same).toBe(true)
  }).toPass({ timeout: 10_000, intervals: [400] })
  await page.waitForTimeout(150)
}

export async function poolEnded(page: Page) {
  if (!(await page.getByTestId('toast').count())) return false
  return /seen everything|only clip|only 3-minute|everything from|everything on this topic/i.test(await page.getByTestId('toast').innerText())
}

/** Next on this level, or the gentle end when the unused pool is empty. */
export async function stepFeed(page: Page, feed = page.getByTestId('journey')) {
  const before = await feed.getAttribute('data-index')
  await page.getByTestId('gesture-next').dispatchEvent('click')
  await expect.poll(async () => (await feed.getAttribute('data-index')) !== before || (await poolEnded(page))).toBe(true)
  if (await poolEnded(page)) return 'end' as const
  if ((await feed.getAttribute('data-index')) === before) return 'end' as const
  await settled(page, feed)
  return 'ok' as const
}

export async function stepToCard(page: Page, card: string, feed = page.getByTestId('journey')) {
  const listed = ((await feed.getAttribute('data-cuts')) || '').split(' ').filter(Boolean).length
  for (let tries = 0; tries < Math.max(listed, 1) * 3 && (await feed.getAttribute('data-card')) !== card; tries++) {
    if ((await stepFeed(page, feed)) === 'end') break
  }
  return (await feed.getAttribute('data-card')) === card
}
