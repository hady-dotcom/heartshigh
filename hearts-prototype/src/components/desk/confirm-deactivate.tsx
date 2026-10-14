'use client'

import { Hidden } from '@/components/app/shell'

/** Deactivate sits in the danger zone and asks before it runs. */
export function ConfirmDeactivate({ closed, portalSlug, next }: { closed: boolean; portalSlug: string; next: string }) {
  return (
    <form
      action="/api/hearts"
      method="post"
      onSubmit={(event) => {
        const ask = closed ? 'Activate this portal again?' : 'Deactivate this portal? Learners will not be able to sign in.'
        if (!window.confirm(ask)) event.preventDefault()
      }}
    >
      <Hidden fields={{ action: 'deactivate', portalSlug, closed: closed ? 'no' : 'yes', next, confirm: 'yes' }} />
      <button className="btn danger" data-testid="deactivate" type="submit">{closed ? 'Activate' : 'Deactivate'}</button>
    </form>
  )
}
