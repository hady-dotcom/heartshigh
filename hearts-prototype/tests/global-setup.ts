import { execSync } from 'node:child_process'

export default function setup() {
  execSync('npx tsx src/seed/seed.ts', { stdio: 'inherit', env: process.env })
}
