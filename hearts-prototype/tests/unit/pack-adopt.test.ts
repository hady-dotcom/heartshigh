import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adoptPacksOnAccessCodes, ensurePackAdopted } from '../../src/server/pack-adopt'

type Row = { id: number; owner?: string; portal?: number; packs?: number[] }

function fakePayload(start: { packs?: Row[]; adoptions?: Row[]; codes?: Row[] }) {
  const packs = [...(start.packs || [])]
  const adoptions = [...(start.adoptions || [])]
  const codes = [...(start.codes || [])]
  let nextId = 100
  return {
    store: { packs, adoptions, codes },
    async findByID({ collection, id }: { collection: string; id: number }) {
      if (collection === 'packs') return packs.find((row) => row.id === id) || null
      return null
    },
    async find({ collection, where }: { collection: string; where?: { and?: { portal?: { equals: number }; pack?: { equals: number } }[] } }) {
      if (collection === 'access-codes') return { docs: codes }
      if (collection !== 'adoptions') return { docs: [] }
      const portal = where?.and?.find((clause) => clause.portal)?.portal?.equals
      const pack = where?.and?.find((clause) => clause.pack)?.pack?.equals
      return {
        docs: adoptions.filter((row) => (portal == null || row.portal === portal) && (pack == null || row.id === pack || (row as { pack?: number }).pack === pack)),
      }
    },
    async create({ collection, data }: { collection: string; data: { kind?: string; portal?: number; pack?: number } }) {
      assert.equal(collection, 'adoptions')
      const row = { id: nextId++, portal: data.portal, pack: data.pack, owner: 'master' }
      adoptions.push(row)
      return row
    },
  }
}

test('a master pack on a join code is adopted once, and a portal pack is left alone', async () => {
  const payload = fakePayload({
    packs: [
      { id: 1, owner: 'master' },
      { id: 2, owner: 'portal' },
    ],
    adoptions: [],
  })
  assert.equal(await ensurePackAdopted(payload as never, 9, 1), true)
  assert.equal(await ensurePackAdopted(payload as never, 9, 1), true)
  assert.equal(payload.store.adoptions.length, 1)
  assert.deepEqual(payload.store.adoptions[0], { id: 100, portal: 9, pack: 1, owner: 'master' })
  assert.equal(await ensurePackAdopted(payload as never, 9, 2), false)
  assert.equal(payload.store.adoptions.length, 1)
})

test('packs already on access codes are adopted onto those portals', async () => {
  const payload = fakePayload({
    packs: [{ id: 7, owner: 'master' }],
    codes: [{ id: 3, portal: 4, packs: [7] }],
    adoptions: [],
  })
  assert.equal(await adoptPacksOnAccessCodes(payload as never), 1)
  assert.equal(payload.store.adoptions.length, 1)
  assert.equal(payload.store.adoptions[0].portal, 4)
  assert.equal((payload.store.adoptions[0] as { pack?: number }).pack, 7)
})
