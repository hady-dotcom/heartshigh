import type { CollectionConfig } from 'payload'

import type { Access, Where } from 'payload'
import { portalIdOf } from './lib/ids'
import { slugProblem } from './lib/text-safety'
import { authorTextProblems, killListHits, markupProblems } from './lib/opening-data'
import { saidInTalk, tierProblem, timingProblems } from './lib/tiers'
import { APIError } from 'payload'
import { openingCollections } from './collections-opening'

// The app's own screens and actions use the local API with explicit portal checks.
// The REST and GraphQL endpoints that Payload mounts are for the master desk only.
const master = ({ req }: { req: { user?: { role?: string } | null } }) => req.user?.role === 'master'

const masterOnly = { read: master, create: master, update: master, delete: master }

function refuse(problems: string[]) {
  if (problems.length) throw new APIError(problems[0], 400, null, true)
}

/** Markup is refused on every save of these fields: they reach learners as text. */
function plainFields(...names: string[]) {
  return ({ data, originalDoc }: { data: Record<string, unknown>; originalDoc?: Record<string, unknown> }) => {
    const merged = { ...(originalDoc || {}), ...data }
    refuse(markupProblems(names.map((name) => [name.charAt(0).toUpperCase() + name.slice(1), typeof merged[name] === 'string' ? (merged[name] as string) : ''])))
    return data
  }
}

/**
 * P9: a learner reads their own rows; staff read their portal's rows; the master reads everything.
 * Teachers see answers only where the learner chose to share them.
 */
function ownerOrStaff(teacherNeedsShare: boolean, privateField?: string): Access {
  return ({ req }) => {
    const user = req.user as { id: number; role?: string; tenants?: { tenant?: unknown }[] } | null
    if (!user) return false
    const own: Where = { user: { equals: user.id } }
    // Rows the learner kept private go to their owner alone: never the master, a portal admin or a teacher.
    const notPrivate: Where[] = privateField ? [{ [privateField]: { not_equals: true } }] : []
    if (user.role === 'master') return privateField ? { or: [own, { and: notPrivate }] } : true
    if (user.role === 'learner') return own
    const portal = portalIdOf(user)
    if (!portal) return own
    const scoped: Where[] = [{ portal: { equals: portal } }, ...notPrivate]
    if (user.role === 'teacher' && teacherNeedsShare) scoped.push({ shareWithTeacher: { equals: true } })
    return { or: [own, { and: scoped }] }
  }
}

