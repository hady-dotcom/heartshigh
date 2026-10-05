export function SearchBox({ action, defaultValue = '' }: { action: string; defaultValue?: string }) {
  return (
    <form className="learner-search" action={action} method="get" data-testid="learner-search" role="search">
      <label className="sr-only" htmlFor="learner-q">Find a talk, a speaker or a topic</label>
      <input
        id="learner-q"
        className="field"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Find a talk, a speaker or a topic"
        data-testid="search-q"
      />
      <button className="pill gold small" type="submit" data-testid="search-submit">Search</button>
    </form>
  )
}
