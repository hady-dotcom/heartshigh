import { Hidden } from '@/components/app/shell'
import { SeeHowPlay } from '@/components/see-how'
import { seeHowManifest } from '@/lib/see-how'
import { seeHowClipMap } from '@/server/see-how-clips'
import type { SessionUser } from '@/server/context'
import type { Payload } from 'payload'
import { DeskFrame, masterNav } from './shell'

export async function MasterSeeHowScreen({ payload, user, query }: { payload: Payload; user: SessionUser; query: { error?: string; notice?: string } }) {
  const clips = await seeHowClipMap(payload)
  const pages = Object.entries(seeHowManifest.pages)
    .map(([id, page]) => ({ id, title: page.title }))
    .sort((a, b) => a.title.localeCompare(b.title, 'en'))
  return (
    <DeskFrame payload={payload} user={user} title="See how" intro="Each page’s short demo. Play it, replace it with your own video, or go back to the one we recorded." active="see-how" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={query} testId="see-how-desk">
      <section className="panel" id="see-how-clips" data-testid="see-how-desk-list">
        <header><h2>Clips</h2><span className="hint">{pages.length} pages</span></header>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Page</th><th>Clip</th><th>Play</th><th>Your video</th></tr>
            </thead>
            <tbody>
              {pages.map((page) => {
                const custom = Boolean(clips[page.id])
                return (
                  <tr key={page.id} data-testid="see-how-row" data-page={page.id} data-custom={custom ? 'yes' : 'no'}>
                    <td><b>{page.title}</b></td>
                    <td>{custom ? 'Your video' : 'The recorded one'}</td>
                    <td><SeeHowPlay pageId={page.id} /></td>
                    <td>
                      <form action="/api/hearts" method="post" encType="multipart/form-data" className="form" style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
                        <Hidden fields={{ action: 'see-how-replace', page: page.id, next: '/master/see-how' }} />
                        <label className="stack">
                          Replace with my video
                          <input type="file" name="file" accept="video/webm,video/mp4,video/quicktime,.webm,.mp4,.mov" required data-testid="see-how-file" data-page={page.id} />
                        </label>
                        <button className="btn small" type="submit" data-testid="see-how-replace" data-page={page.id}>Replace with my video</button>
                      </form>
                      <form action="/api/hearts" method="post" style={{ marginTop: 8 }}>
                        <Hidden fields={{ action: 'see-how-reset', page: page.id, next: '/master/see-how' }} />
                        <p data-testid="see-how-reset-copy">Delete this clip override? Learners will see the recorded one again. This can't be undone.</p>
                        <label className="check"><input type="checkbox" name="sure" value="yes" required={custom} data-testid="see-how-sure" data-page={page.id} disabled={!custom} /> Yes, delete it</label>
                        <button className="btn ghost small" type="submit" data-testid="see-how-reset" data-page={page.id} disabled={!custom}>Back to the recorded one</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </DeskFrame>
  )
}
