import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { buildConfig } from 'payload'
import { collections } from './collections'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '· HEARTS',
    },
  },
  collections,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'hearts-prototype-dev-secret',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteAdapter({
    push: true,
    client: {
      url: process.env.DATABASE_URL || 'file:./data/hearts.db',
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
        'lesson-visits': {},
        'seat-visits': {},
        rituals: {},
        'placing-answers': {},
        'feedback-notes': {},
      },
      userHasAccessToAllTenants: (user) => (user as { role?: string } | null)?.role === 'master',
    }),
  ],
})
