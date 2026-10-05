import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { databaseKind, readS3 } from '@/lib/env'
import {
  appVersion,
  backupStatus,
  databaseStatus,
  emailTransportStatus,
  jobsStatus,
  restoreStatus,
  snapshotOk,
  storageStatus,
  type HealthCheck,
  type OpsSnapshot,
} from '@/lib/ops-health'

type OpsRow = { kind?: string; ok?: boolean | null; at?: string | null; detail?: Record<string, unknown> | null }

export async function lastOpsEvent(payload: Payload, kind: 'backup' | 'restore' | 'retention') {
  const found = await payload.find({
    collection: 'ops-events' as never,
    overrideAccess: true,
    depth: 0,
    limit: 1,
    sort: '-at',
    where: { kind: { equals: kind } },
  })
  return (found.docs[0] as OpsRow | undefined) || null
}

export async function recordOpsEvent(
  payload: Payload,
  kind: 'backup' | 'restore' | 'retention',
  input: { ok: boolean; detail?: Record<string, unknown> },
) {
  return payload.create({
    collection: 'ops-events' as never,
    overrideAccess: true,
    data: { kind, ok: input.ok, at: now().toISOString(), detail: input.detail || {} } as never,
  })
}

export async function systemSnapshot(payload: Payload): Promise<OpsSnapshot> {
  let reachable = true
  try {
    await payload.find({ collection: 'users', depth: 0, limit: 1, overrideAccess: true })
  } catch {
    reachable = false
  }
  const [backup, restore] = await Promise.all([lastOpsEvent(payload, 'backup'), lastOpsEvent(payload, 'restore')])
  const checks: HealthCheck[] = [
    databaseStatus(databaseKind(), reachable),
    storageStatus(Boolean(readS3())),
    emailTransportStatus(),
    jobsStatus(null),
    backupStatus(backup),
    restoreStatus(restore),
  ]
  return {
    ok: snapshotOk(checks),
    version: appVersion(),
    database: checks[0],
    storage: checks[1],
    email: checks[2],
    jobs: checks[3],
    backup: checks[4],
    restore: checks[5],
    checkedAt: now().toISOString(),
  }
}

export async function closedPortalReminders(payload: Payload) {
  const found = await payload.find({
    collection: 'ops-events' as never,
    overrideAccess: true,
    depth: 1,
    limit: 20,
    sort: '-at',
    where: { kind: { equals: 'closed-portal' } },
  })
  return found.docs as { id: number; at?: string; portal?: { name?: string; slug?: string } | number; detail?: { message?: string } }[]
}
