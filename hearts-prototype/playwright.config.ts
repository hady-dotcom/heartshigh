import { defineConfig, devices } from '@playwright/test'
import { E2E_BASE, E2E_DATABASE, E2E_PORT } from './tests/env'

// Default DATABASE_URL: E2E_DATABASE (the sqlite file). HEARTS_E2E_DATABASE can point at Postgres.
const e2eDatabase = process.env.HEARTS_E2E_DATABASE || E2E_DATABASE
process.env.DATABASE_URL = e2eDatabase

// The suite starts its own server on its own port with the test clock on, so a `npm run go` server on :3000
// (which runs without the test clock) is never picked up by mistake. HEARTS_E2E_REUSE=1 reuses a server that is
// already on the test port; global setup then refuses to run unless that server has the test clock on.

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: E2E_BASE,
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: `npx next dev --hostname 127.0.0.1 --port ${E2E_PORT}`,
    url: `${E2E_BASE}/api/hearts`,
    reuseExistingServer: process.env.HEARTS_E2E_REUSE === '1',
    timeout: 240_000,
    env: {
      ...process.env,
      HEARTS_TEST_CLOCK: '1',
      HEARTS_E2E: '1',
      DATABASE_URL: e2eDatabase,
      DATABASE_ADAPTER: /^postgres/i.test(e2eDatabase) ? 'postgres' : 'sqlite',
      HEARTS_DIST_DIR: process.env.HEARTS_DIST_DIR || '.next-e2e',
      HEARTS_TRUSTED_PROXY_HOPS: '1',
      HEARTS_SEARCH_FIXTURE: 'tests/fixtures/youtube-search.json',
      HEARTS_TRANSCRIPT_FIXTURE: 'tests/fixtures/transcripts.json',
      HEARTS_MAIL_CATCHER: '1',
    } as Record<string, string>,
  },
})
