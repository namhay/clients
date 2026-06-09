type BarChartRowProps = {
  label: string
  value: number
  max: number
  displayValue?: string
  barClassName?: string
}

export default function BarChartRow({
  label,
  value,
  max,
  displayValue,
  barClassName = 'bg-blue-600',
}: BarChartRowProps) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0 truncate text-xs text-gray-500 dark:text-gray-400" title={label}>
        {label}
      </div>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className={`h-4 rounded-full ${barClassName}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-16 shrink-0 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
        {displayValue ?? value}
      </div>
    </div>
  )
}
