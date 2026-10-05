import type { Access, CollectionConfig } from 'payload'

/** New slugs are not in the generated CollectionSlug union until types are regenerated. */
const relation = (name: string) => name as 'users'

/**
 * Experiments live outside the learner collections. Portal admins may read them
 * so they can see results for their portal. Writes go through the desk API.
 */
const staffRead: Access = ({ req }) => req.user?.role === 'master' || req.user?.role === 'portal-admin'
const masterWrite: Access = ({ req }) => req.user?.role === 'master'
const nobody: Access = () => false
const readOnly = { read: staffRead, create: masterWrite, update: masterWrite, delete: masterWrite }
const eventsAccess = { read: staffRead, create: nobody, update: nobody, delete: nobody }

const status = {
  name: 'status',
  type: 'select' as const,
  required: true,
  defaultValue: 'draft',
  index: true,
  options: [
    { label: 'Draft', value: 'draft' },
    { label: 'Running', value: 'running' },
    { label: 'Paused', value: 'paused' },
    { label: 'Finished', value: 'finished' },
  ],
}

export const Experiments: CollectionConfig = {
  slug: 'experiments',
  labels: { singular: 'Experiment', plural: 'Experiments' },
  admin: { useAsTitle: 'name', group: 'Experiments' },
  access: readOnly,
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    status,
    { name: 'slot', type: 'text', required: true, index: true },
    { name: 'surface', type: 'text', required: true, defaultValue: 'feed', index: true },
    { name: 'portal', type: 'relationship', relationTo: 'portals', index: true },
    {
      name: 'allocation',
      type: 'select',
      required: true,
      defaultValue: 'fixed',
      options: [
        { label: 'Fixed split', value: 'fixed' },
        { label: 'Auto (bandit)', value: 'auto' },
      ],
    },
    { name: 'primaryMetric', type: 'text', required: true, defaultValue: 'clip_cta_tap' },
    { name: 'secondaryMetrics', type: 'json' },
    { name: 'guardrailNote', type: 'textarea' },
    {
      name: 'variants',
      type: 'array',
      required: true,
      minRows: 2,
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
        { name: 'payload', type: 'json', required: true },
        { name: 'weight', type: 'number', required: true, defaultValue: 1, min: 0 },
        { name: 'approved', type: 'checkbox', defaultValue: false },
        {
          name: 'source',
          type: 'select',
          defaultValue: 'staff',
          options: [
            { label: 'Written on the desk', value: 'staff' },
            { label: 'Suggested by AI', value: 'ai' },
            { label: 'Mock draft', value: 'mock' },
          ],
        },
      ],
    },
    { name: 'defaultVariant', type: 'text' },
    { name: 'winnerKey', type: 'text' },
    { name: 'promoted', type: 'checkbox', defaultValue: false },
    { name: 'createdBy', type: 'relationship', relationTo: 'users' },
    { name: 'approvedBy', type: 'relationship', relationTo: 'users' },
    { name: 'startedAt', type: 'date' },
    { name: 'finishedAt', type: 'date' },
  ],
}

export const ExperimentAssignments: CollectionConfig = {
  slug: 'experiment-assignments',
  labels: { singular: 'Experiment assignment', plural: 'Experiment assignments' },
  admin: { group: 'Experiments', hidden: true },
  access: eventsAccess,
  fields: [
    { name: 'experiment', type: 'relationship', relationTo: relation('experiments'), required: true, index: true },
    { name: 'experimentKey', type: 'text', required: true, index: true },
    { name: 'variantKey', type: 'text', required: true, index: true },
    {
      name: 'subjectKind',
      type: 'select',
      required: true,
      options: [
        { label: 'Learner', value: 'learner' },
        { label: 'Device', value: 'device' },
      ],
    },
    { name: 'learner', type: 'relationship', relationTo: 'users', index: true },
    { name: 'deviceId', type: 'text', index: true },
    { name: 'subject', type: 'text', required: true, index: true },
    { name: 'portal', type: 'relationship', relationTo: 'portals', index: true },
    { name: 'sticky', type: 'checkbox', defaultValue: true },
  ],
}

export const ExperimentEvents: CollectionConfig = {
  slug: 'experiment-events',
  labels: { singular: 'Experiment event', plural: 'Experiment events' },
  admin: { group: 'Experiments', hidden: true },
  access: eventsAccess,
  fields: [
    { name: 'experiment', type: 'relationship', relationTo: relation('experiments'), required: true, index: true },
    { name: 'experimentKey', type: 'text', required: true, index: true },
    { name: 'variantKey', type: 'text', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'exposure',
      index: true,
      options: [
        { label: 'Exposure', value: 'exposure' },
        { label: 'Conversion', value: 'conversion' },
      ],
    },
    { name: 'event', type: 'text', required: true, index: true },
    { name: 'learner', type: 'relationship', relationTo: 'users', index: true },
    { name: 'deviceId', type: 'text', index: true },
    { name: 'subject', type: 'text', required: true, index: true },
    { name: 'sessionId', type: 'text', index: true },
    { name: 'portal', type: 'relationship', relationTo: 'portals', index: true },
    { name: 'props', type: 'json' },
    { name: 'at', type: 'date', required: true, index: true },
  ],
}

export const experimentCollections = [Experiments, ExperimentAssignments, ExperimentEvents]
