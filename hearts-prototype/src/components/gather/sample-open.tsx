import Link from 'next/link'

/** Shown when `/gather/sample` has no published gathering to open. No row is written. */
export function SampleInvite() {
  return (
    <main className="public-gather invite" data-testid="public-gather">
      <div className="wrap">
        <p className="kicker">Gather</p>
        <h1>Sample invite</h1>
        <p className="when-line">This address opens a published gathering.</p>
        <section className="gather-card" data-testid="public-rsvp">
          <p>No gathering is published yet. When one is, this page opens it. Nothing here is stored.</p>
        </section>
      </div>
    </main>
  )
}

/** Shown when `/gather/sample/in` has no published gathering to open. No row is written. */
export function SampleDoor() {
  return (
    <main className="public-gather" data-testid="checkin-page">
      <div className="wrap">
        <p className="kicker">At the door</p>
        <h1>Sample door</h1>
        <p className="when-line">This address opens a published gathering.</p>
        <section className="gather-card door-checkin" data-testid="door-checkin">
          <h2>No gathering is published yet.</h2>
          <p>When one is, the poster QR and the door code open here. Nothing here is stored.</p>
          <Link className="pill gold" href="/login?next=%2Fgather%2Fsample%2Fin" data-testid="checkin-login">Sign in</Link>
        </section>
      </div>
    </main>
  )
}
