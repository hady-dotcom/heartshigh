import { APIError, type Access, type CollectionConfig, type GlobalConfig, type Where } from 'payload'
import { idOf, portalIdOf } from './lib/ids'
import { killListHits } from './lib/opening-data'
import { SCALE_KEYS } from './lib/heart'
import { hasMarkup, helpContactProblems } from './lib/text-safety'

type U = { id?: number; role?: string; tenants?: { tenant?: unknown }[] } | null | undefined
const userOf = (req: { user?: unknown }) => req.user as U
const isMaster = (user: U) => user?.role === 'master'
const isStaff = (user: U) => Boolean(user && user.role && user.role !== 'learner')
const master: Access = ({ req }) => isMaster(userOf(req))
const staff: Access = ({ req }) => isStaff(userOf(req))
const signedIn: Access = ({ req }) => Boolean(req.user)
const nobody: Access = () => false

/** Rows of the caller's own portal, or everything for the master. */
const ownPortal: Access = ({ req }) => {
  const user = userOf(req)
  if (isMaster(user)) return true
  const portal = portalIdOf(user)
  if (user?.role === 'portal-admin' && portal) return { portal: { equals: portal } }
  return false
}

const scaleOptions = SCALE_KEYS.map((key) => ({ label: key, value: key }))

export const HeartScales: CollectionConfig = {
  slug: 'heart-scales',
  labels: { singular: 'Heart scale', plural: 'Heart scales' },
  admin: { useAsTitle: 'leonName' },
  access: { read: staff, create: master, update: master, delete: master },
  fields: [
    { name: 'key', type: 'select', options: scaleOptions, required: true, unique: true },
    { name: 'leonName', type: 'text', required: true },
    { name: 'room', type: 'select', options: ['appetites', 'heat', 'unsettled', 'lights'].map((value) => ({ label: value, value })) },
    { name: 'polishLabel', type: 'text' },
    { name: 'season', type: 'select', options: ['youth', 'health', 'wealth', 'freeTime', 'life'].map((value) => ({ label: value, value })) },
    { name: 'firstOpenRead', type: 'checkbox', defaultValue: true },
    { name: 'anchors', type: 'json', admin: { description: 'Leon’s rung texts, for authors only.' } },
  ],
}

export const Lanes: CollectionConfig = {
  slug: 'lanes',
  admin: { useAsTitle: 'title' },
  access: { read: signedIn, create: master, update: master, delete: master },
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data?.optInOnly || !data.key) return data
        const scenes = await req.payload.find({ collection: 'opening-scenes', overrideAccess: true, depth: 0, limit: 50 })
        const own = await req.payload.find({ collection: 'lanes', overrideAccess: true, depth: 0, limit: 1, where: { key: { equals: data.key } } })
        const laneId = own.docs[0]?.id
        const used = laneId && scenes.docs.some((scene) => ((scene as { options?: { intentLane?: unknown }[] }).options || []).some((option) => idOf(option.intentLane) === laneId))
        if (used) throw new Error('An opt-in lane cannot be the intent lane of any opening option.')
        return data
      },
    ],
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'scale', type: 'relationship', relationTo: 'heart-scales' },
    { name: 'fit', type: 'select', options: ['natural', 'workable', 'weak'].map((value) => ({ label: value, value })) },
    { name: 'clauses', type: 'array', fields: [{ name: 'clause', type: 'relationship', relationTo: 'clauses', required: true }, { name: 'rank', type: 'number', required: true, defaultValue: 1 }] },
    { name: 'seats', type: 'relationship', relationTo: 'seats', hasMany: true },
    { name: 'seriesNote', type: 'textarea' },
    { name: 'optInOnly', type: 'checkbox', defaultValue: false },
    { name: 'excludeClauses', type: 'relationship', relationTo: 'clauses', hasMany: true, admin: { description: 'Never served in this lane during a learner’s first 7 days.' } },
    { name: 'order', type: 'number', defaultValue: 1 },
    { name: 'reachPhrase', type: 'text' },
    { name: 'pseudo', type: 'checkbox', defaultValue: false, admin: { description: 'The default lane behind “Just show me something”. Never scored or shown.' } },
    {
      name: 'starters',
      type: 'array',
      fields: [
        { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true },
        { name: 'role', type: 'select', required: true, options: ['first', 'next', 'mains'].map((value) => ({ label: value, value })) },
        { name: 'order', type: 'number', defaultValue: 1 },
      ],
    },
  ],
}

