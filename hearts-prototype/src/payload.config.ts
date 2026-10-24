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
import { calendarCollections } from './collections-calendar'
import { experimentCollections } from './collections-experiments'
import { gatherCollections } from './collections-gather'
import { insightCollections } from './collections-insights'
import { liveCollections } from './collections-live'
import { missionCollections } from './collections-missions'
import { safetyCollections } from './collections-safety'
import { sheetCollections } from './collections-sheet'
import { MasterFlags } from './collections-opening'
import { databaseKind, isBuildPhase, isProduction, payloadSecret, postgresPush, readS3, serverOrigins, sqliteFileUrl } from './lib/env'
import { migrations } from './migrations'
import { copyPackCoursesOntoCodes } from './server/code-courses'
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
  collections: [...collections, ...aiCollections, ...sheetCollections, ...experimentCollections, ...insightCollections, ...calendarCollections, ...missionCollections, ...gatherCollections, ...liveCollections, ...safetyCollections].map((collection) => ({
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
  onInit: async (payload) => {
    if (isBuildPhase()) return
    try {
      const { markShortTalks } = await import('./server/short-talks')
      const result = await markShortTalks(payload)
      if (result.marked || result.coursesHidden) {
        payload.logger.info(`Marked ${result.marked} talks under 5 minutes. Hid ${result.coursesHidden} courses that had only those talks.`)
      }
      await copyPackCoursesOntoCodes(payload).catch((error) => {
        payload.logger.error({ err: error, msg: 'Could not copy pack courses onto access codes.' })
      })
      // Local seed loads this itself, and that path is also where sample sign-ins are made.
      // A live boot only creates the portal and the films. Unit tests build an empty database and must not load the course.
      if (process.env.HEARTS_SEEDING === '1' || process.env.NODE_ENV === 'test') return
      const { ensureParentingCourse } = await import('./seed/parenting')
      await ensureParentingCourse(payload)
    } catch (error) {
      const text = `${error instanceof Error ? error.message : error} ${error instanceof Error && error.cause instanceof Error ? error.cause.message : ''}`
      const missingTable = /does not exist|no such table/i.test(text)
      // npm run migrate connects before the tables exist. Production migrates first, so a missing table there is a real failure.
      if (!isProduction() && missingTable) {
        payload.logger.info('Startup checks are waiting until migrations create the tables.')
        return
      }
      payload.logger.error({ err: error, msg: 'Could not finish startup checks.' })
      throw error
    }
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
        reports: {},
        'moderation-hides': {},
        'safeguarding-alerts': {},
        announcements: {},
        'announcement-dismissals': {},
        'rate-hits': {},
        'circle-mutes': {},
      } as never,
      userHasAccessToAllTenants: (user) => (user as { role?: string } | null)?.role === 'master',
    }),
    // The prefix column is part of the schema even when the bucket is off, so SQLite and Postgres stay aligned.
    // Files stay on disk until S3_BUCKET (or Railway's BUCKET) is set.
    s3Storage({
      enabled: Boolean(s3),
      alwaysInsertFields: true,
      acl: 'private',
      signedDownloads: { expiresIn: 300 },
      collections: { media: { signedDownloads: { expiresIn: 300 } }, 'see-how-clips': { signedDownloads: { expiresIn: 300 } } },
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
