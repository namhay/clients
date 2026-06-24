import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { subtractDays } from '@/lib/billing'
import { formatDateValue, formatDateTimeValue, type DateFormatId } from '@/lib/date-format'
import type { InvoiceCompanyProfile } from '@/lib/invoice-company'
import { formatInvoiceItemDescription } from '@/lib/invoices'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/payment-methods'
import { pdfKhmerText } from '@/lib/pdf-khmer-text'

// Column widths — Unit Price & Amount equal; Total row uses same grid
const COL = {
  no: '7%',
  desc: '55%',
  qty: '10%',
  price: '14%',
  amount: '14%',
} as const

/** Meta header: customer label | customer value | invoice label | invoice value */
const META_COL = {
  customerLabel: '19%',
  customerValue: '49%',
  invoiceLabel: '21%',
  invoiceValue: '11%',
} as const

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'InvoiceFont', fontSize: 9, color: '#000' },
  logoWrap: { alignItems: 'center', marginBottom: 8 },
  logo: { width: 200, height: 56, objectFit: 'contain' },
  centered: { textAlign: 'center', lineHeight: 1.45 },
  companyTin: { fontSize: 11, textAlign: 'center', lineHeight: 1.45 },
  titleKh: { fontSize: 20, textAlign: 'center', marginTop: 8 },
  titleEn: { fontSize: 18, textAlign: 'center', marginTop: 2, marginBottom: 14 },
  metaGrid: { marginBottom: 12 },
  metaGridRow: { flexDirection: 'row', marginBottom: 3, alignItems: 'flex-start' },
  metaGridLabel: { fontSize: 9, lineHeight: 1.4 },
  metaGridValue: { fontSize: 9, lineHeight: 1.4, paddingRight: 2 },
  metaGridLabelCell: { paddingRight: 6 },
  metaGridValueCell: { paddingRight: 8 },
  valueBold: { fontSize: 10 },
  table: { border: '0.5pt solid #000' },
  tableHeader: { flexDirection: 'row', borderBottom: '0.5pt solid #000', alignItems: 'stretch' },
  tableRow: { flexDirection: 'row', borderBottom: '0.5pt solid #000', minHeight: 28, alignItems: 'stretch' },
  cell: { padding: 4, borderRight: '0.5pt solid #000', justifyContent: 'center' },
  cellCenter: { alignItems: 'center' },
  th: { fontSize: 10, textAlign: 'center' },
  td: { fontSize: 9 },
  colNo: { width: COL.no },
  colDesc: { width: COL.desc },
  colQty: { width: COL.qty },
  colPrice: { width: COL.price },
  colAmount: { width: COL.amount },
  colTextCenter: { textAlign: 'center' },
  lastCol: { borderRight: 0 },
  colTotalLeftMerged: { width: '86%' },
  totalLabelCell: {
    padding: 6,
    borderRight: '0.5pt solid #000',
    borderBottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  totalAmountCell: {
    padding: 6,
    borderLeft: 0,
    borderBottom: 0,
    borderRight: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalMergedLabel: { fontSize: 10, textAlign: 'right' },
  totalMergedAmount: { fontSize: 14, textAlign: 'center' },
  paymentTable: { marginTop: 8, border: '0.5pt solid #000' },
  paymentTableHeader: { flexDirection: 'row', borderBottom: '0.5pt solid #000', alignItems: 'stretch' },
  paymentTableRow: { flexDirection: 'row', borderBottom: '0.5pt solid #000', minHeight: 22, alignItems: 'stretch' },
  paymentCell: { padding: 3, borderRight: '0.5pt solid #000', justifyContent: 'center' },
  paymentColDate: { width: '34%' },
  paymentColMethod: { width: '22%' },
  paymentColAmount: { width: '22%' },
  paymentColBalance: { width: '22%' },
  paymentTh: { fontSize: 10, textAlign: 'center' },
  paymentTd: { fontSize: 9, textAlign: 'center' },
  paymentBalance: { fontSize: 12, fontWeight: 700, textAlign: 'center' },
  paymentSection: { marginTop: 10, textAlign: 'center' },
  paymentRow: { flexDirection: 'row', marginBottom: 6 },
  paymentColLeft: { width: '50%' },
  paymentColRight: { width: '50%' },
  paymentBankLine: { fontSize: 9, lineHeight: 1.4 },
  paymentNotes: { fontSize: 8, lineHeight: 1.4 },
  qrCenter: { alignItems: 'center', justifyContent: 'center', marginBottom: 4, minHeight: 74 },
  paymentQr: { width: 70, height: 70 },
  footer: { flexDirection: 'row', marginTop: -75, justifyContent: 'space-between', alignItems: 'flex-end' },
  signCol: { width: '33%', textAlign: 'center' },
  signTopArea: { minHeight: 5, alignItems: 'center', justifyContent: 'flex-end' },
  signLine: { borderTop: '0.5pt dotted #000', paddingTop: 6 },
  signCaption: { fontSize: 10, lineHeight: 1.45, textAlign: 'center' },
  stamp: { width: 180, marginBottom: 5,height: 90, objectFit: 'contain' },
})

