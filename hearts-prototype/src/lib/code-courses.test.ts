import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { COPY_PACK_COURSES_SQL, MISSING_PACK_COURSES_SQL } from './code-courses-sql'
import {
  LIVE_JOIN_CODES,
  coursesAfterPackCopy,
  coursesOpenedByCode,
  doorQuickPicks,
  indexOpeners,
  openedByLine,
  type PackCourses,
} from './code-courses'

const liveCourses = Array.from({ length: 75 }, (_, index) => index + 1)

const packs: PackCourses[] = [
  { id: 1, title: 'Jibril sittings', courses: [10, 11, 12] },
  { id: 2, title: 'Starter map', courses: [20, 21] },
  { id: 3, title: 'Live library', courses: liveCourses },
]

const live = [
  { code: 'HEARTSDE-7RV9-GFGV', courses: [] as number[], packs: [3] },
  { code: 'HEARTSDE-9QFE-VNEV', courses: [] as number[], packs: [3] },
  { code: 'HEARTSDE-DTRC-99ND', courses: [] as number[], packs: [3] },
]

test('copying pack courses onto a code does not change what that code opens', () => {
  for (const code of live) {
    const before = coursesOpenedByCode(code, packs)
    const copied = coursesAfterPackCopy(code, packs)
    const after = coursesOpenedByCode({ courses: copied.courses, packs: code.packs }, packs)
    assert.equal(copied.code, code.code)
    assert.deepEqual(after, before)
    assert.deepEqual(copied.courses, before)
  }
})

test('the live join codes keep their letters, and every code opens pack 3 courses 1 to 75', () => {
  assert.deepEqual(LIVE_JOIN_CODES, ['HEARTSDE-7RV9-GFGV', 'HEARTSDE-9QFE-VNEV', 'HEARTSDE-DTRC-99ND'])
  const copied = live.map((code) => coursesAfterPackCopy(code, packs))
  assert.deepEqual(
    copied.map((code) => code.code),
    [...LIVE_JOIN_CODES],
  )
  for (const code of copied) assert.deepEqual(code.courses, liveCourses, code.code)
})

test('a teacher code that is already two courses short is filled up to the whole pack', () => {
  const teacher = { code: 'HEARTSDE-7RV9-GFGV', courses: liveCourses.slice(0, 73), packs: [3] }
  const copied = coursesAfterPackCopy(teacher, packs)
  assert.equal(copied.code, teacher.code)
  assert.deepEqual(copied.courses, liveCourses)
})

test('Jibril sittings and Starter map stay on the codes that use them', () => {
  const named = [
    { code: 'HEARTSDE-7RV9-GFGV', courses: [] as number[], packs: [1] },
    { code: 'HEARTSDE-9QFE-VNEV', courses: [] as number[], packs: [1, 2] },
    { code: 'HEARTSDE-DTRC-99ND', courses: [] as number[], packs: [2] },
  ]
  const copied = named.map((code) => coursesAfterPackCopy(code, packs))
  assert.deepEqual(copied[0].courses, [10, 11, 12])
  assert.deepEqual(copied[1].courses, [10, 11, 12, 20, 21])
  assert.deepEqual(copied[2].courses, [20, 21])
})

test('a code that already names a course keeps it, and a repeated pack course is stored once', () => {
  const code = { code: 'HEARTSDE-9QFE-VNEV', courses: [11, 30], packs: [1, 2] }
  const copied = coursesAfterPackCopy(code, packs)
  assert.equal(copied.code, 'HEARTSDE-9QFE-VNEV')
  assert.deepEqual(copied.courses, [10, 11, 12, 20, 21, 30])
})

test('a whole door is offered only when a course is tagged with it', () => {
  assert.deepEqual(doorQuickPicks([{ id: 1, title: 'Untagged', doors: [] }]), [])
  const picks = doorQuickPicks([
    { id: 4, title: 'Prayer', doors: [{ number: 5, code: 'W5', title: 'Prayer' }] },
    { id: 5, title: 'Also prayer', doors: [{ number: 5, code: 'W5', title: 'Prayer' }] },
    { id: 6, title: 'Out of range', doors: [{ number: 21, code: 'W21', title: 'No' }] },
  ])
  assert.equal(picks.length, 1)
  assert.equal(picks[0].code, 'W5')
  assert.deepEqual(picks[0].courseIds, [4, 5])
})

test('the library line names the codes and portals that open a course', () => {
  const openers = indexOpeners({
    codes: [
      { code: 'HEARTSDE-9QFE-VNEV', label: 'Elm learner', courses: [10], packs: [] },
      { code: 'HEARTSDE-7RV9-GFGV', label: '', courses: [], packs: [1] },
    ],
    packs,
    portals: [{ id: 4, name: 'East London' }],
    adoptions: [{ portalId: 4, kind: 'pack', packId: 1, courseId: null }],
  })
  const row = openers.get(10)
  assert.ok(row)
  assert.deepEqual(row?.portals, ['East London'])
  assert.ok(row?.codes.includes('Elm learner'))
  assert.ok(row?.codes.includes('HEARTSDE-7RV9-GFGV'))
  assert.match(openedByLine(row!.codes, row!.portals), /East London can open this course/)
  assert.match(openedByLine(row!.codes, row!.portals), /These codes can open it/)
  assert.equal(openedByLine([], []), 'No code or portal opens this yet.')
})

