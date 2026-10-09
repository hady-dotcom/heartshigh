import type { Access, CollectionConfig } from 'payload'

/** New slugs are not in the generated CollectionSlug union until types are regenerated. */
const relation = (name: string) => name as 'users'

/**
 * AI steps live outside the learner collections. Portal admins may read them.
 * Writes go through the desk API, which checks the master's grant and writes the audit log.
 */
const staffRead: Access = ({ req }) => req.user?.role === 'master' || req.user?.role === 'portal-admin'
const masterWrite: Access = ({ req }) => req.user?.role === 'master'
const readOnly = { read: staffRead, create: masterWrite, update: masterWrite, delete: masterWrite }

const provider = {
  name: 'provider',
  type: 'select' as const,
  defaultValue: 'anthropic',
  options: [
    { label: 'Anthropic', value: 'anthropic' },
    { label: 'OpenAI', value: 'openai' },
  ],
}

export const AiSteps: CollectionConfig = {
  slug: 'ai-steps',
  labels: { singular: 'AI step', plural: 'AI steps' },
  admin: { useAsTitle: 'name', group: 'AI steps' },
  access: readOnly,
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'textarea', required: true },
    { name: 'placeholders', type: 'json', required: true },
    { name: 'prompt', type: 'textarea', required: true },
    provider,
    { name: 'model', type: 'text' },
    { name: 'temperature', type: 'number', defaultValue: 0 },
    { name: 'maxTokens', type: 'number', defaultValue: 1200 },
    { name: 'outputSchema', type: 'json' },
    { name: 'fills', type: 'textarea' },
    { name: 'pipelineOrder', type: 'number', defaultValue: 0 },
    { name: 'inPipeline', type: 'checkbox', defaultValue: true },
    { name: 'fillsTier', type: 'text' },
    { name: 'fillsPoints', type: 'text' },
    { name: 'liveVersion', type: 'number', defaultValue: 1 },
  ],
}

export const AiStepVersions: CollectionConfig = {
  slug: 'ai-step-versions',
  labels: { singular: 'AI step version', plural: 'AI step versions' },
  admin: { useAsTitle: 'note', group: 'AI steps' },
  access: readOnly,
  fields: [
    { name: 'step', type: 'relationship', relationTo: relation('ai-steps'), required: true, index: true },
    { name: 'number', type: 'number', required: true },
    { name: 'prompt', type: 'textarea', required: true },
    provider,
    { name: 'model', type: 'text' },
    { name: 'temperature', type: 'number' },
    { name: 'maxTokens', type: 'number' },
    { name: 'note', type: 'textarea', required: true },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    { name: 'authorName', type: 'text' },
    { name: 'authorRole', type: 'text' },
    { name: 'live', type: 'checkbox', defaultValue: false, index: true },
  ],
}

export const AiStepOutputs: CollectionConfig = {
  slug: 'ai-step-outputs',
  labels: { singular: 'AI step output', plural: 'AI step outputs' },
  admin: { group: 'AI steps' },
  access: readOnly,
  fields: [
    { name: 'step', type: 'relationship', relationTo: relation('ai-steps') },
    { name: 'stepSlug', type: 'text', required: true, index: true },
    { name: 'versionNumber', type: 'number' },
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', index: true },
    {
      name: 'mode',
      type: 'select',
      defaultValue: 'run',
      options: [
        { label: 'Try', value: 'try' },
        { label: 'Run', value: 'run' },
      ],
    },
    {
      name: 'disposition',
      type: 'select',
      defaultValue: 'preview',
      index: true,
      options: [
        { label: 'Preview, not saved', value: 'preview' },
        { label: 'Applied as a draft', value: 'applied' },
        { label: 'Held, a draft is waiting', value: 'pending' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    { name: 'output', type: 'json' },
    { name: 'written', type: 'json' },
    { name: 'error', type: 'textarea' },
    { name: 'job', type: 'relationship', relationTo: relation('ai-step-jobs') },
    { name: 'protectsKind', type: 'text' },
    { name: 'protectsId', type: 'number' },
    { name: 'protectsReason', type: 'text' },
    { name: 'mock', type: 'checkbox', defaultValue: false },
  ],
}

export const AiStepJobs: CollectionConfig = {
  slug: 'ai-step-jobs',
  labels: { singular: 'AI step job', plural: 'AI step jobs' },
  admin: { group: 'AI steps' },
  access: readOnly,
  fields: [
    { name: 'stepSlug', type: 'text', required: true, index: true },
    {
      name: 'scope',
      type: 'select',
      defaultValue: 'talk',
      options: [
        { label: 'One talk', value: 'talk' },
        { label: 'A selection', value: 'selection' },
        { label: 'A course', value: 'course' },
        { label: 'Everything', value: 'all' },
      ],
    },
    { name: 'lessonIds', type: 'json' },
    { name: 'course', type: 'relationship', relationTo: 'courses' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'queued',
      index: true,
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Running', value: 'running' },
        { label: 'Done', value: 'done' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    { name: 'total', type: 'number', defaultValue: 0 },
    { name: 'finished', type: 'number', defaultValue: 0 },
    { name: 'failedCount', type: 'number', defaultValue: 0 },
    { name: 'results', type: 'json' },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'actorName', type: 'text' },
    { name: 'note', type: 'text' },
    { name: 'error', type: 'textarea' },
  ],
}

export const AiDesk: CollectionConfig = {
  slug: 'ai-desk',
  labels: { singular: 'AI desk setting', plural: 'AI desk settings' },
  admin: { group: 'AI steps' },
  access: readOnly,
  fields: [
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'portalMayEdit', type: 'checkbox', defaultValue: false },
  ],
}

export const aiCollections = [AiSteps, AiStepVersions, AiStepOutputs, AiStepJobs, AiDesk]
