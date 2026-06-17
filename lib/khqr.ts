import { KHQRGenerator } from 'konthaina-khqr'
import QRCode from 'qrcode'

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

export async function generateKhqrQrDataUrl(params: KhqrPaymentParams): Promise<string> {
  const payload = generateKhqrPayload(params)
  return QRCode.toDataURL(payload, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}
