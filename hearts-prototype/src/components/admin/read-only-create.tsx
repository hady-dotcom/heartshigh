'use client'

import { DefaultEditView, useDocumentInfo } from '@payloadcms/ui'
import type { DocumentViewClientProps } from 'payload'
import React from 'react'

/** Existing rows keep the normal editor. A new row explains that the app records it. */
export function ReadOnlyCreateView(props: DocumentViewClientProps) {
  const { id } = useDocumentInfo()
  if (id) return <DefaultEditView {...props} />
  return (
    <div className="hig-readonly" data-testid="read-only-create">
      <h1>Kept by the app</h1>
      <p>These rows are recorded by the app. You can read them from the list. You cannot add one by hand.</p>
      <a className="btn btn--style-primary" href="..">Back to the list</a>
    </div>
  )
}
