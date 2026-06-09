import { hasOpenRenewalInvoice } from '@/lib/db/invoices'
import { listServices } from '@/lib/db/services'
import {
  buildServiceInvoiceLabel,
  createInvoiceForService,
  getServiceInvoicePeriod,
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

  for (const svc of services) {
    const input = serviceRecordToInvoiceInput(svc)
    const label = buildServiceInvoiceLabel(
      svc.productType.name,
      svc.name,
      svc.productPackage?.name,
    )
    const { periodEnd } = getServiceInvoicePeriod(input)

    try {
      const exists = await hasOpenRenewalInvoice(svc.clientId, label, periodEnd)
      if (exists) {
        result.skipped++
        continue
      }

      await createInvoiceForService(input, 0, { includeSetupFee: false })
      result.created++
    } catch (e) {
      result.errors.push(
        `${svc.client.name} — ${svc.name}: ${e instanceof Error ? e.message : 'failed'}`,
      )
    }
  }

  return result
}
