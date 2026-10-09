#!/usr/bin/env node
// Fetches yt-dlp into bin/ at build time, checked against the release SHA2-256SUMS.
// Default is the latest stable tag, and nothing older than YT_DLP_MIN is kept.
// YT_DLP_VERSION pins a tag. YT_DLP_CHANNEL=nightly uses yt-dlp-nightly-builds.
// YT_DLP_ALLOW_OLD=1 is the only way to keep a build below the floor.
// Importing this file does not download. Run it: node scripts/get-yt-dlp.mjs
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

export const YT_DLP_MIN = '2026.08.19'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const asset = process.platform === 'win32' ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'
const target = join(root, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
const execFileAsync = promisify(execFile)

export function ytDlpOlderThan(version, floor) {
  const left = String(version || '').replace(/^v/, '').split('.').map((part) => Number(part) || 0)
  const right = String(floor || '').split('.').map((part) => Number(part) || 0)
  const width = Math.max(left.length, right.length)
  for (let index = 0; index < width; index += 1) {
    const a = left[index] || 0
    const b = right[index] || 0
    if (a !== b) return a < b
  }
  return false
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function parseSums(text) {
  const map = new Map()
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+\*?(\S+)/i)
    if (match) map.set(match[2], match[1].toLowerCase())
  }
  return map
}

async function getText(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'hearts-yt-dlp' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`yt-dlp lookup failed: ${response.status} from ${url}`)
  return response.text()
}

async function latestTag(repo) {
  const body = JSON.parse(await getText(`https://api.github.com/repos/${repo}/releases/latest`))
  const tag = String(body.tag_name || '').replace(/^v/, '')
  if (!tag) throw new Error(`yt-dlp latest release from ${repo} had no tag.`)
  return tag
}

async function installedVersion() {
  if (!existsSync(target)) return ''
  try {
    const { stdout } = await execFileAsync(target, ['--version'], { timeout: 20_000 })
    return String(stdout || '').trim().split(/\s+/)[0]
  } catch {
    return ''
  }
}

export async function resolveYtDlp(env = process.env) {
  const nightly = env.YT_DLP_CHANNEL === 'nightly'
  const repo = nightly ? 'yt-dlp/yt-dlp-nightly-builds' : 'yt-dlp/yt-dlp'
  const version = String(env.YT_DLP_VERSION || '').replace(/^v/, '') || (await latestTag(repo))
  if (!nightly && ytDlpOlderThan(version, YT_DLP_MIN) && env.YT_DLP_ALLOW_OLD !== '1') {
    throw new Error(`yt-dlp ${version} is older than ${YT_DLP_MIN}. Captions need a current release. Set YT_DLP_VERSION to a newer tag, or YT_DLP_CHANNEL=nightly. YT_DLP_ALLOW_OLD=1 keeps an older build.`)
  }
  return { repo, version, nightly }
}

async function main() {
  const { repo, version } = await resolveYtDlp()
  const have = await installedVersion()
  if (have === version) {
    console.log(`yt-dlp ${version} is already in bin/.`)
    return
  }
  const base = `https://github.com/${repo}/releases/download/${version}`
  const sums = parseSums(await getText(`${base}/SHA2-256SUMS`))
  const expected = sums.get(asset)
  if (!expected) throw new Error(`SHA2-256SUMS for yt-dlp ${version} has no line for ${asset}.`)
  console.log(`Fetching yt-dlp ${version} (${asset})`)
  const response = await fetch(`${base}/${asset}`, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new Error(`yt-dlp download failed: ${response.status} from ${base}/${asset}`)
  const body = Buffer.from(await response.arrayBuffer())
  if (sha256(body) !== expected) throw new Error('yt-dlp download did not match SHA2-256SUMS, so it was not saved.')
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, body)
  chmodSync(target, 0o755)
  console.log(`yt-dlp ${version} saved to ${target.replace(`${root}/`, '')}`)
}

const invoked = Boolean(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
if (invoked) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
