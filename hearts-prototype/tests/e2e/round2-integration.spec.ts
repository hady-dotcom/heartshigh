import { expect, request as playwrightRequest, test, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { doorCode, doorNumberOfClause } from '../../src/lib/doors'

const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const PORTAL = '/p/east-london'
const BANNED = /hoopoe|hud-?hud/i

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function clean(page: Page, where: string) {
  await page.waitForLoadState('domcontentloaded')
  const html = await page.content()
  expect(html.match(BANNED)?.[0] || '', `${where} names the old mark`).toBe('')
  expect(await page.locator('img[src*="/brand/"]').count(), `${where} shows brand art`).toBe(0)
}

const bg = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor)

test('no hoopoe or Hudhud on sign-in, Home, the feed, the garden, Me, the desks or the laptop page', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(PHONE)
  await page.goto('/login')
  await expect(page.locator('.brand-word')).toHaveText('HEARTS')
  await clean(page, 'login')
  await page.goto('/join')
  await clean(page, 'join')

  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', PORTAL)
  for (const screen of ['', '/feed', '/garden', '/garden/harvest', '/garden/workbook', '/me']) {
    await page.goto(`${PORTAL}${screen}`)
    await clean(page, screen || 'home')
  }

  await page.goto(`${PORTAL}/feed`)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').length
  for (let at = 0; at < Math.min(total, 12); at++) {
    expect(await page.locator('.j-poster-mark img, .avatar img[src*="brand"], .speaker-mark img').count()).toBe(0)
    const before = await feed.getAttribute('data-index')
    await page.getByTestId('gesture-next').dispatchEvent('click')
    await expect(feed).not.toHaveAttribute('data-index', before!)
  }

  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${PORTAL}/admin`)
  await expect(page.getByTestId('desk-narrow')).toBeVisible()
  await clean(page, 'desk on a phone')

  await page.setViewportSize(DESK)
  for (const screen of ['/admin', '/admin/library', '/admin/teach', '/admin/feedback', '/admin/access']) {
    await page.goto(`${PORTAL}${screen}`)
    await clean(page, screen)
  }
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
  for (const screen of ['/master', '/master/tiers', '/master/ai', '/master/opening', '/master/sheet']) {
    await page.goto(screen)
    await clean(page, screen)
  }
})

test('desks wear the evening garden: deep teal page and panels, gold buttons', async ({ page }) => {
  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${PORTAL}/admin/library`)
  expect(await bg(page, '.desk')).toBe('rgb(14, 42, 43)')
  expect(await bg(page, '.side')).toBe('rgb(11, 34, 35)')
  expect(await bg(page, '.panel')).toBe('rgb(22, 54, 51)')
  expect(await bg(page, '.panel > header:not(.light)')).toBe('rgb(15, 59, 58)')
  await page.goto(`${PORTAL}/admin/access`)
  expect(await bg(page, '[data-testid="new-code-submit"]')).toBe('rgb(212, 168, 75)')

  for (const screen of ['/admin/access', '/admin/library', '/admin/teach', '/admin/feedback', '/admin/gather', '/admin/gather/attendance']) {
    await page.goto(`${PORTAL}${screen}`)
    for (const open of await page.locator('details:not([open]) > summary').all()) await open.click({ timeout: 2000 }).catch(() => undefined)
    const ratios = await page.evaluate(() => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) || []).map(Number)
      const lum = ([r, g, b]: number[]) => {
        const c = [r, g, b].map((v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
      }
      const backing = (el: Element | null): number[] => {
        for (let at = el; at; at = at.parentElement) {
          const [r, g, b, a = 1] = rgb(getComputedStyle(at).backgroundColor)
          if (a > 0.5) return [r, g, b]
        }
        return [255, 255, 255]
      }
      const pick = '.main-head h1, .main-head p, .panel h2, .panel > header p, .hint, .tree-door-name, .side a.nav, .badge, .btn, table.data th, table.data td'
      return [...document.querySelectorAll<HTMLElement>(pick)].filter((el) => el.offsetParent && el.textContent?.trim()).map((el) => {
        const [hi, lo] = [lum(rgb(getComputedStyle(el).color)), lum(backing(el))].sort((x, y) => y - x)
        return { text: `${el.className} ${el.textContent!.trim().slice(0, 24)} ${getComputedStyle(el).color} on ${backing(el).join(',')}`, ratio: (hi + 0.05) / (lo + 0.05) }
      })
    })
    expect(ratios.length, screen).toBeGreaterThan(5)
    for (const row of ratios) expect(row.ratio, `${screen} ${row.text} ${row.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
  }

  await page.goto(`${PORTAL}/admin/teach`)
  const spill = await page.evaluate(() => {
    const wrap = document.querySelector<HTMLElement>('[data-testid="admin-teach"] .table-wrap')!
    const edge = wrap.getBoundingClientRect().right
    return { scroll: wrap.scrollWidth - wrap.clientWidth, past: Math.max(...[...wrap.querySelectorAll('td')].map((cell) => cell.getBoundingClientRect().right - edge)) }
  })
  expect(spill.scroll, 'the learners table fits its card at 1440').toBeLessThanOrEqual(1)
  expect(spill.past).toBeLessThanOrEqual(1)
})

test('the library puts each course on the door its clips carry', async ({ page }) => {
  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const all = async (collection: string) => ((await (await master.get(`/api/${collection}?limit=2000&depth=0`)).json()).docs as Record<string, unknown>[])
  const [lessons, cuts] = await Promise.all([all('lessons'), all('cuts')])
  await master.dispose()
  const courseOf = new Map(lessons.map((lesson) => [Number(lesson.id), Number(lesson.course)]))
  const doorsOf = new Map<number, Set<string>>()
  for (const cut of cuts) {
    const door = doorNumberOfClause(Number(cut.bestClause || 0))
    const course = courseOf.get(Number(cut.lesson))
    if (!door || !course) continue
    doorsOf.set(course, (doorsOf.get(course) || new Set()).add(doorCode(door)))
  }
  expect(doorsOf.size).toBeGreaterThan(0)

  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${PORTAL}/admin/library`)
  const placed: { course: number; door: string }[] = []
  for (const href of await page.getByTestId('pack-fold').evaluateAll((links) => links.map((link) => link.getAttribute('href') || ''))) {
    await page.goto(href)
    const opened = page.getByTestId('pack-open')
    await expect(opened).toBeVisible()
    const tiles = opened.locator('[data-testid=door-tile][data-empty=no]')
    for (let index = 0; index < (await tiles.count()); index += 1) {
      await tiles.nth(index).click()
      const door = opened.getByTestId('door-open')
      await expect(door).toBeVisible()
      const key = (await door.getAttribute('data-door')) || ''
      for (const course of await door.getByTestId('pack-course').evaluateAll((rows) => rows.map((row) => Number(row.getAttribute('data-course'))))) {
        placed.push({ course, door: key === 'other' ? 'Other' : key })
      }
    }
  }
  expect(placed.length).toBeGreaterThan(3)
  for (const row of placed) {
    const carried = doorsOf.get(row.course)
    if (carried) expect([...carried], `course ${row.course} sits in ${row.door}`).toContain(row.door)
    else expect(row.door, `course ${row.course} has no clip on a door`).toBe('Other')
  }
  expect(placed.filter((row) => row.door !== 'Other').length).toBeGreaterThan(0)
})