type MetaLabel = { km?: string; en?: string }

function formatMetaLabel(label: MetaLabel) {
  if (label.km && label.en) return `${label.km} / ${label.en}:`
  if (label.km) return `${label.km}:`
  if (label.en) return `${label.en}:`
  return ''
}

function MetaGridRow({
  customerLabel,
  customerValue,
  invoiceLabel,
  invoiceValue,
}: {
  customerLabel?: MetaLabel
  customerValue?: string
  invoiceLabel?: MetaLabel
  invoiceValue?: string
}) {
  if (!customerValue && !invoiceValue) return null
  const customerLabelText = customerLabel ? formatMetaLabel(customerLabel) : ''
  const invoiceLabelText = invoiceLabel ? formatMetaLabel(invoiceLabel) : ''
  return (
    <View style={styles.metaGridRow}>
      <View style={[styles.metaGridLabelCell, { width: META_COL.customerLabel }]}>
        {customerLabelText ? (
          <Text style={styles.metaGridLabel}>{customerLabelText}</Text>
        ) : null}
      </View>
      <View style={[styles.metaGridValueCell, { width: META_COL.customerValue }]}>
        {customerValue && <Text style={styles.metaGridValue}>{pdfKhmerText(customerValue)}</Text>}
      </View>
      <View style={[styles.metaGridLabelCell, { width: META_COL.invoiceLabel }]}>
        {invoiceLabelText ? (
          <Text style={styles.metaGridLabel}>{invoiceLabelText}</Text>
        ) : null}
      </View>
      <View style={{ width: META_COL.invoiceValue }}>
        {invoiceValue && <Text style={styles.metaGridValue}>{invoiceValue}</Text>}
      </View>
    </View>
  )
}

function TinMetaGridRow({ vatTin }: { vatTin?: string | null }) {
  if (!vatTin) return null
  const rightWidth = `${100 - parseFloat(META_COL.customerLabel)}%`
  return (
    <View style={styles.metaGridRow}>
      <View style={[styles.metaGridLabelCell, { width: META_COL.customerLabel }]}>
        <Text style={styles.metaGridLabel}>លេខអត្តសញ្ញាណកម្ម:</Text>
      </View>
      <View style={{ width: rightWidth }}>
        <Text style={styles.metaGridLabel}>
          (VAT TIN) <Text style={styles.metaGridValue}>{vatTin}</Text>
        </Text>
      </View>
    </View>
  )
}

interface Props {
  invoice: {
    invoiceNo: string
    status: string
    dueDate: string
    createdAt: string
    total: number
    subtotal: number
    notes?: string | null
    items: {
      description: string
      quantity: number
      unitPrice: number
      total: number
      periodStart?: string | null
      periodEnd?: string | null
    }[]
    client: {
      name: string
      email: string
      phone?: string | null
      company?: string | null
      companyKhmer?: string | null
      address?: string | null
      vatTin?: string | null
    }
    payments?: {
      paidAt: string
      paymentMethod: PaymentMethod
      amount: number
    }[]
  }
  company: InvoiceCompanyProfile
  dateFormat?: DateFormatId
  timezone?: string
  paymentQrSrc?: string
  logoSrc?: string
  stampSrc?: string
}

