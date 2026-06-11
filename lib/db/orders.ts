import { getSql, newId } from '@/lib/db'
import type { OrderInput, OrderItemInput } from '@/lib/orders'

export type OrderRow = {
  id: string
  clientId: string
  invoiceId: string | null
  status: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type OrderItemRow = OrderItemInput & {
  id: string
  orderId: string
  serviceId: string | null
  createdAt: Date
}

export type ClientNested = {
  id: string
  name: string
  email: string
  company: string | null
}

export type ProductTypeNested = {
  id: string
  name: string
  slug: string
  color: string
}

export type ProductPackageNested = {
  id: string
  name: string
} | null

export type OrderItemWithRelations = OrderItemRow & {
  productType: ProductTypeNested
  productPackage: ProductPackageNested
}

export type OrderWithRelations = OrderRow & {
  client: ClientNested
  invoice: { id: string; invoiceNo: string; total: number; status: string } | null
  items: OrderItemWithRelations[]
  itemCount: number
  totalAmount: number
}

function mapOrder(row: Record<string, unknown>): OrderRow {
  return {
    id: String(row.id),
    clientId: String(row.clientId),
    invoiceId: row.invoiceId != null ? String(row.invoiceId) : null,
    status: String(row.status),
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  }
}

function mapOrderItem(row: Record<string, unknown>): OrderItemRow {
  return {
    id: String(row.id),
    orderId: String(row.orderId),
    serviceId: row.serviceId != null ? String(row.serviceId) : null,
    productTypeId: String(row.productTypeId),
    productPackageId: row.productPackageId != null ? String(row.productPackageId) : null,
    name: String(row.name),
    price: Number(row.price),
    setupFee: Number(row.setupFee),
    startDate: new Date(row.startDate as string),
    expiryDate: new Date(row.expiryDate as string),
    nextDueDate: row.nextDueDate != null ? new Date(row.nextDueDate as string) : null,
    recurring: Boolean(row.recurring),
    period: row.period != null ? String(row.period) : null,
    sortOrder: Number(row.sortOrder ?? 0),
    createdAt: new Date(row.createdAt as string),
  }
}

async function attachOrderRelations(orders: OrderRow[]): Promise<OrderWithRelations[]> {
  if (!orders.length) return []

  const sql = getSql()
  const orderIds = orders.map(o => o.id)
  const clientIds = Array.from(new Set(orders.map(o => o.clientId)))
  const invoiceIds = orders.map(o => o.invoiceId).filter(Boolean) as string[]

  const [clients, invoices, items] = await Promise.all([
    sql`SELECT id, name, email, company FROM "Client" WHERE id = ANY(${clientIds})`,
    invoiceIds.length
      ? sql`SELECT id, "invoiceNo", total, status FROM "Invoice" WHERE id = ANY(${invoiceIds})`
      : Promise.resolve([]),
    sql`
      SELECT oi.*,
        pt.id AS pt_id, pt.name AS pt_name, pt.slug AS pt_slug, pt.color AS pt_color,
        pp.id AS pp_id, pp.name AS pp_name
      FROM "OrderItem" oi
      JOIN "ProductType" pt ON pt.id = oi."productTypeId"
      LEFT JOIN "ProductPackage" pp ON pp.id = oi."productPackageId"
      WHERE oi."orderId" = ANY(${orderIds})
      ORDER BY oi."sortOrder" ASC, oi."createdAt" ASC
    `,
  ])

  const clientsById = new Map<string, ClientNested>()
  for (const row of clients) {
    const r = row as Record<string, unknown>
    clientsById.set(String(r.id), {
      id: String(r.id),
      name: String(r.name),
      email: String(r.email),
      company: r.company != null ? String(r.company) : null,
    })
  }

  const invoicesById = new Map<string, { id: string; invoiceNo: string; total: number; status: string }>()
  for (const row of invoices) {
    const r = row as Record<string, unknown>
    invoicesById.set(String(r.id), {
      id: String(r.id),
      invoiceNo: String(r.invoiceNo),
      total: Number(r.total),
      status: String(r.status),
    })
  }

  const itemsByOrder = new Map<string, OrderItemWithRelations[]>()
  for (const row of items) {
    const r = row as Record<string, unknown>
    const item = mapOrderItem(r)
    const withRelations: OrderItemWithRelations = {
      ...item,
      productType: {
        id: String(r.pt_id),
        name: String(r.pt_name),
        slug: String(r.pt_slug),
        color: String(r.pt_color),
      },
      productPackage: r.pp_id != null
        ? { id: String(r.pp_id), name: String(r.pp_name) }
        : null,
    }
    const list = itemsByOrder.get(item.orderId) || []
    list.push(withRelations)
    itemsByOrder.set(item.orderId, list)
  }

  return orders.map(order => {
    const orderItems = itemsByOrder.get(order.id) || []
    const totalAmount = orderItems.reduce((sum, i) => sum + i.price + i.setupFee, 0)
    return {
      ...order,
      client: clientsById.get(order.clientId)!,
      invoice: order.invoiceId ? invoicesById.get(order.invoiceId) ?? null : null,
      items: orderItems,
      itemCount: orderItems.length,
      totalAmount,
    }
  })
}

export async function countOrders(): Promise<number> {
  const sql = getSql()
  const rows = await sql`SELECT COUNT(*)::int AS count FROM "Order"`
  return Number((rows[0] as { count: number }).count)
}

export async function listOrders(): Promise<OrderWithRelations[]> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM "Order" ORDER BY "createdAt" DESC`
  return attachOrderRelations(rows.map(r => mapOrder(r as Record<string, unknown>)))
}

export async function getOrderById(id: string): Promise<OrderWithRelations | null> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM "Order" WHERE id = ${id} LIMIT 1`
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return null
  const [order] = await attachOrderRelations([mapOrder(row)])
  return order
}

