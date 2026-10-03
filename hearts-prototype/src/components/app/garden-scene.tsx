'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { AreaView, GrowthStage } from '@/lib/garden-areas'

/** Shows a painted layer when the file is there, and the drawn stand-in until then. */
function Painted({ src, className, children }: { src: string; className?: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const image = new Image()
    image.onload = () => setReady(true)
    image.src = src
  }, [src])
  if (!ready) return <span className={className}>{children}</span>
  return <img className={className} src={src} alt="" />
}

function TreeArt({ stage, leaf, blossom }: { stage: GrowthStage; leaf: string; blossom: string }) {
  const canopy = [16, 26, 36, 46, 54][stage]
  const lift = [18, 10, 4, 0, 0][stage]
  return (
    <svg className="tree-svg" viewBox="0 0 120 150" aria-hidden>
      <ellipse cx="60" cy="142" rx="34" ry="6" fill="rgba(0,0,0,0.28)" />
      <rect x="28" y="118" width="64" height="22" rx="4" fill="#6e6256" />
      <rect x="32" y="114" width="56" height="10" rx="3" fill="#8a7b6c" />
      <g className="canopy" style={{ transform: `translateY(${lift}px)` }}>
        <rect x="54" y={78 - lift / 4} width="12" height={48} rx="4" fill="#6b4630" />
        <circle cx="60" cy={78 - canopy * 0.15} r={canopy * 0.72} fill={leaf} />
        <circle cx={60 - canopy * 0.45} cy={86} r={canopy * 0.55} fill={leaf} />
        <circle cx={60 + canopy * 0.48} cy={84} r={canopy * 0.5} fill={leaf} opacity="0.92" />
        {stage >= 2 ? <circle cx="48" cy={70} r="5" fill={blossom} /> : null}
        {stage >= 3 ? <circle cx="74" cy={66} r="5" fill={blossom} /> : null}
        {stage >= 4 ? <circle cx="60" cy={58} r="5.5" fill={blossom} /> : null}
      </g>
    </svg>
  )
}

function FruitMark({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="12" fill="#f0c36a" />
      <circle cx="16" cy="16" r="7" fill="#fff6df" />
      <title>{title}</title>
    </svg>
  )
}

export function GardenScene({ areas }: { areas: AreaView[] }) {
  return (
    <section className="garden-scene" data-testid="garden-scene" data-stages={areas.map((area) => area.stage).join(',')} aria-label="Your garden">
      <Painted src="/garden/scene.webp" className="garden-scene-bg">
        <span className="garden-sky" />
      </Painted>
      <header className="garden-top">
        <h1>Garden</h1>
        <p className="garden-motto">Small steps. A fuller you.</p>
        <p className="garden-motto quiet">Knowledge blossoms over time.</p>
      </header>
      <Painted src="/garden/lantern.webp" className="garden-prop lantern left">
        <span className="lantern" />
      </Painted>
      <Painted src="/garden/lantern.webp" className="garden-prop lantern right">
        <span className="lantern" />
      </Painted>
      <Painted src="/garden/watering-can.webp" className="garden-prop can">
        <span className="watering-can" aria-hidden />
      </Painted>
      <div className="garden-trees">
        {areas.map((area) => (
          <article key={area.id} className={`garden-tree stage-${area.stage}`} data-testid="garden-tree" data-area={area.id} data-stage={area.stage} style={{ ['--leaf' as string]: area.leaf, ['--blossom' as string]: area.blossom }}>
            <Painted src={`/garden/trees/${area.id}-${area.stage}.webp`} className="tree-art">
              <TreeArt stage={area.stage} leaf={area.leaf} blossom={area.blossom} />
            </Painted>
            {area.fruits.length ? (
              <ul className="garden-fruits">
                {area.fruits.map((fruit) => (
                  <li key={fruit.id} className="garden-fruit" data-testid="garden-fruit" data-kind={fruit.kind}>
                    <Link href={fruit.href} title={fruit.title} aria-label={`${fruit.title}, what was sown`}>
                      <Painted src={`/garden/fruits/${area.id}.webp`} className="fruit-art">
                        <FruitMark title={fruit.title} />
                      </Painted>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="plaque"><b>{area.title}</b><small>{area.note}</small></p>
            {area.fruits.length ? <Link className="tree-book" href={area.fruits[0].workbookHref}>Workbook</Link> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
