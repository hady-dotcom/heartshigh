import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TREE_PADS } from './garden-art'
import { GARDEN_AREAS } from './garden-areas'
import { branchFill, branchLabelBounds, doorNamesForArea, gardenBranches } from './garden-branches'
import { LANES } from './opening-data'

test('every open lane is one branch on the tree of its best door, linked to /lanes/[id]', async () => {
  const branches = await gardenBranches('/p/east-london')
  const open = LANES.filter((lane) => !lane.optInOnly)
  assert.equal(branches.length, open.length)
  assert.equal(new Set(branches.map((row) => row.id)).size, open.length)
  assert.equal(branches.some((row) => row.id === 'guarding-gaze'), false)
  const byTree: Record<string, string[]> = {}
  for (const branch of branches) {
    byTree[branch.areaId] = [...(byTree[branch.areaId] || []), branch.id]
    assert.equal(branch.href, `/p/east-london/lanes/${branch.id}`)
    assert.equal(branch.fill, 0, `${branch.id} is a bare twig until getLaneProgress has a count`)
    assert.ok(branch.total >= 1, branch.id)
    assert.ok(branch.example.length > 0, branch.id)
    assert.match(branch.d, /^M 50 74 Q /)
  }
  assert.deepEqual(byTree.islam, ['lightness', 'habits', 'patience'])
  assert.deepEqual(byTree.iman, ['trust', 'talking', 'gifts'])
  assert.deepEqual(byTree.ihsan, ['quiet'])
  assert.equal(byTree.hour, undefined)
  assert.deepEqual(byTree.sitting, ['company', 'mercy'])
})

test('a branch fills from done and total, and every tree still lists its doors', () => {
  assert.equal(branchFill({ done: 0, total: 12 }), 0)
  assert.equal(branchFill({ done: 4, total: 12 }), 4 / 12)
  assert.equal(branchFill({ done: 20, total: 12 }), 1)
  assert.equal(branchFill({ done: 1, total: 0 }), 0)
  for (const area of GARDEN_AREAS) {
    const names = doorNamesForArea(area.id)
    assert.deepEqual(names.map((row) => row.number), area.doors, area.id)
    assert.ok(names.every((row) => row.title.length > 0))
  }
  assert.deepEqual(doorNamesForArea('hour').map((row) => row.number), [17, 18])
})

test('every branch label stays inside a 360-wide and a 390-wide phone', async () => {
  const branches = await gardenBranches('/p/east-london')
  const labelWidth = 96
  for (const sceneWidth of [360, 390]) {
    for (const branch of branches) {
      const area = GARDEN_AREAS.find((row) => row.id === branch.areaId)
      assert.ok(area, branch.id)
      const padX = Number.parseFloat(TREE_PADS[area.art].x)
      const box = branchLabelBounds({ padX, tipX: branch.tipX, align: branch.align, sceneWidth, labelWidth })
      assert.ok(box.left >= 4, `${branch.label} starts at ${box.left.toFixed(1)} on ${sceneWidth}`)
      assert.ok(box.right <= sceneWidth - 4, `${branch.label} ends at ${box.right.toFixed(1)} on ${sceneWidth}`)
    }
  }
})