export async function createOrderRecord(
  data: OrderInput,
  invoiceId: string | null,
): Promise<OrderRow> {
  const sql = getSql()
  const id = newId()
  const now = new Date()
  await sql`
    INSERT INTO "Order" (id, "clientId", "invoiceId", status, notes, "createdAt", "updatedAt")
    VALUES (${id}, ${data.clientId}, ${invoiceId}, 'COMPLETED', ${data.notes || null}, ${now}, ${now})
  `
  const rows = await sql`SELECT * FROM "Order" WHERE id = ${id} LIMIT 1`
  return mapOrder(rows[0] as Record<string, unknown>)
}

export async function createOrderItem(
  orderId: string,
  item: OrderItemInput,
  serviceId: string | null,
  sortOrder: number,
): Promise<OrderItemRow> {
  const sql = getSql()
  const id = newId()
  const now = new Date()
  await sql`
    INSERT INTO "OrderItem" (
      id, "orderId", "serviceId", "productTypeId", "productPackageId", name,
      price, "setupFee", "startDate", "expiryDate", "nextDueDate",
      recurring, period, "sortOrder", "createdAt"
    ) VALUES (
      ${id}, ${orderId}, ${serviceId}, ${item.productTypeId}, ${item.productPackageId}, ${item.name},
      ${item.price}, ${item.setupFee}, ${item.startDate}, ${item.expiryDate}, ${item.nextDueDate},
      ${item.recurring}, ${item.period}, ${sortOrder}, ${now}
    )
  `
  const rows = await sql`SELECT * FROM "OrderItem" WHERE id = ${id} LIMIT 1`
  return mapOrderItem(rows[0] as Record<string, unknown>)
}

export async function linkOrderInvoice(orderId: string, invoiceId: string) {
  const sql = getSql()
  const now = new Date()
  await sql`
    UPDATE "Order" SET "invoiceId" = ${invoiceId}, "updatedAt" = ${now}
    WHERE id = ${orderId}
  `
}

export async function deleteOrder(id: string) {
  const order = await getOrderById(id)
  if (!order) throw new Error('Order not found')

  if (order.invoice?.status === 'PAID') {
    throw new Error('Cannot delete an order with a paid invoice')
  }

  const invoiceId = order.invoiceId
  const serviceIds = order.items
    .map(item => item.serviceId)
    .filter((serviceId): serviceId is string => Boolean(serviceId))

  const sql = getSql()
  await sql.transaction([
    sql`DELETE FROM "Order" WHERE id = ${id}`,
    ...(invoiceId
      ? [
          sql`DELETE FROM "InvoiceItem" WHERE "invoiceId" = ${invoiceId}`,
          sql`DELETE FROM "Invoice" WHERE id = ${invoiceId}`,
        ]
      : []),
    ...(serviceIds.length
      ? [sql`DELETE FROM "Service" WHERE id = ANY(${serviceIds})`]
      : []),
  ])
}
