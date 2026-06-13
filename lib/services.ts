import { calculateBillingDates } from '@/lib/billing'
import { getProductTypeById, getProductTypeBySlug } from '@/lib/db/product-types'
import { getProductPackageById } from '@/lib/db/product-packages'

const PERIODS = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY'] as const
const STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED'] as const

export type ServiceInput = {
  clientId: string
  productTypeId: string
  productPackageId: string | null
  name: string
  startDate: Date
  expiryDate: Date
  price: number
  recurring: boolean
  period: string | null
  status: string
}

export async function parseServiceInput(body: Record<string, unknown>): Promise<ServiceInput> {
  if (!body.clientId || !body.name) {
    throw new Error('Client and name are required')
  }

  let productTypeId = body.productTypeId ? String(body.productTypeId) : ''
  if (!productTypeId && body.type) {
    const bySlug = await getProductTypeBySlug(String(body.type))
    if (bySlug) productTypeId = bySlug.id
  }
  if (!productTypeId) {
    throw new Error('Product type is required')
  }

  const productType = await getProductTypeById(productTypeId)
  if (!productType) throw new Error('Invalid product type')
  if (!productType.active) throw new Error('Selected product type is inactive')

  const recurring = Boolean(body.recurring)
  const period = recurring
    ? (body.period as string) || 'YEARLY'
    : null

  if (recurring && period && !PERIODS.includes(period as typeof PERIODS[number])) {
    throw new Error('Invalid billing cycle')
  }

  const startDate = new Date((body.startDate as string) || new Date().toISOString().split('T')[0])
  let expiryDate = body.expiryDate ? new Date(body.expiryDate as string) : null

  if (recurring && period && !expiryDate) {
    const dates = calculateBillingDates(startDate, period)
    expiryDate = dates.expiryDate
  }

  if (!expiryDate) {
    throw new Error('Renewal date is required')
  }

  const status = (body.status as string) || 'ACTIVE'
  if (!STATUSES.includes(status as typeof STATUSES[number])) {
    throw new Error('Invalid status')
  }

  const productPackageId = body.productPackageId ? String(body.productPackageId) : null
  if (!productPackageId) {
    throw new Error('Product package is required')
  }

  const productPackage = await getProductPackageById(productPackageId)
  if (!productPackage) throw new Error('Invalid product package')
  if (productPackage.productTypeId !== productTypeId) {
    throw new Error('Package does not belong to the selected product type')
  }
  if (!productPackage.active) throw new Error('Selected product package is inactive')

  return {
    clientId: body.clientId as string,
    productTypeId,
    productPackageId,
    name: (body.name as string).trim(),
    startDate,
    expiryDate,
    price: parseFloat(String(body.price)) || 0,
    recurring,
    period,
    status,
  }
}

export function serviceFields(data: ServiceInput): ServiceInput {
  return data
}
