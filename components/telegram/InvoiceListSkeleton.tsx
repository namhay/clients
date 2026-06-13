export function InvoiceListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="tg-card rounded-xl p-4 animate-pulse">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="mt-3 h-7 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  )
}

export function InvoiceDetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="tg-card rounded-xl p-4">
        <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 h-8 w-28 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="tg-card rounded-xl p-4 space-y-3">
        <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  )
}
