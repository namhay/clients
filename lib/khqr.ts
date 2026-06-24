import { KHQRGenerator } from 'konthaina-khqr'
import QRCode from 'qrcode'
import sharp from 'sharp'

const QR_IMAGE_SIZE = 220

export type KhqrCurrency = 'USD' | 'KHR'
export type KhqrMerchantType = 'individual' | 'merchant'

export type KhqrConfig = {
  bakongAccountId: string
  merchantId?: string
  accountInformation?: string
  merchantType: KhqrMerchantType
  currency: KhqrCurrency
  merchantCity: string
  acquiringBank: string
}

export type KhqrPaymentParams = {
  amount: number
  merchantName: string
  acquiringBank: string
  billNumber?: string
  config: KhqrConfig
}

function readKhqrEnv() {
  return {
    enabled: process.env.KHQR_ENABLED !== 'false',
    bakongAccountId: (process.env.KHQR_BAKONG_ACCOUNT_ID || '').trim(),
    merchantId: (process.env.KHQR_MERCHANT_ID || '').trim(),
    accountInformation: (process.env.KHQR_ACCOUNT_INFORMATION || '').trim(),
    merchantType: (process.env.KHQR_MERCHANT_TYPE || '').trim().toLowerCase(),
    currency: (process.env.KHQR_CURRENCY || 'USD').trim().toUpperCase(),
    merchantCity: (process.env.KHQR_MERCHANT_CITY || 'Siem Reap').trim(),
    acquiringBank: (process.env.KHQR_ACQUIRING_BANK || 'ABA Bank').trim(),
  }
}

export function getKhqrConfig(): KhqrConfig | null {
  const env = readKhqrEnv()
  if (!env.enabled || !env.bakongAccountId) return null

  const merchantType: KhqrMerchantType =
    env.merchantType === 'merchant' ? 'merchant' : 'individual'

  if (merchantType === 'merchant' && !env.merchantId) {
    console.warn('KHQR merchant type requires KHQR_MERCHANT_ID; falling back to individual QR')
  }

  return {
    bakongAccountId: env.bakongAccountId,
    merchantId: env.merchantId || undefined,
    accountInformation: env.accountInformation || undefined,
    merchantType: merchantType === 'merchant' && env.merchantId ? 'merchant' : 'individual',
    currency: env.currency === 'KHR' ? 'KHR' : 'USD',
    merchantCity: env.merchantCity || 'Siem Reap',
    acquiringBank: env.acquiringBank || 'ABA Bank',
  }
}

function formatKhqrAmount(amount: number, currency: KhqrCurrency): string {
  if (currency === 'KHR') return String(Math.max(0, Math.round(amount)))
  return Math.max(0, amount).toFixed(2)
}

export function generateKhqrPayload({
  amount,
  merchantName,
  acquiringBank,
  billNumber,
  config,
}: KhqrPaymentParams): string {
  const formattedAmount = formatKhqrAmount(amount, config.currency)
  const trimmedName = merchantName.trim().slice(0, 25)
  const trimmedCity = config.merchantCity.trim().slice(0, 15)
  const trimmedBank = (config.acquiringBank || acquiringBank).trim().slice(0, 25)

  const generator =
    config.merchantType === 'merchant' && config.merchantId
      ? new KHQRGenerator('merchant')
          .setBakongAccountId(config.bakongAccountId)
          .setMerchantId(config.merchantId)
          .setAcquiringBank(trimmedBank)
      : new KHQRGenerator('individual')
          .setBakongAccountId(config.bakongAccountId)
          .setAcquiringBank(trimmedBank)

  generator
    .setStatic(false)
    .setMerchantName(trimmedName)
    .setMerchantCity(trimmedCity)
    .setCurrency(config.currency)
    .setAmount(formattedAmount)

  if (billNumber?.trim()) {
    generator.setBillNumber(billNumber.trim().slice(0, 25))
  }
  if (config.merchantType === 'individual' && config.accountInformation) {
    generator.setAccountInformation(config.accountInformation.trim().slice(0, 32))
  }

  const { qr } = generator.generate()
  if (!KHQRGenerator.verify(qr)) {
    throw new Error('Generated KHQR payload failed CRC verification')
  }
  return qr
}

async function overlayPaymentQrBadge(qrPng: Buffer, size: number): Promise<Buffer> {
  const center = size / 2
  const badgeRadius = Math.round(size * 0.105)
  const ringRadius = badgeRadius + Math.round(size * 0.02)
  const fontSize = Math.round(badgeRadius * 1.15)

  const badgeSvg = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${center}" cy="${center}" r="${ringRadius}" fill="#ffffff"/>
  <circle cx="${center}" cy="${center}" r="${badgeRadius}" fill="#000000"/>
  <text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central"
    fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fontSize}px">$</text>
</svg>`)

  return sharp(qrPng)
    .composite([{ input: badgeSvg, top: 0, left: 0 }])
    .png()
    .toBuffer()
}

export async function generateKhqrQrDataUrl(params: KhqrPaymentParams): Promise<string> {
  const payload = generateKhqrPayload(params)
  const qrPng = await QRCode.toBuffer(payload, {
    type: 'png',
    width: QR_IMAGE_SIZE,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  })
  const withBadge = await overlayPaymentQrBadge(qrPng, QR_IMAGE_SIZE)
  return `data:image/png;base64,${withBadge.toString('base64')}`
}
