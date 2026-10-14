import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  LIVE_JOIN_CODES,
  coursesAfterPackCopy,
  coursesOpenedByCode,
  doorQuickPicks,
  indexOpeners,
  openedByLine,
  type PackCourses,
} from './code-courses'

const packs: PackCourses[] = [
  { id: 1, title: 'Jibril sittings', courses: [10, 11, 12] },
  { id: 2, title: 'Starter map', courses: [20, 21] },
  { id: 3, title: 'One Names class', courses: [11] },
]

const live = [
  { code: 'HEARTSDE-7RV9-GFGV', courses: [] as number[], packs: [1] },
  { code: 'HEARTSDE-9QFE-VNEV', courses: [] as number[], packs: [1, 2] },
  { code: 'HEARTSDE-DTRC-99ND', courses: [] as number[], packs: [2] },
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

test('the live join codes keep their letters, and the old packs stay on the codes that use them', () => {
  assert.deepEqual(LIVE_JOIN_CODES, ['HEARTSDE-7RV9-GFGV', 'HEARTSDE-9QFE-VNEV', 'HEARTSDE-DTRC-99ND'])
  const copied = live.map((code) => coursesAfterPackCopy(code, packs))
  assert.deepEqual(
    copied.map((code) => code.code),
    [...LIVE_JOIN_CODES],
  )
  const teacher = copied[0]
  const learner = copied[1]
  const admin = copied[2]
  assert.deepEqual(teacher.courses, [10, 11, 12])
  assert.deepEqual(learner.courses, [10, 11, 12, 20, 21])
  assert.deepEqual(admin.courses, [20, 21])
  for (const code of [teacher, learner]) {
    for (const courseId of packs[0].courses) assert.ok(code.courses.includes(courseId), `${code.code} keeps Jibril sittings`)
  }
  for (const code of [learner, admin]) {
    for (const courseId of packs[1].courses) assert.ok(code.courses.includes(courseId), `${code.code} keeps Starter map`)
  }
  assert.ok(!teacher.courses.includes(20))
  assert.ok(!admin.courses.includes(10))
})

test('a code that already names a course keeps it, and a repeated pack course is stored once', () => {
  const code = { code: 'HEARTSDE-9QFE-VNEV', courses: [11, 30], packs: [1, 3] }
  const copied = coursesAfterPackCopy(code, packs)
  assert.equal(copied.code, 'HEARTSDE-9QFE-VNEV')
  assert.deepEqual(copied.courses, [10, 11, 12, 30])
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
  const source = readFileSync(new URL('../migrations/20261014_180000_code_courses.ts', import.meta.url), 'utf8')
  assert.match(source, /INSERT INTO "access_codes_rels"/)
  assert.match(source, /'courses'/)
  assert.doesNotMatch(source, /SET\s+"code"/i)
  assert.doesNotMatch(source, /UPDATE\s+"access_codes"/i)
  assert.doesNotMatch(source, /HEARTSDE-/)
})
