'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode; homeHref?: string; onNext?: () => void }
type State = { failed: boolean }

export class JourneyErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Hady Core clip failed', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <section className="j-screen" data-testid="clip-error" style={{ padding: '72px 24px 24px', color: '#f6eedc' }}>
        <h1 className="j-caption small">Something went wrong with this clip.</h1>
        <p className="j-sub">You can skip it, or go back to Home. Nothing else is lost.</p>
        <div className="j-actions">
          <button type="button" className="pill gold block" data-testid="clip-error-next" onClick={() => {
            this.setState({ failed: false })
            this.props.onNext?.()
          }}>
            Next clip
          </button>
          <a className="pill outline-light block" href={this.props.homeHref || '/'} data-testid="clip-error-home">
            Back to Home
          </a>
        </div>
      </section>
    )
  }
}
