'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { AreaFruit, AreaView } from '@/lib/garden-areas'
import { CANOPY_SPLIT, TREE_FRAME, TREE_PADS, medallionSpots, sceneBackground, treeDepth, treeSources, trunkPivot, type GardenTheme } from '@/lib/garden-art'

const MEDALLION_CAP = 6
const SEEN_KEY = 'hearts-garden-bloom'

/** Glow medallions that this browser has not shown before. */
function useFreshBloom(ids: string[]) {
  const key = ids.join('|')
  const [fresh, setFresh] = useState<string[]>([])
  useEffect(() => {
    const list = key ? key.split('|') : []
    try {
      const raw = sessionStorage.getItem(SEEN_KEY)
      const seen = new Set<string>(raw ? JSON.parse(raw) as string[] : [])
      setFresh(list.filter((id) => !seen.has(id)))
      for (const id of list) seen.add(id)
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
    } catch {
      setFresh(list)
    }
  }, [key])
  return new Set(fresh)
}

function hanging(area: AreaView): AreaFruit[] {
  const glow = area.fruits.slice(0, 4)
  const room = MEDALLION_CAP - glow.length
  return [...glow, ...area.pending.slice(0, room)]
}

function Tree({ area }: { area: AreaView }) {
  const pad = TREE_PADS[area.id]
  const art = treeSources(area.id, area.stage)
  const marks = hanging(area)
  const spots = medallionSpots(marks.length, area.stage)
  const fresh = useFreshBloom(marks.filter((mark) => mark.earned).map((mark) => mark.id))
  const pivot = trunkPivot(area.id, area.stage)
  const pivotX = `${(pivot.x / TREE_FRAME.width) * 100}%`
  const pivotY = `${(pivot.y / TREE_FRAME.height) * 100}%`
  return (
    <article
      className="garden-tree"
      data-testid="garden-tree"
      data-area={area.id}
      data-stage={area.stage}
      data-canopy={art.split ? 'split' : 'combined'}
      style={{
        ['--pad-x' as string]: pad.x,
        ['--pad-y' as string]: pad.y,
        ['--z' as string]: String(treeDepth(area.id, area.stage)),
        ['--sway' as string]: pad.sway,
        ['--sway-dur' as string]: pad.dur,
        ['--sway-delay' as string]: pad.delay,
        ['--pivot-x' as string]: pivotX,
        ['--pivot-y' as string]: pivotY,
      }}
    >
      <div className="tree-planter">
        <img src={art.planter} alt="" />
        <Link className="plaque-name" href={area.workbookHref}>{area.plaque}</Link>
      </div>
      <div className={`tree-canopy${art.split ? ' sway' : ''}`}>
        {art.canopy ? <img src={art.canopy} alt="" /> : null}
        {marks.length ? (
          <ul className="garden-fruits">
            {marks.map((mark, index) => (
              <li
                key={mark.id}
                className={`medallion${mark.earned && fresh.has(mark.id) ? ' bloom' : ''}`}
                style={{ left: spots[index].left, top: spots[index].top }}
              >
                <Link
                  href={mark.href}
                  data-testid="garden-fruit"
                  data-kind={mark.kind}
                  data-earned={mark.earned ? 'yes' : 'no'}
                  aria-label={`${mark.title}, ${mark.earned ? 'what was sown' : 'still to grow'}`}
                >
                  <img src={mark.earned ? '/garden/fruit/medallion-glow.webp' : '/garden/fruit/medallion-empty.webp'} alt="" />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  )
}

/** The app's Dawn or Evening, set on <html> before first paint and changed by the pin on Me. */
function useAppTheme(pinned?: GardenTheme): GardenTheme {
  const [theme, setTheme] = useState<GardenTheme>(pinned || 'evening')
  useEffect(() => {
    if (pinned) return setTheme(pinned)
    const root = document.documentElement
    const read = () => setTheme(root.dataset.theme === 'dawn' ? 'dawn' : 'evening')
    read()
    const watch = new MutationObserver(read)
    watch.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => watch.disconnect()
  }, [pinned])
  return theme
}

export function GardenScene({ areas, theme: pinned }: { areas: AreaView[]; theme?: GardenTheme }) {
  const theme = useAppTheme(pinned)
  return (
    <section
      className="garden-scene"
      data-testid="garden-scene"
      data-theme={theme}
      data-stages={areas.map((area) => area.stage).join(',')}
      data-sway={CANOPY_SPLIT ? 'canopy' : 'off'}
      aria-label="Your garden"
    >
      <img className="garden-scene-bg" src={sceneBackground(theme)} alt="" />
      <header className="garden-top">
        <h1><span className="gold-mark" aria-hidden="true" />Small steps. A fuller you.</h1>
      </header>
      <img className="garden-prop lantern" src="/garden/props/lantern.webp" alt="" />
      <div className="garden-trees">
        {areas.map((area) => <Tree key={area.id} area={area} />)}
      </div>
    </section>
  )
}
