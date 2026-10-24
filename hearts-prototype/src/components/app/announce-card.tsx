import { Hidden } from '@/components/app/shell'
import { TopicHelp } from '@/components/app/page-help'

export function AnnounceCard({ id, body, next }: { id: number; body: string; next: string }) {
  return (
    <section className="card" data-testid="announce-card" style={{ marginBottom: 16, background: '#163633', color: '#E8F0EE', border: '1px solid #D4A84B' }}>
      <p className="eyebrow" style={{ color: '#D4A84B' }}>From your portal <TopicHelp topic="announce" /></p>
      <p data-testid="announce-text" style={{ margin: '8px 0 12px' }}>{body}</p>
      <form action="/api/hearts" method="post">
        <Hidden fields={{ action: 'announce-dismiss', announcement: id, next }} />
        <button className="pill outline" type="submit" data-testid="announce-dismiss">Dismiss</button>
      </form>
    </section>
  )
}
