import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Payload, Where } from 'payload'
import {
  assembleUse,
  counted,
  editorLink,
  joinCodeName,
  librarySummary,
  linksFromDoc,
  youtubeThumb,
  youtubeWatch,
  type RelationField,
} from '../../src/lib/library-catalogue'
import { courseFilms, libraryPage, libraryTotals, whoUsesCourse } from '../../src/server/library-catalogue'

const CODE_RELS: RelationField[] = [
  { name: 'packs', collections: ['packs'], hasMany: true },
  { name: 'requiredCourses', collections: ['courses'], hasMany: true },
  { name: 'portal', collections: ['portals'], hasMany: false },
]
const PACK_RELS: RelationField[] = [
  { name: 'courses', collections: ['courses'], hasMany: true },
  { name: 'portal', collections: ['portals'], hasMany: false },
]
const ADOPT_RELS: RelationField[] = [
  { name: 'pack', collections: ['packs'], hasMany: false },
  { name: 'course', collections: ['courses'], hasMany: false },
  { name: 'portal', collections: ['portals'], hasMany: false },
]

test('the library line, thumbnail and watch link use the real words and the YouTube picture', () => {
  assert.equal(librarySummary({ courses: 12, films: 6000, playable: 5400, clips: 800 }), '12 courses · 6000 films · 5400 playable · 800 clips')
  assert.equal(youtubeThumb('ECaTWkof57E'), 'https://img.youtube.com/vi/ECaTWkof57E/mqdefault.jpg')
  assert.equal(youtubeWatch('https://www.youtube.com/watch?v=ECaTWkof57E'), 'https://www.youtube.com/watch?v=ECaTWkof57E')
  assert.equal(youtubeThumb('not an id'), null)
  assert.equal(youtubeWatch(''), null)
  assert.equal(counted(1, 'film', 'films'), '1 film')
  assert.equal(counted(4, 'approved clip', 'approved clips'), '4 approved clips')
  assert.equal(editorLink('/master/library/3', { part: 9, films: 2 }), '/master/library/3?part=9&films=2')
  assert.equal(editorLink('/master/library/3', { part: 9, films: 1 }), '/master/library/3?part=9')
  assert.equal(joinCodeName({ id: 4, label: 'elm-learner', code: 'ELM1' }), 'elm-learner (ELM1)')
})

test('who opens a course still names codes and portals when packs are gone', () => {
  const code = linksFromDoc({ id: 4, label: 'leeds-learner', code: 'LEEDS', requiredCourses: [5], portal: 3 }, CODE_RELS, 'leeds-learner (LEEDS)')
  const adoption = linksFromDoc({ id: 8, course: 5, portal: 4 }, ADOPT_RELS, '')
  const use = assembleUse(5, [], [code], [adoption], [
    { id: 3, name: 'Leeds Chapter' },
    { id: 4, name: 'Harbour' },
  ])
  assert.deepEqual(use.packs, [])
  assert.deepEqual(use.codes, ['leeds-learner (LEEDS)'])
  assert.deepEqual(use.portals, ['Harbour', 'Leeds Chapter'])
})

test('a pack only counts when it actually contains the course', () => {
  const sitting = linksFromDoc({ id: 1, title: 'Jibril sittings', courses: [5, 6] }, PACK_RELS, 'Jibril sittings')
  const other = linksFromDoc({ id: 2, title: 'Other', courses: [9], portal: 9 }, PACK_RELS, 'Other')
  const learner = linksFromDoc({ id: 4, packs: [1], portal: 9, label: 'elm-learner', code: 'ELM1' }, CODE_RELS, 'elm-learner (ELM1)')
  const stranger = linksFromDoc({ id: 5, packs: [2], portal: 9 }, CODE_RELS, 'other-code')
  const adoption = linksFromDoc({ id: 7, pack: 1, portal: 9 }, ADOPT_RELS, '')
  const use = assembleUse(5, [sitting, other], [learner, stranger], [adoption], [{ id: 9, name: 'East London Mosque' }])
  assert.deepEqual(use.packs, ['Jibril sittings'])
  assert.deepEqual(use.codes, ['elm-learner (ELM1)'])
  assert.deepEqual(use.portals, ['East London Mosque'])
})

