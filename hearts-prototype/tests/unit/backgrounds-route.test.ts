import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GET } from '../../src/app/(frontend)/backgrounds/[...path]/route'
import { CATALOGUE, backgroundKey, backgroundSrc } from '../../src/lib/backgrounds'

const BASE = 'https://heartshigh-production.up.railway.app'
const S3_ENV = {
  S3_BUCKET: 'hearts-bucket',
  S3_ACCESS_KEY_ID: 'test-access-key',
  S3_SECRET_ACCESS_KEY: 'test-secret-key',
  S3_ENDPOINT: 'https://storage.example.test',
  S3_REGION: 'auto',
}
const S3_NAMES = [...Object.keys(S3_ENV), 'AWS_S3_BUCKET_NAME', 'BUCKET', 'AWS_ACCESS_KEY_ID', 'ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'SECRET_ACCESS_KEY', 'AWS_ENDPOINT_URL', 'ENDPOINT']

async function withEnv<T>(values: Record<string, string>, run: () => Promise<T>) {
  const saved = Object.fromEntries(S3_NAMES.map((name) => [name, process.env[name]]))
  for (const name of S3_NAMES) delete process.env[name]
  Object.assign(process.env, values)
  try {
    return await run()
  } finally {
    for (const name of S3_NAMES) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
  }
}

const call = (path: string[]) => GET(new Request(`${BASE}/backgrounds/${path.join('/')}`), { params: Promise.resolve({ path }) })
const basename = (file: string) => file.split('/').pop()!

test('every catalogue row is written jpg/<basename> and resolves to backgrounds/jpg/<basename>', () => {
  assert.equal(CATALOGUE.length, 240)
  assert.equal(new Set(CATALOGUE.map((row) => basename(row.file))).size, 240)
  for (const row of CATALOGUE) {
    assert.match(row.file, /^jpg\/[A-Za-z0-9][A-Za-z0-9._-]*\.jpg$/, row.file)
    const key = `backgrounds/jpg/${basename(row.file)}`
    assert.equal(backgroundKey(row.file), key)
    assert.equal(backgroundKey(basename(row.file)), key)
    const src = backgroundSrc(row.file, BASE)!
    assert.equal(src, `${BASE}/backgrounds/${row.file}`)
    const path = new URL(src).pathname.replace(/^\/backgrounds\//, '').split('/')
    assert.equal(backgroundKey(path), key, 'the URL the app builds is the one the route serves')
  }
  for (const slice of ['A', 'B', 'C', 'D-place', 'D-texture']) assert.ok(CATALOGUE.some((row) => row.slice === slice), slice)
})

test('the route redirects every catalogue still to a short-lived signed GET for backgrounds/jpg/<basename>', async () => {
  await withEnv(S3_ENV, async () => {
    for (const row of CATALOGUE) {
      const response = await call(row.file.split('/'))
      assert.equal(response.status, 302, row.file)
      assert.equal(response.headers.get('cache-control'), 'public, max-age=600, s-maxage=600')
      const location = new URL(response.headers.get('location')!)
      assert.equal(location.origin, 'https://storage.example.test')
      assert.ok(location.pathname.endsWith(`/backgrounds/jpg/${basename(row.file)}`), location.pathname)
      assert.ok(location.pathname.includes('hearts-bucket') || location.hostname.startsWith('hearts-bucket'))
      assert.ok(location.searchParams.get('X-Amz-Signature'))
      assert.equal(location.searchParams.get('X-Amz-Expires'), '3600')
    }
    const bare = await call([basename(CATALOGUE[90].file)])
    assert.equal(bare.status, 302)
    assert.ok(new URL(bare.headers.get('location')!).pathname.endsWith(`/backgrounds/jpg/${basename(CATALOGUE[90].file)}`))
  })
})

test('unknown names and anything shaped like a path escape are a 404', async () => {
  const known = basename(CATALOGUE[0].file)
  const bad = [
    [],
    ['nope.jpg'],
    ['jpg', 'nope.jpg'],
    ['jpg', `${known}.png`],
    ['jpg', known.toUpperCase()],
    ['other', known],
    ['jpg', 'jpg', known],
    ['..', '..', 'etc', 'passwd'],
    ['jpg', '..', known],
    ['..', known],
    ['%2e%2e', known],
    ['jpg', `..${known}`],
    ['jpg', `${known}\0`],
    ['jpg', `sub\\${known}`],
    ['jpg', ''],
    ['media', 'secret.jpg'],
  ]
  await withEnv(S3_ENV, async () => {
    for (const path of bad) {
      assert.equal(backgroundKey(path), null, JSON.stringify(path))
      const response = await call(path)
      assert.equal(response.status, 404, JSON.stringify(path))
      assert.equal(response.headers.get('location'), null)
      assert.equal(response.headers.get('cache-control'), 'no-store')
    }
  })
  assert.equal(backgroundKey('../../etc/passwd'), null)
  assert.equal(backgroundKey(null), null)
})

test('without bucket settings the route is a 404, and without BACKGROUNDS_BASE_URL no bucket link is built', async () => {
  await withEnv({}, async () => {
    assert.equal((await call(CATALOGUE[0].file.split('/'))).status, 404)
  })
  assert.equal(backgroundSrc(CATALOGUE[0].file, null), null)
  assert.equal(backgroundSrc(CATALOGUE[0].file, ''), null)
})