export const Portals: CollectionConfig = {
  slug: 'portals',
  labels: { singular: 'Portal', plural: 'Portals' },
  admin: { useAsTitle: 'name' },
  access: masterOnly,
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: (value: unknown) => slugProblem(String(value || '')) || true,
    },
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'mosque',
      options: [
        { label: 'Mosque', value: 'mosque' },
        { label: 'Church', value: 'church' },
        { label: 'Synagogue', value: 'synagogue' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'welcome', type: 'textarea' },
    { name: 'colour', type: 'text', defaultValue: '#1f4d3a' },
    {
      name: 'watchHistoryOptIn',
      type: 'checkbox',
      defaultValue: false,
      label: 'Share detailed watch history with teachers',
    },
    { name: 'organisationName', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'closed', type: 'checkbox', defaultValue: false },
    { name: 'logoUrl', type: 'text' },
    { name: 'showOthersAnswers', type: 'checkbox', defaultValue: true },
    { name: 'notificationEmails', type: 'text' },
    { name: 'theme', type: 'select', defaultValue: 'light', options: [{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }] },
    { name: 'calendarUrl', type: 'text' },
    { name: 'learnerWelcomeUrl', type: 'text' },
    { name: 'learnerIntroUrl', type: 'text' },
    { name: 'teacherWelcomeUrl', type: 'text' },
    { name: 'teacherIntroUrl', type: 'text' },
    { name: 'learnerLabel', type: 'text', defaultValue: 'Learner' },
    { name: 'teacherLabel', type: 'text', defaultValue: 'Teacher' },
    { name: 'wizardDone', type: 'checkbox', defaultValue: false },
  ],
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    cookies: {
      secure: false,
      sameSite: 'Lax',
    },
  },
  hooks: {
    beforeValidate: [
      ({ data, operation, req }) => {
        if (operation === 'create' && data?.role === 'master' && req.payloadAPI !== 'local' && req.user?.role !== 'master') {
          data.role = 'learner'
        }
        return data
      },
    ],
  },
  admin: { useAsTitle: 'email' },
  access: { admin: master, ...masterOnly },
  fields: [
    { name: 'name', type: 'text', required: true, saveToJWT: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'learner',
      saveToJWT: true,
      options: [
        { label: 'Master', value: 'master' },
        { label: 'Portal admin', value: 'portal-admin' },
        { label: 'Teacher', value: 'teacher' },
        { label: 'Learner', value: 'learner' },
      ],
    },
    { name: 'accessCode', type: 'relationship', relationTo: 'access-codes', saveToJWT: true },
    { name: 'extraPacks', type: 'relationship', relationTo: 'packs', hasMany: true },
    { name: 'onboarded', type: 'checkbox', defaultValue: false },
    { name: 'seenWelcome', type: 'checkbox', defaultValue: false },
    { name: 'startingClause', type: 'number' },
    { name: 'courseList', type: 'json' },
    { name: 'extraCourses', type: 'relationship', relationTo: 'courses', hasMany: true },
    { name: 'audience', type: 'text' },
    { name: 'shareWatch', type: 'checkbox', defaultValue: false },
    { name: 'joinedAt', type: 'date' },
    { name: 'nightAlerts', type: 'checkbox', defaultValue: false },
    { name: 'shareOpening', type: 'checkbox', defaultValue: false, label: 'Share my opening answers with my mentor' },
    { name: 'keepPlace', type: 'checkbox', defaultValue: false, label: 'Keep my place across devices' },
    { name: 'trendsOptIn', type: 'checkbox', defaultValue: false, label: 'Add my taps to the chapter’s trends' },
    { name: 'shareWithLearners', type: 'checkbox', defaultValue: false, label: 'Share answers with other learners, and see the answers they share' },
    { name: 'haptics', type: 'checkbox', defaultValue: true },
    { name: 'removed', type: 'checkbox', defaultValue: false },
    { name: 'updatedBy', type: 'relationship', relationTo: 'users' },
    { name: 'onBehalfOf', type: 'relationship', relationTo: 'users' },
  ],
}

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'audio/*', 'video/*', 'application/pdf'],
  },
  access: {
    read: ({ req }) => {
      if (req.user?.role === 'master') return true
      const portal = portalIdOf(req.user as { tenants?: { tenant?: unknown }[] } | null)
      return portal ? { portal: { equals: portal } } : false
    },
    create: master,
    update: master,
    delete: master,
  },
  fields: [
    { name: 'alt', type: 'text' },
    { name: 'portal', type: 'relationship', relationTo: 'portals' },
  ],
}

export const Clauses: CollectionConfig = {
  slug: 'clauses',
  admin: { useAsTitle: 'fragment' },
  access: masterOnly,
  fields: [
    { name: 'number', type: 'number', required: true, unique: true },
    { name: 'fragment', type: 'text', required: true },
    { name: 'core', type: 'text' },
    { name: 'teaching', type: 'textarea' },
    { name: 'series', type: 'textarea' },
  ],
}

export const Seats: CollectionConfig = {
  slug: 'seats',
  access: masterOnly,
  fields: [
    { name: 'clause', type: 'relationship', relationTo: 'clauses', required: true },
    { name: 'position', type: 'number', required: true },
    { name: 'text', type: 'textarea', required: true },
    { name: 'note', type: 'textarea' },
  ],
}

export const ShelfItems: CollectionConfig = {
  slug: 'shelf-items',
  access: masterOnly,
  fields: [
    { name: 'volume', type: 'text' },
    { name: 'section', type: 'text' },
    { name: 'title', type: 'text', required: true },
    { name: 'series', type: 'textarea' },
    { name: 'empty', type: 'checkbox', defaultValue: false },
  ],
}

