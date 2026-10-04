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

function boxesOverlap(left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }) {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y
}

/** Header, lane chip, timer and Tap for sound must not share pixels, in either layout. */
export async function chromeBoxesClear(page: Page) {
  const named = [
    ['header', '[data-testid="top-speaker"]'],
    ['header', '[data-testid="speaker-link"]'],
    ['chip', '[data-testid="lane-chip"]'],
    ['timer', '[data-testid="clip-timer"]'],
    ['sound', '[data-testid="tap-sound"]'],
  ] as const
  const found: { name: string; box: { x: number; y: number; width: number; height: number } }[] = []
  const seen = new Set<string>()
  for (const [name, selector] of named) {
    if (seen.has(name) && name === 'header') continue
    const loc = page.locator(selector).first()
    if (!(await loc.count()) || !(await loc.isVisible())) continue
    const box = await loc.boundingBox()
    if (!box || box.width < 1 || box.height < 1) continue
    found.push({ name, box })
    seen.add(name)
  }
  for (let i = 0; i < found.length; i++) {
    for (let j = i + 1; j < found.length; j++) {
      expect(
        boxesOverlap(found[i].box, found[j].box),
        `${found[i].name} must not overlap ${found[j].name}`,
      ).toBe(false)
    }
  }
  return found.map((row) => row.name)
}

export async function stepToCard(page: Page, card: string, feed = page.getByTestId('journey')) {
  const listed = ((await feed.getAttribute('data-cuts')) || '').split(' ').filter(Boolean).length
  for (let tries = 0; tries < Math.max(listed, 1) * 3 && (await feed.getAttribute('data-card')) !== card; tries++) {
    if ((await stepFeed(page, feed)) === 'end') break
  }
  return (await feed.getAttribute('data-card')) === card
}
