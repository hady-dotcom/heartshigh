import Link from 'next/link'
import type { ReactNode } from 'react'
import { Arch } from '@/components/arch'

/** A quiet empty state: a gold arch, one sentence, and a way forward. */
export function EmptyState({
  testId,
  children,
  action,
}: {
  testId?: string
  children: ReactNode
  action?: { href: string; label: string }
}) {
  return (
    <div className="empty-state" data-testid={testId}>
      <Arch size={56} />
      <p>{children}</p>
      {action ? <Link className="pill gold" href={action.href}>{action.label}</Link> : null}
    </div>
  )
}
