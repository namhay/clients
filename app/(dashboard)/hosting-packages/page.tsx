'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HostingPackagesRedirect() {
  const router = useRouter()
  useEffect(() => {
    fetch('/api/product-types?active=true')
      .then(r => r.json())
      .then(types => {
        const hosting = types.find((t: any) => t.slug === 'HOSTING')
        router.replace(hosting ? `/product-packages?productTypeId=${hosting.id}` : '/product-packages')
      })
      .catch(() => router.replace('/product-packages'))
  }, [router])
  return <div className="p-6 text-gray-500 dark:text-gray-400">Redirecting to Product Packages...</div>
}
