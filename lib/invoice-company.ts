import { getAppSettings } from '@/lib/settings'
import { readEnvDefaults } from '@/lib/env-file'

export type InvoiceCompanyProfile = {
  name: string
  nameKhmer: string
  tagline: string
  tin: string
  address: string
  addressKhmer: string
  email: string
  phone: string
  website: string
  bankName: string
  bankAccountNo: string
  bankAccountName: string
}

export async function getInvoiceCompanyProfile(): Promise<InvoiceCompanyProfile> {
  const settings = await getAppSettings()
  const env = readEnvDefaults()
  return {
    name: settings.companyName || 'IT-SMART.BIZ',
    nameKhmer: env.COMPANY_NAME_KHMER || 'អាយធីស្មាត',
    tagline: env.COMPANY_TAGLINE || 'IT Solutions made easy',
    tin: env.COMPANY_TIN || 'E116-1500027368',
    address: settings.companyAddress || 'Bakheng Rd, Salakanseng, Svay Dangkum, Siem Reap Cambodia',
    addressKhmer: env.COMPANY_ADDRESS_KHMER || 'ផ្លូវបាខែង ភូមិសាលាកន្សែង សង្កាត់ស្វាយដង្គំ ក្រុងសៀមរាប',
    email: settings.companyEmail || 'info@it-smart.biz',
    phone: settings.companyPhone || '098 720 760 / 099 720 760',
    website: env.COMPANY_WEBSITE || 'www.it-smart.biz',
    bankName: env.BANK_NAME || 'ABA Bank',
    bankAccountNo: env.BANK_ACCOUNT_NO || '000087959',
    bankAccountName: env.BANK_ACCOUNT_NAME || 'IT SMART BIZ',
  }
}
