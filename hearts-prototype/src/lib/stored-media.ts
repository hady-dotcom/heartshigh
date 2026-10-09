import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { readS3, type S3Settings } from './env'

export function mediaObjectKeys(filename: string, prefix?: string | null) {
  const name = filename.replace(/^\/+/, '')
  const prefixed = [prefix, name].filter(Boolean).join('/')
  return prefixed === name ? [name] : [prefixed, name]
}

export function localMediaPaths(filename: string, prefix?: string | null, root = process.cwd()) {
  return [...new Set(mediaObjectKeys(filename, prefix).map((key) => path.join(root, 'media', key)))]
}

async function defaultReadLocal(filePath: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath)
  } catch {
    return null
  }
}

async function readS3Object(key: string, settings: S3Settings): Promise<Buffer | null> {
  try {
    const client = new S3Client({
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
      region: settings.region,
      endpoint: settings.endpoint,
      forcePathStyle: settings.forcePathStyle,
    })
    const response = await client.send(new GetObjectCommand({ Bucket: settings.bucket, Key: key }))
    const bytes = await response.Body?.transformToByteArray()
    return bytes ? Buffer.from(bytes) : null
  } catch {
    return null
  }
}

export async function readStoredMediaBytes(
  media: { filename: string; prefix?: string | null },
  deps: {
    readLocal?: (filePath: string) => Promise<Buffer | null>
    readRemote?: (key: string, settings: S3Settings) => Promise<Buffer | null>
    settings?: S3Settings | null
    cwd?: string
  } = {},
): Promise<Buffer | null> {
  const readLocal = deps.readLocal || defaultReadLocal
  for (const filePath of localMediaPaths(media.filename, media.prefix, deps.cwd)) {
    const bytes = await readLocal(filePath)
    if (bytes) return bytes
  }
  const settings = deps.settings === undefined ? readS3() : deps.settings
  if (!settings) return null
  const readRemote = deps.readRemote || readS3Object
  for (const key of mediaObjectKeys(media.filename, media.prefix)) {
    const bytes = await readRemote(key, settings)
    if (bytes) return bytes
  }
  return null
}
