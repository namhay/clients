import { redirect } from 'next/navigation'
import { getProductTypeBySlug } from '@/lib/db/product-types'

export default async function HostingPackagesRedirect() {
  const hosting = await getProductTypeBySlug('HOSTING')
  redirect(hosting ? `/product-packages?productTypeId=${hosting.id}` : '/product-packages')
}
