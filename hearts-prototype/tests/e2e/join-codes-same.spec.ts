import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from '@playwright/test'
import { E2E_DATABASE } from '../env'

/** The server on 3100 has already copied pack courses onto each code. This reads that database. */
test('existing join codes still open the same courses, and the code letters are unchanged', () => {
  const file = path.resolve(process.cwd(), E2E_DATABASE.replace(/^file:/, ''))
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    const codes = db.prepare('SELECT id, code, label FROM access_codes').all() as { id: number; code: string; label: string | null }[]
    const seed = JSON.parse(readFileSync(path.join(process.cwd(), 'data/seed-codes-test.json'), 'utf8')) as Record<string, string>
    expect(Object.keys(seed).length).toBeGreaterThan(0)
    for (const [label, value] of Object.entries(seed)) {
      const row = codes.find((code) => code.label === label)
      expect(row, label).toBeTruthy()
      expect(row!.code, label).toBe(value)
    }

    const direct = db.prepare(`SELECT parent_id, courses_id FROM access_codes_rels WHERE path = 'courses' AND courses_id IS NOT NULL`).all() as { parent_id: number; courses_id: number }[]
    const packLinks = db.prepare(`SELECT parent_id, packs_id FROM access_codes_rels WHERE path = 'packs' AND packs_id IS NOT NULL`).all() as { parent_id: number; packs_id: number }[]
    const packCourses = db.prepare(`SELECT parent_id, courses_id FROM packs_rels WHERE path = 'courses' AND courses_id IS NOT NULL`).all() as { parent_id: number; courses_id: number }[]
    const coursesOnPack = new Map<number, number[]>()
    for (const row of packCourses) {
      const list = coursesOnPack.get(row.parent_id) || []
      list.push(row.courses_id)
      coursesOnPack.set(row.parent_id, list)
    }

    for (const code of codes) {
      const stored = [...new Set(direct.filter((row) => row.parent_id === code.id).map((row) => row.courses_id))].sort((a, b) => a - b)
      const fromPacks = packLinks.filter((row) => row.parent_id === code.id).flatMap((row) => coursesOnPack.get(row.packs_id) || [])
      const opened = [...new Set([...stored, ...fromPacks])].sort((a, b) => a - b)
      expect(stored, code.label || code.code).toEqual(opened)
    }

    const packs = db.prepare('SELECT id, title FROM packs').all() as { id: number; title: string }[]
    for (const title of ['Jibril sittings', 'Starter map']) {
      const pack = packs.find((row) => row.title === title)
      expect(pack, title).toBeTruthy()
      const courseIds = coursesOnPack.get(pack!.id) || []
      expect(courseIds.length, title).toBeGreaterThan(0)
      const holders = packLinks.filter((row) => row.packs_id === pack!.id)
      expect(holders.length, title).toBeGreaterThan(0)
      for (const holder of holders) {
        const stored = direct.filter((row) => row.parent_id === holder.parent_id).map((row) => row.courses_id)
        for (const courseId of courseIds) expect(stored, title).toContain(courseId)
      }
    }
  } finally {
    db.close()
  }
})
