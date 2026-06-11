type MonthlyRevenueChartProps = {
  data: { month: string; label: string; revenue: number }[]
  formatValue: (amount: number) => string
}

export default function MonthlyRevenueChart({ data, formatValue }: MonthlyRevenueChartProps) {
  const max = Math.max(...data.map(m => m.revenue), 1)

  return (
    <div className="flex h-52 items-end justify-between gap-1 sm:gap-1.5">
      {data.map(month => {
        const pct = max > 0 ? (month.revenue / max) * 100 : 0
        const barHeight = month.revenue > 0 ? Math.max(pct, 6) : 0
        const shortLabel = new Date(`${month.month}-01`).toLocaleDateString('en-US', { month: 'short' })

        return (
          <div
            key={month.month}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            title={`${month.label}: ${formatValue(month.revenue)}`}
          >
            <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 sm:text-xs">
              {month.revenue > 0 ? formatValue(month.revenue) : '—'}
            </span>
            <div className="flex h-32 w-full items-end justify-center sm:h-36">
              <div
                className="w-full max-w-8 rounded-t bg-green-600 dark:bg-green-500"
                style={{ height: `${barHeight}%` }}
              />
            </div>
            <span className="w-full truncate text-center text-[10px] text-gray-500 dark:text-gray-400 sm:text-xs">
              {shortLabel}
            </span>
          </div>
        )
      })}
    </div>
  )
}