type OptionData = { key?: string; label?: string; replyPill?: string; nudges?: { scale?: string; delta?: number }[]; crisis?: boolean; intentLane?: unknown; spineFirst?: boolean }

/** Publish rules from spec 5.1.3. Returns a list of plain-English problems. */
export async function sceneProblems(
  payload: { find: (args: Record<string, unknown>) => Promise<{ docs: unknown[] }> },
  scene: { id?: number; key?: string; status?: string; caption?: string; subline?: string; options?: OptionData[] },
) {
  const problems: string[] = []
  const options = scene.options || []
  const normal = options.filter((option) => !option.crisis)
  if (normal.length < 4 || normal.length > 6) problems.push(`A scene needs 4 to 6 options. This one has ${normal.length}.`)
  const scales = (await payload.find({ collection: 'heart-scales', overrideAccess: true, depth: 0, limit: 20 })).docs as { key?: string; firstOpenRead?: boolean }[]
  const closed = new Set(scales.filter((scale) => scale.firstOpenRead === false).map((scale) => scale.key))
  for (const option of options) {
    for (const item of option.nudges || []) {
      if (item.scale && closed.has(item.scale) && Number(item.delta || 0) !== 0) problems.push(`“${option.label}” nudges ${item.scale}, which is never read at first open.`)
    }
  }
  const text = [scene.caption, scene.subline, ...options.flatMap((option) => [option.label, option.replyPill])].filter(Boolean).join(' \n ')
  const hits = killListHits(text)
  if (hits.length) problems.push(`Learner-facing words on the kill list: ${hits.join(', ')}.`)
  const others = (await payload.find({ collection: 'opening-scenes', overrideAccess: true, depth: 0, limit: 50, where: { status: { equals: 'published' } } })).docs as { id: number; key?: string; options?: OptionData[] }[]
  const peers = others.filter((row) => row.id !== scene.id && row.key !== scene.key)
  if (scene.status === 'published' && peers.length + 1 > 6) problems.push('No more than six scenes can be published.')
  const crisisHere = options.filter((option) => option.crisis).length
  const crisisElsewhere = peers.reduce((sum, row) => sum + (row.options || []).filter((option) => option.crisis).length, 0)
  if (crisisHere > 1 || (crisisHere && crisisElsewhere)) problems.push('Exactly one published scene carries the crisis option. There is already one.')
  if (scene.status === 'published' && !crisisHere && !crisisElsewhere) problems.push('One published scene has to carry the crisis option.')
  return problems
}

export const OpeningScenes: CollectionConfig = {
  slug: 'opening-scenes',
  labels: { singular: 'Opening scene', plural: 'Opening scenes' },
  admin: { useAsTitle: 'key' },
  access: { read: signedIn, create: master, update: master, delete: master },
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (data.status !== 'published') return data
        const problems = await sceneProblems(req.payload as never, { ...data, id: originalDoc?.id })
        if (problems.length) throw new Error(problems.join(' '))
        if (originalDoc && JSON.stringify(originalDoc.options) !== JSON.stringify(data.options)) data.version = Number(originalDoc.version || 1) + 1
        return data
      },
    ],
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'order', type: 'number', defaultValue: 1 },
    { name: 'caption', type: 'text', required: true, admin: { description: 'Mark one word with **double stars** to emphasise it.' } },
    { name: 'subline', type: 'text' },
    { name: 'scene', type: 'upload', relationTo: 'media' },
    { name: 'layout', type: 'select', defaultValue: 'grid4', options: ['grid4', 'bubbles', 'doorsCarousel'].map((value) => ({ label: value, value })) },
    {
      name: 'options',
      type: 'array',
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
        { name: 'replyPill', type: 'text' },
        { name: 'nudges', type: 'array', fields: [{ name: 'scale', type: 'select', options: scaleOptions, required: true }, { name: 'delta', type: 'number', min: -1, max: 1, defaultValue: 0 }] },
        { name: 'intentLane', type: 'relationship', relationTo: 'lanes' },
        { name: 'spineFirst', type: 'checkbox', defaultValue: false },
        { name: 'crisis', type: 'checkbox', defaultValue: false },
        { name: 'sensitivity', type: 'select', defaultValue: 'normal', options: [{ label: 'Normal', value: 'normal' }, { label: 'Private', value: 'private' }], access: { update: ({ req }) => isMaster(userOf(req)) } },
      ],
    },
    { name: 'status', type: 'select', defaultValue: 'draft', options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }] },
    { name: 'version', type: 'number', defaultValue: 1 },
    { name: 'adaptedFrom', type: 'textarea' },
  ],
}

