import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { InvoiceCompanyProfile } from '@/lib/invoice-company'
import { formatInvoiceItemDescription } from '@/lib/invoices'

// Column widths — Unit Price & Amount equal; Total row uses same grid
const COL = {
  no: '7%',
  desc: '44%',
  qty: '12%',
  price: '18.5%',
  amount: '18.5%',
} as const

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'InvoiceFont', fontSize: 9, color: '#000' },
  logoWrap: { alignItems: 'center', marginBottom: 8 },
  logo: { width: 200, height: 56, objectFit: 'contain' },
  centered: { textAlign: 'center', lineHeight: 1.45 },
  titleKh: { fontSize: 20, textAlign: 'center', marginTop: 8 },
  titleEn: { fontSize: 18, fontWeight: 700, textAlign: 'center', marginTop: 2, marginBottom: 14 },
  metaRow: { flexDirection: 'row', marginBottom: 12 },
  metaColCustomer: { width: '70%' },
  metaColInvoice: { width: '30%', alignItems: 'flex-end' },
  metaLineRight: { marginBottom: 3, lineHeight: 1.4, textAlign: 'right' },
  metaLine: { marginBottom: 3, lineHeight: 1.4 },
  label: { fontWeight: 700 },
  table: { border: '0.5pt solid #000' },
  tableHeader: { flexDirection: 'row', borderBottom: '0.5pt solid #000' },
  tableRow: { flexDirection: 'row', borderBottom: '0.5pt solid #000', minHeight: 28 },
  th: { padding: 5, fontWeight: 700, fontSize: 8, textAlign: 'center', borderRight: '0.5pt solid #000' },
  td: { padding: 5, fontSize: 9, borderRight: '0.5pt solid #000' },
  colNo: { width: COL.no },
  colDesc: { width: COL.desc },
  colQty: { width: COL.qty, textAlign: 'center' },
  colPrice: { width: COL.price, textAlign: 'center' },
  colAmount: { width: COL.amount, textAlign: 'center' },
  lastCol: { borderRight: 0 },
  totalLabel: { width: COL.price, padding: 6, borderRight: '0.5pt solid #000', fontSize: 8, textAlign: 'left' },
  totalValue: { width: COL.amount, padding: 6, textAlign: 'center', fontWeight: 700, fontSize: 11 },
  paymentSection: { marginTop: 10 },
  paymentRow: { flexDirection: 'row', marginBottom: 6 },
  paymentColLeft: { width: '50%' },
  paymentColRight: { width: '50%' },
  paymentNotes: { fontSize: 8, lineHeight: 1.4 },
  qrCenter: { alignItems: 'center', marginTop: -50, marginBottom: 4 },
  paymentQr: { width: 80, height: 80, marginLeft: -150 },
  footer: { flexDirection: 'row', marginTop: -50, justifyContent: 'space-between' },
  signCol: { width: '42%', textAlign: 'center' },
  signTopArea: { height: 83, alignItems: 'center', justifyContent: 'flex-start' },
  signLine: { borderTop: '0.5pt dotted #000', paddingTop: 6, fontSize: 8 },
  stamp: { width: 140, height: 80, objectFit: 'contain' },
})

function formatInvoiceDate(date: string | Date) {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function BilingualLabel({ km, en, value, alignRight }: { km: string; en: string; value?: string; alignRight?: boolean }) {
  return (
    <Text style={alignRight ? styles.metaLineRight : styles.metaLine}>
      <Text style={styles.label}>{km} / {en}</Text>
      {value !== undefined ? `: ${value}` : ':'}
    </Text>
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
      address?: string | null
      vatTin?: string | null
    }
  }
  company: InvoiceCompanyProfile
  paymentQrSrc?: string
  logoSrc?: string
  stampSrc?: string
}

