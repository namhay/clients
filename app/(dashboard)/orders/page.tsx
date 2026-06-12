'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Pagination from '@/components/Pagination'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { toast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'

const OrderFormModal = dynamic(() => import('@/components/orders/OrderFormModal'), { ssr: false })

export default function OrdersPage() {
  const { formatDate } = useAppSettings()
  const [orders, setOrders] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders?page=${page}`)
      if (!res.ok) {
        setOrders([])
        return
      }
      const data = await res.json()
      setOrders(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page])

  const viewPDF = (invoiceId: string) => {
    window.open(`/api/invoices/${invoiceId}/pdf?inline=1`, '_blank', 'noopener,noreferrer')
  }

  const del = async (order: { id: string; invoice?: { invoiceNo: string; status: string } | null }) => {
    const invoiceNote = order.invoice
      ? ` and invoice ${order.invoice.invoiceNo}`
      : ''
    if (!await toast.confirm(
      `Delete this order${invoiceNote}? Services created from this order will also be removed.`,
    )) return

    const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Failed to delete order')
      return
    }
    toast.success('Order deleted')
    load()
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Combine multiple products (e.g. Domain + Hosting) into one invoice
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Order
        </button>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Date</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Client</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Total</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  No orders yet. Create an order to add multiple products on one invoice.
                </td>
              </tr>
            )}
            {orders.map(order => (
              <tr key={order.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 align-top">
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                <td className="px-4 py-3">
                  <Link href={`/clients/${order.clientId}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-400">
                    {order.client?.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {formatCurrency(order.totalAmount || 0)}
                </td>
                <td className="px-4 py-3">
                  {order.invoice ? (
                    <span className="font-semibold text-blue-700 dark:text-blue-300">{order.invoice.invoiceNo}</span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {order.invoice && (
                      <button
                        className="btn-secondary py-1 px-2 text-xs"
                        onClick={() => viewPDF(order.invoice.id)}
                      >
                        PDF
                      </button>
                    )}
                    <button
                      className="btn-danger py-1 px-2 text-xs"
                      onClick={() => del(order)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={25}
          onPageChange={setPage}
          loading={loading}
        />
      </div>

      <OrderFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={load}
      />
    </div>
  )
}
