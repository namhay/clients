const colorMap: Record<string, string> = {
  blue: 'badge-domain',
  green: 'badge-hosting',
  orange: 'badge-ssl',
  pink: 'badge-design',
  purple: 'badge-purple',
  gray: 'badge-gray',
  yellow: 'badge-yellow',
  red: 'badge-expired',
  indigo: 'badge-indigo',
}

export function productTypeBadgeClass(color?: string | null): string {
  return colorMap[color || 'blue'] || 'badge-domain'
}
