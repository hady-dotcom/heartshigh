import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { s3Storage } from '@payloadcms/storage-s3'
import { buildConfig } from 'payload'
import { aiCollections } from './collections-ai'
import { adminCollections } from './collections-admin'
import { collections } from './collections'
import { consentCollections } from './collections-consent'
import { gatherCollections } from './collections-gather'
import { sheetCollections } from './collections-sheet'
import { MasterFlags } from './collections-opening'
import { AUDITED_COLLECTIONS } from './lib/audit-events'
import { databaseKind, payloadCsrf, payloadSecret, postgresPush, readS3, serverOrigins, sqliteFileUrl } from './lib/env'
import { migrations } from './migrations'
import { TRASH_SLUGS } from './lib/trash'
import { TENANT_COLLECTIONS } from './lib/tenant-collections'
import { assignJoinerToClass } from './server/classes'
import { enqueueAudit, staffAuditAfterChange, staffAuditAfterDelete } from './server/audit'
import { viewAsGlobalGuard, viewAsGuard } from './server/viewas'
import { emailAdapter } from './lib/email-adapter'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const kind = databaseKind()
const databaseUrl = kind === 'postgres' ? process.env.DATABASE_URL || '' : sqliteFileUrl()
if (kind === 'sqlite' && databaseUrl.startsWith('file:')) {
  mkdirSync(path.dirname(path.resolve(databaseUrl.slice('file:'.length))), { recursive: true })
}

const origins = serverOrigins()
const s3 = readS3()

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '· HEARTS',
    },
    components: {
      header: ['/components/viewas-admin-banner#ViewAsAdminBanner'],
    },
  },
  collections: [...collections, ...aiCollections, ...sheetCollections, ...gatherCollections, ...consentCollections, ...adminCollections].map((collection) => {
    const afterChange = [...(collection.hooks?.afterChange || [])]
    const afterDelete = [...(collection.hooks?.afterDelete || [])]
    if (AUDITED_COLLECTIONS.includes(collection.slug as (typeof AUDITED_COLLECTIONS)[number])) {
      afterChange.push(staffAuditAfterChange as never)
      afterDelete.push(staffAuditAfterDelete as never)
    }
    if (collection.slug === 'users') {
      afterChange.push((async ({ doc, operation, req }: { doc: { id: number; accessCode?: unknown; role?: string | null }; operation: string; req: { payload?: typeof import('payload') } }) => {
        if (operation !== 'create' || !req.payload) return
        const payload = req.payload
        enqueueAudit(() => assignJoinerToClass(payload as never, doc))
      }) as never)
    }
    return {
      ...collection,
      // C15: trash on content collections only. Do not edit collections.ts (A owns Users, C owns Media).
      trash: collection.trash || TRASH_SLUGS.includes(collection.slug),
      hooks: {
        ...collection.hooks,
        beforeOperation: [...(collection.hooks?.beforeOperation || []), viewAsGuard as never],
        afterChange,
        afterDelete,
      },
    }
  }),
  globals: [MasterFlags].map((global) => ({ ...global, hooks: { ...global.hooks, beforeChange: [viewAsGlobalGuard as never, ...(global.hooks?.beforeChange || [])] } })),
  editor: lexicalEditor(),
  secret: payloadSecret(),
  email: emailAdapter(),
  serverURL: origins[0],
  cors: origins.length ? origins : undefined,
  // Playwright's APIRequestContext has no Origin header, so HEARTS_E2E may blank CSRF
  // in development. payloadCsrf ignores that switch when NODE_ENV=production.
  csrf: payloadCsrf(origins),
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db:
    kind === 'postgres'
      ? postgresAdapter({
          pool: { connectionString: databaseUrl, max: 10 },
          // Integer ids, matching the SQLite database the app already uses.
          idType: 'serial',
          push: postgresPush(),
          migrationDir: path.resolve(dirname, 'migrations'),
          prodMigrations: migrations,
        })
      : sqliteAdapter({
          push: true,
          client: {
            url: databaseUrl,
          },
        }),
  plugins: [
    multiTenantPlugin({
      tenantsSlug: 'portals',
      tenantField: { name: 'portal' },
      tenantSelectorLabel: 'Portal',
      collections: { ...TENANT_COLLECTIONS },
      userHasAccessToAllTenants: (user) => (user as { role?: string } | null)?.role === 'master',
    }),
    // The prefix column is part of the schema even when the bucket is off, so SQLite and Postgres stay aligned.
    // Files stay on disk until S3_BUCKET (or Railway's BUCKET) is set.
    s3Storage({
      enabled: Boolean(s3),
      alwaysInsertFields: true,
      collections: { media: true },
      bucket: s3?.bucket || 'hearts-local',
      config: s3
        ? {
            credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
            region: s3.region,
            endpoint: s3.endpoint,
            forcePathStyle: s3.forcePathStyle,
          }
        : { region: 'us-east-1' },
    }),
  ],
})
