export type Role = 'ADMIN' | 'STAFF'
export type Period = 'MONTHLY' | 'YEARLY'
export type ServiceStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
export type InvoiceStatus = 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'

export interface ProductType {
  id: string
  name: string
  slug: string
  color: string
  hasHostingSpecs: boolean
  active: boolean
  sortOrder: number
}

export type PackageBillingType = 'RECURRING' | 'ONE_TIME'

export interface ProductPackage {
  id: string
  productTypeId: string
  productType?: ProductType
  name: string
  description?: string | null
  billingType?: PackageBillingType
  priceMonthly: number
  priceYearly: number
  setupFee: number
  active: boolean
}

export interface Client {
  id: string
  name: string
  email: string
  phone?: string | null
  company?: string | null
  address?: string | null
  telegramId?: string | null
  notes?: string | null
  createdAt: Date
  _count?: { services: number; invoices: number }
}

export interface Service {
  id: string
  clientId: string
  client?: Client
  productTypeId: string
  productType?: ProductType
  productPackageId?: string | null
  productPackage?: ProductPackage | null
  name: string
  startDate: Date
  expiryDate: Date
  price: number
  recurring: boolean
  period?: Period | null
  status: ServiceStatus
  notes?: string | null
}

export interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Invoice {
  id: string
  clientId: string
  client?: Client
  invoiceNo: string
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  status: InvoiceStatus
  dueDate: Date
  paidAt?: Date | null
  notes?: string | null
  createdAt: Date
}

export interface DashboardStats {
  totalClients: number
  unpaidInvoices: number
  totalRevenue: number
  expiringServices: number
  recentInvoices: Invoice[]
  expiringList: Service[]
}
