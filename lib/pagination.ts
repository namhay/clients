export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function parsePageParams(
  searchParams: URLSearchParams,
  defaultPageSize = DEFAULT_PAGE_SIZE,
): { page: number; pageSize: number; offset: number } {
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const rawSize = Number.parseInt(searchParams.get('pageSize') || String(defaultPageSize), 10) || defaultPageSize
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize))
  const offset = (page - 1) * pageSize
  return { page, pageSize, offset }
}

export function toPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export function isPaginatedRequest(searchParams: URLSearchParams): boolean {
  return searchParams.has('page')
}
