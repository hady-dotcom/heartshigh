export type WipeKind = 'hard-delete' | 'unlink' | 'none'

export type WipeRule = {
  kind: WipeKind
  /** Payload field name, camelCase. Column is `{snake}_id` unless `column` is set. */
  field?: string
  column?: string
  /** Extra SQL AND clause. May use `{id}` for the portal or user id. Constants only, never request text. */
  extra?: string
}

export type JoinClear = {
  table: string
  /** Column that holds the user or portal id. */
  column: string
}

export type WipeEntry = {
  collection: string
  table: string
  /** Fields that point at portals or users, including plugin `portal`. Used by the completeness test. */
  relations: { portals?: string[]; users?: string[] }
  portal?: WipeRule | WipeRule[]
  user?: WipeRule | WipeRule[]
  mediaColumns?: string[]
  joinClears?: { portal?: JoinClear[]; user?: JoinClear[] }
  /** Friendly count key shown on the confirm panel. */
  countKey?: string
  countLabel?: string
}

export type EraseScope = 'portal' | 'user'

export type PersonMode = 'account' | 'portal'

export type CountRow = { key: string; label: string; n: number }

export type EraseSummary = {
  scope: EraseScope
  id: number
  name: string
  slug?: string
  email?: string
  role?: string
  mode?: PersonMode
  otherPortals: { id: number; name: string }[]
  counts: CountRow[]
  files: number
  confirmLabel: string
  confirmValue: string
}

export type EraseResult = {
  ok: true
  scope: EraseScope
  id: number
  deleted: Record<string, number>
  filesQueued: number
  filesRemoved: number
  fileFailures: number
}

export type EraseRefusal = { ok: false; error: string }

export type MediaTarget = {
  id: number
  filename?: string | null
  prefix?: string | null
  objectKey?: string | null
  url?: string | null
}

export type SqlExec = (text: string) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>