export const Courses: CollectionConfig = {
  slug: 'courses',
  admin: { useAsTitle: 'title' },
  access: masterOnly,
  hooks: { beforeChange: [plainFields('title', 'summary', 'speaker')] },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'textarea' },
    { name: 'speaker', type: 'text' },
    {
      name: 'origin',
      type: 'select',
      required: true,
      defaultValue: 'master',
      options: [
        { label: 'Master library', value: 'master' },
        { label: 'Local', value: 'local' },
      ],
    },
    { name: 'portal', type: 'relationship', relationTo: 'portals' },
    { name: 'importable', type: 'checkbox', defaultValue: true },
    { name: 'isPublic', type: 'checkbox', defaultValue: false },
    { name: 'importToken', type: 'text', index: true },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
    {
      name: 'visibility',
      type: 'select',
      defaultValue: 'published',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
  ],
}

export const Units: CollectionConfig = {
  slug: 'units',
  admin: { useAsTitle: 'title' },
  access: masterOnly,
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true },
    { name: 'order', type: 'number', defaultValue: 1 },
  ],
}

export const Lessons: CollectionConfig = {
  slug: 'lessons',
  admin: { useAsTitle: 'title' },
  access: masterOnly,
  hooks: { beforeChange: [plainFields('title', 'sourceTitle', 'speaker')] },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'unit', type: 'relationship', relationTo: 'units', required: true },
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true },
    { name: 'portal', type: 'relationship', relationTo: 'portals' },
    { name: 'master', type: 'checkbox', defaultValue: false },
    { name: 'order', type: 'number', defaultValue: 1 },
    { name: 'speaker', type: 'text' },
    { name: 'youtubeUrl', type: 'text' },
    { name: 'youtubeId', type: 'text' },
    { name: 'muxAssetId', type: 'text', admin: { description: 'Mux-ready. Unused until a Mux asset is attached.' } },
    { name: 'muxPlaybackId', type: 'text' },
    { name: 'durationSeconds', type: 'number' },
    { name: 'transcript', type: 'textarea', maxLength: 500000 },
    {
      name: 'transcriptSource',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'None', value: 'none' },
        { label: 'YouTube', value: 'youtube' },
        { label: 'Upload', value: 'upload' },
        { label: 'Pending', value: 'pending' },
      ],
    },
    { name: 'transcriptNote', type: 'textarea' },
    { name: 'sourceUrl', type: 'text' },
    { name: 'csvSeq', type: 'number', admin: { description: 'Seq in HEARTS-8k-LINKS-for-bots.csv, for audit.' } },
    { name: 'starterLane', type: 'text' },
    { name: 'sourceTitle', type: 'text', admin: { description: 'The title exactly as YouTube and the links list have it.' } },
  ],
}

export const Resources: CollectionConfig = {
  slug: 'resources',
  access: masterOnly,
  fields: [
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true },
    { name: 'name', type: 'text', required: true },
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'link',
      options: [
        { label: 'Link', value: 'link' },
        { label: 'File', value: 'file' },
      ],
    },
    { name: 'url', type: 'text' },
    { name: 'showAtEnd', type: 'checkbox', defaultValue: false },
  ],
}

export const Packs: CollectionConfig = {
  slug: 'packs',
  labels: { singular: 'Course pack', plural: 'Course packs' },
  admin: { useAsTitle: 'title' },
  access: masterOnly,
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'textarea' },
    {
      name: 'owner',
      type: 'select',
      required: true,
      defaultValue: 'master',
      options: [
        { label: 'Master', value: 'master' },
        { label: 'Portal', value: 'portal' },
      ],
    },
    { name: 'portal', type: 'relationship', relationTo: 'portals' },
    { name: 'courses', type: 'relationship', relationTo: 'courses', hasMany: true },
  ],
}

