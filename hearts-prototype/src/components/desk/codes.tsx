import { Hidden } from '@/components/app/shell'
import { codeRefusal } from '@/lib/access-codes'
import { now } from '@/lib/clock'

type CodeRow = { id: number; code?: unknown; disabled?: unknown; expiresAt?: unknown; maxUses?: unknown; uses?: unknown }

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export function CodeStatus({ code, next, portalSlug }: { code: CodeRow; next: string; portalSlug?: string }) {
  const uses = Number(code.uses || 0)
  const maxUses = code.maxUses ? Number(code.maxUses) : null
  const expiresAt = typeof code.expiresAt === 'string' ? code.expiresAt : null
  const refusal = codeRefusal({ disabled: Boolean(code.disabled), expiresAt, maxUses, uses }, now())
  const state = code.disabled ? 'Switched off' : refusal ? (refusal.includes('expired') ? 'Expired' : 'Used up') : 'Works'
  return (
    <div data-testid="code-status" data-state={state}>
      <span className={`badge ${refusal ? 'rose' : 'teal'}`}>{state}</span>
      <div className="hint">
        {maxUses ? `${uses} of ${plural(maxUses, 'use', 'uses')}` : `${plural(uses, 'use', 'uses')}, no limit`}
        {expiresAt ? `, until ${new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : ''}
      </div>
      <form action="/api/hearts" method="post" style={{ marginTop: 4 }}>
        <Hidden fields={{ action: 'code-switch', id: code.id, disabled: code.disabled ? 'false' : 'true', next, ...(portalSlug ? { portalSlug } : {}) }} />
        <button className="btn ghost small" data-testid="code-switch" type="submit">{code.disabled ? 'Switch on' : 'Switch off'}</button>
      </form>
    </div>
  )
}

export function CodeLimits() {
  return (
    <>
      <label className="stack">Label (for the desk only)<input type="text" name="label" maxLength={80} placeholder="Spring term learners" /></label>
      <div className="cols">
        <label className="stack">Uses<input type="number" data-testid="code-max-uses" name="maxUses" min={1} max={10000} placeholder="No limit" /></label>
        <label className="stack">Works for (days)<input type="number" data-testid="code-expiry-days" name="expiresInDays" min={1} max={366} placeholder="No expiry" /></label>
      </div>
    </>
  )
}
