import Link from 'next/link'
import { Banner, Logout, Phone, Principle } from '@/components/chrome'
import { requireMaster } from '@/server/context'

export default async function Master({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload } = await requireMaster()
  const portals = await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: 50, sort: 'name' })
  const packs = await payload.find({ collection: 'packs', overrideAccess: true, depth: 0, limit: 50, sort: 'title' })
  const courses = await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 50, where: { origin: { equals: 'master' } } })
  const codes = await payload.find({ collection: 'access-codes', overrideAccess: true, depth: 0, limit: 200 })
  return (
    <Phone>
      <div className="topbar"><Link className="mark" href="/"><span className="hearts">♥</span> HEARTS</Link><Logout /></div>
      <Banner error={query.error} notice={query.notice} />
      <h1>Master desk</h1>
      <Principle
        label="Portals"
        text="You open a house. You do not live in every room."
        why="Each mosque, church or synagogue needs its own admin, its own codes, and none of anyone else's."
      />
      <p><Link href="/master/questions">Edit the placing questions</Link></p>
      <h2>Open a portal</h2>
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="create-portal" />
        <label>Name<input data-testid="create-portal-name" name="name" placeholder="Harbour Mosque" /></label>
        <label>Address<input data-testid="create-portal-slug" name="slug" placeholder="harbour" /></label>
        <label>Kind
          <select name="kind" defaultValue="mosque">
            <option value="mosque">Mosque</option>
            <option value="church">Church</option>
            <option value="synagogue">Synagogue</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>Welcome line<textarea name="welcome" placeholder="A quiet room for whoever is sent." /></label>
        <button data-testid="create-portal-submit" type="submit">Open portal</button>
      </form>
      <h2>Master library</h2>
      <ul>{courses.docs.map((course) => <li key={course.id}>{(course as { title?: string }).title}</li>)}</ul>
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="create-course" />
        <input type="hidden" name="origin" value="master" />
        <input type="hidden" name="next" value="/master" />
        <label>New master course<input data-testid="master-course-title" name="title" /></label>
        <label>Speaker<input name="speaker" /></label>
        <button type="submit">Add to the library</button>
      </form>
      <h2>Course packs</h2>
      <ul>{packs.docs.map((pack) => <li key={pack.id} data-testid="pack-row">{(pack as { title?: string }).title}</li>)}</ul>
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="create-pack" />
        <input type="hidden" name="owner" value="master" />
        <input type="hidden" name="next" value="/master" />
        <label>New master pack<input data-testid="master-pack-title" name="title" /></label>
        <button type="submit">Save pack</button>
      </form>
      <h2>Portals</h2>
      {portals.docs.map((portal) => {
        const doc = portal as { id: number; name?: string; slug?: string; closed?: boolean }
        const portalPacks = packs.docs.filter((pack) => {
          const owner = pack as { portal?: number; owner?: string }
          return owner.owner === 'master' || owner.portal === doc.id
        })
        return (
          <section className="card" key={doc.id} data-testid="portal-card">
            <h3>{doc.name}</h3>
            <p className="meta">/{doc.slug} {doc.closed ? '· deactivated' : '· active'}</p>
            <p><Link href={`/p/${doc.slug}/admin`}>Open this portal&apos;s admin</Link></p>
            <form action="/api/hearts" method="post">
              <input type="hidden" name="action" value="deactivate" />
              <input type="hidden" name="portalSlug" value={doc.slug} />
              <input type="hidden" name="closed" value={doc.closed ? 'no' : 'yes'} />
              <input type="hidden" name="next" value="/master" />
              <button data-testid="deactivate-portal" type="submit">{doc.closed ? 'Activate portal' : 'Deactivate portal'}</button>
            </form>
            <form action="/api/hearts" method="post">
              <input type="hidden" name="action" value="create-pack" />
              <input type="hidden" name="portalSlug" value={doc.slug} />
              <input type="hidden" name="next" value="/master" />
              <label>Course pack for this portal<input data-testid="portal-pack-title" name="title" placeholder="Harbour sittings" /></label>
              <button type="submit">Save pack</button>
            </form>
            <form action="/api/hearts" method="post">
              <input type="hidden" name="action" value="create-code" />
              <input type="hidden" name="portalSlug" value={doc.slug} />
              <input type="hidden" name="next" value="/master" />
              <label>Access code<input data-testid="code-value" name="code" placeholder="HARBOUR-LEARN" /></label>
              <label>Role
                <select data-testid="code-role" name="role" defaultValue="admin">
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="learner">Learner</option>
                  <option value="parent">Parent</option>
                </select>
              </label>
              <label>Linked teacher code
                <select data-testid="code-teacher" name="linkedTeacherCode">
                  <option value="">None</option>
                  {codes.docs.filter((code) => (code as { portal?: number; role?: string }).portal === doc.id && (code as { role?: string }).role === 'teacher').map((code) => (
                    <option key={code.id} value={code.id}>{(code as { code?: string }).code}</option>
                  ))}
                </select>
              </label>
              <label>Course pack
                <select data-testid="code-pack" name="pack">
                  {portalPacks.map((pack) => <option key={pack.id} value={pack.id}>{(pack as { title?: string }).title}</option>)}
                </select>
              </label>
              <button data-testid="create-code" type="submit">Generate access code</button>
            </form>
            <p className="meta">Join links look like /join?code=THE-CODE</p>
          </section>
        )
      })}
    </Phone>
  )
}
