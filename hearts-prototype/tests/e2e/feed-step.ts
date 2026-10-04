import { expect, type Locator, type Page } from '@playwright/test'
import { tidyCaption } from '../../src/lib/tidy-caption'
import { captionIndex } from '../../src/lib/tiers'

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

const CHROME_IDS = ['feed-mission', 'swipe-hint', 'lane-chip', 'clip-timer', 'tap-sound', 'top-speaker', 'speaker-link', 'caption', 'learn-more'] as const

/** elementFromPoint at each chrome centre, plus every pair of bounding boxes. */
export async function chromeCentresClear(page: Page, extraIds: string[] = []) {
  const ids = [...CHROME_IDS, ...extraIds]
  const found: { id: string; box: { x: number; y: number; width: number; height: number } }[] = []
  for (const id of ids) {
    const loc = page.getByTestId(id).first()
    if (!(await loc.count()) || !(await loc.isVisible())) continue
    const box = await loc.boundingBox()
    if (!box || box.width < 2 || box.height < 2) continue
    found.push({ id, box })
  }
  const nested = await page.evaluate((ids) => {
    const nodes = ids.map((id) => ({ id, el: document.querySelector(`[data-testid="${id}"]`) }))
    const skip = new Set<string>()
    for (const left of nodes) {
      for (const right of nodes) {
        if (!left.el || !right.el || left.id === right.id) continue
        if (left.el.contains(right.el) || right.el.contains(left.el)) skip.add([left.id, right.id].sort().join(':'))
      }
    }
    return [...skip]
  }, found.map((row) => row.id))
  const skip = new Set(nested)
  for (let i = 0; i < found.length; i++) {
    for (let j = i + 1; j < found.length; j++) {
      const key = [found[i].id, found[j].id].sort().join(':')
      if (skip.has(key)) continue
      expect(boxesOverlap(found[i].box, found[j].box), `${found[i].id} must not overlap ${found[j].id}`).toBe(false)
    }
  }
  const hits = await page.evaluate((items) => items.map((item) => {
    const el = document.querySelector(`[data-testid="${item.id}"]`)
    if (!el) return { id: item.id, hit: '', owns: false }
    const r = el.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    const node = top instanceof Element ? top : null
    const owns = Boolean(node && (el === node || el.contains(node)))
    const hit = node?.closest?.('[data-testid]')?.getAttribute('data-testid') || node?.getAttribute('data-testid') || ''
    return { id: item.id, hit, owns }
  }), found)
  for (const row of hits) {
    expect(row.owns, `${row.id} centre hit ${row.hit || 'nothing'}`).toBe(true)
  }
  return found.map((row) => row.id)
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

export type OpeningClip = {
  cutId: number
  lessonTitle?: string
  courseTitle?: string
  hors?: { quote?: string; lines?: { at: number; text: string; tidy?: string }[] }
}

const fold = (value: string) => value.replace(/[.?!]+$/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/** On a talk card, the caption is the timed line for now, or absent. It is never the talk or series title. */
export async function captionIsSpoken(page: Page, clips: Record<string, OpeningClip> | OpeningClip[]) {
  const feed = page.getByTestId('journey')
  if ((await feed.getAttribute('data-card')) !== 'talk') return
  const lessonTitle = (await feed.getAttribute('data-lesson-title')) || ''
  const courseTitle = (await feed.getAttribute('data-course-title')) || ''
  const cut = Number(await feed.getAttribute('data-cut'))
  const listed = Array.isArray(clips) ? clips : Object.values(clips)
  const clip = listed.find((row) => row.cutId === cut)
  const snap = await page.evaluate(() => ((window as unknown as { __HEARTS_FEED_SNAP?: () => { hidden: boolean; currentTime: number }[] }).__HEARTS_FEED_SNAP?.() || []).find((row) => !row.hidden))
  const time = snap?.currentTime
  const lines = clip?.hors?.lines || []
  const index = time == null ? -1 : captionIndex(lines, time)
  const caption = page.getByTestId('caption')
  if (index < 0) {
    expect(await caption.count(), 'no timed words for this moment, so no caption').toBe(0)
    return
  }
  await expect(caption, 'timed words must appear as the caption').toBeVisible()
  const shown = (await caption.innerText()).replace(/\s+/g, ' ').trim()
  expect(shown.length, 'a visible caption has spoken words').toBeGreaterThan(0)
  expect(fold(shown), 'caption must not be the lesson title').not.toBe(fold(lessonTitle))
  expect(fold(shown), 'caption must not be the series title').not.toBe(fold(courseTitle))
  if (lessonTitle) expect(shown, 'caption must not be the lesson title').not.toBe(lessonTitle)
  if (courseTitle) expect(shown, 'caption must not be the series title').not.toBe(courseTitle)
  const expected = tidyCaption(lines[index].tidy || lines[index].text)
  expect(fold(shown), 'caption must be the timed transcript line for now').toBe(fold(expected))
}
