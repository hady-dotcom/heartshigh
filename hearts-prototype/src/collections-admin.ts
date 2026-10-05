import type { Access, CollectionConfig, Where } from 'payload'
import { portalIdOf } from './lib/ids'
import { CLASS_COLOURS } from './lib/class-palette'
import { authorTextProblems, markupProblems } from './lib/opening-data'
import { APIError } from 'payload'

const master = ({ req }: { req: { user?: { role?: string } | null } }) => req.user?.role === 'master'

function staffPortal(user: { id?: number; role?: string | null; tenants?: { tenant?: unknown }[] } | null | undefined): Where | boolean {
  if (!user) return false
  if (user.role === 'master') return true
  if (user.role !== 'portal-admin' && user.role !== 'teacher') return false
  const portal = portalIdOf(user)
  return portal ? { portal: { equals: portal } } : false
}

const staffRead: Access = ({ req }) => staffPortal(req.user as never)
const staffWrite: Access = ({ req }) => {
  const user = req.user as { role?: string | null; tenants?: { tenant?: unknown }[] } | null
  if (!user) return false
  if (user.role === 'master' || user.role === 'portal-admin') return staffPortal(user)
  return false
}
const classWrite: Access = ({ req }) => staffPortal(req.user as never)

function refuse(problems: string[]) {
  if (problems.length) throw new APIError(problems[0], 400, null, true)
}

/**
 * Classes (K03) and operational rows for backups, restore drills and clean-up.
 * Portal field is added by the multi-tenant plugin for classes and join rules.
 */
export const Classes: CollectionConfig = {
  slug: 'classes',
  labels: { singular: 'Class', plural: 'Classes' },
  admin: { useAsTitle: 'name' },
  access: { read: staffRead, create: classWrite, update: classWrite, delete: classWrite },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        const name = typeof data?.name === 'string' ? data.name : ''
        refuse(markupProblems([['Name', name]]))
        refuse(authorTextProblems([['Name', name]]))
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'colour',
      type: 'select',
      defaultValue: CLASS_COLOURS[0].value,
      options: CLASS_COLOURS.map((row) => ({ label: row.label, value: row.value })),
    },
    { name: 'teachers', type: 'relationship', relationTo: 'users', hasMany: true },
    { name: 'learners', type: 'relationship', relationTo: 'users', hasMany: true },
    { name: 'note', type: 'textarea' },
  ],
}

/** A code can drop new joiners into a class, without editing AccessCodes (Lane A). */
export const ClassJoinRules: CollectionConfig = {
  slug: 'class-join-rules',
  labels: { singular: 'Class join rule', plural: 'Class join rules' },
  access: { read: staffRead, create: staffWrite, update: staffWrite, delete: staffWrite },
  fields: [
    { name: 'accessCode', type: 'relationship', relationTo: 'access-codes', required: true },
    { name: 'class', type: 'relationship', relationTo: 'classes', required: true },
  ],
}

/** Last backup, restore drill and clean-up, shown on the master System page. */
export const OpsEvents: CollectionConfig = {
  slug: 'ops-events',
  labels: { singular: 'Ops event', plural: 'Ops events' },
  admin: { useAsTitle: 'kind' },
  access: { read: master, create: master, update: master, delete: master },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Backup', value: 'backup' },
        { label: 'Restore drill', value: 'restore' },
        { label: 'Retention', value: 'retention' },
        { label: 'Closed portal reminder', value: 'closed-portal' },
      ],
    },
    { name: 'ok', type: 'checkbox', defaultValue: true },
    { name: 'at', type: 'date', required: true },
    { name: 'detail', type: 'json' },
    { name: 'portal', type: 'relationship', relationTo: 'portals' },
  ],
}

export const adminCollections = [Classes, ClassJoinRules, OpsEvents]
