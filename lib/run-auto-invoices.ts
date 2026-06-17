import { hasInvoiceForPeriod } from '@/lib/db/invoices'
import { listServices } from '@/lib/db/services'
import type { ServiceWithRelations } from '@/lib/db/services'
import type { ServiceForInvoice } from '@/lib/invoices'
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
import { parseReminderTimezone } from '@/lib/reminder-schedule'
import { getAppSettings } from '@/lib/settings'

export type AutoInvoiceRunResult = {
  processed: number
  created: number
  skipped: number
  tooEarly: number
  errors: string[]
  invoices: { id: string; invoiceNo: string }[]
}

type InvoiceKind = 'first' | 'renewal'

type InvoicePlanGroup = {
  clientId: string
  clientName: string
  expiryDate: Date
  kind: InvoiceKind
  services: ServiceForInvoice[]
}

function groupKey(clientId: string, expiryDate: Date, kind: InvoiceKind) {
  return `${clientId}:${expiryDate.toISOString().slice(0, 10)}:${kind}`
}

async function resolveServiceInvoicePlan(
  svc: ServiceWithRelations,
): Promise<{ kind: InvoiceKind; input: ServiceForInvoice } | null> {
  const label = buildServiceInvoiceLabel(
    svc.productType.name,
    svc.name,
    svc.productPackage?.name,
  )

  const hasFirst = await hasInvoiceForPeriod(svc.clientId, label, svc.startDate)
  if (!hasFirst) {
    return { kind: 'first', input: serviceRecordToInvoiceInput(svc) }
  }

  const hasRenewal = await hasInvoiceForPeriod(svc.clientId, label, svc.expiryDate)
  if (hasRenewal) return null

  return { kind: 'renewal', input: serviceRecordToInvoiceInput(svc) }
}

async function buildInvoicePlanGroups(
  services: ServiceWithRelations[],
): Promise<{ groups: InvoicePlanGroup[]; skipped: number; errors: string[] }> {
  const groups = new Map<string, InvoicePlanGroup>()
  let skipped = 0
  const errors: string[] = []

  for (const svc of services) {
    try {
      const plan = await resolveServiceInvoicePlan(svc)
      if (!plan) {
        skipped++
        continue
      }

      const key = groupKey(svc.clientId, svc.expiryDate, plan.kind)
      const existing = groups.get(key)
      if (existing) {
        existing.services.push(plan.input)
      } else {
        groups.set(key, {
          clientId: svc.clientId,
          clientName: svc.client.name,
          expiryDate: svc.expiryDate,
          kind: plan.kind,
          services: [plan.input],
        })
      }
    } catch (e) {
      errors.push(
        `${svc.client.name} — ${svc.name}: ${e instanceof Error ? e.message : 'failed'}`,
      )
    }
  }

  return { groups: Array.from(groups.values()), skipped, errors }
}

async function createInvoicesForPlanGroups(
  planGroups: InvoicePlanGroup[],
): Promise<Pick<AutoInvoiceRunResult, 'created' | 'skipped' | 'errors' | 'invoices'>> {
  const result = {
    created: 0,
    skipped: 0,
    errors: [] as string[],
    invoices: [] as { id: string; invoiceNo: string }[],
  }

  for (const group of planGroups) {
    if (!group.services.length) continue

    const options = group.kind === 'first'
      ? { periodMode: 'form' as const }
      : { periodMode: 'renewal' as const }

    try {
      const invoice = await createInvoiceForServices(
        group.services,
        group.clientId,
        group.expiryDate,
        options,
      )
      result.created++
      result.invoices.push({ id: invoice.id, invoiceNo: invoice.invoiceNo })
    } catch (e) {
      result.errors.push(
        `${group.clientName}: ${e instanceof Error ? e.message : 'failed'}`,
      )
    }
  }

  return result
}

/** Generate renewal invoices for eligible services of one client (manual fallback for cron). */
export async function runAutoInvoicesForClient(clientId: string): Promise<AutoInvoiceRunResult> {
  const settings = await getAppSettings()
  const timezone = parseReminderTimezone(settings.reminderTimezone)
  const candidates = await listServices({ clientId, status: 'ACTIVE' })
  const recurring = candidates.filter(s => s.recurring)
  const eligible = filterServicesDueForAutoInvoice(recurring, timezone)
  const tooEarly = recurring.length - eligible.length

  const { groups, skipped, errors } = await buildInvoicePlanGroups(eligible)
  const created = await createInvoicesForPlanGroups(groups)

  return {
    processed: recurring.length,
    tooEarly,
    skipped: skipped + created.skipped,
    errors: [...errors, ...created.errors],
    created: created.created,
    invoices: created.invoices,
  }
}

export async function runAutoInvoices(): Promise<AutoInvoiceRunResult> {
  const settings = await getAppSettings()
  const timezone = parseReminderTimezone(settings.reminderTimezone)
  const maxDays = await getMaxExpiryWindowDays()
  const candidates = await listServices({
    expiryDateLte: expiryWithinDays(maxDays),
    status: 'ACTIVE',
  })

  const recurring = candidates.filter(s => s.recurring)
  const eligible = filterServicesDueForAutoInvoice(recurring, timezone)
  const tooEarly = recurring.length - eligible.length

  const { groups, skipped, errors } = await buildInvoicePlanGroups(eligible)
  const created = await createInvoicesForPlanGroups(groups)

  return {
    processed: recurring.length,
    tooEarly,
    skipped: skipped + created.skipped,
    errors: [...errors, ...created.errors],
    created: created.created,
    invoices: created.invoices,
  }
}
