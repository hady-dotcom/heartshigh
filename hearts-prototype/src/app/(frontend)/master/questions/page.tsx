import Link from 'next/link'
import { Banner, Phone, Principle } from '@/components/chrome'
import { requireMaster } from '@/server/context'

export default async function Questions({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload } = await requireMaster()
  const questions = await payload.find({ collection: 'placing-questions', overrideAccess: true, sort: 'order', limit: 40 })
  return (
    <Phone>
      <p><Link href="/master">Back to the desk</Link></p>
      <Banner error={query.error} notice={query.notice} />
      <h1>Placing questions</h1>
      <Principle label="About you" text="Ask so you can begin gently." why="The answers choose a starting path. They are not a score." />
      {questions.docs.map((question) => {
        const doc = question as { id: number; prompt?: string; options?: string[]; portal?: unknown }
        return (
          <article className="card" key={doc.id}>
            <p>{doc.prompt}</p>
            <p className="meta">{(doc.options || []).join(' · ')} {doc.portal ? '· portal only' : '· shared'}</p>
          </article>
        )
      })}
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="placing-question" />
        <input type="hidden" name="next" value="/master/questions" />
        <label>Question<textarea data-testid="placing-prompt" name="prompt" /></label>
        <label>Why we ask<input name="why" /></label>
        <label>Answers, one on each line<textarea data-testid="placing-options" name="options" /></label>
        <button type="submit">Save question</button>
      </form>
    </Phone>
  )
}