export default function InvoicePDF({ invoice, company, paymentQrSrc, logoSrc, stampSrc }: Props) {
  const customerName = invoice.client.company || invoice.client.name
  const invoiceDate = formatInvoiceDate(invoice.createdAt)

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
          <Text>លេខអត្តសញ្ញាណកម្ម (TIN): {company.tin}</Text>
          <Text>អាសយដ្ឋាន៖ {company.addressKhmer}</Text>
          <Text>Address: {company.address}</Text>
          <Text>ទូរស័ព្ទលេខ/Telephone: {company.phone}</Text>
          <Text>អ៊ីម៉ែល/Email: {company.email}  វេបសាយ/Website: {company.website}</Text>
        </View>

        <Text style={styles.titleKh}>វិក្កយបត្រ</Text>
        <Text style={styles.titleEn}>INVOICE</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaColCustomer}>
            <BilingualLabel km="អតិថិជន" en="Customer" value={customerName} />
            {invoice.client.address && <BilingualLabel km="អាសយដ្ឋាន" en="Address" value={invoice.client.address} />}
            {invoice.client.phone && <BilingualLabel km="ទូរស័ព្ទលេខ" en="Telephone" value={invoice.client.phone} />}
            {invoice.client.vatTin && <BilingualLabel km="លេខអត្តសញ្ញាណកម្ម (អតប)" en="VAT TIN" value={invoice.client.vatTin} />}
          </View>
          <View style={styles.metaColInvoice}>
            <BilingualLabel km="លេខវិក្កយបត្រ" en="Invoice No." value={invoice.invoiceNo} alignRight />
            <BilingualLabel km="កាលបរិច្ឆេទ" en="Invoice Date" value={invoiceDate} alignRight />
          </View>
        </View>

        {/* Items table + total row (same column grid) */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colNo]}>ល.រ{'\n'}No.</Text>
            <Text style={[styles.th, styles.colDesc]}>បរិយាយមុខទំនិញ{'\n'}Description</Text>
            <Text style={[styles.th, styles.colQty]}>បរិមាណ{'\n'}Quantity</Text>
            <Text style={[styles.th, styles.colPrice]}>តម្លៃឯកតា{'\n'}Unit Price</Text>
            <Text style={[styles.th, styles.colAmount, styles.lastCol]}>តម្លៃសរុប{'\n'}Amount</Text>
          </View>
          {invoice.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, styles.colNo, { textAlign: 'center' }]}>{i + 1}</Text>
              <Text style={[styles.td, styles.colDesc]}>
                {formatInvoiceItemDescription(item.description)}
                {'\n'}
                ({formatInvoiceDate(item.periodStart ?? invoice.createdAt)} - {formatInvoiceDate(item.periodEnd ?? invoice.dueDate)})
              </Text>
              <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.td, styles.colPrice]}>$ {item.unitPrice.toFixed(2)}</Text>
              <Text style={[styles.td, styles.colAmount, styles.lastCol]}>$ {item.total.toFixed(2)}</Text>
            </View>
          ))}
          <View style={[styles.tableRow, { borderBottom: 0, minHeight: 32 }]}>
            <Text style={[styles.td, styles.colNo]}> </Text>
            <Text style={[styles.td, styles.colDesc]}> </Text>
            <Text style={[styles.td, styles.colQty]}> </Text>
            <Text style={styles.totalLabel}>សរុប(បញ្ចូលទាំងអាករ) / TOTAL (VAT Included)</Text>
            <Text style={[styles.totalValue, styles.lastCol]}>$ {invoice.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment below table */}
        <View style={styles.paymentSection}>
          <View style={styles.paymentRow}>
            <View style={styles.paymentColLeft}>
              <Text style={{ fontWeight: 700, marginBottom: 3 }}>{company.bankName}</Text>
              <Text>Account No.: {company.bankAccountNo}</Text>
              <Text>Account Name: {company.bankAccountName}</Text>
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
              <Text>ហត្ថលេខា និងឈ្មោះអ្នកទិញ</Text>
              <Text>Customer&apos;s Signature & Name</Text>
            </View>
          </View>
          <View style={styles.signCol}>
            <View style={styles.signTopArea}>
              {stampSrc && <Image src={stampSrc} style={styles.stamp} />}
            </View>
            <View style={styles.signLine}>
              <Text>ហត្ថលេខា និងឈ្មោះអ្នកលក់</Text>
              <Text>Seller&apos;s Signature & Name</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
