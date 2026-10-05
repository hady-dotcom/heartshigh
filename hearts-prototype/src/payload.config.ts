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
import { collections } from './collections'
import { gatherCollections } from './collections-gather'
import { liveCollections } from './collections-live'
import { sheetCollections } from './collections-sheet'
import { MasterFlags } from './collections-opening'
import { databaseKind, payloadSecret, postgresPush, readS3, serverOrigins, sqliteFileUrl } from './lib/env'
import { migrations } from './migrations'
import { viewAsGlobalGuard, viewAsGuard } from './server/viewas'

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
  collections: [...collections, ...aiCollections, ...sheetCollections, ...gatherCollections, ...liveCollections].map((collection) => ({
    ...collection,
    hooks: { ...collection.hooks, beforeOperation: [...(collection.hooks?.beforeOperation || []), viewAsGuard as never] },
  })),
  globals: [MasterFlags].map((global) => ({ ...global, hooks: { ...global.hooks, beforeChange: [viewAsGlobalGuard as never, ...(global.hooks?.beforeChange || [])] } })),
  editor: lexicalEditor(),
  secret: payloadSecret(),
  serverURL: origins[0],
  cors: origins.length ? origins : undefined,
  csrf: origins.length ? origins : undefined,
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
      collections: {
        messages: {},
        events: {},
        rsvps: {},
        checkins: {},
        'workbook-entries': {},
        answers: {},
        'access-codes': {},
        schedules: {},
        notifications: {},
        completions: {},
        'watch-sessions': {},
        adoptions: {},
        'harvest-entries': {},
        'drawn-to': {},
        'lesson-visits': {},
        'seat-visits': {},
        rituals: {},
        'placing-answers': {},
        'feedback-notes': {},
        gatherings: {},
        'gather-rsvps': {},
        'gather-checkins': {},
        'gather-reflections': {},
        'gather-photos': {},
        'live-sessions': {},
        'live-questions': {},
        'live-reminders': {},
        'live-presence': {},
      } as never,
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
