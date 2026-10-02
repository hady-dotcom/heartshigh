import type { CollectionConfig } from 'payload'

import { portalIdOf } from './lib/ids'

// The app's own screens and actions use the local API with explicit portal checks.
// The REST and GraphQL endpoints that Payload mounts are for the master desk only.
const master = ({ req }: { req: { user?: { role?: string } | null } }) => req.user?.role === 'master'

const masterOnly = { read: master, create: master, update: master, delete: master }

export const Portals: CollectionConfig = {
  slug: 'portals',
  labels: { singular: 'Portal', plural: 'Portals' },
  admin: { useAsTitle: 'name' },
  access: masterOnly,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
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
      ],
    },
    { name: 'transcriptNote', type: 'textarea' },
    { name: 'sourceUrl', type: 'text' },
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
  fields: [
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true },
    { name: 'course', type: 'relationship', relationTo: 'courses' },
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
    { name: 'second', type: 'number', required: true, defaultValue: 0 },
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
  ],
}

export const Answers: CollectionConfig = {
  slug: 'answers',
  access: masterOnly,
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
  access: masterOnly,
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
]
