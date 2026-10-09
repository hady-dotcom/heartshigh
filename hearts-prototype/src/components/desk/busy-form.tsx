'use client'

import type { FormHTMLAttributes, ReactNode } from 'react'

/** Disables the submit button once, so a double click does not send the same bring-in or sheet twice. */
export function BusyForm({ children, ...props }: FormHTMLAttributes<HTMLFormElement> & { children: ReactNode }) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        props.onSubmit?.(event)
        if (event.defaultPrevented) return
        const button = event.currentTarget.querySelector('button[type="submit"]')
        if (button instanceof HTMLButtonElement) {
          button.disabled = true
          button.setAttribute('aria-busy', 'true')
        }
      }}
    >
      {children}
    </form>
  )
}
