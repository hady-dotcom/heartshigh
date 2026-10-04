import { fieldToColumn, slugToTable } from './relations'
import type { WipeEntry, WipeRule } from './types'

const entries: WipeEntry[] = []
const bySlug = new Map<string, WipeEntry>()

function rules(value: WipeRule | WipeRule[] | undefined) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/** Later PRs call this for each new collection that stores a portal or a user. */
export function registerWipe(entry: WipeEntry) {
  if (bySlug.has(entry.collection)) {
    const index = entries.findIndex((row) => row.collection === entry.collection)
    entries[index] = entry
  } else {
    entries.push(entry)
  }
  bySlug.set(entry.collection, entry)
  return entry
}

export function wipeEntries() {
  return entries
}

export function wipeEntry(slug: string) {
  return bySlug.get(slug)
}

export function registeredSlugs() {
  return new Set(entries.map((entry) => entry.collection))
}

function tenantOwned(slug: string, userField = 'user', countKey?: string, countLabel?: string, extra?: Partial<WipeEntry>) {
  registerWipe({
    collection: slug,
    table: slugToTable(slug),
    relations: { portals: ['portal'], users: [userField] },
    portal: { kind: 'hard-delete', field: 'portal' },
    user: { kind: 'hard-delete', field: userField },
    countKey,
    countLabel,
    ...extra,
  })
}

function portalOnly(slug: string, countKey?: string, countLabel?: string) {
  registerWipe({
    collection: slug,
    table: slugToTable(slug),
    relations: { portals: ['portal'] },
    portal: { kind: 'hard-delete', field: 'portal' },
    user: { kind: 'none' },
    countKey,
    countLabel,
  })
}

function unlinkUser(slug: string, users: string[], extra?: Partial<WipeEntry>) {
  registerWipe({
    collection: slug,
    table: slugToTable(slug),
    relations: { users },
    portal: { kind: 'none' },
    user: users.map((field) => ({ kind: 'unlink', field })),
    ...extra,
  })
}

registerWipe({
  collection: 'portals',
  table: 'portals',
  relations: { portals: ['id'] },
  portal: { kind: 'hard-delete', column: 'id' },
  user: { kind: 'none' },
  countKey: 'portals',
  countLabel: 'The portal itself',
})

registerWipe({
  collection: 'users',
  table: 'users',
  relations: { portals: ['tenants.tenant'], users: ['id', 'updatedBy', 'onBehalfOf'] },
  portal: { kind: 'none' },
  user: [
    { kind: 'hard-delete', column: 'id' },
    { kind: 'unlink', field: 'updatedBy' },
    { kind: 'unlink', field: 'onBehalfOf' },
  ],
  joinClears: {
    user: [
      { table: 'users_sessions', column: '_parent_id' },
      { table: 'users_rels', column: 'parent_id' },
      { table: 'users_tenants', column: '_parent_id' },
    ],
    portal: [{ table: 'users_tenants', column: 'tenant_id' }],
  },
  countKey: 'accounts',
  countLabel: 'Accounts',
})

registerWipe({
  collection: 'media',
  table: 'media',
  relations: { portals: ['portal'] },
  portal: { kind: 'none' },
  user: { kind: 'none' },
  countKey: 'files',
  countLabel: 'Files',
})

registerWipe({
  collection: 'courses',
  table: 'courses',
  relations: { portals: ['portal'] },
  portal: [
    { kind: 'hard-delete', field: 'portal', extra: `origin = 'local'` },
    { kind: 'unlink', field: 'portal', extra: `origin = 'master' OR origin IS NULL` },
  ],
  user: { kind: 'none' },
  countKey: 'localCourses',
  countLabel: 'Courses made here',
})