/** A portal may hide at most this many scenes, and never the one carrying the help option. */
export const MAX_HIDDEN_SCENES = 2

type ConfigData = {
  portal?: unknown
  wording?: { scene?: unknown; caption?: string | null; subline?: string | null; labels?: unknown }[] | null
  hiddenScenes?: unknown[] | null
  helpContacts?: { label?: string | null; phone?: string | null; url?: string | null; hours?: string | null }[] | null
}

type Finder = { find: (args: Record<string, unknown>) => Promise<{ docs: unknown[] }> }

/**
 * Every rule the portal opening screen applies, enforced on the collection so REST, the admin panel and the
 * custom forms all meet the same checks. Returns plain-English problems.
 */
export async function openingConfigProblems(payload: Finder, data: ConfigData, original: ConfigData | null) {
  const problems: string[] = []
  if (original && 'portal' in data && (idOf(data.portal) || null) !== (idOf(original.portal) || null)) problems.push('The portal of an opening setup cannot be changed.')
  const next: ConfigData = { ...(original || {}), ...data }
  const hidden = [...new Set(((next.hiddenScenes as unknown[]) || []).map((row) => idOf(row)).filter((id): id is number => Boolean(id)))]
  if (hidden.length > MAX_HIDDEN_SCENES) problems.push(`A portal can hide at most ${MAX_HIDDEN_SCENES} scenes. This would hide ${hidden.length}.`)
  if (hidden.length) {
    const scenes = (await payload.find({ collection: 'opening-scenes', overrideAccess: true, depth: 0, limit: 50, where: { id: { in: hidden } } })).docs as { id: number; options?: { crisis?: boolean }[] }[]
    if (scenes.some((scene) => (scene.options || []).some((option) => option.crisis))) problems.push('The scene with the help option cannot be hidden.')
  }
  for (const row of next.wording || []) {
    const labels = row.labels && typeof row.labels === 'object' ? Object.values(row.labels as Record<string, unknown>).map(String) : []
    const words = [row.caption || '', row.subline || '', ...labels]
    if (words.some(hasMarkup)) problems.push('Scene wording is plain text: no HTML or script.')
    const hits = killListHits(words.join(' \n '))
    if (hits.length) problems.push(`These words are not used with learners: ${hits.join(', ')}.`)
    if ((row.caption || '').length > 140 || (row.subline || '').length > 200 || labels.some((label) => label.length > 80)) problems.push('Keep captions under 140 characters, sublines under 200 and labels under 80.')
  }
  if ('helpContacts' in data) {
    const contacts = next.helpContacts || []
    if (!contacts.length && (original?.helpContacts || []).length) problems.push('Keep at least one help contact. The help screen must always offer someone to call.')
    contacts.forEach((contact, index) => {
      for (const problem of helpContactProblems(contact)) problems.push(`Help contact ${index + 1}: ${problem}`)
    })
  }
  return [...new Set(problems)]
}

