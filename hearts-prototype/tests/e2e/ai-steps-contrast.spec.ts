import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const SHOTS = '/opt/cursor/artifacts'
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const

function channel(value: number) {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(rgb: number[]) {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

function ratio(fg: number[], bg: number[]) {
  const a = luminance(fg)
  const b = luminance(bg)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

async function signIn(page: Page) {
  await page.goto('/login?next=%2Fp%2Feast-london%2Fadmin%2Fai')
  await page.getByTestId('login-email').fill('elm-admin@hearts.test')
  await page.getByTestId('login-password').fill('portal-admin')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('AI steps stay readable at a laptop and a phone width', async ({ page }) => {
  test.setTimeout(120_000)
  mkdirSync(SHOTS, { recursive: true })
  await signIn(page)

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ ...viewport })
    await page.goto('/p/east-london/admin/ai')
    await expect(page.getByTestId('ai-registry')).toBeVisible()
    await expect(page.getByTestId('desk-narrow')).toBeHidden()
    await expect(page.getByText('In the pipeline')).toHaveCount(0)
    await expect(page.getByTestId('ai-mock-mode')).toContainText('Switch on by connecting your AI account')
    await expect(page.getByTestId('ai-mock-mode')).toContainText('portal admins')
    await expect(page.getByTestId('ai-step')).toHaveCount(13)
    const states = await page.getByTestId('ai-step-state').allTextContents()
    expect(states).toContain('Ready')
    expect(states).toContain('Switch on by connecting your AI account')
    const lines = await page.getByTestId('ai-step-line').allTextContents()
    expect(lines.every((line) => line.trim().length > 0 && !line.includes('\n'))).toBe(true)

    const contrast = await page.evaluate(() => {
      const parse = (value: string) => value.match(/\d+/g)?.slice(0, 3).map(Number) || [0, 0, 0]
      const paint = (el: Element | null) => {
        if (!el) return null
        const style = getComputedStyle(el)
        let node: Element | null = el
        let bg = parse(style.backgroundColor)
        while (node && bg[0] + bg[1] + bg[2] === 0 && style.backgroundColor.endsWith('0)')) {
          node = node.parentElement
          if (!node) break
          bg = parse(getComputedStyle(node).backgroundColor)
        }
        return { fg: parse(style.color), bg, text: (el.textContent || '').trim().slice(0, 80) }
      }
      const step = document.querySelector('[data-testid="ai-step"]')
      return {
        title: paint(step?.querySelector('h2') || null),
        line: paint(step?.querySelector('[data-testid="ai-step-line"]') || null),
        state: paint(document.querySelector('[data-testid="ai-step-state"]')),
        banner: paint(document.querySelector('[data-testid="ai-mock-mode"] b')),
        bannerLine: paint(document.querySelector('[data-testid="ai-mock-mode"] p')),
      }
    })
    for (const [name, sample] of Object.entries(contrast)) {
      expect(sample, name).toBeTruthy()
      expect(ratio(sample!.fg, sample!.bg), `${name} “${sample!.text}” ${sample!.fg} on ${sample!.bg}`).toBeGreaterThanOrEqual(4.5)
    }

    await page.getByTestId('ai-step').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/ai-steps-${viewport.width}x${viewport.height}.png` })
  }
})
