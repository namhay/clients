import { Prisma } from '@prisma/client'
import { calculateBillingDates } from '@/lib/billing'
import { prisma } from '@/lib/prisma'

const PERIODS = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY'] as const
const STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED'] as const

export type ServiceInput = {
  clientId: string
  productTypeId: string
  productPackageId: string | null
  name: string
  startDate: Date
  expiryDate: Date
  nextDueDate: Date | null
  price: number
  setupFee: number
  recurring: boolean
  period: string | null
  status: string
  notes: string | null
}

export async function parseServiceInput(body: Record<string, unknown>): Promise<ServiceInput> {
  if (!body.clientId || !body.name) {
    throw new Error('Client and name are required')
  }

  let productTypeId = body.productTypeId ? String(body.productTypeId) : ''
  if (!productTypeId && body.type) {
    const bySlug = await prisma.productType.findUnique({
      where: { slug: String(body.type).toUpperCase() },
    })
    if (bySlug) productTypeId = bySlug.id
  }
  if (!productTypeId) {
    throw new Error('Product type is required')
  }

  const productType = await prisma.productType.findUnique({ where: { id: productTypeId } })
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
  let nextDueDate = body.nextDueDate ? new Date(body.nextDueDate as string) : null

  if (recurring && period) {
    if (!expiryDate && !nextDueDate) {
      const dates = calculateBillingDates(startDate, period)
      expiryDate = dates.expiryDate
      nextDueDate = dates.nextDueDate
    } else if (expiryDate && !nextDueDate) {
      nextDueDate = expiryDate
    } else if (nextDueDate && !expiryDate) {
      expiryDate = nextDueDate
    }
  }

  if (!expiryDate) {
    throw new Error('Renewal / expiry date is required')
  }

  const status = (body.status as string) || 'ACTIVE'
  if (!STATUSES.includes(status as typeof STATUSES[number])) {
    throw new Error('Invalid status')
  }

  const productPackageId = body.productPackageId ? String(body.productPackageId) : null
  if (!productPackageId) {
    throw new Error('Product package is required')
  }

  const productPackage = await prisma.productPackage.findUnique({
    where: { id: productPackageId },
    include: { productType: true },
  })
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
    nextDueDate: recurring ? nextDueDate : null,
    price: parseFloat(String(body.price)) || 0,
    setupFee: parseFloat(String(body.setupFee)) || 0,
    recurring,
    period,
    status,
    notes: body.notes ? String(body.notes).trim() : null,
  }
}

export function toPrismaCreateData(data: ServiceInput): Prisma.ServiceUncheckedCreateInput {
  return {
    clientId: data.clientId,
    productTypeId: data.productTypeId,
    productPackageId: data.productPackageId,
    name: data.name,
    startDate: data.startDate,
    expiryDate: data.expiryDate,
    nextDueDate: data.nextDueDate,
    price: data.price,
    setupFee: data.setupFee,
    recurring: data.recurring,
    period: data.period as Prisma.ServiceCreateInput['period'],
    status: data.status as Prisma.ServiceCreateInput['status'],
    notes: data.notes,
  }
}

export function toPrismaUpdateData(data: ServiceInput): Prisma.ServiceUncheckedUpdateInput {
  return {
    clientId: data.clientId,
    productTypeId: data.productTypeId,
    productPackageId: data.productPackageId,
    name: data.name,
    startDate: data.startDate,
    expiryDate: data.expiryDate,
    nextDueDate: data.nextDueDate,
    price: data.price,
    setupFee: data.setupFee,
    recurring: data.recurring,
    period: data.period as Prisma.ServiceUncheckedUpdateInput['period'],
    status: data.status as Prisma.ServiceUncheckedUpdateInput['status'],
    notes: data.notes,
  }
}

export const serviceInclude = {
  client: true,
  productType: true,
  productPackage: true,
} as const
