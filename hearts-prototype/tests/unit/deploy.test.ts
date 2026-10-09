import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { securityHeaders } from '../../security-headers.mjs'
import { authCookie } from '../../src/lib/cookies'
import {
  bootstrapIdentity,
  cookiesSecure,
  databaseKind,
  demoAccountsBlockBoot,
  DEMO_PASSWORDS,
  DEV_SECRET,
  isPreviewEnvironment,
  payloadSecret,
  productionProblems,
  readS3,
  seedRefusal,
  serverURL,
} from '../../src/lib/env'
import { clientIp, platformClientIpHeader, trustedProxyHops } from '../../src/lib/rate-limit'

const root = process.cwd()
const secret = 'a'.repeat(40)
const prod = {
  NODE_ENV: 'production',
  PAYLOAD_SECRET: secret,
  DATABASE_URL: 'postgres://hearts:hearts@postgres:5432/hearts',
  DATABASE_ADAPTER: 'postgres',
  S3_BUCKET: 'hearts-media',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_ENDPOINT: 'https://t3.storageapi.dev',
  S3_REGION: 'auto',
  SERVER_URL: 'https://hearts.example.com',
  HEARTS_TRUSTED_PROXY_HOPS: '1',
}

test('SQLite stays the default, and a postgres address selects Postgres', () => {
  assert.equal(databaseKind({}), 'sqlite')
  assert.equal(databaseKind({ DATABASE_URL: 'file:./data/hearts.db' }), 'sqlite')
  assert.equal(databaseKind({ DATABASE_URL: 'postgres://localhost/hearts' }), 'postgres')
  assert.equal(databaseKind({ DATABASE_URL: 'postgresql://localhost/hearts' }), 'postgres')
  assert.equal(databaseKind({ DATABASE_ADAPTER: 'sqlite', DATABASE_URL: 'postgres://localhost/hearts' }), 'sqlite')
})

test('production refuses to start until the secret, Postgres, bucket, address and proxy are set', () => {
  assert.deepEqual(productionProblems(prod, { hops: 1, platformHeader: null }), [])
  const missing = productionProblems({ NODE_ENV: 'production' }, { hops: 0, platformHeader: null })
  assert.ok(missing.some((line) => line.includes('PAYLOAD_SECRET')))
  assert.ok(missing.some((line) => line.includes('Postgres')))
  assert.ok(missing.some((line) => line.includes('bucket')))
  assert.ok(missing.some((line) => line.includes('SERVER_URL')))
  assert.ok(missing.some((line) => line.includes('HEARTS_TRUSTED_PROXY_HOPS')))
  const demoSecret = productionProblems({ ...prod, PAYLOAD_SECRET: 'hearts-master' }, { hops: 1, platformHeader: null })
  assert.ok(demoSecret.some((line) => line.includes('demo password')))
  const push = productionProblems({ ...prod, HEARTS_DB_PUSH: '1' }, { hops: 1, platformHeader: null })
  assert.ok(push.some((line) => line.includes('HEARTS_DB_PUSH')))
})

test('Railway bucket variable names are accepted, and local disk is used when they are absent', () => {
  assert.equal(readS3({}), null)
  const railway = readS3({ BUCKET: 'b', ACCESS_KEY_ID: 'k', SECRET_ACCESS_KEY: 's', REGION: 'auto', ENDPOINT: 'https://t3.storageapi.dev' })
  assert.equal(railway?.bucket, 'b')
  assert.equal(railway?.forcePathStyle, false)
  const minio = readS3({ S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's', S3_ENDPOINT: 'http://minio:9000' })
  assert.equal(minio?.forcePathStyle, true)
})

test('production cookies are always Secure, and local cookies are not', () => {
  assert.equal(cookiesSecure({ NODE_ENV: 'production' }), true)
  assert.equal(cookiesSecure({ NODE_ENV: 'production', HEARTS_COOKIE_SECURE: '0' }), true)
  assert.equal(cookiesSecure({ NODE_ENV: 'development' }), false)
  assert.match(authCookie('payload-token', 'abc', 10, { NODE_ENV: 'production' }), /Secure/)
  assert.doesNotMatch(authCookie('payload-token', 'abc', 10, { NODE_ENV: 'development' }), /Secure/)
  assert.match(authCookie('payload-token', 'abc', 10, { NODE_ENV: 'production' }), /HttpOnly/)
})

