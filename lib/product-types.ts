import { Prisma } from '@prisma/client'

const COLORS = ['blue', 'green', 'orange', 'pink', 'purple', 'gray', 'yellow', 'red', 'indigo'] as const

export type ProductTypeInput = {
  name: string
  slug: string
  color: string
  hasHostingSpecs: boolean
  active: boolean
  sortOrder: number
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
  }
}

export function toPrismaProductTypeData(
  data: ProductTypeInput,
): Prisma.ProductTypeUncheckedCreateInput {
  return data
}

export const PRODUCT_TYPE_COLORS = COLORS
