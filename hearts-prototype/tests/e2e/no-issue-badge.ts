import { expect, type Page } from '@playwright/test'

/**
 * Next.js 15 always mounts <nextjs-portal> in `next dev`. The red badge is the
 * `[data-next-badge][data-error=true]` node inside its shadow root.
 */
export async function noIssueBadge(page: Page) {
  const issue = await page.evaluate(() => {
    const badge = document.querySelector('nextjs-portal')?.shadowRoot?.querySelector('[data-next-badge]')
    if (badge?.getAttribute('data-error') !== 'true') return ''
    return '1 Issue'
  })
  expect(issue, 'the Next.js 1 Issue badge must not appear').toBe('')
}
