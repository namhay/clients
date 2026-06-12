'use client'
import { useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { getListCache, prefetchList, setListCache } from '@/lib/list-cache'
import type { PaginatedResult } from '@/lib/pagination'

type UsePaginatedListOptions = {
  endpoint: string
  searchParam?: string
  extraParams?: Record<string, string>
}

function buildCacheKey(endpoint: string, params: URLSearchParams) {
  return `${endpoint}?${params.toString()}`
}

function buildParams(
  page: number,
  search: string,
  searchParam: string,
  extraParams: Record<string, string>,
) {
  const params = new URLSearchParams({ page: String(page) })
  const trimmed = search.trim()
  if (trimmed) params.set(searchParam, trimmed)
  for (const [key, value] of Object.entries(extraParams)) {
    if (value) params.set(key, value)
  }
  return params
}

export function usePaginatedList<T>({
  endpoint,
  searchParam = 'search',
  extraParams = {},
}: UsePaginatedListOptions) {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)
  const filtersRef = useRef({ search: debouncedSearch, extraKey: '' })

  const extraKey = JSON.stringify(extraParams)

  useEffect(() => {
    const ac = new AbortController()
    const filtersChanged =
      filtersRef.current.search !== debouncedSearch
      || filtersRef.current.extraKey !== extraKey

    const pageToLoad = filtersChanged ? 1 : page
    filtersRef.current = { search: debouncedSearch, extraKey }

    if (filtersChanged && page !== 1) {
      setPage(1)
    }

    const params = buildParams(pageToLoad, debouncedSearch, searchParam, extraParams)
    const cacheKey = buildCacheKey(endpoint, params)
    const cached = getListCache<T>(cacheKey)
    if (cached) {
      setItems(cached.items)
      setTotal(cached.total ?? 0)
      setTotalPages(cached.totalPages ?? 1)
      setLoading(false)
    } else {
      setLoading(true)
    }

    fetch(cacheKey, { signal: ac.signal })
      .then(async res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json() as Promise<PaginatedResult<T>>
      })
      .then(data => {
        const nextItems = data.items || []
        const nextTotal = data.total || 0
        const nextTotalPages = data.totalPages || 1
        setItems(nextItems)
        setTotal(nextTotal)
        setTotalPages(nextTotalPages)
        setListCache(cacheKey, {
          items: nextItems,
          total: nextTotal,
          totalPages: nextTotalPages,
        })

        if (pageToLoad < nextTotalPages) {
          const nextParams = buildParams(pageToLoad + 1, debouncedSearch, searchParam, extraParams)
          void prefetchList(buildCacheKey(endpoint, nextParams))
        }
      })
      .catch(err => {
        if (err?.name !== 'AbortError' && !cached) {
          setItems([])
          setTotal(0)
          setTotalPages(1)
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })

    return () => ac.abort()
  }, [page, debouncedSearch, extraKey, reloadToken, endpoint, searchParam])

  const reload = () => setReloadToken(token => token + 1)

  const initialLoading = loading && items.length === 0
  const refreshing = loading && items.length > 0

  return {
    searchInput,
    setSearchInput,
    debouncedSearch,
    page,
    setPage,
    items,
    total,
    totalPages,
    loading,
    initialLoading,
    refreshing,
    reload,
  }
}
