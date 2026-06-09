import Link from 'next/link'

type StatCardProps = {
  label: string
  value: string | number
  sub?: string
  href?: string
  valueClassName?: string
}

export default function StatCard({ label, value, sub, href, valueClassName }: StatCardProps) {
  const content = (
    <div className="card p-4 transition-colors hover:border-blue-200 dark:hover:border-blue-800">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueClassName ?? 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
    </div>
  )

  if (href) {
    return <Link href={href} className="block min-w-0">{content}</Link>
  }
  return content
}