export const Cuts: CollectionConfig = {
  slug: 'cuts',
  admin: { useAsTitle: 'land' },
  access: masterOnly,
  hooks: { beforeChange: [plainFields('hook', 'turn', 'land')] },
  fields: [
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true },
    { name: 'course', type: 'relationship', relationTo: 'courses' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Suggested', value: 'suggested' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    { name: 'placeholder', type: 'checkbox', defaultValue: false, admin: { description: 'A 0:00 to 0:20 stand-in until the cutting pass sets real in and out points.' } },
    { name: 'presentation', type: 'select', defaultValue: 'video', options: [{ label: 'Video', value: 'video' }, { label: 'Slide', value: 'slide' }] },
    { name: 'playable', type: 'checkbox', defaultValue: true },
    { name: 'lastError', type: 'text' },
    { name: 'start', type: 'number', required: true },
    { name: 'end', type: 'number', required: true },
    { name: 'timestamp', type: 'text' },
    { name: 'hook', type: 'textarea', required: true },
    { name: 'turn', type: 'textarea', required: true },
    { name: 'land', type: 'textarea', required: true },
    { name: 'fullContext', type: 'textarea' },
    { name: 'theme', type: 'text' },
    { name: 'device', type: 'text' },
    { name: 'whyItAllures', type: 'textarea' },
    { name: 'bestClause', type: 'number' },
    { name: 'clauseFragment', type: 'text' },
    { name: 'hangStrength', type: 'text' },
    { name: 'whyHang', type: 'textarea' },
    { name: 'seatHint', type: 'text' },
    { name: 'stage2Form', type: 'text' },
    { name: 'currencyNote', type: 'textarea' },
    { name: 'quoteConfidence', type: 'text' },
    { name: 'exemplarAffinity', type: 'text' },
    { name: 'kind', type: 'text' },
    { name: 'engine', type: 'text' },
    { name: 'seat', type: 'relationship', relationTo: 'seats' },
  ],
}

export const LadderItems: CollectionConfig = {
  slug: 'ladder-items',
  access: masterOnly,
  hooks: { beforeChange: [plainFields('quote')] },
  fields: [
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true },
    { name: 'cut', type: 'relationship', relationTo: 'cuts' },
    {
      name: 'kind',
      type: 'select',
      options: [
        { label: "Hors d'oeuvre", value: 'hors' },
        { label: 'Appetiser', value: 'appetiser' },
      ],
    },
    { name: 'start', type: 'number' },
    { name: 'end', type: 'number' },
    { name: 'quote', type: 'textarea' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
  ],
}

