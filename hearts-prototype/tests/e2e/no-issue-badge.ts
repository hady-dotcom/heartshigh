import { expect, type Page } from '@playwright/test'

/**
 * Next.js 15 always mounts <nextjs-portal> in `next dev`. The red badge is the
 * `[data-next-badge][data-error=true]` node inside its shadow root.
 */
export async function noIssueBadge(page: Page) {
  const badge = page.locator('[data-next-badge][data-error="true"]')
  await expect(badge, 'the Next.js 1 Issue badge must not appear').toHaveCount(0)
}
