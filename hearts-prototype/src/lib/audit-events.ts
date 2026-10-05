/** Staff-action event names and the plain sentences the Activity log shows. */

export const AUDITED_COLLECTIONS = ['portals', 'access-codes', 'packs', 'courses', 'users'] as const

export type AuditedCollection = (typeof AUDITED_COLLECTIONS)[number]

/** Fields that must never appear in audit detail, even as values. */
export const SECRET_FIELDS = new Set([
  'password',
  'hash',
  'salt',
  'token',
  'totpSecret',
  'backupCodes',
  'resetPasswordToken',
  'resetPasswordExpiration',
])

/** Learner-written text. We only record that the field changed, never the words. */
export const PRIVATE_TEXT_FIELDS = new Set([
  'body',
  'answer',
  'text',
  'prompt',
  'reply',
  'teacherReply',
  'note',
  'reflection',
  'caption',
])

export const NOISY_USER_FIELDS = new Set([
  'updatedAt',
  'updatedBy',
  'onBehalfOf',
  'lastLoggedInAt',
  'loginAttempts',
  'lockUntil',
  'onboarded',
  'seenWelcome',
  'sessions',
  'collection',
])

export type AuditSentenceInput = {
  event: string
  actorName?: string | null
  actorRole?: string | null
  targetName?: string | null
  portalName?: string | null
  reason?: string | null
  detail?: Record<string, unknown> | null
  count?: number
}

export function roleWords(role?: string | null) {
  if (role === 'master') return 'master'
  if (role === 'portal-admin') return 'portal admin'
  if (role === 'teacher') return 'teacher'
  if (role === 'learner') return 'learner'
  return role || 'someone'
}

function who(name?: string | null, role?: string | null) {
  const label = (name || '').trim() || 'Someone'
  return role ? `${label} (${roleWords(role)})` : label
}

function reasonLine(reason?: string | null) {
  const text = (reason || '').trim()
  return text ? ` Reason: ${text}` : ''
}

