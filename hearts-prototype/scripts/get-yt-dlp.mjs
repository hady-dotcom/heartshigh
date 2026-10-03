#!/usr/bin/env node
// Puts a pinned yt-dlp release in bin/, checked against its published SHA-256, for the caption import.
// Usage: node scripts/get-yt-dlp.mjs   (setup runs it; a failure only means captions come from the other sources)
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const YT_DLP_VERSION = '2025.09.26'
const HASHES = {
  'yt-dlp_linux': 'd2f07382138f4bd882254996502636f5a67a8c5ee5ab8a25807e2784a4878642',
  'yt-dlp_linux_aarch64': 'ff118cc5ca7c606090938ee90177f5bc04cc25a658726f977782261dfc5ac0b8',
  'yt-dlp_macos': 'bb3a68c1c1397f4fe8b373970148239e2d546b246711a50c0ca71264bfec5988',
  'yt-dlp.exe': 'f930cb6bef322cb692fb9e778ee52952619e75f07f2b063d554ff2100cebf7d9',
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const asset = process.platform === 'win32' ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'
const target = join(root, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex')

if (existsSync(target) && sha(readFileSync(target)) === HASHES[asset]) {
  console.log(`yt-dlp ${YT_DLP_VERSION} is already in bin/.`)
  process.exit(0)
}
const url = `https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/${asset}`
console.log(`Fetching yt-dlp ${YT_DLP_VERSION} (${asset})`)
const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
if (!response.ok) throw new Error(`yt-dlp download failed: ${response.status} from ${url}`)
const body = Buffer.from(await response.arrayBuffer())
if (sha(body) !== HASHES[asset]) throw new Error(`yt-dlp download did not match its published SHA-256, so it was not saved.`)
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, body)
chmodSync(target, 0o755)
console.log(`yt-dlp ${YT_DLP_VERSION} saved to ${target.replace(`${root}/`, '')}`)
