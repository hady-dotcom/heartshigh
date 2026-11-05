'use client'

import { useState } from 'react'

/** The long code form: the pack defaults to everything, and a teacher is asked only for a learner. */
export function CodeRoleFields({
  teachers,
  packs,
  defaultPack,
}: {
  teachers: { id: number; name: string }[]
  packs: { id: number; title: string }[]
  defaultPack: string
}) {
  const [role, setRole] = useState('learner')
  return (
    <>
      <div className="cols">
        <label className="stack">Code<input type="text" data-testid="new-code" name="code" placeholder="Leave empty for a random code" /></label>
        <label className="stack">For
          <select data-testid="new-code-role" name="role" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="learner">Learner</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
            <option value="parent">Parent (one course)</option>
          </select>
        </label>
      </div>
      <label className="stack">Which courses (usually: everything)
        <select data-testid="new-code-pack" name="pack" defaultValue={defaultPack}>
          {packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.title}</option>)}
        </select>
      </label>
      {role === 'learner' ? (
        <label className="stack">Put them with which teacher?
          <select data-testid="new-code-teacher" name="linkedTeacherCode" defaultValue={teachers[0] ? String(teachers[0].id) : ''}>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
          </select>
        </label>
      ) : <input type="hidden" name="linkedTeacherCode" value="" />}
    </>
  )
}
