import { CopyLink } from '@/components/app/copy-link'

export function CrossPost({ text, testId }: { text: string; testId: string }) {
  return (
    <details className="gather-more" data-testid={`${testId}-row`}>
      <summary>
        <span className="chevron" aria-hidden="true" />
        Copy for Meetup or Facebook
      </summary>
      <div className="cross-box">
        <textarea className="field" readOnly data-testid={testId} value={text} />
        <CopyLink value={text} testId={`${testId}-copy`} label="Copy" />
      </div>
    </details>
  )
}
