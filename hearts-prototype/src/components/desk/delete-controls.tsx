import { Hidden } from '@/components/app/shell'
import { KINDS, type DeleteKind, undoSentence } from '@/lib/desk-delete'

function fields(kind: DeleteKind, id: number | undefined, next: string, portalSlug?: string) {
  return {
    action: id ? 'desk-delete' : 'desk-bulk-delete',
    kind,
    ...(id ? { id } : {}),
    next,
    ...(portalSlug ? { portalSlug } : {}),
  }
}

function Confirm({ kind, testId, title }: { kind: DeleteKind; testId: string; title?: string }) {
  const spec = KINDS[kind]
  if (spec.strong) {
    return (
      <label className="stack">
        Type {title || 'the name'}
        <input name="confirm" required data-testid={`${testId}-name`} autoComplete="off" />
      </label>
    )
  }
  return (
    <label className="check">
      <input type="checkbox" name="sure" value="yes" required data-testid={`${testId}-sure`} /> {kind === 'lesson' ? 'Yes, move it to the bin' : 'Yes, delete it'}
    </label>
  )
}

/** One row. A tick, or the portal name when the delete is a strong one. */
export function DeleteInline({
  kind,
  id,
  next,
  portalSlug,
  testId,
  label = 'Delete',
  title,
}: {
  kind: DeleteKind
  id: number
  next: string
  portalSlug?: string
  testId: string
  label?: string
  title?: string
}) {
  const spec = KINDS[kind]
  return (
    <form className="desk-delete" action="/api/hearts" method="post" data-testid={`${testId}-form`} data-kind={kind}>
      <Hidden fields={fields(kind, id, next, portalSlug)} />
      <p data-testid={`${testId}-copy`}>{spec.confirm} {undoSentence(kind)}</p>
      <Confirm kind={kind} testId={testId} title={title} />
      <button className="btn danger small" type="submit" data-testid={testId}>{label}</button>
    </form>
  )
}

/** A tick on each row, then one Delete for the ticked ones. The ticks use `form={formId}`. */
export function DeleteMany({
  kind,
  next,
  portalSlug,
  formId,
}: {
  kind: DeleteKind
  next: string
  portalSlug?: string
  formId: string
}) {
  const spec = KINDS[kind]
  if (!spec.bulk) return null
  return (
    <form id={formId} className="bulk-bar" action="/api/hearts" method="post" data-testid={formId}>
      <Hidden fields={{ action: 'desk-bulk-delete', kind, next, ...(portalSlug ? { portalSlug } : {}) }} />
      <p data-testid={`${formId}-copy`}>{spec.confirm} {undoSentence(kind)}</p>
      <label className="check">
        <input type="checkbox" name="sure" value="yes" required data-testid={`${formId}-sure`} /> {kind === 'lesson' ? 'Yes, move the ticked ones to the bin' : 'Yes, delete the ticked ones'}
      </label>
      <button className="btn danger small" type="submit" data-testid={`${formId}-go`}>Delete selected</button>
    </form>
  )
}

export function DeletePick({ formId, id, label }: { formId: string; id: number; label: string }) {
  return <input form={formId} type="checkbox" name="id" value={id} data-testid="delete-pick" aria-label={`Select ${label}`} />
}
