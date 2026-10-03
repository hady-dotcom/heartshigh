#!/usr/bin/env node
// Runs from a clean clone with nothing but Node and npm. Pass --start to launch the app afterwards.
import { execSync } from 'node:child_process'
import { existsSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const run = (command, { optional = false } = {}) => {
  console.log(`\n> ${command}`)
  try {
    execSync(command, { cwd: root, stdio: 'inherit', env: process.env })
  } catch (error) {
    if (!optional) throw error
    console.warn(`(skipped: ${command} did not finish; the app still runs, only the browser tests need it)`)
  }
}

if (!existsSync(join(root, 'node_modules', '.package-lock.json'))) run(existsSync(join(root, 'package-lock.json')) ? 'npm ci' : 'npm install')
run('npx playwright install chromium', { optional: true })
try {
  run('npx tsx src/seed/seed.ts')
} catch (error) {
  // An older prototype database whose schema the dev push cannot migrate: keep it aside and seed a fresh one.
  const db = join(root, 'data', 'hearts.db')
  if (!existsSync(db)) throw error
  const aside = `${db}.old-${Date.now()}`
  renameSync(db, aside)
  console.warn(`The old database could not be updated, so it was moved to ${aside} and a fresh one is being seeded.`)
  run('npx tsx src/seed/seed.ts')
}

console.log('\nReady. Sign in as master@hearts.test / hearts-master at http://localhost:3000')
if (process.argv.includes('--start')) run('npx next dev')
