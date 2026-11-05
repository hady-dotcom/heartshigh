'use client'

import { HelpTip } from './help'
import { TOOL } from '@/lib/desk-help'

/** Hide test accounts is on by default. Unchecking reloads the list with them shown. */
export function HideTestFilter({ action, hide }: { action: string; hide: boolean }) {
  return (
    <form className="hide-test" action={action} method="get" data-testid="hide-test-accounts" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label className="check">
        <input
          type="checkbox"
          name="hideTest"
          value="1"
          defaultChecked={hide}
          data-testid="hide-test-toggle"
          onChange={(event) => {
            const form = event.currentTarget.form
            if (!form) return
            if (!event.currentTarget.checked) {
              const shown = document.createElement('input')
              shown.type = 'hidden'
              shown.name = 'hideTest'
              shown.value = '0'
              form.appendChild(shown)
              event.currentTarget.disabled = true
            }
            form.requestSubmit()
          }}
        />
        Hide test accounts
      </label>
      <HelpTip topic="hide-test">{TOOL.hideTest}</HelpTip>
    </form>
  )
}
