import { expect, test, type Page } from '@playwright/test'

const PHONE = { width: 390, height: 844 }

const AUTH = ['/login?next=/p/parenting', '/forgot', '/join', '/reset', '/']
const GUEST = ['/p/parenting/courses', '/p/parenting/week', '/p/parenting/me']

const BANNED = new Set([
  'rgb(15, 59, 58)',
  'rgb(14, 47, 46)',
  'rgb(16, 46, 44)',
  'rgb(22, 54, 51)',
  'rgb(31, 77, 58)',
  'rgb(224, 122, 95)',
  'rgb(212, 168, 75)',
  'rgb(224, 177, 90)',
  'rgb(196, 146, 58)',
])

async function oldTheme(page: Page) {
  return page.evaluate((banned) => {
    const hits: string[] = []
    const visible = (el: Element) => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      const rect = el.getBoundingClientRect()
      return rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.top < window.innerHeight
    }
    const body = document.body
    const bgImage = `${getComputedStyle(body).backgroundImage} ${getComputedStyle(document.documentElement).backgroundImage}`
    if (/evening-courtyard|lattice\.svg/i.test(bgImage)) hits.push('courtyard image')
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue
      const cs = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if (rect.width * rect.height > 4000 && banned.includes(cs.backgroundColor)) {
        hits.push(`${cs.backgroundColor} ${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`)
      }
      if (rect.width * rect.height > 2000 && banned.includes(cs.color)) {
        hits.push(`ink ${cs.color} ${el.tagName.toLowerCase()}`)
      }
    }
    const heading = [...document.querySelectorAll('h1')].find((el) => visible(el))
    const family = heading ? getComputedStyle(heading).fontFamily.toLowerCase() : ''
    if (/cormorant|garamond|caslon/.test(family)) hits.push(`serif heading ${family}`)
    return hits.slice(0, 8)
  }, [...BANNED])
}

test('auth, guest and parenting pages stay on the white and blue tokens', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(PHONE)
  const problems: string[] = []
  for (const path of [...AUTH, ...GUEST]) {
    await page.goto(path)
    await page.waitForTimeout(400)
    const hits = await oldTheme(page)
    if (hits.length) problems.push(`${path}: ${hits.join('; ')}`)
  }
  await page.goto('/login?next=/p/parenting/admin')
  await page.getByTestId('login-email').fill('parenting-admin@hearts.test')
  await page.getByTestId('login-password').fill('portal-admin')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  for (const path of ['/p/parenting/admin', '/p/parenting/courses', '/p/parenting/admin/teach']) {
    await page.goto(path)
    await page.waitForTimeout(400)
    const hits = await oldTheme(page)
    if (hits.length) problems.push(`${path}: ${hits.join('; ')}`)
  }
  expect(problems, problems.join('\n')).toEqual([])
})
