import type { CollectionConfig } from 'payload'

// The master sheet keeps its own records so a re-import can find a talk by the key in the
// spreadsheet, and so the last import can be undone, without adding fields to the shared collections.

const master = ({ req }: { req: { user?: { role?: string } | null } }) => req.user?.role === 'master'
const masterOnly = { read: master, create: master, update: master, delete: master }

/** The spreadsheet's name for a talk, plus the few sheet words the lesson itself does not store. */
export const SheetKeys: CollectionConfig = {
  slug: 'sheet-keys',
  labels: { singular: 'Sheet key', plural: 'Sheet keys' },
  admin: { useAsTitle: 'talkKey' },
  access: masterOnly,
  fields: [
    { name: 'talkKey', type: 'text', required: true, unique: true, index: true },
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true, unique: true, index: true },
    { name: 'channel', type: 'text' },
    {
      name: 'sheetStatus',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Checked', value: 'checked' },
        { label: 'Live', value: 'live' },
      ],
    },
  ],
}

/** One row per upload: the workbook, the dry-run, and the snapshot an undo puts back. */
export const SheetImports: CollectionConfig = {
  slug: 'sheet-imports',
  labels: { singular: 'Sheet import', plural: 'Sheet imports' },
  access: masterOnly,
  fields: [
    { name: 'desk', type: 'select', required: true, options: ['master', 'portal'].map((value) => ({ label: value, value })) },
    { name: 'portal', type: 'relationship', relationTo: 'portals' },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'actorRole', type: 'text' },
    { name: 'fileName', type: 'text' },
    {
      name: 'state',
      type: 'select',
      required: true,
      defaultValue: 'preview',
      options: ['preview', 'applied', 'undone'].map((value) => ({ label: value, value })),
      index: true,
    },
    { name: 'at', type: 'date' },
    { name: 'summary', type: 'json' },
    { name: 'snapshot', type: 'json' },
    { name: 'workbook', type: 'textarea', maxLength: 12_000_000 },
  ],
}

export const sheetCollections = [SheetKeys, SheetImports]
