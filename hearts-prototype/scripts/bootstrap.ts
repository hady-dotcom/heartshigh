import { assertProductionEnv, bootstrapIdentity, DEMO_EMAIL_SUFFIX, isProduction } from '../src/lib/env'
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { platformClientIpHeader, trustedProxyHops } from '../src/lib/rate-limit'

// Creates the first master admin from BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD.
// If a master already exists, it prints that and changes nothing, including the password.
if (isProduction()) assertProductionEnv(process.env, { hops: trustedProxyHops(), platformHeader: platformClientIpHeader() })

const identity = bootstrapIdentity()
if (identity.problems.length) {
  console.error(identity.problems.join('\n'))
  process.exit(1)
}

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const existing = await payload.find({ collection: 'users', overrideAccess: true, limit: 1, depth: 0, where: { role: { equals: 'master' } } })
  const master = existing.docs[0]
  if (master) {
    console.log(`A master admin already exists (${master.email}). Bootstrap did not change the password or create another account.`)
    process.exit(0)
  }
  const sameEmail = await payload.find({ collection: 'users', overrideAccess: true, limit: 1, depth: 0, where: { email: { equals: identity.email } } })
  if (sameEmail.docs[0]) {
    console.error(`${identity.email} already has an account that is not a master. Bootstrap did not change it.`)
    process.exit(1)
  }
  if (identity.email.endsWith(DEMO_EMAIL_SUFFIX)) {
    console.error('Refusing to create a master on an @hearts.test address.')
    process.exit(1)
  }
  await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: identity.email,
      password: identity.password,
      name: identity.name,
      role: 'master',
      onboarded: true,
      seenWelcome: true,
    },
  })
  console.log(`Created the master admin ${identity.email}. Running this command again will not change that account.`)
} finally {
  await closePayload(payload)
}
process.exit(0)
