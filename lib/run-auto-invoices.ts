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
  errors: string[]
}

function groupKey(clientId: string, expiryDate: Date) {
  return `${clientId}:${expiryDate.toISOString().slice(0, 10)}`
}

export async function runAutoInvoices(): Promise<AutoInvoiceRunResult> {
  const maxDays = await getMaxExpiryWindowDays()
  const candidates = await listServices({
    expiryDateLte: expiryWithinDays(maxDays),
    status: 'ACTIVE',
  })

  const services = filterServicesDueForAutoInvoice(candidates).filter(s => s.recurring)

  const result: AutoInvoiceRunResult = {
    processed: services.length,
    created: 0,
    skipped: 0,
    errors: [],
  }

  const groups = new Map<string, ServiceWithRelations[]>()
  for (const svc of services) {
    const key = groupKey(svc.clientId, svc.expiryDate)
    const list = groups.get(key) || []
    list.push(svc)
    groups.set(key, list)
  }

  for (const group of Array.from(groups.values())) {
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
      await createInvoiceForServices(
        toInvoice,
        group[0].clientId,
        0,
        group[0].expiryDate,
        { includeSetupFee: false, periodMode: 'renewal' },
      )
      result.created++
    } catch (e) {
      result.errors.push(
        `${group[0].client.name}: ${e instanceof Error ? e.message : 'failed'}`,
      )
    }
  }

  return result
}
