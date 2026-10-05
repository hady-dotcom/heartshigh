import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'
import { mailTransportMode } from '@/lib/email-adapter'
import { transportBanner } from '@/server/mail'

export function EmailPanel({ next }: { next: string }) {
  const mode = mailTransportMode()
  return (
    <section className="panel" data-testid="email-panel">
      <header className="light"><h2>Email <HelpTip topic="emailTransport">{TOOL.emailTransport}</HelpTip></h2></header>
      <div className="body">
        <p data-testid="email-transport" data-mode={mode}>{transportBanner()}</p>
        <form action="/api/hearts" method="post">
          <Hidden fields={{ action: 'send-test-email', next }} />
          <button className="btn gold" type="submit" data-testid="send-test-email">Send me a test email</button>
        </form>
      </div>
    </section>
  )
}
