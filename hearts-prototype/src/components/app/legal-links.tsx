import Link from 'next/link'

export function LegalLinks({ slug, className = 'door-links' }: { slug?: string | null; className?: string }) {
  const prefix = slug ? `/p/${slug}` : ''
  return (
    <div className={className} data-testid="legal-links">
      <Link href={`${prefix}/privacy`} data-testid="link-privacy">Privacy</Link>
      <Link href={`${prefix}/terms`} data-testid="link-terms">Terms</Link>
      <Link href={`${prefix}/guidelines`} data-testid="link-guidelines">How we speak</Link>
    </div>
  )
}

export function ConsentLine() {
  return (
    <label className="consent-line" data-testid="join-consent-line">
      <input type="checkbox" name="joinConsent" value="on" required data-testid="join-consent" />
      <span>
        I have read the <a href="/privacy">privacy notice</a> and <a href="/guidelines">how we speak here</a>, and I agree.
      </span>
    </label>
  )
}
