const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function BritishDateFields({
  name,
  value,
  testId,
}: {
  name: string
  value?: string
  testId: string
}) {
  const [year, month, day] = (value || '').split('-')
  return (
    <span className="british-date" lang="en-GB" data-testid={testId}>
      <input type="number" name={`${name}Day`} min={1} max={31} defaultValue={day || ''} placeholder="Day" aria-label="Day" data-testid={`${testId}-day`} />
      <select name={`${name}Month`} defaultValue={month || ''} aria-label="Month" data-testid={`${testId}-month`}>
        <option value="">Month</option>
        {MONTHS.map((label, index) => (
          <option key={label} value={String(index + 1).padStart(2, '0')}>{label}</option>
        ))}
      </select>
      <input type="number" name={`${name}Year`} min={2020} max={2100} defaultValue={year || ''} placeholder="Year" aria-label="Year" data-testid={`${testId}-year`} />
    </span>
  )
}
