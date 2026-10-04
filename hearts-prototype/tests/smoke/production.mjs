// Checks a running production server. Usage: node tests/smoke/production.mjs http://127.0.0.1:3000
const base = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'owner@example.com'
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'local-proof-passphrase'

function fail(message) {
  console.error(`FAIL ${message}`)
  process.exitCode = 1
}

async function main() {
  const health = await fetch(`${base}/api/health`)
  const healthBody = await health.json()
  console.log('health', health.status, JSON.stringify(healthBody))
  if (!health.ok || healthBody.ok !== true || healthBody.database !== 'postgres' || healthBody.storage !== 's3') {
    fail(`health was ${health.status} ${JSON.stringify(healthBody)}`)
  }
  if (JSON.stringify(healthBody).includes('secret') || JSON.stringify(healthBody).includes(password)) fail('health leaked a secret')

  const loginPage = await fetch(`${base}/login`)
  const headers = loginPage.headers
  console.log('login', loginPage.status)
  for (const name of ['x-content-type-options', 'x-frame-options', 'content-security-policy', 'strict-transport-security', 'referrer-policy']) {
    if (!headers.get(name)) fail(`missing header ${name}`)
  }
  if (headers.get('x-powered-by')) fail('X-Powered-By is present')
  if (!/frame-ancestors 'none'/.test(headers.get('content-security-policy') || '')) fail('CSP does not lock framing')

  const demo = await fetch(`${base}/api/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'master@hearts.test', password: 'hearts-master' }),
  })
  console.log('demo login', demo.status)
  if (demo.ok) fail('the demo master password signed in')

  const session = await fetch(`${base}/api/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const sessionBody = await session.json().catch(() => ({}))
  const setCookie = session.headers.get('set-cookie') || ''
  console.log('bootstrap login', session.status, setCookie.includes('Secure') ? 'cookie Secure' : 'cookie not Secure')
  if (!session.ok || !sessionBody.token) fail(`bootstrap login failed: ${session.status}`)
  if (!/HttpOnly/i.test(setCookie) || !/Secure/i.test(setCookie)) fail(`session cookie flags: ${setCookie}`)

  const auth = { authorization: `JWT ${sessionBody.token}` }
  const clauses = await fetch(`${base}/api/clauses?limit=1`, { headers: auth })
  const clauseBody = await clauses.json().catch(() => ({}))
  console.log('clauses', clauses.status, 'total', clauseBody.totalDocs)
  if (!clauses.ok || !(clauseBody.totalDocs >= 41)) fail(`expected the 41 clauses, got ${clauseBody.totalDocs}`)
  const doors = await fetch(`${base}/api/doors?limit=1`, { headers: auth })
  const doorBody = await doors.json().catch(() => ({}))
  console.log('doors', doors.status, 'total', doorBody.totalDocs)
  if (!doors.ok || doorBody.totalDocs !== 20) fail(`expected the 20 Jibril doors from the migration, got ${doorBody.totalDocs}`)

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  const form = new FormData()
  form.set('file', new Blob([png], { type: 'image/png' }), 'dot.png')
  form.set('alt', 'smoke')
  const uploaded = await fetch(`${base}/api/media`, { method: 'POST', headers: auth, body: form })
  const media = await uploaded.json().catch(() => ({}))
  console.log('upload', uploaded.status, media?.doc?.filename || media?.filename || media?.errors || media?.message)
  const doc = media.doc || media
  if (!uploaded.ok || !doc?.filename) fail(`upload failed: ${uploaded.status} ${JSON.stringify(media).slice(0, 400)}`)

  const fileUrl = doc.url?.startsWith('http') ? doc.url : `${base}${doc.url || `/api/media/file/${doc.filename}`}`
  const file = await fetch(fileUrl, { headers: auth })
  console.log('file', file.status, file.headers.get('content-type'))
  if (!file.ok) fail(`uploaded file was not readable at ${fileUrl}`)

  if (process.env.S3_ENDPOINT && process.env.S3_BUCKET) {
    const { HeadObjectCommand, S3Client } = await import('@aws-sdk/client-s3')
    const client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
    })
    const key = `${doc.prefix || ''}${doc.filename}`
    await client.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }))
    console.log('s3 object', key)
  }

  if (process.exitCode) {
    console.error('Smoke failed.')
    process.exit(process.exitCode)
  }
  console.log('Smoke passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
