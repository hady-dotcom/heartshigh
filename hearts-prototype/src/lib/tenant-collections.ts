/**
 * Collections that receive a `portal` field from the multi-tenant plugin.
 * Later PRs that add a tenant-scoped table must add the slug here and register
 * a wipe rule in `src/server/erase/registry.ts`. The registry test fails if either is missing.
 *
 * Plug-in points already named for unmerged work:
 * #20 live, #22 experiments, #25, #26 courses / My week, #27 insights / missions.
 */
export const TENANT_COLLECTIONS = {
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
  consents: {},
  'age-profiles': {},
  'help-requests': {},
  classes: {},
  'class-join-rules': {},
} as const

export type TenantCollectionSlug = keyof typeof TENANT_COLLECTIONS