export default function InvoicePDF({ invoice, company, dateFormat, timezone, paymentQrSrc, logoSrc, stampSrc }: Props) {
  const companyKh = invoice.client.companyKhmer?.trim()
  const companyEn = invoice.client.company?.trim()
  const hasCompanyKh = Boolean(companyKh)
  const hasCompanyEn = Boolean(companyEn)
  const showCustomerFallback = !hasCompanyKh && !hasCompanyEn
  const formatInvoiceDate = (date: string | Date) => formatDateValue(date, dateFormat, timezone)
  const formatInvoiceDateTime = (date: string | Date) => formatDateTimeValue(date, dateFormat, timezone)
  const invoiceDate = formatInvoiceDate(invoice.createdAt)
  const dueDate = formatInvoiceDate(invoice.dueDate)
  const payments = invoice.payments ?? []

  let paidRunning = 0
  const paymentRows = payments.map(payment => {
    paidRunning += payment.amount
    return {
      ...payment,
      balance: Math.max(0, invoice.total - paidRunning),
    }
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logo */}
        {logoSrc && (
          <View style={styles.logoWrap}>
            <Image src={logoSrc} style={styles.logo} />
          </View>
        )}

        <View style={styles.centered}>
          <Text style={styles.companyTin}>លេខអត្តសញ្ញាណកម្ម (VAT TIN) {company.tin}</Text>
          <Text>អាសយដ្ឋាន៖ {pdfKhmerText(company.addressKhmer)}</Text>
          <Text>Address: {company.address}</Text>
          <Text>ទូរស័ព្ទលេខ/Telephone: {company.phone}</Text>
          <Text>អ៊ីម៉ែល/Email: {company.email}  វេបសាយ/Website: {company.website}</Text>
        </View>

        <Text style={styles.titleKh}>វិក្កយបត្រ</Text>
        <Text style={styles.titleEn}>INVOICE</Text>

        <View style={styles.metaGrid}>
          {hasCompanyKh && (
            <MetaGridRow
              customerLabel={{ km: 'អតិថិជន / ក្រុមហ៊ុន' }}
              customerValue={companyKh}
              invoiceLabel={{ km: 'លេខវិក្កយបត្រ', en: 'Invoice No.' }}
              invoiceValue={invoice.invoiceNo}
            />
          )}
          {hasCompanyEn && (
            <MetaGridRow
              customerLabel={{ en: 'Customer / Company' }}
              customerValue={companyEn}
              invoiceLabel={!hasCompanyKh ? { km: 'លេខវិក្កយបត្រ', en: 'Invoice No.' } : undefined}
              invoiceValue={!hasCompanyKh ? invoice.invoiceNo : undefined}
            />
          )}
          {showCustomerFallback && (
            <MetaGridRow
              customerLabel={{ km: 'អតិថិជន', en: 'Customer' }}
              customerValue={invoice.client.name}
              invoiceLabel={{ km: 'លេខវិក្កយបត្រ', en: 'Invoice No.' }}
              invoiceValue={invoice.invoiceNo}
            />
          )}
          <MetaGridRow
             customerLabel={{ km: 'លេខទូរស័ព្ទ', en: 'Telephone' }}
             customerValue={invoice.client.phone ?? undefined}
            invoiceLabel={{ km: 'កាលបរិច្ឆេទ', en: 'Invoice Date' }}
            invoiceValue={invoiceDate}
          />
          <MetaGridRow
            customerLabel={{ km: 'អាសយដ្ឋាន', en: 'Address' }}
            customerValue={invoice.client.address ?? undefined}
            invoiceLabel={{ km: 'ថ្ងៃផុតកំណត់', en: 'Due Date' }}
            invoiceValue={dueDate}
          />
          <TinMetaGridRow vatTin={invoice.client.vatTin} />
        </View>

        {/* Items table + total row (same column grid) */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={[styles.cell, styles.colNo, styles.cellCenter]}>
              <Text style={styles.th}>ល.រ{'\n'}No.</Text>
            </View>
            <View style={[styles.cell, styles.colDesc, styles.cellCenter]}>
              <Text style={styles.th}>បរិយាយមុខទំនិញ{'\n'}Description</Text>
            </View>
            <View style={[styles.cell, styles.colQty, styles.cellCenter]}>
              <Text style={styles.th}>បរិមាណ{'\n'}Quantity</Text>
            </View>
            <View style={[styles.cell, styles.colPrice, styles.cellCenter]}>
              <Text style={styles.th}>តម្លៃឯកតា{'\n'}Unit Price</Text>
            </View>
            <View style={[styles.cell, styles.colAmount, styles.lastCol, styles.cellCenter]}>
              <Text style={styles.th}>តម្លៃសរុប{'\n'}Amount</Text>
            </View>
          </View>
          {invoice.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={[styles.cell, styles.colNo, styles.cellCenter]}>
                <Text style={[styles.td, styles.colTextCenter]}>{i + 1}</Text>
              </View>
              <View style={[styles.cell, styles.colDesc]}>
                <Text style={styles.td}>
                  {formatInvoiceItemDescription(item.description)}
                  {item.periodStart && item.periodEnd && (
                    <>
                      {'\n'}
                      ({formatInvoiceDate(item.periodStart)} - {formatInvoiceDate(subtractDays(item.periodEnd, 1))})
                    </>
                  )}
                </Text>
              </View>
              <View style={[styles.cell, styles.colQty, styles.cellCenter]}>
                <Text style={[styles.td, styles.colTextCenter]}>{item.quantity}</Text>
              </View>
              <View style={[styles.cell, styles.colPrice, styles.cellCenter]}>
                <Text style={[styles.td, styles.colTextCenter]}>${item.unitPrice.toFixed(2)}</Text>
              </View>
              <View style={[styles.cell, styles.colAmount, styles.lastCol, styles.cellCenter]}>
                <Text style={[styles.td, styles.colTextCenter]}>${item.total.toFixed(2)}</Text>
              </View>
            </View>
          ))}
          <View style={[styles.tableRow, { borderBottom: 0, minHeight: 32 }]}>
            <View style={[styles.totalLabelCell, styles.colTotalLeftMerged]}>
              <Text style={styles.totalMergedLabel}>សរុប(បញ្ចូលទាំងអាករ) / TOTAL (VAT Included)</Text>
            </View>
            <View style={[styles.totalAmountCell, styles.colAmount]}>
              <Text style={styles.totalMergedAmount}>${invoice.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {paymentRows.length > 0 && (
          <View style={styles.paymentTable}>
            <View style={styles.paymentTableHeader}>
              <View style={[styles.paymentCell, styles.paymentColDate, styles.cellCenter]}>
                <Text style={styles.paymentTh}>Payment Date</Text>
              </View>
              <View style={[styles.paymentCell, styles.paymentColMethod, styles.cellCenter]}>
                <Text style={styles.paymentTh}>Payment Method</Text>
              </View>
              <View style={[styles.paymentCell, styles.paymentColAmount, styles.cellCenter]}>
                <Text style={styles.paymentTh}>Amount</Text>
              </View>
              <View style={[styles.paymentCell, styles.paymentColBalance, styles.lastCol, styles.cellCenter]}>
                <Text style={styles.paymentTh}>Balance</Text>
              </View>
            </View>
            {paymentRows.map((payment, i) => (
              <View
                key={`${payment.paidAt}-${i}`}
                style={[
                  styles.paymentTableRow,
                  ...(i === paymentRows.length - 1 ? [{ borderBottom: 0 }] : []),
                ]}
              >
                <View style={[styles.paymentCell, styles.paymentColDate, styles.cellCenter]}>
                  <Text style={styles.paymentTd}>{formatInvoiceDateTime(payment.paidAt)}</Text>
                </View>
                <View style={[styles.paymentCell, styles.paymentColMethod, styles.cellCenter]}>
                  <Text style={styles.paymentTd}>
                    {PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}
                  </Text>
                </View>
                <View style={[styles.paymentCell, styles.paymentColAmount, styles.cellCenter]}>
                  <Text style={styles.paymentTd}>${payment.amount.toFixed(2)}</Text>
                </View>
                <View style={[styles.paymentCell, styles.paymentColBalance, styles.lastCol, styles.cellCenter]}>
                  <Text style={styles.paymentBalance}>${payment.balance.toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Payment below table */}
        <View style={styles.paymentSection}>
          <View style={styles.paymentRow}>
            <View style={invoice.notes ? styles.paymentColLeft : { width: '100%' }}>
              <Text style={styles.paymentBankLine}>
                Bank: <Text style={styles.valueBold}>{company.bankName}</Text>
                {' | Account No.: '}<Text style={styles.valueBold}>{company.bankAccountNo}</Text>
                {' | Account Name: '}<Text style={styles.valueBold}>{company.bankAccountName}</Text>
              </Text>
            </View>
            {invoice.notes && (
              <View style={styles.paymentColRight}>
                <Text style={styles.paymentNotes}>
                  <Text style={{ fontWeight: 700 }}>Notes: </Text>
                  {invoice.notes}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.qrCenter}>
            {paymentQrSrc ? <Image src={paymentQrSrc} style={styles.paymentQr} /> : null}
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.signCol}>
            <View style={styles.signTopArea} />
            <View style={styles.signLine}>
              <Text style={styles.signCaption}>ហត្ថលេខា និងឈ្មោះអ្នកទិញ </Text>
              <Text style={styles.signCaption}>Customer&apos;s Signature & Name</Text>
            </View>
          </View>
          <View style={styles.signCol}>
            <View style={styles.signTopArea}>
              {stampSrc && <Image src={stampSrc} style={styles.stamp} />}
            </View>
            <View style={styles.signLine}>
              <Text style={styles.signCaption}>ហត្ថលេខា និងឈ្មោះអ្នកលក់ </Text>
              <Text style={styles.signCaption}>Seller&apos;s Signature & Name</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
