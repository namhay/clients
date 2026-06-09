import { createOrderItem, createOrderRecord, getOrderById } from '@/lib/db/orders'
import { createService } from '@/lib/db/services'
import {
  createInvoiceForServices,
  sendInvoiceToClient,
  serviceRecordToInvoiceInput,
} from '@/lib/invoices'
import { parseServiceInput, serviceFields } from '@/lib/services'

export type OrderItemInput = {
  productTypeId: string
  productPackageId: string | null
  name: string
  price: number
  setupFee: number
  startDate: Date
  expiryDate: Date
  nextDueDate: Date | null
  recurring: boolean
  period: string | null
  sortOrder?: number
}

export type OrderInput = {
  clientId: string
  notes: string | null
  items: OrderItemInput[]
}

export type FulfillOrderOptions = {
  generateInvoice?: boolean
  sendInvoice?: boolean
  tax?: number
}

export async function parseOrderInput(body: Record<string, unknown>): Promise<OrderInput> {
  const clientId = String(body.clientId || '').trim()
  if (!clientId) throw new Error('Client is required')

  const rawItems = Array.isArray(body.items) ? body.items : []
  if (!rawItems.length) throw new Error('Add at least one product to the order')

  const items: OrderItemInput[] = []
  for (let i = 0; i < rawItems.length; i++) {
    const row = rawItems[i] as Record<string, unknown>
    const serviceData = await parseServiceInput({
      ...row,
      clientId,
      status: 'ACTIVE',
      notes: null,
    })
    items.push({
      productTypeId: serviceData.productTypeId,
      productPackageId: serviceData.productPackageId,
      name: serviceData.name,
      price: serviceData.price,
      setupFee: serviceData.setupFee,
      startDate: serviceData.startDate,
      expiryDate: serviceData.expiryDate,
      nextDueDate: serviceData.nextDueDate,
      recurring: serviceData.recurring,
      period: serviceData.period,
    })
  }

  return {
    clientId,
    notes: body.notes ? String(body.notes).trim() : null,
    items,
  }
}

export async function fulfillOrder(
  order: OrderInput,
  options: FulfillOrderOptions = {},
) {
  const { generateInvoice = true, sendInvoice = false, tax = 0 } = options
  const createdServices = []

  for (const item of order.items) {
    const service = await createService(serviceFields({
      clientId: order.clientId,
      productTypeId: item.productTypeId,
      productPackageId: item.productPackageId,
      name: item.name,
      startDate: item.startDate,
      expiryDate: item.expiryDate,
      nextDueDate: item.nextDueDate,
      price: item.price,
      setupFee: item.setupFee,
      recurring: item.recurring,
      period: item.period,
      status: 'ACTIVE',
      notes: order.notes,
    }))
    createdServices.push(service)
  }

  let invoice = null
  let invoiceSent = null

  if (generateInvoice) {
    invoice = await createInvoiceForServices(
      createdServices.map(serviceRecordToInvoiceInput),
      order.clientId,
      tax,
    )
  }

  const orderRecord = await createOrderRecord(order, invoice?.id ?? null)

  for (let i = 0; i < order.items.length; i++) {
    await createOrderItem(orderRecord.id, order.items[i], createdServices[i].id, i)
  }

  if (invoice && sendInvoice) {
    invoiceSent = await sendInvoiceToClient(invoice.id, order.clientId)
  }

  const fullOrder = await getOrderById(orderRecord.id)
  return {
    order: fullOrder,
    services: createdServices,
    invoice,
    invoiceSent,
  }
}
