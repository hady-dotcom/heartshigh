/**
 * Restore drill: copy a backup into a fresh scratch database and file folder, then compare counts.
 * Refuses a remote DATABASE_URL. Writes a JSON report. No secrets are printed.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildRestoreReport, countTables, type CountMap } from '../src/lib/backup'
import { isRemoteDatabase } from '../src/lib/env'

const root = path.resolve(import.meta.dirname, '..')
const out = process.env.HEARTS_RESTORE_OUT || path.join(root, '.backups', 'restore-drill-report.json')
const scratch = path.join(root, '.backups', 'scratch')
const fixture = path.join(root, '.backups', 'fixture')

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listFiles(full))
    else out.push(full)
  }
  return out
}

function sqliteCounts(file: string): CountMap {
  const db = new DatabaseSync(file)
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as { name: string }[]
  const rows = tables.map((table) => {
    const count = (db.prepare(`SELECT COUNT(*) AS n FROM "${table.name}"`).get() as { n: number }).n
    return { name: table.name, count }
  })
  db.close()
  return countTables(rows)
}

function writeFixture() {
  rmSync(fixture, { recursive: true, force: true })
  mkdirSync(path.join(fixture, 'media'), { recursive: true })
  const dbFile = path.join(fixture, 'hearts.sqlite')
  const db = new DatabaseSync(dbFile)
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT);
    CREATE TABLE answers (id INTEGER PRIMARY KEY, user_id INTEGER, body TEXT);
    CREATE TABLE audit_log (id INTEGER PRIMARY KEY, event TEXT);
    INSERT INTO users (email, name) VALUES ('amina@masjid.test', 'Amina'), ('yusuf@masjid.test', 'Yusuf');
    INSERT INTO answers (user_id, body) VALUES (1, 'A private reflection'), (2, 'Another line');
    INSERT INTO audit_log (event) VALUES ('people.import'), ('users.grant');
  `)
  db.close()
  writeFileSync(path.join(fixture, 'media', 'voice-1.webm'), 'voice-note-bytes')
  writeFileSync(path.join(fixture, 'media', 'photo-1.jpg'), 'photo-bytes')
  writeFileSync(path.join(fixture, 'media', 'sheet.pdf'), 'pdf-bytes')
  return dbFile
}

function copyTree(from: string, to: string) {
  mkdirSync(to, { recursive: true })
  for (const file of listFiles(from)) {
    const rel = path.relative(from, file)
    const dest = path.join(to, rel)
    mkdirSync(path.dirname(dest), { recursive: true })
    copyFileSync(file, dest)
  }
}

function latestBackup() {
  const base = path.join(root, '.backups')
  if (!existsSync(base)) return null
  const found: string[] = []
  for (const kind of ['daily', 'weekly', 'monthly', 'fixture-run']) {
    const dir = path.join(base, kind)
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) found.push(full)
    }
  }
  found.sort()
  return found.at(-1) || null
}

function main() {
  if (isRemoteDatabase()) {
    throw new Error('This drill refuses a remote DATABASE_URL. Point it at a local scratch database only.')
  }
  mkdirSync(path.dirname(out), { recursive: true })
  const sourceDb = process.argv.includes('--live-local')
    ? (process.env.DATABASE_URL || '').replace(/^file:/, '') || path.join(root, 'data', 'hearts.db')
    : writeFixture()

  const backupDir = path.join(root, '.backups', 'fixture-run', new Date().toISOString().replace(/[:.]/g, ''))
  mkdirSync(path.join(backupDir, 'media'), { recursive: true })
  if (existsSync(sourceDb)) copyFileSync(sourceDb, path.join(backupDir, 'hearts.sqlite'))
  const mediaSrc = process.argv.includes('--live-local') ? path.join(root, 'media') : path.join(fixture, 'media')
  if (existsSync(mediaSrc)) copyTree(mediaSrc, path.join(backupDir, 'media'))

  rmSync(scratch, { recursive: true, force: true })
  mkdirSync(path.join(scratch, 'media'), { recursive: true })
  const chosen = latestBackup() || backupDir
  const dump = path.join(chosen, 'hearts.sqlite')
  const restoredDb = path.join(scratch, 'hearts.sqlite')
  if (existsSync(dump)) copyFileSync(dump, restoredDb)
  if (existsSync(path.join(chosen, 'media'))) copyTree(path.join(chosen, 'media'), path.join(scratch, 'media'))

  const before = existsSync(path.join(backupDir, 'hearts.sqlite')) ? sqliteCounts(path.join(backupDir, 'hearts.sqlite')) : {}
  const after = existsSync(restoredDb) ? sqliteCounts(restoredDb) : {}
  const filesBefore = listFiles(path.join(backupDir, 'media')).length
  const filesAfter = listFiles(path.join(scratch, 'media')).length
  const report = buildRestoreReport({
    at: new Date().toISOString(),
    source: chosen,
    destination: scratch,
    before,
    after,
    filesBefore,
    filesAfter,
    notes: ['Local SQLite drill. Production uses pg_dump --format=custom and a second bucket. See docs/BACKUPS.md.'],
  })
  writeFileSync(out, JSON.stringify(report, null, 2))
  writeFileSync(path.join(root, 'docs', 'restore-drill-last.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ok: report.ok, rows: after, files: filesAfter, report: out }, null, 2))
  if (!report.ok) process.exit(1)
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  writeFileSync(out, JSON.stringify({ ok: false, error: message, at: new Date().toISOString() }, null, 2))
  console.error(message)
  process.exit(1)
}
