import { hasOpenRenewalInvoice } from '@/lib/db/invoices'
import { listServices } from '@/lib/db/services'
import type { ServiceWithRelations } from '@/lib/db/services'
import {
  buildServiceInvoiceLabel,
  createInvoiceForServices,
  serviceRecordToInvoiceInput,
} from '@/lib/invoices'
import {
  expiryWithinDays,
  filterServicesDueForAutoInvoice,
  getMaxExpiryWindowDays,
} from '@/lib/reminders'

export type AutoInvoiceRunResult = {
  processed: number
  created: number
  skipped: number
  tooEarly: number
  errors: string[]
  invoices: { id: string; invoiceNo: string }[]
}

function groupKey(clientId: string, expiryDate: Date) {
  return `${clientId}:${expiryDate.toISOString().slice(0, 10)}`
}

function groupServicesByClientExpiry(services: ServiceWithRelations[]) {
  const groups = new Map<string, ServiceWithRelations[]>()
  for (const svc of services) {
    const key = groupKey(svc.clientId, svc.expiryDate)
    const list = groups.get(key) || []
    list.push(svc)
    groups.set(key, list)
  }
  return Array.from(groups.values())
}

async function createInvoicesForServiceGroups(
  groups: ServiceWithRelations[][],
): Promise<Pick<AutoInvoiceRunResult, 'created' | 'skipped' | 'errors' | 'invoices'>> {
  const result = {
    created: 0,
    skipped: 0,
    errors: [] as string[],
    invoices: [] as { id: string; invoiceNo: string }[],
  }

  for (const group of groups) {
    const toInvoice = []

    for (const svc of group) {
      const label = buildServiceInvoiceLabel(
        svc.productType.name,
        svc.name,
        svc.productPackage?.name,
      )

      try {
        const exists = await hasOpenRenewalInvoice(svc.clientId, label, svc.expiryDate)
        if (exists) {
          result.skipped++
          continue
        }
        toInvoice.push(serviceRecordToInvoiceInput(svc))
      } catch (e) {
        result.errors.push(
          `${svc.client.name} — ${svc.name}: ${e instanceof Error ? e.message : 'failed'}`,
        )
      }
    }

    if (!toInvoice.length) continue

    try {
      const invoice = await createInvoiceForServices(
        toInvoice,
        group[0].clientId,
        0,
        group[0].expiryDate,
        { includeSetupFee: false, periodMode: 'renewal' },
      )
      result.created++
      result.invoices.push({ id: invoice.id, invoiceNo: invoice.invoiceNo })
    } catch (e) {
      result.errors.push(
        `${group[0].client.name}: ${e instanceof Error ? e.message : 'failed'}`,
      )
    }
  }

  return result
}

/** Generate renewal invoices for eligible services of one client (manual fallback for cron). */
export async function runAutoInvoicesForClient(clientId: string): Promise<AutoInvoiceRunResult> {
  const candidates = await listServices({ clientId, status: 'ACTIVE' })
  const recurring = candidates.filter(s => s.recurring)
  const eligible = filterServicesDueForAutoInvoice(recurring)
  const tooEarly = recurring.length - eligible.length

  const created = await createInvoicesForServiceGroups(groupServicesByClientExpiry(eligible))

  return {
    processed: recurring.length,
    tooEarly,
    ...created,
  }
}

export async function runAutoInvoices(): Promise<AutoInvoiceRunResult> {
  const maxDays = await getMaxExpiryWindowDays()
  const candidates = await listServices({
    expiryDateLte: expiryWithinDays(maxDays),
    status: 'ACTIVE',
  })

  const recurring = candidates.filter(s => s.recurring)
  const eligible = filterServicesDueForAutoInvoice(recurring)
  const tooEarly = recurring.length - eligible.length

  const created = await createInvoicesForServiceGroups(groupServicesByClientExpiry(eligible))

  return {
    processed: recurring.length,
    tooEarly,
    ...created,
  }
}