function listCount(detail?: Record<string, unknown> | null) {
  const ids = detail?.ids
  if (Array.isArray(ids)) return ids.length
  const n = Number(detail?.count)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** One warm British sentence for a desk row. Never includes passwords or answer text. */
export function auditSentence(input: AuditSentenceInput) {
  const actor = who(input.actorName, input.actorRole)
  const target = (input.targetName || '').trim() || 'someone'
  const portal = (input.portalName || '').trim()
  const inPortal = portal ? ` in ${portal}` : ''
  const detail = input.detail || {}
  const count = input.count || listCount(detail)
  const fields = Array.isArray(detail.fields) ? (detail.fields as string[]).filter(Boolean) : []
  const kind = String(detail.kind || detail.action || '')

  switch (input.event) {
    case 'view_as.start':
      return `${actor} viewed the app as ${target}.${reasonLine(input.reason)}`
    case 'view_as.stop':
      return `${actor} stopped viewing as ${target}.`
    case 'view_as.write':
      return `${actor} made a change while viewing as ${target}.${reasonLine(input.reason)}`
    case 'view_as.write_on':
      return `${actor} turned on changes while viewing as ${target}.${reasonLine(input.reason)}`
    case 'view_as.write_off':
      return `${actor} turned off changes while viewing as ${target}.`
    case 'view_as.denied':
      return `${actor} was refused from viewing as ${target}.${reasonLine(input.reason)}`
    case 'view_as.blocked_write':
      return `${actor} tried to change something while viewing as ${target}, and it was blocked.`
    case 'feedback.export':
      return `${actor} downloaded shared answers${inPortal}.`
    case 'people.export':
      return `${actor} downloaded the people list${inPortal}.`
    case 'people.import':
      return `${actor} added ${count || 'some'} people from a list${inPortal}.`
    case 'people.bulk':
      return `${actor} used a bulk action (${kind || 'change'}) on ${count || 'some'} people${inPortal}.${reasonLine(input.reason)}`
    case 'audit.export':
      return `${actor} downloaded the activity log${inPortal}.`
    case 'users.grant':
      return `${actor} gave a course to ${target}${inPortal}.`
    case 'users.role':
      return `${actor} changed ${target}'s role${inPortal}.${reasonLine(input.reason)}`
    case 'users.suspend':
      return `${actor} paused ${target}'s account.${reasonLine(input.reason)}`
    case 'users.restore':
      return `${actor} restored ${target}'s account.${reasonLine(input.reason)}`
    case 'users.create':
      return `${actor} added ${target}${inPortal}.`
    case 'users.update':
      return `${actor} changed ${target}'s account${fields.length ? ` (${fields.join(', ')})` : ''}${inPortal}.`
    case 'users.delete':
      return `${actor} removed ${target}'s account${inPortal}.`
    case 'access-codes.create':
      return `${actor} made an access code${inPortal}.`
    case 'access-codes.update':
      return `${actor} changed an access code${inPortal}${fields.includes('disabled') ? ' (on or off)' : ''}.`
    case 'access-codes.delete':
      return `${actor} deleted an access code${inPortal}.`
    case 'portals.update':
      return `${actor} changed portal settings${inPortal}${fields.includes('closed') ? ' (open or closed)' : ''}${fields.includes('features') ? ' (features)' : ''}.`
    case 'portals.create':
      return `${actor} opened a portal${portal ? ` (${portal})` : ''}.`
    case 'packs.create':
      return `${actor} made a course pack${inPortal}.`
    case 'packs.update':
      return `${actor} changed a course pack${inPortal}.`
    case 'packs.delete':
      return `${actor} deleted a course pack${inPortal}.`
    case 'courses.create':
      return `${actor} made a course${inPortal}.`
    case 'courses.update':
      return `${actor} changed a course${inPortal}.`
    case 'courses.delete':
      return `${actor} deleted a course${inPortal}.`
    case 'class.create':
      return `${actor} made a class${inPortal}.`
    case 'class.update':
      return `${actor} changed a class${inPortal}.`
    case 'class.delete':
      return `${actor} deleted a class${inPortal}.`
    case 'class.members':
      return `${actor} changed who is in a class${inPortal}.`
    case 'class.join-rule':
      return `${actor} set a class for new joiners on a code${inPortal}.`
    case 'trash.remove':
      return `${actor} moved something to Recently removed${inPortal}.`
    case 'trash.restore':
      return `${actor} restored something from Recently removed${inPortal}.`
    case 'trash.empty':
      return `${actor} emptied Recently removed${inPortal}.`
    case 'retention.run':
      return `${actor} ran the data clean-up.`
    case 'ops.backup':
      return `A backup finished${detail.ok === false ? ' with a problem' : ''}.`
    case 'ops.restore':
      return `A restore drill finished${detail.ok === false ? ' with a problem' : ''}.`
    default:
      if (input.event.startsWith('sheet.')) return `${actor} used the master sheet (${input.event.replace('sheet.', '')})${inPortal}.`
      if (input.event.startsWith('ai.')) return `${actor} used an AI desk action (${input.event.replace('ai.', '')}).`
      if (input.event.startsWith('compass.')) return `${actor} opened Compass for ${target || 'a portal'}${inPortal}.`
      return `${actor} did ${input.event.replace(/[._]/g, ' ')}${inPortal}.${reasonLine(input.reason)}`
  }
}

export function isAuditedCollection(slug: string): slug is AuditedCollection {
  return (AUDITED_COLLECTIONS as readonly string[]).includes(slug)
}

export function eventForStaffChange(slug: string, operation: 'create' | 'update' | 'delete', fields: string[]) {
  if (slug === 'users') {
    if (operation === 'create') return 'users.create'
    if (operation === 'delete') return 'users.delete'
    if (fields.includes('removed')) {
      return fields.includes('removed:false') ? 'users.restore' : 'users.suspend'
    }
    if (fields.includes('role')) return 'users.role'
    if (fields.includes('extraCourses') || fields.includes('extraPacks') || fields.includes('courseList')) return 'users.grant'
    return 'users.update'
  }
  return `${slug}.${operation}`
}

/** Only field names that changed, never values that could be a password or a reflection. */
export function changedFieldNames(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  const prev = before || {}
  const next = after || {}
  const names = new Set([...Object.keys(prev), ...Object.keys(next)])
  const out: string[] = []
  for (const name of names) {
    if (name === 'id' || name === 'createdAt' || name === 'updatedAt' || NOISY_USER_FIELDS.has(name)) continue
    if (SECRET_FIELDS.has(name)) {
      if (Object.prototype.hasOwnProperty.call(next, name) && next[name] !== undefined) out.push(name)
      continue
    }
    if (JSON.stringify(prev[name]) !== JSON.stringify(next[name])) out.push(name)
  }
  if (prev.removed === true && next.removed === false) out.push('removed:false')
  return out
}

export function safeAuditDetail(detail: Record<string, unknown> | null | undefined) {
  if (!detail) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(detail)) {
    if (SECRET_FIELDS.has(key) || PRIVATE_TEXT_FIELDS.has(key)) continue
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      out[key] = safeAuditDetail(value as Record<string, unknown>)
      continue
    }
    if (typeof value === 'string' && (SECRET_FIELDS.has(key) || PRIVATE_TEXT_FIELDS.has(key))) continue
    out[key] = value
  }
  return out
}
