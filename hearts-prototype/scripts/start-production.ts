import { spawn } from 'node:child_process'
import { assertProductionEnv, DEMO_EMAIL_SUFFIX, isProduction } from '../src/lib/env'
import { logError } from '../src/lib/log'
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { platformClientIpHeader, trustedProxyHops } from '../src/lib/rate-limit'

process.on('unhandledRejection', (error) => {
  logError('unhandledRejection', error)
  process.exit(1)
})
process.on('uncaughtException', (error) => {
  logError('uncaughtException', error)
  process.exit(1)
})

if (!isProduction()) {
  console.error('npm start is the production server. On your own computer, use npm run dev.')
  process.exit(1)
}

try {
  assertProductionEnv(process.env, { hops: trustedProxyHops(), platformHeader: platformClientIpHeader() })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const demo = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { email: { like: DEMO_EMAIL_SUFFIX } },
  })
  if (demo.totalDocs) {
    console.error(
      'Hady Core cannot start: this database still has demo accounts (addresses ending in @hearts.test, such as master@hearts.test). Those accounts use passwords that are written in the README. Remove them before hosting this for real people. Nothing was started.',
    )
    process.exit(1)
  }
} finally {
  await closePayload(payload)
}

const port = process.env.PORT || '3000'
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '0.0.0.0', '-p', port], {
  stdio: 'inherit',
  env: process.env,
})
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => child.kill(signal))
}
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
