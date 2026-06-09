/** Parse a date or datetime value for invoice paidAt storage. */
export function parsePaidAtDate(value: unknown): Date {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) throw new Error('Paid date is required')

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T12:00:00`)
    if (Number.isNaN(date.getTime())) throw new Error('Invalid paid date')
    return date
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid paid date')
  return date
}

export function toPaidDateInput(date: Date | string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toISOString().split('T')[0]
}
