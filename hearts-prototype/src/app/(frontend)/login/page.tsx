import { Banner, Phone, Principle } from '@/components/chrome'

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const query = await searchParams
  return (
    <Phone>
      <Banner error={query.error} />
      <h1>Welcome back.</h1>
      <Principle label="Door" text="We kept your place." why="Coming back should feel quiet, not like a test." />
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="login" />
        <input type="hidden" name="next" value={query.next || '/'} />
        <label>Email<input data-testid="login-email" name="email" type="email" autoComplete="username" required /></label>
        <label>Password<input data-testid="login-password" name="password" type="password" autoComplete="current-password" required /></label>
        <button data-testid="login-submit" type="submit">Sign in</button>
      </form>
    </Phone>
  )
}
