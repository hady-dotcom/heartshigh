'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ExampleInUse } from '@/components/app/care'
import { readStoredGarden, GARDEN_AREAS, type AreaFruit, type AreaView, type GardenAreaId } from '@/lib/garden-areas'
import { doorNamesForArea, type GardenBranch } from '@/lib/garden-branches'
import { CANOPY_SPLIT, TREE_FRAME, TREE_PADS, medallionSpots, sceneBackground, treeDepth, treeSources, trunkPivot, type GardenTheme } from '@/lib/garden-art'

const MEDALLION_CAP = 6
const SEEN_KEY = 'hearts-garden-bloom'
const AREAS_KEY = 'hearts-garden-areas'

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

function Tree({ area, branches, onPlaque }: { area: AreaView; branches: GardenBranch[]; onPlaque: (id: GardenAreaId) => void }) {
  const pad = TREE_PADS[area.art]
  const art = treeSources(area.art, area.stage)
  const marks = hanging(area)
  const spots = medallionSpots(marks.length, area.stage)
  const fresh = useFreshBloom(marks.filter((mark) => mark.earned).map((mark) => mark.id))
  const pivot = trunkPivot(area.art, area.stage)
  const pivotX = `${(pivot.x / TREE_FRAME.width) * 100}%`
  const pivotY = `${(pivot.y / TREE_FRAME.height) * 100}%`
  return (
    <article
      className="garden-tree"
      data-testid="garden-tree"
      data-area={area.id}
      data-art={area.art}
      data-stage={area.stage}
      data-canopy={art.split ? 'split' : 'combined'}
      style={{
        ['--pad-x' as string]: pad.x,
        ['--pad-y' as string]: pad.y,
        ['--z' as string]: String(treeDepth(area.art, area.stage)),
        ['--sway' as string]: pad.sway,
        ['--sway-dur' as string]: pad.dur,
        ['--sway-delay' as string]: pad.delay,
        ['--pivot-x' as string]: pivotX,
        ['--pivot-y' as string]: pivotY,
      }}
    >
      <div className="tree-planter">
        <img src={art.planter} alt="" />
        <button
          type="button"
          className="plaque-name"
          data-testid="tree-plaque"
          style={{ ['--plaque-chars' as string]: String(area.plaque.length) }}
          aria-label={`${area.title}. ${area.note}. Lanes and doors`}
          onClick={() => onPlaque(area.id)}
        >{area.plaque}</button>
        <p className="plaque-note" data-testid="plaque-note">{area.note}</p>
      </div>
      <div className={`tree-canopy${art.split ? ' sway' : ''}`}>
        {art.canopy ? <img src={art.canopy} alt="" /> : null}
        {branches.length ? (
          <svg className="tree-branches" viewBox="0 0 100 100" aria-hidden="true">
            {branches.map((branch) => (
              <g key={branch.id}>
                <path d={branch.d} className="branch-wood" />
                <path d={branch.d} className="branch-leaf" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - branch.fill} />
              </g>
            ))}
          </svg>
        ) : null}
        {branches.map((branch) => (
          <Link
            key={branch.id}
            className="branch-bud"
            href={branch.href}
            data-testid="garden-branch"
            data-lane={branch.id}
            data-fill={branch.fill}
            data-align={branch.align}
            style={{ left: `${branch.tipX}%`, top: `${branch.tipY}%` }}
            aria-label={`${branch.title}. ${branch.done} of ${branch.total} done`}
          >{branch.label}</Link>
        ))}
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

function TreeSheet({ areaId, branches, onClose }: { areaId: GardenAreaId; branches: GardenBranch[]; onClose: () => void }) {
  const area = GARDEN_AREAS.find((row) => row.id === areaId)
  if (!area) return null
  const doors = doorNamesForArea(areaId)
  const own = branches.filter((branch) => branch.areaId === areaId)
  return (
    <div className="tree-sheet" data-testid="tree-sheet" role="dialog" aria-label={area.title}>
      <button type="button" className="tree-sheet-close" onClick={onClose}>Back to the garden</button>
      <p className="eyebrow">{area.plaque}</p>
      <h2>{area.title}</h2>
      <p className="tree-sheet-note">{area.note}</p>
      <p className="eyebrow">Doors</p>
      <ul className="tree-doors" data-testid="tree-doors">
        {doors.map((door) => <li key={door.number}>Door {door.number} · {door.title}</li>)}
      </ul>
      {own.length ? <p className="eyebrow">Branches</p> : null}
      {own.map((branch) => (
        <section key={branch.id} className="tree-lane" data-testid="tree-lane" data-lane={branch.id}>
          <h3>{branch.title}</h3>
          <p className="tree-lane-count" data-testid="tree-lane-count">{branch.done} of {branch.total} done{branch.minutes ? ` · ${branch.minutes} min` : ''}</p>
          <div className="bar" aria-hidden="true"><i style={{ width: `${Math.round(branch.fill * 100)}%` }} /></div>
          {branch.done <= 0 ? (
            <ExampleInUse testId="lane-branch-example" title={branch.title} action={{ href: branch.href, label: 'Start this lane' }}>
              <p>{branch.example}</p>
            </ExampleInUse>
          ) : (
            <Link className="pill gold" href={branch.href}>Open this lane</Link>
          )}
        </section>
      ))}
    </div>
  )
}

export function GardenScene({ areas, branches = [], theme: pinned }: { areas: AreaView[]; branches?: GardenBranch[]; theme?: GardenTheme }) {
  const theme = useAppTheme(pinned)
  const [open, setOpen] = useState<GardenAreaId | null>(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AREAS_KEY)
      if (!raw) return
      const migrated = readStoredGarden(raw)
      if (!migrated) return
      localStorage.setItem(AREAS_KEY, JSON.stringify(migrated))
    } catch {
      // Private browsing can refuse storage. The trees still grow from the talks themselves.
    }
  }, [])
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
        <p className="garden-hook">A quiet picture of time you have given.</p>
      </header>
      <img className="garden-prop lantern" src="/garden/props/lantern.webp" alt="" />
      <div className="garden-trees">
        {areas.map((area) => <Tree key={area.id} area={area} branches={branches.filter((branch) => branch.areaId === area.id)} onPlaque={setOpen} />)}
      </div>
      {open ? <TreeSheet areaId={open} branches={branches} onClose={() => setOpen(null)} /> : null}
    </section>
  )
}