export const EngagementPoints: CollectionConfig = {
  slug: 'engagement-points',
  access: masterOnly,
  fields: [
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true },
    { name: 'cut', type: 'relationship', relationTo: 'cuts' },
    {
      name: 'triggerType',
      type: 'select',
      defaultValue: 'timestamp',
      options: [{ label: 'At a moment in the film', value: 'timestamp' }],
      admin: { description: 'Only timestamps for now. Other ways to set when a question appears can be added here.' },
    },
    { name: 'second', type: 'number', required: true, defaultValue: 0, admin: { description: 'Seconds into the source film (so the same question fires in the Hors and the Appetiser).' } },
    { name: 'nudges', type: 'json', admin: { description: 'Check-in nudges: [{ "option": "...", "scale": "belonging", "delta": -1 }]' } },
    { name: 'crisisOption', type: 'text' },
    { name: 'correctOption', type: 'text', admin: { description: 'For multiple choice: the option that is right, if any. Shown only after answering.' } },
    { name: 'timeLimitSec', type: 'number' },
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'reflection',
      options: [
        { label: 'Question', value: 'question' },
        { label: 'Multiple choice', value: 'multiple_choice' },
        { label: 'Reflection', value: 'reflection' },
        { label: 'Task', value: 'task' },
      ],
    },
    { name: 'prompt', type: 'textarea', required: true },
    { name: 'options', type: 'json' },
    {
      name: 'timing',
      type: 'select',
      defaultValue: 'immediate',
      options: [
        { label: 'Immediately', value: 'immediate' },
        { label: 'Future', value: 'future' },
      ],
    },
    { name: 'delayAmount', type: 'number', defaultValue: 0 },
    {
      name: 'delayUnit',
      type: 'select',
      defaultValue: 'week',
      options: [
        { label: 'Seconds', value: 'second' },
        { label: 'Minutes', value: 'minute' },
        { label: 'Hours', value: 'hour' },
        { label: 'Days', value: 'day' },
        { label: 'Weeks', value: 'week' },
      ],
    },
    { name: 'contingent', type: 'relationship', relationTo: 'engagement-points' },
    { name: 'link', type: 'text' },
    { name: 'timeLimit', type: 'number' },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    {
      name: 'audience',
      type: 'select',
      defaultValue: 'everyone',
      options: [
        { label: 'Everyone on this video', value: 'everyone' },
        { label: 'Only me', value: 'self' },
        { label: 'Selected learners', value: 'selected' },
      ],
    },
    { name: 'audienceUsers', type: 'relationship', relationTo: 'users', hasMany: true },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'published',
      options: [
        { label: 'Published', value: 'published' },
        { label: 'Draft, needs a human check', value: 'draft' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: { description: 'Learners only see published pop-ups. Drafts from the transcript wait here for a person.' },
    },
    { name: 'draftNote', type: 'text' },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'users' },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const merged = { ...(originalDoc || {}), ...data } as Record<string, unknown>
        const options = Array.isArray(merged.options) ? (merged.options as unknown[]).map(String) : []
        refuse(
          authorTextProblems([
            ['The question', typeof merged.prompt === 'string' ? merged.prompt : ''],
            ...options.map((option, index): [string, string] => [`Option ${index + 1}`, option]),
            ['The right answer', typeof merged.correctOption === 'string' ? merged.correctOption : ''],
            ['The crisis option', typeof merged.crisisOption === 'string' ? merged.crisisOption : ''],
          ]),
        )
        return data
      },
    ],
  },
}

/** One per talk: the hors d'oeuvre, the appetiser (hook, turn, land) and how the main opens. */
export const TalkTiers: CollectionConfig = {
  slug: 'talk-tiers',
  labels: { singular: 'Talk tiers', plural: 'Talk tiers' },
  access: masterOnly,
  fields: [
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true, unique: true, index: true },
    { name: 'horsStart', type: 'number', required: true, min: 0 },
    { name: 'horsEnd', type: 'number', required: true, min: 0 },
    { name: 'horsQuote', type: 'textarea' },
    { name: 'appetiserStart', type: 'number', required: true, min: 0 },
    { name: 'appetiserEnd', type: 'number', required: true, min: 0 },
    { name: 'hook', type: 'textarea' },
    { name: 'turn', type: 'textarea' },
    { name: 'land', type: 'textarea' },
    { name: 'hookAt', type: 'number', min: 0, admin: { description: 'When the hook is said, for the appetiser captions.' } },
    { name: 'turnAt', type: 'number', min: 0 },
    { name: 'landAt', type: 'number', min: 0 },
    { name: 'horsLines', type: 'json', admin: { description: "The hors d'oeuvre's sentences with their times: [{ at, text }]." } },
    { name: 'offerResume', type: 'checkbox', defaultValue: true, admin: { description: 'Offer "Resume from where the appetiser ended" next to the main, which always opens at 0:00.' } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft, needs a human check', value: 'draft' },
        { label: 'Checked by a person', value: 'checked' },
        { label: 'Rejected: learners never see this talk', value: 'rejected' },
      ],
    },
    { name: 'checkedAt', type: 'date' },
    { name: 'source', type: 'text', admin: { description: 'Where the draft came from, for example the caption file.' } },
    { name: 'note', type: 'textarea' },
    { name: 'checkedBy', type: 'relationship', relationTo: 'users' },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const merged = { ...(originalDoc || {}), ...data } as Record<string, unknown>
        const problem = tierProblem(merged)
        if (problem) throw new APIError(problem, 400, null, true)
        const lessonId = typeof merged.lesson === 'object' && merged.lesson ? (merged.lesson as { id: number }).id : Number(merged.lesson)
        const lesson = lessonId ? await req.payload.findByID({ collection: 'lessons', id: lessonId, depth: 0, overrideAccess: true }).catch(() => null) : null
        const duration = Number((lesson as { durationSeconds?: number } | null)?.durationSeconds || 0)
        const late = timingProblems(duration || null, [
          { label: "The hors d'oeuvre", start: Number(merged.horsStart), end: Number(merged.horsEnd) },
          { label: 'The appetiser', start: Number(merged.appetiserStart), end: Number(merged.appetiserEnd) },
        ])
        if (duration && late.length) throw new APIError(late[0], 400, null, true)
        // The hook, turn, land and hors d'oeuvre line are the speaker's words: plain text, word for word from the
        // talk. Without a transcript to check against, they are held to the kill list like any author's words.
        const lines: [string, string][] = [
          ["The hors d'oeuvre line", String(merged.horsQuote || '')],
          ['The hook', String(merged.hook || '')],
          ['The turn', String(merged.turn || '')],
          ['The land', String(merged.land || '')],
        ]
        refuse(markupProblems(lines))
        const { tierSourceText } = await import('./server/tier-source')
        const source = tierSourceText(lesson as { youtubeId?: string; transcript?: string } | null)
        for (const [label, line] of lines) {
          if (!line.trim()) continue
          if (source) {
            if (!saidInTalk(line, source)) throw new APIError(`${label} has to be the speaker's words, word for word from the transcript.`, 400, null, true)
          } else if (killListHits(line).length) throw new APIError(`${label} uses words learners never see from us: ${killListHits(line).join(', ')}.`, 400, null, true)
        }
        return data
      },
    ],
  },
}

