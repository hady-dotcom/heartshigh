import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOORS } from './doors'
import { GARDEN_AREAS, areaGrowth, areaOfDoor, growthStage, migrateGardenProgress, readStoredGarden } from './garden-areas'

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
  assert.equal(areaOfDoor(12)?.id, 'iman')
  assert.equal(areaOfDoor(16)?.id, 'ihsan')
  assert.equal(areaOfDoor(3)?.id, 'islam')
  assert.equal(areaOfDoor(17)?.id, 'hour')
  assert.equal(areaOfDoor(1)?.id, 'sitting')
  assert.equal(areaOfDoor(20)?.id, 'sitting')
  assert.equal(areaOfDoor(null), null)
  assert.deepEqual(GARDEN_AREAS.map((area) => area.note), [
    'Islam: what you do',
    'Iman: what you believe',
    'Ihsan: worship as though you see Him',
    "The Hour: what's coming",
    'The Sitting: how Jibril came to teach',
  ])
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
  const iman = grown.find((area) => area.id === 'iman')!
  const ihsan = grown.find((area) => area.id === 'ihsan')!
  assert.equal(iman.done, 2)
  assert.equal(iman.total, 2)
  assert.equal(iman.stage, 4)
  assert.deepEqual(iman.fruits.map((fruit) => fruit.kind), ['talk', 'course'])
  assert.equal(iman.fruits[0].href, '/course/7?part=1')
  assert.equal(iman.fruits[0].workbookHref, '/garden/workbook')
  assert.equal(iman.fruits.every((fruit) => fruit.earned), true)
  assert.equal(iman.pending.length, 0)
  assert.equal(ihsan.done, 0)
  assert.equal(ihsan.stage, 0)
  assert.equal(ihsan.fruits.length, 0)
  assert.deepEqual(ihsan.pending.map((fruit) => fruit.kind).sort(), ['course', 'talk'])
  assert.equal(ihsan.pending.every((fruit) => fruit.earned), false)
  assert.equal(grown.reduce((sum, area) => sum + area.done, 0), 2)
})

test('saved garden trees move onto the hadith sections without dropping a door or a count', () => {
  const migrated = migrateGardenProgress([
    { id: 'quran', done: 2, doors: [12] },
    { id: 'spirituality', done: 4, doors: [9, 10, 17, 18] },
    { id: 'society', done: 3, doors: [3, 4, 5] },
    { id: 'character', done: 1, doors: [16] },
    { id: 'hadith', done: 2, doors: [1, 19] },
  ])
  const byId = new Map(migrated.map((area) => [area.id, area]))
  assert.deepEqual(byId.get('iman')?.doors, [9, 10, 12])
  assert.equal(byId.get('iman')?.done, 4)
  assert.deepEqual(byId.get('hour')?.doors, [17, 18])
  assert.equal(byId.get('hour')?.done, 2)
  assert.deepEqual(byId.get('islam')?.doors, [3, 4, 5])
  assert.equal(byId.get('islam')?.done, 3)
  assert.deepEqual(byId.get('ihsan')?.doors, [16])
  assert.equal(byId.get('ihsan')?.done, 1)
  assert.deepEqual(byId.get('sitting')?.doors, [1, 19])
  assert.equal(byId.get('sitting')?.done, 2)
  assert.equal(migrated.reduce((sum, area) => sum + area.done, 0), 12)
  assert.equal(migrated.reduce((sum, area) => sum + area.doors.length, 0), 11)

  const fromNames = migrateGardenProgress([
    { id: 'quran', done: 2 },
    { id: 'spirituality', done: 8 },
    { id: 'society', done: 6 },
    { id: 'character', done: 1 },
    { id: 'hadith', done: 4 },
  ])
  const named = new Map(fromNames.map((area) => [area.id, area]))
  assert.deepEqual(named.get('iman')?.doors, [9, 10, 11, 12, 13, 14, 15])
  assert.equal(named.get('iman')?.done, 8)
  assert.deepEqual(named.get('hour')?.doors, [17, 18])
  assert.equal(named.get('hour')?.done, 2)
  assert.equal(fromNames.reduce((sum, area) => sum + area.done, 0), 21)

  const again = migrateGardenProgress(migrated)
  assert.deepEqual(again, migrated)
  assert.equal(readStoredGarden('not json'), null)
  assert.deepEqual(readStoredGarden(JSON.stringify(['quran', 'character']))?.find((area) => area.id === 'iman')?.doors, [12])
  assert.deepEqual(readStoredGarden(JSON.stringify(['quran', 'character']))?.find((area) => area.id === 'ihsan')?.doors, [16])
})
