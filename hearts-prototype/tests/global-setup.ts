import { execSync } from 'node:child_process'
import { E2E_BASE, E2E_DATABASE } from './env'

async function serverClock() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`${E2E_BASE}/api/hearts`)
      if (response.ok) return ((await response.json()) as { testClock?: boolean }).testClock === true
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`No server answered at ${E2E_BASE}.`)
}

export default async function setup() {
  const database = process.env.HEARTS_E2E_DATABASE || E2E_DATABASE
  execSync('npx tsx src/seed/seed.ts --reset', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: database,
      DATABASE_ADAPTER: /^postgres/i.test(database) ? 'postgres' : 'sqlite',
      HEARTS_E2E: '1',
    },
  })
  if (!(await serverClock())) {
    throw new Error(`The server at ${E2E_BASE} is running without HEARTS_TEST_CLOCK=1. Stop it, or let the tests start their own server (unset HEARTS_E2E_REUSE).`)
  }
}