export const Answers: CollectionConfig = {
  slug: 'answers',
  access: { read: ownerOrStaff(true, 'keepPrivate'), create: master, update: master, delete: master },
  fields: [
    { name: 'point', type: 'relationship', relationTo: 'engagement-points', required: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'lesson', type: 'relationship', relationTo: 'lessons' },
    { name: 'body', type: 'textarea' },
    { name: 'choice', type: 'text' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'audio', type: 'upload', relationTo: 'media' },
    { name: 'video', type: 'upload', relationTo: 'media' },
    { name: 'keepPrivate', type: 'checkbox', defaultValue: false },
    { name: 'shareWithTeacher', type: 'checkbox', defaultValue: false },
    { name: 'shareWithLearners', type: 'checkbox', defaultValue: false, admin: { description: 'The learner chose to let other learners on this video read it. Separate from sharing with their teacher.' } },
    { name: 'cut', type: 'relationship', relationTo: 'cuts' },
    { name: 'atSecond', type: 'number' },
    { name: 'viewingId', type: 'text' },
    { name: 'answeredAt', type: 'date' },
    { name: 'pendingSync', type: 'checkbox', defaultValue: false },
    { name: 'correct', type: 'checkbox' },
  ],
}

export const WorkbookEntries: CollectionConfig = {
  slug: 'workbook-entries',
  access: masterOnly,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'answer', type: 'relationship', relationTo: 'answers' },
    { name: 'lesson', type: 'relationship', relationTo: 'lessons' },
    { name: 'course', type: 'relationship', relationTo: 'courses' },
    { name: 'body', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'consent', type: 'checkbox', defaultValue: false },
    { name: 'teacherReply', type: 'textarea' },
    { name: 'repliedAt', type: 'date' },
  ],
}

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  access: masterOnly,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'href', type: 'text' },
    { name: 'read', type: 'checkbox', defaultValue: false },
    { name: 'channel', type: 'text', defaultValue: 'in-app' },
    { name: 'key', type: 'text', index: true },
  ],
}

