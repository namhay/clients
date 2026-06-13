'use client'
import { formatRenewalTiming, RENEWAL_DAYS_BEFORE_EXPIRY_OPTIONS } from '@/lib/clients'

export type ClientFormValues = {
  name: string
  email: string
  phone: string
  company: string
  companyKhmer: string
  address: string
  vatTin: string
  telegramId: string
  notes: string
  renewalDaysBeforeExpiry: number
}

type ClientFormModalProps = {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving?: boolean
  editMode?: boolean
  form: ClientFormValues
  setForm: React.Dispatch<React.SetStateAction<ClientFormValues>>
}

export default function ClientFormModal({
  open,
  onClose,
  onSave,
  saving = false,
  editMode = false,
  form,
  setForm,
}: ClientFormModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
          <h2 className="text-base font-semibold">{editMode ? 'Edit Client' : 'Add New Client'}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name *</label>
              <input type="text" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="text" className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Company (KH)</label>
            <input type="text" className="input" value={form.companyKhmer} onChange={e => setForm(f => ({ ...f, companyKhmer: e.target.value }))} />
          </div>
          <div>
            <label className="label">Company (EN)</label>
            <input type="text" className="input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="input" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">VAT TIN</label>
              <input type="text" className="input" value={form.vatTin} onChange={e => setForm(f => ({ ...f, vatTin: e.target.value }))} />
            </div>
            <div>
              <label className="label">Telegram ID</label>
              <input type="text" className="input" value={form.telegramId} onChange={e => setForm(f => ({ ...f, telegramId: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <label className="label">Generate Invoice & Send Reminder</label>
            <select
              className="input"
              value={form.renewalDaysBeforeExpiry}
              onChange={e => setForm(f => ({ ...f, renewalDaysBeforeExpiry: parseInt(e.target.value) }))}
            >
              {RENEWAL_DAYS_BEFORE_EXPIRY_OPTIONS.map(days => (
                <option key={days} value={days}>{formatRenewalTiming(days)}</option>
              ))}
            </select>
            {editMode && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Applies to auto-generated invoices and renewal reminders for this client&apos;s services.
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : editMode ? 'Save Changes' : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
  )
}