test('demo passwords cannot be the first admin, and production cannot be wiped or seeded with them', () => {
  for (const password of DEMO_PASSWORDS) {
    assert.ok(bootstrapIdentity({ BOOTSTRAP_ADMIN_EMAIL: 'owner@example.com', BOOTSTRAP_ADMIN_PASSWORD: password }).problems.length > 0)
  }
  assert.deepEqual(bootstrapIdentity({ BOOTSTRAP_ADMIN_EMAIL: 'owner@example.com', BOOTSTRAP_ADMIN_PASSWORD: 'a-real-passphrase' }).problems, [])
  assert.match(seedRefusal(['--reset'], prod) || '', /wipe/)
  assert.match(seedRefusal([], prod) || '', /demo accounts/)
  assert.equal(seedRefusal(['--starters'], prod), null)
  assert.equal(seedRefusal(['--reset'], { NODE_ENV: 'development', DATABASE_URL: 'file:./data/hearts.db' }), null)
  assert.match(seedRefusal(['--reset'], { NODE_ENV: 'development', DATABASE_URL: 'postgres://u:p@db.example.com:5432/hearts' }) || '', /not on this computer/)
})

test('a platform header is used instead of a spoofed X-Forwarded-For', () => {
  const req = new Request('http://local/api', { headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9', 'fly-client-ip': '203.0.113.8', 'x-real-ip': '6.6.6.6' } })
  assert.equal(platformClientIpHeader({ HEARTS_CLIENT_IP_HEADER: 'x-forwarded-for' }), null)
  assert.equal(platformClientIpHeader({ HEARTS_CLIENT_IP_HEADER: 'x-real-ip' }), null)
  assert.equal(platformClientIpHeader({ FLY_APP_NAME: 'hearts' }), 'fly-client-ip')
  assert.equal(clientIp(req, 1, { HEARTS_CLIENT_IP_HEADER: 'fly-client-ip' }), '203.0.113.8')
  assert.equal(clientIp(req, 1, { FLY_APP_NAME: 'hearts' }), '203.0.113.8')
  assert.equal(trustedProxyHops({ RAILWAY_PROJECT_ID: 'abc' }), 1)
  assert.equal(trustedProxyHops({ RAILWAY_PROJECT_ID: 'abc', HEARTS_TRUSTED_PROXY_HOPS: '0' }), 0)
  assert.equal(trustedProxyHops({ RENDER_SERVICE_ID: 'srv' }), 1)
  assert.equal(clientIp(req, trustedProxyHops({ RAILWAY_PROJECT_ID: 'abc' }), {}), '9.9.9.9')
  assert.equal(serverURL(prod), 'https://hearts.example.com')
})

test('security headers are set, and they do not trust a frame from another site', () => {
  const headers = Object.fromEntries(securityHeaders.map((header) => [header.key, header.value]))
  assert.equal(headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(headers['X-Frame-Options'], 'DENY')
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/)
  assert.match(headers['Content-Security-Policy'], /youtube-nocookie/)
  assert.match(headers['Content-Security-Policy'], /challenges\.cloudflare\.com/)
  assert.match(headers['Strict-Transport-Security'], /max-age=/)
  assert.match(readFileSync(path.join(root, 'next.config.mjs'), 'utf8'), /securityHeaders/)
})

test('preview may boot with leftover @hearts.test accounts; production still refuses', () => {
  assert.equal(isPreviewEnvironment({ RAILWAY_ENVIRONMENT: 'preview' }), true)
  assert.equal(isPreviewEnvironment({ HEARTS_ENV: 'preview' }), true)
  assert.equal(isPreviewEnvironment({ RAILWAY_ENVIRONMENT: 'production' }), false)
  assert.equal(isPreviewEnvironment({ NODE_ENV: 'production' }), false)
  assert.equal(demoAccountsBlockBoot({ RAILWAY_ENVIRONMENT: 'preview' }), false)
  assert.equal(demoAccountsBlockBoot({ HEARTS_ENV: 'preview' }), false)
  assert.equal(demoAccountsBlockBoot({ NODE_ENV: 'production', RAILWAY_ENVIRONMENT: 'production' }), true)
  assert.equal(demoAccountsBlockBoot({ NODE_ENV: 'production' }), true)
})

test('production startup does not seed, and dev startup refuses to seed when NODE_ENV is production', () => {
  const start = readFileSync(path.join(root, 'scripts/start-production.ts'), 'utf8')
  assert.doesNotMatch(start, /seed\.ts/)
  assert.match(start, /@hearts\.test/)
  assert.match(start, /demoAccountsBlockBoot/)
  const run = (script: string) => {
    try {
      execFileSync(process.execPath, [script], { cwd: root, env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' })
      return 0
    } catch (error) {
      const failed = error as { status?: number; stderr?: string; stdout?: string }
      return { status: failed.status, text: `${failed.stdout || ''}${failed.stderr || ''}` }
    }
  }
  const ensure = run('scripts/ensure-seed.mjs')
  assert.notEqual(ensure, 0)
  assert.match(String(ensure && ensure.text), /production/)
  const setup = run('scripts/setup.mjs')
  assert.notEqual(setup, 0)
  assert.match(String(setup && setup.text), /production/)
})

test('the Dockerfile bakes no secret or database address into the image', () => {
  const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8')
  const declared = dockerfile.split('\n').filter((line) => /^\s*(ARG|ENV)\s/i.test(line))
  for (const line of declared) assert.doesNotMatch(line, /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL/i, line)
  assert.doesNotMatch(dockerfile, /build-time-placeholder/)
  assert.match(dockerfile, /npm run build[\s\S]*rm -rf data/, 'the throwaway build database does not ship')
  assert.equal(payloadSecret({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' }).length > 0, true, 'next build compiles with no secret set')
  assert.throws(() => payloadSecret({ NODE_ENV: 'production' }), /PAYLOAD_SECRET/, 'the running server never falls back to it')
  assert.throws(() => payloadSecret({ NODE_ENV: 'production', PAYLOAD_SECRET: DEV_SECRET }), /sample value/)
})

test('uploaded files go to a private bucket and are fetched with short signed links', () => {
  const config = readFileSync(path.join(root, 'src/payload.config.ts'), 'utf8')
  assert.match(config, /acl:\s*'private'/)
  assert.match(config, /signedDownloads:\s*\{\s*expiresIn:\s*300/)
  assert.match(config, /collections:\s*\{\s*media:\s*\{\s*signedDownloads:\s*\{\s*expiresIn:\s*300/)
})

test('the latest Postgres migration has a table for every collection and global', async () => {
  const { readdirSync } = await import('node:fs')
  const { collections } = await import('../../src/collections')
  const { aiCollections } = await import('../../src/collections-ai')
  const { MasterFlags } = await import('../../src/collections-opening')
  const { sheetCollections } = await import('../../src/collections-sheet')
  const { experimentCollections } = await import('../../src/collections-experiments')
  const { insightCollections } = await import('../../src/collections-insights')
  const { calendarCollections } = await import('../../src/collections-calendar')
  const { missionCollections } = await import('../../src/collections-missions')
  const { gatherCollections } = await import('../../src/collections-gather')
  const { liveCollections } = await import('../../src/collections-live')
  const { safetyCollections } = await import('../../src/collections-safety')
  const dir = path.join(root, 'src/migrations')
  const files = readdirSync(dir)
  const stamps = files.filter((name) => /\.ts$/.test(name) && name !== 'index.ts').map((name) => name.slice(0, 15))
  assert.equal(stamps.length, new Set(stamps).size, `migration timestamps must be unique: ${stamps.join(', ')}`)
  const ts = files.filter((name) => name.endsWith('.ts') && name !== 'index.ts').sort()
  const newest = ts.at(-1)!.replace(/\.ts$/, '')
  assert.equal(files.includes(`${newest}.json`), true, `the newest migration needs a snapshot for migrate:create; ${newest}.json is missing`)
  const latest = files.filter((name) => name.endsWith('.json')).sort().at(-1)!
  const tables = new Set(Object.keys(JSON.parse(readFileSync(path.join(dir, latest), 'utf8')).tables).map((name) => name.replace(/^public\./, '')))
  const slugs = [...collections, ...aiCollections, ...sheetCollections, ...experimentCollections, ...insightCollections, ...calendarCollections, ...missionCollections, ...gatherCollections, ...liveCollections, ...safetyCollections, MasterFlags].map((item) => item.slug.replace(/-/g, '_'))
  const missing = slugs.filter((slug) => !tables.has(slug))
  assert.deepEqual(missing, [], `run npx payload migrate:create against Postgres; ${latest} lacks ${missing.join(', ')}`)
})