export const AccessCodes: CollectionConfig = {
  slug: 'access-codes',
  labels: { singular: 'Access code', plural: 'Access codes' },
  admin: { useAsTitle: 'code' },
  access: masterOnly,
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, index: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'Learner', value: 'learner' },
        { label: 'Teacher', value: 'teacher' },
        { label: 'Admin', value: 'admin' },
        { label: 'Parent', value: 'parent' },
      ],
    },
    { name: 'packs', type: 'relationship', relationTo: 'packs', hasMany: true },
    { name: 'requiredCourses', type: 'relationship', relationTo: 'courses', hasMany: true },
    { name: 'linkedTeacherCode', type: 'relationship', relationTo: 'access-codes' },
    { name: 'parentMentorCode', type: 'relationship', relationTo: 'access-codes' },
    { name: 'label', type: 'text', admin: { description: 'A name for the desk, so codes can be found without printing them.' } },
    { name: 'expiresAt', type: 'date', admin: { description: 'After this moment the code stops working.' } },
    { name: 'maxUses', type: 'number', min: 1, admin: { description: 'Leave empty for no limit.' } },
    { name: 'uses', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'disabled', type: 'checkbox', defaultValue: false },
  ],
}

export const Adoptions: CollectionConfig = {
  slug: 'adoptions',
  access: masterOnly,
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Pack', value: 'pack' },
        { label: 'Course', value: 'course' },
      ],
    },
    { name: 'pack', type: 'relationship', relationTo: 'packs' },
    { name: 'course', type: 'relationship', relationTo: 'courses' },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
    { name: 'order', type: 'number', defaultValue: 1 },
  ],
}

export const PlacingQuestions: CollectionConfig = {
  slug: 'placing-questions',
  access: masterOnly,
  fields: [
    { name: 'prompt', type: 'textarea', required: true },
    { name: 'why', type: 'text' },
    { name: 'options', type: 'json', required: true },
    { name: 'order', type: 'number', defaultValue: 1 },
    { name: 'portal', type: 'relationship', relationTo: 'portals' },
  ],
}

export const PlacingAnswers: CollectionConfig = {
  slug: 'placing-answers',
  access: { read: ownerOrStaff(false), create: master, update: master, delete: master },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'question', type: 'relationship', relationTo: 'placing-questions', required: true },
    { name: 'choice', type: 'text', required: true },
  ],
}

export const Tags: CollectionConfig = {
  slug: 'tags',
  access: masterOnly,
  fields: [
    {
      name: 'item',
      type: 'relationship',
      relationTo: ['lessons', 'cuts', 'engagement-points', 'courses'],
      required: true,
    },
    { name: 'clause', type: 'relationship', relationTo: 'clauses' },
    { name: 'seat', type: 'relationship', relationTo: 'seats' },
    { name: 'lane', type: 'relationship', relationTo: 'lanes' },
    { name: 'weight', type: 'number', defaultValue: 1, min: 0, max: 1 },
    {
      name: 'state',
      type: 'select',
      defaultValue: 'suggested',
      options: [
        { label: 'Suggested', value: 'suggested' },
        { label: 'Confirmed', value: 'confirmed' },
      ],
    },
    { name: 'note', type: 'text' },
  ],
}

export const HarvestEntries: CollectionConfig = {
  slug: 'harvest-entries',
  access: masterOnly,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'lesson', type: 'relationship', relationTo: 'lessons' },
    {
      name: 'kind',
      type: 'select',
      options: [
        { label: "Qur'an", value: 'quran' },
        { label: 'Hadith', value: 'hadith' },
      ],
    },
    { name: 'text', type: 'textarea' },
    { name: 'reference', type: 'text' },
    { name: 'timestamp', type: 'text' },
    { name: 'context', type: 'textarea' },
  ],
}