export const OpeningConfigs: CollectionConfig = {
  slug: 'opening-configs',
  labels: { singular: 'Opening setup', plural: 'Opening setups' },
  access: { read: ownPortal, create: master, update: ownPortal, delete: master },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        const problems = await openingConfigProblems(req.payload as never, data as ConfigData, operation === 'update' ? (originalDoc as ConfigData) || null : null)
        if (problems.length) throw new APIError(problems.join(' '), 400, null, true)
        return data
      },
    ],
  },
  fields: [
    { name: 'portal', type: 'relationship', relationTo: 'portals', unique: true, admin: { description: 'Empty for the master default.' } },
    {
      name: 'wording',
      type: 'array',
      fields: [
        { name: 'scene', type: 'relationship', relationTo: 'opening-scenes', required: true },
        { name: 'caption', type: 'text' },
        { name: 'subline', type: 'text' },
        { name: 'labels', type: 'json' },
      ],
    },
    { name: 'hiddenScenes', type: 'relationship', relationTo: 'opening-scenes', hasMany: true },
    { name: 'defaultClip', type: 'relationship', relationTo: 'cuts' },
    { name: 'helpContacts', type: 'array', fields: [{ name: 'label', type: 'text', required: true }, { name: 'phone', type: 'text' }, { name: 'url', type: 'text' }, { name: 'hours', type: 'text' }] },
    { name: 'trendsContributionPrompt', type: 'checkbox', defaultValue: true },
  ],
}

const ownerOnly: Access = ({ req }) => (req.user ? ({ user: { equals: (req.user as { id: number }).id } } as Where) : false)

export const HeartStates: CollectionConfig = {
  slug: 'heart-states',
  access: { read: ownerOnly, update: ownerOnly, delete: ownerOnly, create: signedIn },
  hooks: {
    beforeChange: [
      // P3: the row is always the signed-in owner's own, and only while Keep my place across devices is on.
      async ({ data, req, operation }) => {
        if (req.payloadAPI === 'local' && !req.user) return data
        const user = req.user as { id: number; keepPlace?: boolean | null } | null
        if (!user) throw new APIError('Sign in first.', 401, null, true)
        const fresh = (await req.payload.findByID({ collection: 'users', id: user.id, overrideAccess: true, depth: 0 })) as { keepPlace?: boolean | null }
        if (!fresh.keepPlace) throw new APIError('Turn on Keep my place across devices first.', 403, null, true)
        if (operation === 'create' || 'user' in data) data.user = user.id
        return data
      },
    ],
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, unique: true },
    { name: 'state', type: 'json', required: true },
  ],
}

/**
 * Private rows go to their owner alone. The owner test is the signed-in account itself, never a view-as target,
 * so the master, portal staff and anyone viewing as the learner get none of them.
 */
const openingRead: Access = ({ req }) => {
  const user = userOf(req)
  if (!user?.id) return false
  const own: Where = { user: { equals: user.id } }
  if (!isStaff(user)) return own
  const shared: Where[] = [{ private: { equals: false } }, { staffVisible: { equals: true } }, { supersededAt: { exists: false } }]
  if (!isMaster(user)) {
    const portal = portalIdOf(user)
    if (!portal) return own
    shared.push({ portal: { equals: portal } })
    if (user.role === 'teacher') shared.push({ mentors: { contains: user.id } })
  }
  return { or: [own, { and: shared }] }
}

export const OpeningAnswers: CollectionConfig = {
  slug: 'opening-answers',
  labels: { singular: 'Opening answer', plural: 'Opening answers' },
  access: { read: openingRead, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'portal', type: 'relationship', relationTo: 'portals' },
    { name: 'scene', type: 'relationship', relationTo: 'opening-scenes' },
    { name: 'sceneKey', type: 'text', required: true },
    { name: 'optionKey', type: 'text', required: true, admin: { description: 'The option key, or pass, or not-reached.' } },
    { name: 'labelSnapshot', type: 'text' },
    { name: 'private', type: 'checkbox', defaultValue: false },
    { name: 'staffVisible', type: 'checkbox', defaultValue: false, admin: { description: 'Set by the server: not private, and the learner shares opening answers with their mentor.' } },
    { name: 'mentors', type: 'relationship', relationTo: 'users', hasMany: true },
    { name: 'scenesVersion', type: 'number' },
    { name: 'answeredAt', type: 'date' },
    { name: 'recordedAt', type: 'date' },
    { name: 'supersededAt', type: 'date' },
  ],
}

