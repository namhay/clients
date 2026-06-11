import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { subtractDays } from '@/lib/billing'
import { formatDateValue, type DateFormatId } from '@/lib/date-format'
import type { InvoiceCompanyProfile } from '@/lib/invoice-company'
import { formatInvoiceItemDescription } from '@/lib/invoices'

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
  companyTin: { fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.45 },
  titleKh: { fontSize: 20, textAlign: 'center', marginTop: 8 },
  titleEn: { fontSize: 18, fontWeight: 700, textAlign: 'center', marginTop: 2, marginBottom: 14 },
  metaGrid: { marginBottom: 12 },
  metaGridRow: { flexDirection: 'row', marginBottom: 3, alignItems: 'flex-start' },
  metaGridLabel: { fontSize: 9, lineHeight: 1.4 },
  metaGridValue: { fontSize: 9, fontWeight: 700, lineHeight: 1.4 },
  metaGridLabelCell: { paddingRight: 6 },
  metaGridValueCell: { paddingRight: 8 },
  valueBold: { fontSize: 10, fontWeight: 700 },
  table: { border: '0.5pt solid #000' },
  tableHeader: { flexDirection: 'row', borderBottom: '0.5pt solid #000', alignItems: 'stretch' },
  tableRow: { flexDirection: 'row', borderBottom: '0.5pt solid #000', minHeight: 28, alignItems: 'stretch' },
  cell: { padding: 5, borderRight: '0.5pt solid #000', justifyContent: 'center' },
  cellCenter: { alignItems: 'center' },
  th: { fontWeight: 700, fontSize: 8, textAlign: 'center' },
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
  totalMergedAmount: { fontWeight: 700, fontSize: 14, textAlign: 'center' },
  paymentSection: { marginTop: 10, textAlign: 'center' },
  paymentRow: { flexDirection: 'row', marginBottom: 6 },
  paymentColLeft: { width: '50%' },
  paymentColRight: { width: '50%' },
  paymentBankLine: { fontSize: 9, lineHeight: 1.4 },
  paymentNotes: { fontSize: 8, lineHeight: 1.4 },
  qrCenter: { alignItems: 'center', marginBottom: 4 },
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
        {customerValue && <Text style={styles.metaGridValue}>{customerValue}</Text>}
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
    tax: number
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
  const invoiceDate = formatInvoiceDate(invoice.createdAt)
  const dueDate = formatInvoiceDate(invoice.dueDate)

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
          <Text>អាសយដ្ឋាន៖ {company.addressKhmer}</Text>
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
          {paymentQrSrc && (
            <View style={styles.qrCenter}>
              <Image src={paymentQrSrc} style={styles.paymentQr} />
            </View>
          )}
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
