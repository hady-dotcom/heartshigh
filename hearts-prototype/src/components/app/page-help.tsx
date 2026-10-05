'use client'

import { HelpTip } from '@/components/help-tip'

/** Learner “?” — same pop-up as the desk, with data-help for the coverage test. */
export function PageHelp({ topic, children }: { topic: string; children: string }) {
  if (!children) return null
  return (
    <span className="page-help" data-help={topic} data-testid="page-help">
      <HelpTip topic={topic} label="What is this page?">
        {children}
      </HelpTip>
    </span>
  )
}
