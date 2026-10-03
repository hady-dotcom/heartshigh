// Reads the environment once, in plain language, so boot, seed, and cookies all agree.
// Nothing here connects to a database or prints a secret.

export type Env = Record<string, string | undefined>

export const DEV_SECRET = 'hearts-prototype-dev-secret'

/** Passwords written in the README. They must never be created on a public server. */
export const DEMO_PASSWORDS = ['hearts-master', 'portal-admin', 'portal-teacher', 'portal-learner']

export const DEMO_EMAIL_SUFFIX = '@hearts.test'

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'db'])

export function isProduction(env: Env = process.env) {
  return env.NODE_ENV === 'production'
}

/** True while `next build` is evaluating the config, so the image can be built before the real secrets exist. */
export function isBuildPhase(env: Env = process.env) {
  return env.NEXT_PHASE === 'phase-production-build' || env.HEARTS_BUILD === '1'
}

export function databaseKind(env: Env = process.env): 'postgres' | 'sqlite' {
  const explicit = (env.DATABASE_ADAPTER || '').trim().toLowerCase()
  const url = env.DATABASE_URL || ''
  if (explicit === 'postgres' || explicit === 'postgresql') return 'postgres'
  if (explicit === 'sqlite') return 'sqlite'
  if (/^postgres(ql)?:\/\//i.test(url)) return 'postgres'
  return 'sqlite'
}

export function sqliteFileUrl(env: Env = process.env) {
  return env.DATABASE_URL || 'file:./data/hearts.db'
}

export function databaseHost(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/** A Postgres server that is not this computer or the compose network. Wiping one of those is refused. */
export function isRemoteDatabase(env: Env = process.env) {
  if (databaseKind(env) !== 'postgres') return false
  const host = databaseHost(env.DATABASE_URL || '')
  return !host || !LOCAL_DB_HOSTS.has(host)
}

export function secretProblem(secret: string) {
  if (!secret) return 'PAYLOAD_SECRET is not set. In your host’s variables, add PAYLOAD_SECRET: a long random string, at least 32 characters. A password manager can make one.'
  if (secret === DEV_SECRET || secret.startsWith('build-time-placeholder')) return 'PAYLOAD_SECRET is still the sample value from the source code. Generate a new one. Do not reuse the sample.'
  if (DEMO_PASSWORDS.includes(secret)) return 'PAYLOAD_SECRET is one of the demo passwords from the README. Choose a different secret.'
  if (secret.length < 32) return 'PAYLOAD_SECRET is too short. Use at least 32 characters.'
  return null
}

export function payloadSecret(env: Env = process.env) {
  const secret = env.PAYLOAD_SECRET?.trim() || ''
  if (isProduction(env) && !isBuildPhase(env)) {
    const problem = secretProblem(secret)
    if (problem) throw new Error(`HEARTS cannot start. ${problem}`)
  }
  return secret || DEV_SECRET
}

function first(env: Env, ...keys: string[]) {
  for (const key of keys) {
    const value = env[key]?.trim()
    if (value) return value
  }
  return ''
}

export type S3Settings = {
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  endpoint?: string
  forcePathStyle: boolean
}

function forcePathStyle(env: Env, endpoint: string) {
  const flag = (env.S3_FORCE_PATH_STYLE || '').trim().toLowerCase()
  if (flag === '1' || flag === 'true') return true
  if (flag === '0' || flag === 'false') return false
  if (!endpoint) return false
  try {
    const host = new URL(endpoint).hostname
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') || host.includes('minio')
  } catch {
    return false
  }
}

/**
 * S3-compatible storage. Railway’s bucket variables (BUCKET, ACCESS_KEY_ID, SECRET_ACCESS_KEY, REGION, ENDPOINT)
 * are accepted, and so are the S3_* and AWS_* names. Returns null when the bucket is not configured, which
 * means development keeps files on disk.
 */
export function readS3(env: Env = process.env): S3Settings | null {
  const bucket = first(env, 'S3_BUCKET', 'AWS_S3_BUCKET_NAME', 'BUCKET')
  const accessKeyId = first(env, 'S3_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'ACCESS_KEY_ID')
  const secretAccessKey = first(env, 'S3_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'SECRET_ACCESS_KEY')
  if (!bucket || !accessKeyId || !secretAccessKey) return null
  const endpoint = first(env, 'S3_ENDPOINT', 'AWS_ENDPOINT_URL', 'ENDPOINT') || undefined
  const region = first(env, 'S3_REGION', 'AWS_DEFAULT_REGION', 'AWS_REGION', 'REGION') || (endpoint ? 'auto' : 'us-east-1')
  return { bucket, accessKeyId, secretAccessKey, region, endpoint, forcePathStyle: forcePathStyle(env, endpoint || '') }
}

export function serverOrigins(env: Env = process.env) {
  const raw = [env.SERVER_URL, ...(env.ADDITIONAL_ORIGINS || '').split(',')]
  const urls = raw.map((value) => value?.trim().replace(/\/$/, '') || '').filter((value) => /^https?:\/\//.test(value))
  return [...new Set(urls)]
}

export function serverURL(env: Env = process.env) {
  return serverOrigins(env)[0]
}

/** Production cookies are always Secure. A variable cannot turn that off. */
export function cookiesSecure(env: Env = process.env) {
  if (isProduction(env) && !isBuildPhase(env)) return true
  return env.HEARTS_COOKIE_SECURE === '1'
}

/** Drizzle push is a development convenience. Production changes the schema only through migrations. */
export function postgresPush(env: Env = process.env) {
  return !isProduction(env) && env.HEARTS_DB_PUSH === '1'
}

export function clientIpConfigured(env: Env, hops: number, platformHeader: string | null) {
  if (platformHeader) return true
  if ((env.HEARTS_TRUSTED_PROXY_HOPS || '').trim() !== '') return true
  return hops > 0
}

export function productionProblems(env: Env, opts: { hops: number; platformHeader: string | null }) {
  const problems: string[] = []
  const secretIssue = secretProblem(env.PAYLOAD_SECRET?.trim() || '')
  if (secretIssue) problems.push(secretIssue)
  if (databaseKind(env) !== 'postgres') {
    problems.push('The database must be Postgres. Set DATABASE_URL to the postgres:// address from your database, or set DATABASE_ADAPTER=postgres. SQLite is only for a computer you are developing on.')
  } else if (!/^postgres(ql)?:\/\//i.test(env.DATABASE_URL || '')) {
    problems.push('DATABASE_ADAPTER is postgres, but DATABASE_URL is not a postgres:// address.')
  }
  if (!readS3(env)) {
    problems.push('Uploaded files need a bucket, or they disappear every time the app is redeployed. Set S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (Railway’s names BUCKET, ACCESS_KEY_ID and SECRET_ACCESS_KEY work too). For Railway, MinIO or Cloudflare, also set S3_ENDPOINT.')
  }
  if (!serverURL(env)) {
    problems.push('SERVER_URL is not set. Use the public address people will open, such as https://your-app.up.railway.app, with no slash at the end.')
  } else {
    try {
      const url = new URL(serverURL(env)!)
      if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        problems.push('SERVER_URL must start with https:// once the site is on the public internet. http:// is only for a test on this computer.')
      }
    } catch {
      problems.push('SERVER_URL could not be read as an address. Example: https://your-app.up.railway.app')
    }
  }
  if (env.HEARTS_COOKIE_SECURE === '0') {
    problems.push('HEARTS_COOKIE_SECURE=0 is not allowed in production. Sign-in cookies must be marked Secure.')
  }
  if (env.HEARTS_DB_PUSH === '1') {
    problems.push('HEARTS_DB_PUSH=1 is not allowed in production. The live database is updated only by migrations, which do not wipe it.')
  }
  if (!clientIpConfigured(env, opts.hops, opts.platformHeader)) {
    problems.push('Say how the app should see a visitor’s address. On Railway or Render set HEARTS_TRUSTED_PROXY_HOPS=1. On Fly set HEARTS_CLIENT_IP_HEADER=fly-client-ip. On a machine with no proxy in front, set HEARTS_TRUSTED_PROXY_HOPS=0. The app will not trust a visitor-supplied X-Forwarded-For on its own.')
  }
  return problems
}

export function assertProductionEnv(env: Env, opts: { hops: number; platformHeader: string | null }) {
  if (!isProduction(env) || isBuildPhase(env)) return
  const problems = productionProblems(env, opts)
  if (!problems.length) return
  throw new Error(`HEARTS cannot start:\n- ${problems.join('\n- ')}`)
}

export function bootstrapIdentity(env: Env = process.env) {
  const email = (env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase()
  const password = env.BOOTSTRAP_ADMIN_PASSWORD || ''
  const name = (env.BOOTSTRAP_ADMIN_NAME || '').trim() || 'Master'
  const problems: string[] = []
  if (!email.includes('@') || email.startsWith('@') || email.endsWith(DEMO_EMAIL_SUFFIX)) {
    problems.push('BOOTSTRAP_ADMIN_EMAIL must be your own email address. Do not use an @hearts.test address.')
  }
  if (password.length < 12) problems.push('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.')
  if (DEMO_PASSWORDS.includes(password) || password === DEV_SECRET) problems.push('BOOTSTRAP_ADMIN_PASSWORD is a demo password printed in the README. Choose a different one.')
  return { email, password, name, problems }
}

/**
 * Why seed or reseed must stop. Null means it may continue.
 * Production can load starter talks. It cannot wipe the database or create the demo accounts.
 */
export function seedRefusal(argv: string[], env: Env = process.env) {
  const reset = argv.includes('--reset')
  const starters = argv.includes('--starters')
  if (isProduction(env) && reset) {
    return 'Refusing to wipe the database because NODE_ENV is production. Nothing was deleted.'
  }
  if (isProduction(env) && !starters) {
    return 'Refusing to create demo accounts in production. Passwords such as hearts-master must not exist on a public server. Run npm run seed:starters to load the talks, and npm run bootstrap once to create the first master admin.'
  }
  if (isRemoteDatabase(env) && reset) {
    return 'Refusing to wipe a database that is not on this computer. Nothing was deleted.'
  }
  if (isRemoteDatabase(env) && !starters) {
    return 'Refusing to create demo accounts on a database that is not on this computer. Run npm run seed:starters to load the talks.'
  }
  return null
}