test('the migration copies course links and does not rewrite a join code', () => {
  const source = readFileSync(new URL('../migrations/20261015_130000_code_courses.ts', import.meta.url), 'utf8')
  assert.match(source, /COPY_PACK_COURSES_SQL/)
  assert.match(COPY_PACK_COURSES_SQL, /INSERT INTO "access_codes_rels"/)
  assert.match(COPY_PACK_COURSES_SQL, /'courses'/)
  assert.doesNotMatch(source, /SET\s+"code"/i)
  assert.doesNotMatch(COPY_PACK_COURSES_SQL, /UPDATE\s+"access_codes"/i)
  assert.doesNotMatch(source + COPY_PACK_COURSES_SQL, /HEARTSDE-/)
})

test('elm-teacher keeps courses 33 and 34 from its pack on top of the courses already stored', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE access_codes (id INTEGER PRIMARY KEY, code TEXT, label TEXT);
    CREATE TABLE access_codes_rels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      "order" INTEGER,
      parent_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      packs_id INTEGER,
      courses_id INTEGER
    );
    CREATE TABLE packs_rels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      "order" INTEGER,
      parent_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      courses_id INTEGER
    );
  `)
  db.prepare('INSERT INTO access_codes (id, code, label) VALUES (1, ?, ?)').run('ELM-TEACHER', 'elm-teacher')
  db.prepare('INSERT INTO access_codes_rels ("order", parent_id, path, packs_id) VALUES (1, 1, ?, 1)').run('packs')
  for (let courseId = 1; courseId <= 34; courseId += 1) {
    db.prepare('INSERT INTO packs_rels ("order", parent_id, path, courses_id) VALUES (?, 1, ?, ?)').run(courseId, 'courses', courseId)
  }
  for (let courseId = 1; courseId <= 32; courseId += 1) {
    db.prepare('INSERT INTO access_codes_rels ("order", parent_id, path, courses_id) VALUES (?, 1, ?, ?)').run(courseId + 1, 'courses', courseId)
  }
  db.exec(COPY_PACK_COURSES_SQL)
  const stored = (db.prepare(`SELECT courses_id FROM access_codes_rels WHERE parent_id = 1 AND path = 'courses' ORDER BY courses_id`).all() as { courses_id: number }[]).map((row) => row.courses_id)
  assert.deepEqual(stored, Array.from({ length: 34 }, (_, index) => index + 1))
  assert.equal((db.prepare('SELECT code FROM access_codes WHERE id = 1').get() as { code: string }).code, 'ELM-TEACHER')
  const missing = db.prepare(MISSING_PACK_COURSES_SQL).all() as unknown[]
  assert.deepEqual(missing, [])
  db.close()
})

test('the copy gives admin, learner and teacher exactly courses 1 to 75 from pack 3', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE access_codes (id INTEGER PRIMARY KEY, code TEXT, label TEXT);
    CREATE TABLE access_codes_rels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      "order" INTEGER,
      parent_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      packs_id INTEGER,
      courses_id INTEGER
    );
    CREATE TABLE packs_rels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      "order" INTEGER,
      parent_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      courses_id INTEGER
    );
  `)
  for (let courseId = 1; courseId <= 75; courseId += 1) {
    db.prepare('INSERT INTO packs_rels ("order", parent_id, path, courses_id) VALUES (?, 3, ?, ?)').run(courseId, 'courses', courseId)
  }
  const codes = [
    { id: 1, code: 'HEARTSDE-DTRC-99ND', label: 'admin' },
    { id: 2, code: 'HEARTSDE-9QFE-VNEV', label: 'learner' },
    { id: 3, code: 'HEARTSDE-7RV9-GFGV', label: 'teacher' },
  ]
  for (const code of codes) {
    db.prepare('INSERT INTO access_codes (id, code, label) VALUES (?, ?, ?)').run(code.id, code.code, code.label)
    db.prepare('INSERT INTO access_codes_rels ("order", parent_id, path, packs_id) VALUES (1, ?, ?, 3)').run(code.id, 'packs')
  }
  // The teacher already has 73 of the 75, plus two required courses that share the course column.
  for (let courseId = 1; courseId <= 73; courseId += 1) {
    db.prepare('INSERT INTO access_codes_rels ("order", parent_id, path, courses_id) VALUES (?, 3, ?, ?)').run(courseId, 'courses', courseId)
  }
  db.prepare('INSERT INTO access_codes_rels ("order", parent_id, path, courses_id) VALUES (74, 3, ?, 1)').run('requiredCourses')
  db.prepare('INSERT INTO access_codes_rels ("order", parent_id, path, courses_id) VALUES (75, 3, ?, 2)').run('requiredCourses')

  db.exec(COPY_PACK_COURSES_SQL)
  db.exec(COPY_PACK_COURSES_SQL)

  for (const code of codes) {
    const stored = (db.prepare(`SELECT courses_id FROM access_codes_rels WHERE parent_id = ? AND path = 'courses' ORDER BY courses_id`).all(code.id) as { courses_id: number }[]).map((row) => row.courses_id)
    assert.deepEqual(stored, liveCourses, code.label)
    const letters = db.prepare('SELECT code FROM access_codes WHERE id = ?').get(code.id) as { code: string }
    assert.equal(letters.code, code.code)
  }
  db.close()
})
