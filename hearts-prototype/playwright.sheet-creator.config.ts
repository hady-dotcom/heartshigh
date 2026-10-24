import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { E2E_BASE, E2E_DATABASE, E2E_PORT } from './tests/env'

process.env.DATABASE_URL = E2E_DATABASE
process.env.HEARTS_E2E = process.env.HEARTS_E2E || '1'

const env = { ...process.env } as Record<string, string>
delete env.HEARTS_SEARCH_FIXTURE
delete env.HEARTS_TRANSCRIPT_FIXTURE
env.HEARTS_TEST_CLOCK = '1'
env.HEARTS_E2E = '1'
env.DATABASE_URL = E2E_DATABASE
env.HEARTS_DIST_DIR = '.next-sheet'
env.HEARTS_TRUSTED_PROXY_HOPS = '1'
env.YT_DLP_PATH = path.resolve('tests/fixtures/sheet-creator/yt-dlp.mjs')

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'sheet-creator-ytdlp.spec.ts',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: E2E_BASE,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: `npx next dev --hostname 127.0.0.1 --port ${E2E_PORT}`,
    url: `${E2E_BASE}/api/hearts`,
    reuseExistingServer: false,
    timeout: 240_000,
    env,
  },
})