type Row = Record<string, unknown> & { id: number }

function same(left: unknown, right: unknown) {
  const value = left && typeof left === 'object' && 'id' in left ? (left as { id: unknown }).id : left
  return value === right || String(value ?? '') === String(right ?? '')
}

function matchCond(current: unknown, cond: Record<string, unknown>) {
  if ('equals' in cond) return same(current, cond.equals)
  if ('not_equals' in cond) {
    if (current == null || current === '') return false
    return String(current) !== String(cond.not_equals)
  }
  if ('in' in cond) return (cond.in as unknown[]).some((item) => same(current, item))
  if ('contains' in cond) {
    const list = Array.isArray(current) ? current : current == null ? [] : [current]
    return list.some((item) => same(item, cond.contains))
  }
  return false
}

function match(doc: Row, where?: Where): boolean {
  if (!where) return true
  const rec = where as Record<string, unknown>
  if (Array.isArray(rec.and)) return (rec.and as Where[]).every((part) => match(doc, part))
  if (Array.isArray(rec.or)) return (rec.or as Where[]).some((part) => match(doc, part))
  return Object.entries(rec).every(([key, cond]) => matchCond(doc[key], cond as Record<string, unknown>))
}

function sortRows(docs: Row[], sort?: string) {
  if (!sort) return docs
  const desc = sort.startsWith('-')
  const key = desc ? sort.slice(1) : sort
  return [...docs].sort((a, b) => {
    const left = a[key]
    const right = b[key]
    const cmp = typeof left === 'number' && typeof right === 'number' ? left - right : String(left ?? '').localeCompare(String(right ?? ''))
    return desc ? -cmp : cmp
  })
}

function memory(data: Record<string, Row[]>, fields: Record<string, { name: string; type?: string; relationTo?: string; hasMany?: boolean }[]>) {
  return {
    config: {
      collections: Object.entries(fields).map(([slug, list]) => ({ slug, fields: list })),
    },
    async count({ collection, where }: { collection: string; where?: Where }) {
      return { totalDocs: (data[collection] || []).filter((doc) => match(doc, where)).length }
    },
    async find({ collection, where, limit, page, sort }: { collection: string; where?: Where; limit: number; page?: number; sort?: string }) {
      const docs = sortRows((data[collection] || []).filter((doc) => match(doc, where)), sort)
      const current = page || 1
      const start = (current - 1) * limit
      return { docs: docs.slice(start, start + limit), totalDocs: docs.length, page: current, totalPages: Math.max(1, Math.ceil(docs.length / limit)) }
    },
  } as unknown as Payload
}

function bigLibrary() {
  const courses: Row[] = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    title: `Course ${String(index + 1).padStart(2, '0')}`,
    origin: 'master',
    speaker: 'A speaker',
  }))
  const lessons: Row[] = []
  let lessonId = 1
  for (const course of courses) {
    for (let index = 0; index < 200; index += 1) {
      lessons.push({
        id: lessonId,
        title: `Film ${lessonId}`,
        course: course.id,
        order: index + 1,
        youtubeId: index % 5 === 0 ? '' : 'ECaTWkof57E',
        videoProvider: 'youtube',
        tooShort: false,
        binned: false,
      })
      lessonId += 1
    }
  }
  const cuts: Row[] = courses.flatMap((course) => [
    { id: course.id * 2, course: course.id, lesson: 1, status: 'approved', tooShort: false, binned: false },
    { id: course.id * 2 + 1, course: course.id, lesson: 1, status: 'draft', tooShort: false, binned: false },
  ])
  return memory(
    { courses, lessons, cuts, packs: [], 'access-codes': [], adoptions: [], portals: [] },
    { courses: [{ name: 'title', type: 'text' }], lessons: [{ name: 'course', type: 'relationship', relationTo: 'courses' }], cuts: [{ name: 'course', type: 'relationship', relationTo: 'courses' }] },
  )
}

