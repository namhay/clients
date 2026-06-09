const COLORS = ['blue', 'green', 'orange', 'pink', 'purple', 'gray', 'yellow', 'red', 'indigo'] as const

export type ReminderTiming = 'BEFORE' | 'AFTER'

export function parseReminderTiming(value: unknown, fallback: ReminderTiming = 'BEFORE'): ReminderTiming {
  return String(value || fallback).toUpperCase() === 'AFTER' ? 'AFTER' : 'BEFORE'
}

export function formatReminderRule(days: number, timing: ReminderTiming = 'BEFORE'): string {
  return timing === 'AFTER' ? `${days}d after` : `${days}d before`
}

export type ProductTypeInput = {
  name: string
  slug: string
  color: string
  hasHostingSpecs: boolean
  active: boolean
  sortOrder: number
  reminderDaysBeforeExpiry: number
  reminderTiming: ReminderTiming
  autoInvoiceDaysBeforeExpiry: number
}

export function slugify(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'TYPE'
}

export function parseProductTypeInput(body: Record<string, unknown>): ProductTypeInput {
  const name = String(body.name || '').trim()
  if (!name) throw new Error('Product type name is required')

  const slug = body.slug ? String(body.slug).trim().toUpperCase() : slugify(name)
  if (!slug) throw new Error('Product type slug is required')

  const color = String(body.color || 'blue').toLowerCase()
  if (!COLORS.includes(color as typeof COLORS[number])) {
    throw new Error(`Invalid color. Choose: ${COLORS.join(', ')}`)
  }

  return {
    name,
    slug,
    color,
    hasHostingSpecs: Boolean(body.hasHostingSpecs),
    active: body.active !== false,
    sortOrder: parseInt(String(body.sortOrder)) || 0,
    reminderDaysBeforeExpiry: Math.max(1, parseInt(String(body.reminderDaysBeforeExpiry)) || 14),
    reminderTiming: parseReminderTiming(body.reminderTiming),
    autoInvoiceDaysBeforeExpiry: Math.max(1, parseInt(String(body.autoInvoiceDaysBeforeExpiry)) || 14),
  }
}

export function productTypeFields(data: ProductTypeInput): ProductTypeInput {
  return data
}

export const PRODUCT_TYPE_COLORS = COLORS
