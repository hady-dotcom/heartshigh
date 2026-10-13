import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const port = Number(process.env.HEARTS_BRING_IN_PORT || 3211)
const database = process.env.HEARTS_BRING_IN_DATABASE || 'file:./data/hearts-bring-in.db'
const base = `http://127.0.0.1:${port}`
const fixture = path.join(process.cwd(), 'tests/fixtures/bring-in/yt-dlp.mjs')

process.env.HEARTS_E2E = '1'
process.env.HEARTS_E2E_PORT = String(port)
process.env.HEARTS_E2E_DATABASE = database
process.env.DATABASE_URL = database

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'bring-in-round2.spec.ts',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: base,
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: `npx next dev --hostname 127.0.0.1 --port ${port}`,
    url: `${base}/api/hearts`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ...process.env,
      HEARTS_TEST_CLOCK: '1',
      HEARTS_E2E: '1',
      DATABASE_URL: database,
      HEARTS_DIST_DIR: '.next-bring-in',
      HEARTS_TRUSTED_PROXY_HOPS: '1',
      HEARTS_SEARCH_FIXTURE: 'tests/fixtures/youtube-search.json',
      HEARTS_TRANSCRIPT_FIXTURE: 'tests/fixtures/transcripts.json',
      YT_DLP_PATH: fixture,
      YT_DLP_ROLE: 'server',
      HEARTS_CAPTION_BOT_WALL: '1',
      HEARTS_YT_FIXTURE: '1',
    } as Record<string, string>,
  },
})