export const Schedules: CollectionConfig = {
  slug: 'schedules',
  access: masterOnly,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'owner', type: 'relationship', relationTo: 'users' },
    { name: 'learners', type: 'relationship', relationTo: 'users', hasMany: true },
    {
      name: 'targetType',
      type: 'select',
      options: [
        { label: 'Course', value: 'course' },
        { label: 'Course pack', value: 'pack' },
      ],
    },
    { name: 'course', type: 'relationship', relationTo: 'courses' },
    { name: 'pack', type: 'relationship', relationTo: 'packs' },
    { name: 'startDate', type: 'text', required: true },
    { name: 'endDate', type: 'text', required: true },
    { name: 'weekdays', type: 'json', required: true },
    { name: 'slots', type: 'json', required: true },
  ],
}

export const Events: CollectionConfig = {
  slug: 'events',
  access: masterOnly,
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'startsAt', type: 'date' },
    { name: 'place', type: 'text' },
    { name: 'note', type: 'textarea' },
  ],
}

export const Rsvps: CollectionConfig = {
  slug: 'rsvps',
  access: masterOnly,
  fields: [
    { name: 'event', type: 'relationship', relationTo: 'events', required: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'status', type: 'text', defaultValue: 'going' },
    { name: 'ticket', type: 'text' },
    {
      name: 'ticketKind',
      type: 'select',
      defaultValue: 'held',
      options: [
        { label: 'Earned this week', value: 'earned' },
        { label: 'Held for a host to welcome', value: 'held' },
      ],
    },
  ],
}

export const Checkins: CollectionConfig = {
  slug: 'checkins',
  access: masterOnly,
  fields: [
    { name: 'event', type: 'relationship', relationTo: 'events', required: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'override', type: 'checkbox', defaultValue: false },
    { name: 'byStaff', type: 'relationship', relationTo: 'users' },
  ],
}

export const Messages: CollectionConfig = {
  slug: 'messages',
  access: masterOnly,
  fields: [
    { name: 'author', type: 'relationship', relationTo: 'users' },
    { name: 'body', type: 'textarea', required: true },
  ],
}

export const Completions: CollectionConfig = {
  slug: 'completions',
  access: masterOnly,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true },
    { name: 'percent', type: 'number', defaultValue: 100 },
    { name: 'onTime', type: 'checkbox' },
  ],
}

export const FeedbackNotes: CollectionConfig = {
  slug: 'feedback-notes',
  access: masterOnly,
  fields: [
    { name: 'answer', type: 'relationship', relationTo: 'answers', required: true },
    { name: 'author', type: 'relationship', relationTo: 'users', required: true },
    { name: 'second', type: 'number', required: true, defaultValue: 0 },
    { name: 'body', type: 'textarea', required: true },
    { name: 'audio', type: 'upload', relationTo: 'media' },
  ],
}

export const WatchSessions: CollectionConfig = {
  slug: 'watch-sessions',
  access: masterOnly,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true },
    { name: 'seconds', type: 'number', defaultValue: 0 },
  ],
}

export const LessonVisits: CollectionConfig = {
  slug: 'lesson-visits',
  access: masterOnly,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true },
  ],
}

export const SeatVisits: CollectionConfig = {
  slug: 'seat-visits',
  access: masterOnly,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'seat', type: 'relationship', relationTo: 'seats', required: true },
    { name: 'returned', type: 'checkbox', defaultValue: false },
  ],
}

export const Rituals: CollectionConfig = {
  slug: 'rituals',
  access: masterOnly,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'note', type: 'text', required: true },
  ],
}

export const collections = [
  Portals,
  Users,
  Media,
  Clauses,
  Seats,
  ShelfItems,
  Courses,
  Units,
  Lessons,
  Resources,
  Packs,
  Cuts,
  LadderItems,
  EngagementPoints,
  Answers,
  WorkbookEntries,
  Notifications,
  AccessCodes,
  TalkTiers,
  Adoptions,
  PlacingQuestions,
  PlacingAnswers,
  Tags,
  HarvestEntries,
  Schedules,
  Events,
  Rsvps,
  Checkins,
  Messages,
  Completions,
  FeedbackNotes,
  WatchSessions,
  LessonVisits,
  SeatVisits,
  Rituals,
  ...openingCollections,
]
