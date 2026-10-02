import { Banner, Phone, Principle } from '@/components/chrome'

export default async function Join({ searchParams }: { searchParams: Promise<{ error?: string; code?: string }> }) {
  const query = await searchParams
  const code = query.code || ''
  return (
    <Phone>
      <Banner error={query.error} />
      <h1>Come in.</h1>
      <Principle
        label="Access code"
        text="The code decides whether you are looking after the portal, or learning in it."
        why="A house needs a door that knows who it is opening for."
      />
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="join" />
        <label>Access code<input data-testid="join-code" name="code" defaultValue={code} required /></label>
        <label>Your name<input data-testid="join-name" name="name" required /></label>
        <label>Email<input data-testid="join-email" name="email" type="email" required /></label>
        <label>Password<input data-testid="join-password" name="password" type="password" minLength={8} required /></label>
        <button data-testid="join-submit" type="submit">Join</button>
      </form>
      <p className="meta">A learner code makes you a learner. An admin code makes you the portal admin. The course pack on the code is what you will see.</p>
    </Phone>
  )
}
