import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

/**
 * Visual gate only. The default `npm run test:e2e` config ignores this file
 * so the rest of the suite stays on one browser.
 * Projects: Chromium and WebKit at phone and desk, plus mobile Chrome.
 */
export default defineConfig({
  ...base,
  testMatch: '**/visual-qa.spec.ts',
  testIgnore: [],
  timeout: 600_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  projects: [
    { name: 'chromium-phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'chromium-desk', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'webkit-phone', use: { ...devices['Desktop Safari'], viewport: { width: 390, height: 844 } } },
    { name: 'webkit-desk', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
  ],
})