test('totals and pages stay real past the old 300 row cap', async () => {
  const payload = bigLibrary()
  const totals = await libraryTotals(payload)
  assert.equal(totals.courses, 30)
  assert.equal(totals.films, 6000)
  assert.equal(totals.playable, 4800)
  assert.equal(totals.clips, 60)
  assert.equal(librarySummary(totals), '30 courses · 6000 films · 4800 playable · 60 clips')

  const first = await libraryPage(payload, '1')
  const second = await libraryPage(payload, '2')
  assert.equal(first.total, 30)
  assert.equal(first.pages, 2)
  assert.equal(first.courses.length, 24)
  assert.equal(second.courses.length, 6)
  assert.equal(first.stats.get(first.courses[0].id)?.films, 200)
  assert.equal(first.stats.get(first.courses[0].id)?.approved, 1)
  assert.equal(first.stats.get(first.courses[0].id)?.youtubeId, 'ECaTWkof57E')
  assert.notEqual(first.courses[0].id, second.courses[0].id)

  const films = await courseFilms(payload, 1, '9')
  assert.equal(films.total, 200)
  assert.equal(films.pages, 5)
  assert.equal(films.page, 5)
  assert.equal(films.lessons.length, 8)
})

test('the course page reads packs when they exist, and codes when they do not', async () => {
  const withPacks = memory(
    {
      packs: [
        { id: 1, title: 'Jibril sittings', courses: [5, 6] },
        { id: 2, title: 'Other', courses: [9], portal: 9 },
      ],
      'access-codes': [
        { id: 4, label: 'elm-learner', code: 'ELM1', packs: [1], portal: 9 },
        { id: 5, label: 'other-code', code: 'OTHER', packs: [2], portal: 9 },
      ],
      adoptions: [{ id: 7, kind: 'pack', pack: 1, portal: 9 }],
      portals: [{ id: 9, name: 'East London Mosque' }],
    },
    {
      packs: [
        { name: 'title', type: 'text' },
        { name: 'courses', type: 'relationship', relationTo: 'courses', hasMany: true },
        { name: 'portal', type: 'relationship', relationTo: 'portals' },
      ],
      'access-codes': [
        { name: 'packs', type: 'relationship', relationTo: 'packs', hasMany: true },
        { name: 'requiredCourses', type: 'relationship', relationTo: 'courses', hasMany: true },
        { name: 'portal', type: 'relationship', relationTo: 'portals' },
      ],
      adoptions: [
        { name: 'pack', type: 'relationship', relationTo: 'packs' },
        { name: 'course', type: 'relationship', relationTo: 'courses' },
        { name: 'portal', type: 'relationship', relationTo: 'portals' },
      ],
      portals: [{ name: 'name', type: 'text' }],
    },
  )
  const packed = await whoUsesCourse(withPacks, 5)
  assert.deepEqual(packed, { codes: ['elm-learner (ELM1)'], packs: ['Jibril sittings'], portals: ['East London Mosque'] })

  const noPacks = memory(
    {
      'access-codes': [{ id: 4, label: 'leeds-learner', code: 'LEEDS', requiredCourses: [5], portal: 3 }],
      adoptions: [{ id: 8, course: 5, portal: 4 }],
      portals: [
        { id: 3, name: 'Leeds Chapter' },
        { id: 4, name: 'Harbour' },
      ],
    },
    {
      'access-codes': [
        { name: 'requiredCourses', type: 'relationship', relationTo: 'courses', hasMany: true },
        { name: 'portal', type: 'relationship', relationTo: 'portals' },
      ],
      adoptions: [
        { name: 'course', type: 'relationship', relationTo: 'courses' },
        { name: 'portal', type: 'relationship', relationTo: 'portals' },
      ],
      portals: [{ name: 'name', type: 'text' }],
    },
  )
  const open = await whoUsesCourse(noPacks, 5)
  assert.deepEqual(open.packs, [])
  assert.deepEqual(open.codes, ['leeds-learner (LEEDS)'])
  assert.deepEqual(open.portals, ['Harbour', 'Leeds Chapter'])
})
