'use client'

/** Filters the question rows already on the page. Nothing is sent until the person saves a question. */
export function QuestionSearch({ row }: { row: string }) {
  return (
    <label className="stack" style={{ marginBottom: 12 }}>
      Search
      <input
        type="search"
        placeholder="Search questions"
        aria-label="Search questions"
        data-testid="question-search"
        onChange={(event) => {
          const needle = event.target.value.trim().toLowerCase()
          document.querySelectorAll<HTMLElement>(row).forEach((item) => {
            item.hidden = needle.length > 0 && !item.textContent?.toLowerCase().includes(needle)
          })
        }}
      />
    </label>
  )
}
