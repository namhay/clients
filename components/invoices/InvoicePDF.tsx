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
  totalLabel: { fontSize: 8, textAlign: 'left' },
  totalValue: { textAlign: 'center', fontWeight: 700, fontSize: 11 },
  paymentSection: { marginTop: 10, textAlign: 'center' },
  paymentRow: { flexDirection: 'row', marginBottom: 6 },
  paymentColLeft: { width: '50%' },
  paymentColRight: { width: '50%' },
  paymentBankLine: { fontSize: 9, lineHeight: 1.4 },
  paymentNotes: { fontSize: 8, lineHeight: 1.4 },
  qrCenter: { alignItems: 'center', marginBottom: 4 },
  paymentQr: { width: 70, height: 70 },
  footer: { flexDirection: 'row', marginTop: -50, justifyContent: 'space-between' },
  signCol: { width: '42%', textAlign: 'center' },
  signTopArea: { height: 50, alignItems: 'center', justifyContent: 'flex-start' },
  signLine: { borderTop: '0.5pt dotted #000', paddingTop: 6, fontSize: 8 },
  stamp: { width: 378, height: 230, marginTop: -20, marginBottom: 10, objectFit: 'contain' },
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
                  {'\n'}
                  ({formatInvoiceDate(item.periodStart ?? invoice.createdAt)} - {formatInvoiceDate(item.periodEnd ?? invoice.dueDate)})
                </Text>
              </View>
              <View style={[styles.cell, styles.colQty, styles.cellCenter]}>
                <Text style={[styles.td, styles.colTextCenter]}>{item.quantity}</Text>
              </View>
              <View style={[styles.cell, styles.colPrice, styles.cellCenter]}>
                <Text style={[styles.td, styles.colTextCenter]}>$ {item.unitPrice.toFixed(2)}</Text>
              </View>
              <View style={[styles.cell, styles.colAmount, styles.lastCol, styles.cellCenter]}>
                <Text style={[styles.td, styles.colTextCenter]}>$ {item.total.toFixed(2)}</Text>
              </View>
            </View>
          ))}
          <View style={[styles.tableRow, { borderBottom: 0, minHeight: 32 }]}>
            <View style={[styles.cell, styles.colNo]}><Text> </Text></View>
            <View style={[styles.cell, styles.colDesc]}><Text> </Text></View>
            <View style={[styles.cell, styles.colQty]}><Text> </Text></View>
            <View style={[styles.cell, styles.colPrice]}>
              <Text style={styles.totalLabel}>សរុប(បញ្ចូលទាំងអាករ) / TOTAL (VAT Included)</Text>
            </View>
            <View style={[styles.cell, styles.colAmount, styles.lastCol, styles.cellCenter]}>
              <Text style={styles.totalValue}>$ {invoice.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Payment below table */}
        <View style={styles.paymentSection}>
          <View style={styles.paymentRow}>
            <View style={invoice.notes ? styles.paymentColLeft : { width: '100%' }}>
              <Text style={styles.paymentBankLine}>
                Bank: <Text style={styles.label}>{company.bankName}</Text>
                {' | Account No.: '}<Text style={styles.label}>{company.bankAccountNo}</Text>
                {' | Account Name: '}<Text style={styles.label}>{company.bankAccountName}</Text>
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
