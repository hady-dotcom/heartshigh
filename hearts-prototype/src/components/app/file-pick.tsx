'use client'

import { useState } from 'react'

export function FilePick({ name, accept, required, testId }: { name: string; accept?: string; required?: boolean; testId?: string }) {
  const [file, setFile] = useState('')
  return (
    <label className="file-pick" data-testid={testId || 'file-pick'}>
      <input
        type="file"
        name={name}
        accept={accept}
        required={required}
        onChange={(event) => setFile(event.target.files?.[0]?.name || '')}
      />
      <span className="file-pick-btn">Add a photo</span>
      <span className="file-pick-name">{file || 'No photo chosen yet'}</span>
    </label>
  )
}