registerWipe({
  collection: 'lessons',
  table: 'lessons',
  relations: { portals: ['portal'] },
  portal: [
    {
      kind: 'hard-delete',
      field: 'portal',
      extra: `course_id IN (SELECT id FROM courses WHERE origin = 'local' AND portal_id = {id})`,
    },
    {
      kind: 'unlink',
      field: 'portal',
      extra: `course_id NOT IN (SELECT id FROM courses WHERE origin = 'local' AND portal_id = {id})`,
    },
  ],
  user: { kind: 'none' },
  countKey: 'localTalks',
  countLabel: 'Talks made here',
})

registerWipe({
  collection: 'packs',
  table: 'packs',
  relations: { portals: ['portal'] },
  portal: [
    { kind: 'hard-delete', field: 'portal', extra: `owner = 'portal'` },
    { kind: 'unlink', field: 'portal', extra: `owner = 'master' OR owner IS NULL` },
  ],
  user: { kind: 'none' },
  countKey: 'packs',
  countLabel: 'Course packs',
})

registerWipe({
  collection: 'engagement-points',
  table: 'engagement_points',
  relations: { users: ['author', 'reviewedBy', 'audienceUsers'] },
  portal: { kind: 'none' },
  user: [
    { kind: 'unlink', field: 'author' },
    { kind: 'unlink', field: 'reviewedBy' },
  ],
  joinClears: { user: [{ table: 'engagement_points_rels', column: 'users_id' }] },
})

unlinkUser('talk-tiers', ['checkedBy'])

tenantOwned('answers', 'user', 'answers', 'Answers', { mediaColumns: ['image_id', 'audio_id', 'video_id'] })
tenantOwned('workbook-entries', 'user', 'workbook', 'Workbook entries', { mediaColumns: ['image_id'] })
tenantOwned('notifications', 'user', 'notifications', 'Notifications')
tenantOwned('completions', 'user', 'completions', 'Parts watched')
tenantOwned('harvest-entries', 'user', 'harvest', 'Harvest entries')
tenantOwned('drawn-to', 'user', 'drawnTo', 'Short clip notes')
tenantOwned('watch-sessions', 'user', 'watches', 'Watch history')
tenantOwned('lesson-visits', 'user', 'lessonVisits', 'Talk visits')
tenantOwned('seat-visits', 'user', 'seatVisits', 'Seat visits')
tenantOwned('rituals', 'user', 'rituals', 'Garden notes')
tenantOwned('placing-answers', 'user', 'placing', 'Joining answers')
tenantOwned('feedback-notes', 'author', 'feedbackNotes', 'Teacher notes', { mediaColumns: ['audio_id'] })

