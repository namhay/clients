'use client'
import { useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import type { PaginatedResult } from '@/lib/pagination'

type UsePaginatedListOptions = {
  endpoint: string
  searchParam?: string
  extraParams?: Record<string, string>
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

    setLoading(true)
    const params = new URLSearchParams({ page: String(pageToLoad) })
    const trimmed = debouncedSearch.trim()
    if (trimmed) params.set(searchParam, trimmed)
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) params.set(key, value)
    }

    fetch(`${endpoint}?${params}`, { signal: ac.signal })
      .then(async res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json() as Promise<PaginatedResult<T>>
      })
      .then(data => {
        setItems(data.items || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
      })
      .catch(err => {
        if (err?.name !== 'AbortError') {
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
    reload,
  }
}
