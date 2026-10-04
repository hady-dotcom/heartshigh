import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { Payload } from 'payload'
import { readS3 } from '../../lib/env'
import { bind, execOutside, quoteIdent } from './sql'
import type { MediaTarget, SqlExec } from './types'

const RETRY_TABLE = `
CREATE TABLE IF NOT EXISTS erase_s3_retries (
  id integer PRIMARY KEY,
  object_key varchar NOT NULL,
  bucket varchar,
  filename varchar,
  local_path varchar,
  error varchar,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  attempts integer DEFAULT 0
)
`

function objectKey(file: MediaTarget) {
  if (file.objectKey) return file.objectKey
  const prefix = String(file.prefix || '').replace(/^\/+|\/+$/g, '')
  const name = String(file.filename || '')
  if (!name) return ''
  return prefix ? `${prefix}/${name}` : name
}

function localPath(file: MediaTarget) {
  const name = String(file.filename || '')
  if (!name) return ''
  return path.resolve(process.cwd(), 'media', name)
}

export async function collectMedia(exec: SqlExec, ids: number[]) {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
  if (!unique.length) return [] as MediaTarget[]
  const found = await exec(`SELECT id, filename, prefix, url, _objectkey AS "objectKey" FROM media WHERE id IN (${unique.join(',')})`)
  return found.rows as unknown as MediaTarget[]
}

export async function mediaIdsFrom(exec: SqlExec, table: string, columns: string[], where: string) {
  const ids: number[] = []
  for (const column of columns) {
    const result = await exec(`SELECT ${quoteIdent(column)} AS id FROM ${quoteIdent(table)} WHERE ${where} AND ${quoteIdent(column)} IS NOT NULL`)
    for (const row of result.rows) {
      const id = Number(row.id)
      if (Number.isInteger(id) && id > 0) ids.push(id)
    }
  }
  return ids
}

export async function unreferencedPortalMedia(exec: SqlExec, portalId: number) {
  const sql = bind(
    `SELECT id, filename, prefix, url, _objectkey AS "objectKey" FROM media
     WHERE portal_id = {id}
       AND id NOT IN (SELECT photo_id FROM speakers WHERE photo_id IS NOT NULL)
       AND id NOT IN (SELECT film_id FROM lessons WHERE film_id IS NOT NULL)
       AND id NOT IN (SELECT file_id FROM resources WHERE file_id IS NOT NULL)
       AND id NOT IN (SELECT scene_id FROM opening_scenes WHERE scene_id IS NOT NULL)`,
    portalId,
    'portal',
  )
  return (await exec(sql)).rows as unknown as MediaTarget[]
}

export async function ensureRetryTable(payload: Payload) {
  await execOutside(payload, RETRY_TABLE).catch(() => undefined)
}

function retrySql(file: MediaTarget, bucket: string, error: string, local: string) {
  const key = objectKey(file).replaceAll("'", "''")
  const err = error.replaceAll("'", "''").slice(0, 500)
  const fileName = String(file.filename || '').replaceAll("'", "''")
  const bucketName = bucket.replaceAll("'", "''")
  const localName = local.replaceAll("'", "''")
  return `INSERT INTO erase_s3_retries (object_key, bucket, filename, local_path, error, attempts) VALUES ('${key}', '${bucketName}', '${fileName}', '${localName}', '${err}', 1)`
}

export async function removeStoredFiles(payload: Payload, files: MediaTarget[]) {
  const s3 = readS3()
  let removed = 0
  let failed = 0
  await ensureRetryTable(payload)
  const client = s3
    ? new S3Client({
        credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
        region: s3.region,
        endpoint: s3.endpoint,
        forcePathStyle: s3.forcePathStyle,
      })
    : null
  for (const file of files) {
    const key = objectKey(file)
    const disk = localPath(file)
    try {
      if (client && s3 && key) {
        await client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }))
      } else if (disk) {
        await unlink(disk).catch((error: { code?: string }) => {
          if (error.code !== 'ENOENT') throw error
        })
      }
      removed += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : 'The file could not be removed.'
      await execOutside(payload, retrySql(file, s3?.bucket || '', message, disk)).catch(() => undefined)
    }
  }
  return { removed, failed }
}
