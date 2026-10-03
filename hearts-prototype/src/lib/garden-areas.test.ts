import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOORS } from './doors'
import { GARDEN_AREAS, areaGrowth, areaOfDoor, growthStage } from './garden-areas'

test('the 20 working doors each belong to one tree', () => {
  const seen = new Map<number, string>()
  for (const area of GARDEN_AREAS) {
    for (const door of area.doors) {
      assert.equal(seen.has(door), false, `door ${door} is in ${seen.get(door)} and ${area.id}`)
      seen.set(door, area.id)
    }
  }
  assert.deepEqual([...seen.keys()].sort((a, b) => a - b), DOORS.map((door) => door.number))
  for (const door of DOORS) assert.equal(areaOfDoor(door.number)?.doors.includes(door.number), true)
  assert.equal(areaOfDoor(12)?.id, 'quran')
  assert.equal(areaOfDoor(16)?.id, 'character')
  assert.equal(areaOfDoor(null), null)
})

test('growth moves off a sapling with the first real thing done, and fills the tree when the area is done', () => {
  assert.equal(growthStage(0, 10), 0)
  assert.equal(growthStage(0, 0), 0)
  assert.equal(growthStage(1, 10), 1)
  assert.equal(growthStage(3, 10), 2)
  assert.equal(growthStage(6, 10), 3)
  assert.equal(growthStage(10, 10), 4)
  assert.equal(growthStage(1, 0), 1)
})

test('only finished full talks and their course questions fill a tree', () => {
  const lessons = [
    { id: 1, courseId: 7, title: 'His Books', door: 12 },
    { id: 2, courseId: 7, title: 'Ihsan', door: 16 },
    { id: 3, courseId: 8, title: 'Unplaced', door: null },
  ]
  const base = {
    lessons,
    points: [
      { id: 10, lessonId: 1 },
      { id: 11, lessonId: 2 },
    ],
    courses: [
      { id: 7, title: 'The names' },
      { id: 8, title: 'Elsewhere' },
    ],
    hrefForLesson: (lessonId: number, courseId: number) => `/course/${courseId}?part=${lessonId}`,
    hrefForCourse: (courseId: number) => `/course/${courseId}`,
    workbookHref: '/garden/workbook',
  }
  const empty = areaGrowth({ ...base, completions: [], answers: [] })
  assert.ok(empty.every((area) => area.stage === 0 && area.fruits.length === 0))

  // A hors d'oeuvre watch is not a completion, so passing no completion leaves every tree a sapling.
  const browsed = areaGrowth({ ...base, completions: [], answers: [] })
  assert.deepEqual(browsed.map((area) => area.done), [0, 0, 0, 0, 0])

  const grown = areaGrowth({
    ...base,
    completions: [{ lessonId: 1 }, { lessonId: 3 }],
    answers: [{ pointId: 10 }],
  })
  const quran = grown.find((area) => area.id === 'quran')!
  const character = grown.find((area) => area.id === 'character')!
  assert.equal(quran.done, 2)
  assert.equal(quran.total, 2)
  assert.equal(quran.stage, 4)
  assert.deepEqual(quran.fruits.map((fruit) => fruit.kind), ['talk', 'course'])
  assert.equal(quran.fruits[0].href, '/course/7?part=1')
  assert.equal(quran.fruits[0].workbookHref, '/garden/workbook')
  assert.equal(character.done, 0)
  assert.equal(character.stage, 0)
  assert.equal(grown.reduce((sum, area) => sum + area.done, 0), 2)
})
