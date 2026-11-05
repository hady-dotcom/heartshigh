import Link from 'next/link'
import type { ReactNode } from 'react'
import { httpsHref, plainText, telHref } from '@/lib/text-safety'

export type CareContact = { label: string; phone?: string | null; url?: string | null; hours?: string | null }

/** Helplines a learner can call now. Phone is the main step. */
export function Helplines({ contacts, testId = 'care-lines' }: { contacts: CareContact[]; testId?: string }) {
  if (!contacts.length) return null
  return (
    <ul className="care-lines" data-testid={testId}>
      {contacts.map((contact) => {
        const phone = contact.phone ? telHref(contact.phone) : null
        const link = httpsHref(contact.url)
        return (
          <li key={contact.label} data-testid="help-contact">
            <b>{plainText(contact.label)}</b>
            {contact.hours ? <small>{plainText(contact.hours)}</small> : null}
            <span className="care-line-actions">
              {phone ? <a className="pill gold small" href={phone} data-testid="help-phone">Call {plainText(contact.phone || '')}</a> : null}
              {link ? <a className="text-link" href={link} target="_blank" rel="noreferrer" data-testid="help-link">{link.replace(/^https:\/\//, '').replace(/\/$/, '')}</a> : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** A clearly labelled filled-in example, plus the button that does the real thing. */
export function ExampleInUse({
  testId,
  title,
  children,
  action,
  desk = false,
}: {
  testId?: string
  title: string
  children: ReactNode
  action: { href: string; label: string }
  desk?: boolean
}) {
  return (
    <div className="example-in-use" data-testid={testId} data-example="yes">
      <p className="example-kicker">Example</p>
      <article className="example-sample">
        <h3>{title}</h3>
        <div className="example-body">{children}</div>
      </article>
      <p className="example-note">A filled-in example of this page in use. It is not a real record.</p>
      <Link className={desk ? 'btn gold' : 'pill gold'} href={action.href}>{action.label}</Link>
    </div>
  )
}
