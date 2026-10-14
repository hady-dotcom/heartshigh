'use client'

import { useMemo, useState } from 'react'
import { HelpTip } from '@/components/desk/help'
import { LibraryCoursePicker } from '@/components/desk/library-picker'
import { Hidden } from '@/components/app/shell'
import type { LibraryCoursePick } from '@/lib/code-courses'
import {
  DEPTH_ORDER,
  DEPTH_SECTION,
  FEATURES,
  PRESETS,
  type FeatureKey,
  type FeatureMap,
  type PresetKey,
  defaultFeatures,
  featureLocked,
  lockBeginner,
  matchingPreset,
  presetFeatures,
} from '@/lib/features'
import { TOOL } from '@/lib/desk-help'

type Props = {
  mode: 'create' | 'edit'
  action: string
  next: string
  name?: string
  slug?: string
  kind?: string
  welcome?: string
  courses: LibraryCoursePick[]
  selectedCourses?: number[]
  features?: FeatureMap
}

const STEPS = [
  { key: 'details', label: 'Details' },
  { key: 'courses', label: 'Courses' },
  { key: 'features', label: 'Features' },
] as const

type Step = (typeof STEPS)[number]['key']

export function PortalStudio({
  mode,
  action,
  next,
  name = '',
  slug = '',
  kind = 'mosque',
  welcome = '',
  courses,
  selectedCourses = [],
  features,
}: Props) {
  const [step, setStep] = useState<Step>(mode === 'edit' ? 'features' : 'details')
  const [on, setOn] = useState<FeatureMap>(lockBeginner(features || defaultFeatures()))

  const preset = matchingPreset(on)
  const applyPreset = (key: PresetKey) => setOn(presetFeatures(key))
  const toggle = (key: FeatureKey) => {
    if (featureLocked(key)) return
    setOn((current) => ({ ...current, [key]: !current[key] }))
  }
  const go = (next: Step) => {
    window.setTimeout(() => setStep(next), 0)
  }

  const grouped = useMemo(
    () => DEPTH_ORDER.map((depth) => ({ depth, rows: FEATURES.filter((row) => row.depth === depth) })),
    [],
  )

  return (
    <form className="portal-studio" action="/api/hearts" method="post" data-testid="portal-studio">
      <Hidden fields={{ action, next, featuresForm: 'yes', portalSlug: mode === 'edit' ? slug : undefined }} />
      <nav className="studio-steps" aria-label="Portal steps" data-testid="studio-steps">
        {STEPS.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className={`studio-step${step === item.key ? ' on' : ''}`}
            data-testid={`studio-step-${item.key}`}
            onClick={() => setStep(item.key)}
          >
            <span className="studio-num">{index + 1}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <section className="panel" hidden={step !== 'details'} data-testid="studio-details">
        <header>
          <div>
            <h2>The portal <HelpTip topic="portal-details">{TOOL.portalDetails}</HelpTip></h2>
            <p>A name, a short address, and a line of welcome. You choose courses and features next.</p>
          </div>
        </header>
        <div className="body form">
          <label className="stack">Name
            <input type="text" name="name" defaultValue={name} data-testid="create-portal-name" placeholder="Harbour Mosque" required={mode === 'create'} />
          </label>
          <label className="stack">Short address
            <input type="text" name="slug" defaultValue={slug} data-testid="create-portal-slug" placeholder="harbour" required={mode === 'create'} readOnly={mode === 'edit'} />
          </label>
          <label className="stack">Kind
            <select name="kind" defaultValue={kind} data-testid="create-portal-kind">
              <option value="mosque">Mosque</option>
              <option value="church">Church</option>
              <option value="synagogue">Synagogue</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="stack">Welcome line
            <textarea name="welcome" defaultValue={welcome} data-testid="create-portal-welcome" placeholder="A few words for people arriving" />
          </label>
        </div>
      </section>

      <section className="panel" hidden={step !== 'courses'} data-testid="studio-courses">
        <header>
          <div>
            <h2>Courses <HelpTip topic="portal-courses">{TOOL.portalCourses}</HelpTip></h2>
            <p>Tick the library courses this portal may use. Search, pick a whole door, or take every library course.</p>
          </div>
        </header>
        <div className="body">
          <LibraryCoursePicker courses={courses} selected={selectedCourses} testId="studio-course-list" />
        </div>
      </section>

      <section className="panel" hidden={step !== 'features'} data-testid="studio-features">
        <header>
          <div>
            <h2>Features <HelpTip topic="portal-features">{TOOL.portalFeatures}</HelpTip></h2>
            <p>Three groups. The first stays on. The next ones are on until you switch them off. The last ones you pick.</p>
          </div>
        </header>
        <div className="body">
          <div className="presets" data-testid="feature-presets">
            {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`btn small${preset === key ? ' ink' : ' ghost'}`}
                data-testid={`preset-${key}`}
                onClick={() => applyPreset(key)}
              >
                {PRESETS[key].label}
              </button>
            ))}
          </div>
          <p className="hint" data-testid="preset-hint">{preset ? PRESETS[preset].hint : 'A mix of your own.'}</p>
          <div className="feature-board">
            {grouped.map((group) => (
              <div key={group.depth} className="feature-depth" data-testid={`feature-depth-${group.depth}`}>
                <h3>{DEPTH_SECTION[group.depth].title}</h3>
                <p className="hint depth-line" data-testid={`feature-depth-line-${group.depth}`}>{DEPTH_SECTION[group.depth].line}</p>
                {group.rows.map((feature) => {
                  const locked = featureLocked(feature.key)
                  return (
                  <div key={feature.key} className={`feature-row${on[feature.key] ? ' on' : ''}${locked ? ' locked' : ''}`} data-testid={`feature-row-${feature.key}`}>
                    <label className="feature-switch">
                      <input
                        type="checkbox"
                        name={locked ? undefined : 'feature'}
                        value={feature.key}
                        checked={locked || on[feature.key]}
                        disabled={locked}
                        onChange={() => toggle(feature.key)}
                        data-testid={`feature-${feature.key}`}
                      />
                      {locked ? <input type="hidden" name="feature" value={feature.key} /> : null}
                      <span>
                        <b>{feature.name}</b>
                        <small>{feature.what}</small>
                      </span>
                    </label>
                    <HelpTip topic={`feature-${feature.key}`} place="end">{feature.help}</HelpTip>
                  </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="studio-actions">
        <button
          type="button"
          className="btn ghost"
          data-testid="studio-back"
          hidden={step === 'details'}
          onClick={() => go(step === 'features' ? 'courses' : 'details')}
        >
          Back
        </button>
        <button
          type="button"
          className="btn ink"
          data-testid="studio-next"
          hidden={step === 'features'}
          onClick={() => go(step === 'details' ? 'courses' : 'features')}
        >
          Next
        </button>
        <button
          className="btn ink"
          type="submit"
          hidden={step !== 'features'}
          data-testid={mode === 'create' ? 'create-portal-submit' : 'save-portal-features'}
        >
          {mode === 'create' ? 'Open portal' : 'Save features'}
        </button>
      </div>
    </form>
  )
}
