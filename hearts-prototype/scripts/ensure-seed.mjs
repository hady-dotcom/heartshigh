import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

if (!process.env.DATABASE_URL && !existsSync('data/hearts.db')) {
  console.log('No database yet, seeding data/hearts.db first.')
  execSync('npx tsx src/seed/seed.ts', { stdio: 'inherit' })
}
