import Link from 'next/link'
import type { ReactNode } from 'react'
import { Arch } from '@/components/arch'

/** A quiet empty state: a gold arch, one sentence, a filled-in example, and a way forward. */
export function EmptyState({
  testId,
  children,
  action,
  example,
}: {
  testId?: string
  children: ReactNode
  action?: { href: string; label: string }
  example?: { title: string; body: ReactNode }
}) {
  return (
    <div className="empty-state" data-testid={testId}>
      <Arch size={56} />
      <p>{children}</p>
      {example ? (
        <div className="example-in-use" data-example="yes">
          <p className="example-kicker">Example</p>
          <article className="example-sample">
            <h3>{example.title}</h3>
            <div className="example-body">{example.body}</div>
          </article>
          <p className="example-note">A filled-in example of this page in use. It is not yours yet.</p>
        </div>
      ) : null}
      {action ? <Link className="pill gold" href={action.href}>{action.label}</Link> : null}
    </div>
  )
}
