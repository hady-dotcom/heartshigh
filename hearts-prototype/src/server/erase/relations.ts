import type { CollectionConfig, Field } from 'payload'
import { collections } from '../../collections'
import { adminCollections } from '../../collections-admin'
import { aiCollections } from '../../collections-ai'
import { consentCollections } from '../../collections-consent'
import { gatherCollections } from '../../collections-gather'
import { openingCollections } from '../../collections-opening'
import { sheetCollections } from '../../collections-sheet'
import { TENANT_COLLECTIONS } from '../../lib/tenant-collections'

export const ALL_COLLECTION_CONFIGS: CollectionConfig[] = [
  ...collections,
  ...aiCollections,
  ...sheetCollections,
  ...gatherCollections,
  ...consentCollections,
  ...adminCollections,
]

function fieldsOf(field: Field): Field[] {
  if ('fields' in field && Array.isArray(field.fields)) return field.fields as Field[]
  if (field.type === 'tabs') return field.tabs.flatMap((tab) => tab.fields as Field[])
  if (field.type === 'blocks') return field.blocks.flatMap((block) => block.fields as Field[])
  return []
}

function relationTo(field: Field): string[] {
  if (field.type !== 'relationship' && field.type !== 'upload') return []
  const to = field.relationTo
  return (Array.isArray(to) ? to : [to]).filter(Boolean)
}

function walk(fields: Field[] | undefined, found: { portals: Set<string>; users: Set<string> }, prefix = '') {
  for (const field of fields || []) {
    const name = 'name' in field && typeof field.name === 'string' ? field.name : ''
    const path = name ? (prefix ? `${prefix}.${name}` : name) : prefix
    for (const target of relationTo(field)) {
      if (target === 'portals') found.portals.add(path || name)
      if (target === 'users') found.users.add(path || name)
    }
    walk(fieldsOf(field), found, path)
  }
}

/** Collections that store a portal or a user, including plugin `portal` and the users/portals roots. */
export function collectionsNeedingWipe(extra: CollectionConfig[] = ALL_COLLECTION_CONFIGS) {
  const needed = new Map<string, { portals: string[]; users: string[] }>()
  const add = (slug: string, portals: string[] = [], users: string[] = []) => {
    const current = needed.get(slug) || { portals: [], users: [] }
    needed.set(slug, {
      portals: [...new Set([...current.portals, ...portals])],
      users: [...new Set([...current.users, ...users])],
    })
  }
  add('portals', ['id'])
  add('users', ['tenants.tenant'], ['id', 'updatedBy', 'onBehalfOf'])
  for (const slug of Object.keys(TENANT_COLLECTIONS)) add(slug, ['portal'])
  for (const collection of extra) {
    const found = { portals: new Set<string>(), users: new Set<string>() }
    walk(collection.fields, found)
    if (found.portals.size || found.users.size) {
      add(collection.slug, [...found.portals], [...found.users])
    }
  }
  // opening collections are already inside `collections`, but keep the import used so a later split cannot drop them.
  void openingCollections
  return needed
}

export function slugToTable(slug: string) {
  return slug.replace(/-/g, '_')
}

export function fieldToColumn(field: string) {
  return `${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) }_id`
}