registerWipe({
  collection: 'schedules',
  table: 'schedules',
  relations: { portals: ['portal'], users: ['owner', 'learners'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: { kind: 'hard-delete', field: 'owner' },
  joinClears: { user: [{ table: 'schedules_rels', column: 'users_id' }] },
  countKey: 'plans',
  countLabel: 'Study plans',
})

portalOnly('events', 'nights', 'Nights')
tenantOwned('rsvps', 'user', 'rsvps', 'Night tickets')

registerWipe({
  collection: 'checkins',
  table: 'checkins',
  relations: { portals: ['portal'], users: ['user', 'byStaff'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: [
    { kind: 'hard-delete', field: 'user' },
    { kind: 'unlink', field: 'byStaff' },
  ],
  countKey: 'checkins',
  countLabel: 'Night check-ins',
})

tenantOwned('messages', 'author', 'board', 'Board notes')
portalOnly('access-codes', 'codes', 'Access codes')
portalOnly('adoptions', 'adoptions', 'Library links')

registerWipe({
  collection: 'gatherings',
  table: 'gatherings',
  relations: { portals: ['portal'], users: ['host', 'proposedBy'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: [
    { kind: 'unlink', field: 'host' },
    { kind: 'unlink', field: 'proposedBy' },
  ],
  countKey: 'gatherings',
  countLabel: 'Gatherings',
})

registerWipe({
  collection: 'gather-rsvps',
  table: 'gather_rsvps',
  relations: { portals: ['portal'], users: ['user', 'broughtBy'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: [
    { kind: 'hard-delete', field: 'user' },
    { kind: 'unlink', field: 'broughtBy' },
  ],
  countKey: 'gatherRsvps',
  countLabel: 'Gather replies',
})

tenantOwned('gather-checkins', 'user', 'gatherCheckins', 'Gather check-ins')
tenantOwned('gather-reflections', 'user', 'gatherReflections', 'Gather reflections')

registerWipe({
  collection: 'gather-photos',
  table: 'gather_photos',
  relations: { portals: ['portal'], users: ['postedBy'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: { kind: 'hard-delete', field: 'postedBy' },
  mediaColumns: ['image_id'],
  countKey: 'gatherPhotos',
  countLabel: 'Gather photos',
})

registerWipe({
  collection: 'circle-answers',
  table: 'circle_answers',
  relations: { portals: ['portal'], users: ['author'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: { kind: 'hard-delete', field: 'author' },
  countKey: 'circle',
  countLabel: 'Circle answers',
})

registerWipe({
  collection: 'placing-questions',
  table: 'placing_questions',
  relations: { portals: ['portal'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: { kind: 'none' },
})

registerWipe({
  collection: 'opening-configs',
  table: 'opening_configs',
  relations: { portals: ['portal'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: { kind: 'none' },
})

registerWipe({
  collection: 'heart-states',
  table: 'heart_states',
  relations: { users: ['user'] },
  portal: { kind: 'none' },
  user: { kind: 'hard-delete', field: 'user' },
})

registerWipe({
  collection: 'opening-answers',
  table: 'opening_answers',
  relations: { portals: ['portal'], users: ['user', 'mentors'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: { kind: 'hard-delete', field: 'user' },
  joinClears: { user: [{ table: 'opening_answers_rels', column: 'users_id' }] },
  countKey: 'opening',
  countLabel: 'Opening answers',
})

portalOnly('heart-contributions', 'contributions', 'Trend counts')

registerWipe({
  collection: 'view-as-sessions',
  table: 'view_as_sessions',
  relations: { portals: ['portal'], users: ['actor', 'target'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: [
    { kind: 'hard-delete', field: 'actor' },
    { kind: 'hard-delete', field: 'target' },
  ],
})

registerWipe({
  collection: 'audit-log',
  table: 'audit_log',
  relations: { portals: ['portal'], users: ['actor', 'target'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: [
    { kind: 'hard-delete', field: 'actor' },
    { kind: 'hard-delete', field: 'target' },
  ],
})

tenantOwned('compass-attempts', 'user', 'compass', 'Compass check-ins')
portalOnly('compass-mixes', 'compassMix', 'Compass mix')
tenantOwned('compass-serves', 'user', 'compassServes', 'Compass suggestions')

registerWipe({
  collection: 'feedback-summaries',
  table: 'feedback_summaries',
  relations: { portals: ['portal'], users: ['author'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: { kind: 'hard-delete', field: 'author' },
})

registerWipe({
  collection: 'sheet-imports',
  table: 'sheet_imports',
  relations: { portals: ['portal'], users: ['actor'] },
  portal: { kind: 'hard-delete', field: 'portal' },
  user: { kind: 'unlink', field: 'actor' },
})

unlinkUser('question-rewrites', ['author'])
unlinkUser('ai-step-versions', ['author'])
unlinkUser('ai-step-jobs', ['actor'])

export function ruleColumn(rule: WipeRule) {
  if (rule.column) return rule.column
  if (!rule.field) throw new Error('A wipe rule needs a field or a column.')
  return fieldToColumn(rule.field)
}

export function rulesFor(entry: WipeEntry, side: 'portal' | 'user') {
  return rules(side === 'portal' ? entry.portal : entry.user)
}

export { fieldToColumn, slugToTable }
