import { Hidden } from '@/components/app/shell'
import { PageHelp } from '@/components/app/page-help'

export function ConfirmStrip({ next, required = false }: { next: string; required?: boolean }) {
  return (
    <section className={`card${required ? '' : ''}`} data-testid="confirm-strip" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        Check your inbox to confirm your email
        <PageHelp topic="confirm" />
      </h2>
      <p>{required ? 'Your portal needs this before you continue.' : 'You can keep learning. A confirmed email is needed to reset a password or hold a staff role.'}</p>
      <form action="/api/hearts" method="post">
        <Hidden fields={{ action: 'resend-confirm', next }} />
        <button className="pill outline small" type="submit" data-testid="resend-confirm">Send again</button>
      </form>
    </section>
  )
}