export const HeartContributions: CollectionConfig = {
  slug: 'heart-contributions',
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'portal', type: 'relationship', relationTo: 'portals', required: true },
    { name: 'isoWeek', type: 'text', required: true },
    { name: 'doorKey', type: 'text' },
    { name: 'scenePasses', type: 'json' },
    { name: 'laneTop2', type: 'json' },
    { name: 'nonceHash', type: 'text', index: true },
  ],
}

const auditRead: Access = ({ req }) => {
  const user = userOf(req)
  if (isMaster(user)) return true
  const portal = portalIdOf(user)
  return user?.role === 'portal-admin' && portal ? { portal: { equals: portal } } : false
}

export const ViewAsSessions: CollectionConfig = {
  slug: 'view-as-sessions',
  access: { read: auditRead, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'actor', type: 'relationship', relationTo: 'users', required: true },
    { name: 'actorRole', type: 'text' },
    { name: 'target', type: 'relationship', relationTo: 'users', required: true },
    { name: 'targetRole', type: 'text' },
    { name: 'portal', type: 'relationship', relationTo: 'portals' },
    { name: 'reason', type: 'textarea', required: true },
    { name: 'token', type: 'text', index: true, access: { read: () => false } },
    { name: 'startedAt', type: 'date' },
    { name: 'lastSeenAt', type: 'date' },
    { name: 'expiresAt', type: 'date' },
    { name: 'endedAt', type: 'date' },
    { name: 'endReason', type: 'select', options: ['exit', 'idle-timeout', 'max-timeout', 'replaced', 'actor-signed-out', 'role-changed', 'target-removed', 'portal-closed'].map((value) => ({ label: value, value })) },
    { name: 'writeEnabled', type: 'checkbox', defaultValue: false },
    { name: 'writeUntil', type: 'date' },
    { name: 'returnTo', type: 'text' },
    { name: 'ipHash', type: 'text' },
    { name: 'userAgent', type: 'text' },
  ],
}

export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  labels: { singular: 'Audit entry', plural: 'Audit log' },
  admin: { useAsTitle: 'event' },
  access: { read: auditRead, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'event', type: 'text', required: true, index: true },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'actorRole', type: 'text' },
    { name: 'target', type: 'relationship', relationTo: 'users' },
    { name: 'targetRole', type: 'text' },
    { name: 'portal', type: 'relationship', relationTo: 'portals' },
    { name: 'sessionId', type: 'text', index: true },
    { name: 'reason', type: 'textarea' },
    { name: 'at', type: 'date', required: true },
    { name: 'ipHash', type: 'text' },
    { name: 'detail', type: 'json' },
  ],
}

export const MasterFlags: GlobalConfig = {
  slug: 'master-flags',
  label: 'Master flags',
  access: { read: master, update: master },
  fields: [
    {
      name: 'popupOverPlayer',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Pop-up questions sit over the YouTube player, as in the old system. Off: the card fills the screen below the paused player (YouTube’s embed rules).' },
    },
    {
      name: 'chromeOverPlayer',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'The board’s full-bleed look: caption, right rail, speaker bar and gold pill over the clip. Off: all of it sits around the player.' },
    },
    {
      name: 'showUnchecked',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Show unchecked talks to learners. On, draft tiers play in the feed. Off (the default for production), only talks a person has approved on the review desk play.' },
    },
    {
      name: 'horsMaxSeconds',
      type: 'number',
      defaultValue: 45,
      min: 20,
      max: 180,
      admin: { description: "Longest hors d'oeuvre the desk will save, in seconds. 15 to 20 is the usual length and only a warning. Longer than this is refused." },
    },
  ],
}

export const openingCollections = [HeartScales, Lanes, OpeningScenes, OpeningConfigs, HeartStates, OpeningAnswers, HeartContributions, ViewAsSessions, AuditLog]
