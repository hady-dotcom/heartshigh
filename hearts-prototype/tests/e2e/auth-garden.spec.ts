import { expect, test, type Browser, type Page } from '@playwright/test'
import { seedCode } from '../env'

// Leon's review: the door, join and sign-in pages are the evening garden at any hour, never the pale cream card.

const FIELD = 'rgb(16, 46, 44)'
const GOLD_LINE = 'rgb(196, 146, 58)'
const GOLD = 'rgb(212, 168, 75)'
const SIZES = [{ name: 'phone', width: 390, height: 844 }, { name: 'desk', width: 1440, height: 900 }] as const
const HOURS = [{ name: 'dawn', at: '2026-10-04T08:00:00+01:00' }, { name: 'evening', at: '2026-10-04T20:30:00+01:00' }] as const

async function open(browser: Browser, size: (typeof SIZES)[number], at: string, path: string) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, timezoneId: 'Europe/London' })
  const page = await context.newPage()
  await page.clock.setFixedTime(new Date(at))
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  return page
}

function luminance(rgb: string) {
  const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) || ['255', '255', '255']).slice(0, 3).map(Number)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

async function looksLikeTheGarden(page: Page, main: string) {
  const look = await page.getByTestId(main).evaluate((el) => {
    const css = (node: Element, pseudo?: string) => getComputedStyle(node, pseudo)
    const card = el.querySelector('.door-card')!
    const mark = el.querySelector('.brand-mark')!
    const button = el.querySelector('.pill.gold')!
    return {
      bg: css(el).backgroundColor,
      art: css(el, '::before').backgroundImage,
      blur: css(el, '::before').filter,
      shade: css(el, '::after').backgroundImage,
      card: css(card).backgroundImage,
      cardBg: css(card).backgroundColor,
      cardInk: css(card).color,
      cardWidth: card.getBoundingClientRect().width,
      mark: css(mark).color,
      markDisc: css(mark).backgroundImage,
      word: el.querySelector('.brand-word')?.textContent,
      wordColour: css(el.querySelector('.brand-word')!).color,
      button: css(button).backgroundColor,
      buttonInk: css(button).color,
      fields: [...el.querySelectorAll('.field')].map((field) => ({ bg: css(field).backgroundColor, border: css(field).borderTopColor })),
    }
  })
  expect(luminance(look.bg), 'the page behind the card is deep teal').toBeLessThan(0.25)
  expect(look.art).toContain('/theme/evening-courtyard.jpg')
  expect(look.blur).toContain('blur')
  expect(look.shade).toContain('rgba(10, 40, 40')
  expect(look.mark).toBe(GOLD)
  expect(look.markDisc).toContain('radial-gradient')
  expect(look.word).toBe('Hady Core')
  expect(look.button).toBe(GOLD)
  expect(luminance(look.buttonInk)).toBeLessThan(0.15)
  expect(look.cardWidth, 'the garden card stays compact').toBeLessThanOrEqual(380)
  expect(luminance(look.cardBg), 'door card is evening teal, not parchment').toBeLessThan(0.3)
  expect(luminance(look.cardInk), 'cream type on the evening card').toBeGreaterThan(0.7)
  expect(luminance(look.wordColour)).toBeGreaterThan(0.7)
  for (const field of look.fields) {
    expect(field.bg).toBe(FIELD)
    expect(field.border).toBe(GOLD_LINE)
  }
}

for (const size of SIZES) {
  for (const hour of HOURS) {
    test(`join with the code in the link is the evening garden (${size.name}, ${hour.name})`, async ({ browser }) => {
      const code = seedCode('elm-learner')
      const page = await open(browser, size, hour.at, `/join?code=${code}&from=Aisha`)
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'evening')
      await expect(page.getByRole('heading', { name: 'Come in' })).toBeVisible()
      await expect(page.getByText('Your code is already filled in. Add your name, email and a password to join.')).toBeVisible()
      await expect(page.getByTestId('join-code')).toHaveValue(code)
      await expect(page.getByTestId('join-submit')).toHaveText('Join')
      await expect(page.getByTestId('join-pitch')).toContainText('Idris from East London Mosque invited you')
      await looksLikeTheGarden(page, 'join')
      const card = (await page.locator('.door-card').boundingBox())!
      expect(card.width).toBeLessThanOrEqual(380)
      expect(card.x).toBeGreaterThanOrEqual(0)
      expect(card.x + card.width).toBeLessThanOrEqual(size.width)
      if (process.env.AUTH_SHOTS) await page.screenshot({ path: `${process.env.AUTH_SHOTS}/auth-join-${size.name}-${hour.name}.png`, fullPage: true })
      await page.context().close()
    })

    test(`sign-in is the evening garden (${size.name}, ${hour.name})`, async ({ browser }) => {
      const page = await open(browser, size, hour.at, '/login')
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'evening')
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
      await expect(page.getByTestId('login-submit')).toHaveText('Sign in')
      await looksLikeTheGarden(page, 'login')
      if (process.env.AUTH_SHOTS) await page.screenshot({ path: `${process.env.AUTH_SHOTS}/auth-login-${size.name}-${hour.name}.png`, fullPage: true })
      await page.context().close()
    })
  }
}

test('the front door is the evening garden too, and signing in from the garden page still works', async ({ browser }) => {
  const page = await open(browser, SIZES[0], HOURS[0].at, '/')
  await expect(page.getByRole('heading', { name: 'Someone wanted good for you' })).toBeVisible()
  await looksLikeTheGarden(page, 'door')
  await page.getByTestId('door-login').click()
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await page.context().close()
})

test('a portal named Hearts shows as Hady Core on the master desk; its slug stays as typed', async ({ page }) => {
  const sfx = Date.now().toString(36).slice(-5)
  const slug = `hearts-${sfx}`
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login?next=/master')
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('master')).toBeVisible()
  await page.getByTestId('create-portal-name').fill(`Hearts ${sfx}`)
  await page.getByTestId('create-portal-slug').fill(slug)
  await page.getByTestId('create-portal-submit').click()
  await expect(page.getByTestId('notice')).toBeVisible()
  const card = page.getByTestId('portal-card').filter({ hasText: `/p/${slug}` })
  await expect(card).toContainText(`Hady Core ${sfx}`)
  await expect(card).not.toContainText(`Hearts ${sfx}`)
  await expect(page.getByTestId('code-portal').locator(`option[value="${slug}"]`)).toHaveText(`Hady Core ${sfx}`)
})
