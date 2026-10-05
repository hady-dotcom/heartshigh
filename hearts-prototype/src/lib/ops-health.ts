export type HealthFlag = 'ok' | 'off' | 'warn' | 'down'

export type HealthCheck = {
  key: string
  label: string
  status: HealthFlag
  detail: string
}

export type OpsSnapshot = {
  ok: boolean
  version: string
  database: HealthCheck
  storage: HealthCheck
  email: HealthCheck
  jobs: HealthCheck
  backup: HealthCheck
  restore: HealthCheck
  checkedAt: string
}

export function emailTransportStatus(env: Record<string, string | undefined> = process.env): HealthCheck {
  const smtp = Boolean(env.SMTP_URL?.trim())
  const resend = Boolean(env.RESEND_API_KEY?.trim())
  if (smtp || resend) {
    return { key: 'email', label: 'Email', status: 'ok', detail: smtp ? 'SMTP is set.' : 'Resend is set.' }
  }
  return { key: 'email', label: 'Email', status: 'off', detail: 'email not sent: transport off' }
}

export function storageStatus(hasS3: boolean): HealthCheck {
  return hasS3
    ? { key: 'storage', label: 'File storage', status: 'ok', detail: 'The media bucket is set.' }
    : { key: 'storage', label: 'File storage', status: 'warn', detail: 'Files are on this computer’s disk. A live server needs a bucket.' }
}

export function databaseStatus(kind: 'postgres' | 'sqlite', reachable: boolean): HealthCheck {
  if (!reachable) return { key: 'database', label: 'Database', status: 'down', detail: 'The database did not answer.' }
  return {
    key: 'database',
    label: 'Database',
    status: 'ok',
    detail: kind === 'postgres' ? 'Postgres is answering.' : 'The local SQLite file is answering.',
  }
}

export function jobsStatus(depth: number | null): HealthCheck {
  if (depth == null) {
    return { key: 'jobs', label: 'Jobs queue', status: 'off', detail: 'No jobs runner is wired. Nightly clean-up is a Railway cron. See docs/BACKUPS.md.' }
  }
  if (depth > 50) return { key: 'jobs', label: 'Jobs queue', status: 'warn', detail: `${depth} jobs are waiting.` }
  return { key: 'jobs', label: 'Jobs queue', status: 'ok', detail: `${depth} job${depth === 1 ? '' : 's'} waiting.` }
}

export function backupStatus(last?: { at?: string | null; ok?: boolean | null; detail?: string | null } | null): HealthCheck {
  if (!last?.at) return { key: 'backup', label: 'Last backup', status: 'warn', detail: 'No backup has been recorded yet.' }
  if (last.ok === false) return { key: 'backup', label: 'Last backup', status: 'down', detail: last.detail || 'The last backup failed.' }
  return { key: 'backup', label: 'Last backup', status: 'ok', detail: `Last good backup: ${last.at}` }
}

export function restoreStatus(last?: { at?: string | null; ok?: boolean | null; detail?: string | null } | null): HealthCheck {
  if (!last?.at) return { key: 'restore', label: 'Last restore drill', status: 'warn', detail: 'No restore drill has been recorded yet.' }
  if (last.ok === false) return { key: 'restore', label: 'Last restore drill', status: 'down', detail: last.detail || 'The last restore drill failed.' }
  return { key: 'restore', label: 'Last restore drill', status: 'ok', detail: `Last good drill: ${last.at}` }
}

export function snapshotOk(checks: HealthCheck[]) {
  return checks.every((check) => check.status !== 'down')
}

export function appVersion(env: Record<string, string | undefined> = process.env) {
  return env.HEARTS_VERSION || env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 8) || env.npm_package_version || 'dev'
}
