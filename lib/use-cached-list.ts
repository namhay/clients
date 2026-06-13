'use client'
import { useCallback, useEffect, useState } from 'react'
import { getListCache, listItemsFromPayload, storeListPayload } from '@/lib/list-cache'

/** Fetch a list once; show cached rows instantly on revisit while refreshing in background. */
export function useCachedList<T>(endpoint: string, deps: unknown[] = []) {
  const [items, setItems] = useState<T[]>(() => getListCache<T>(endpoint)?.items ?? [])
  const [loading, setLoading] = useState(() => !getListCache<T>(endpoint))
  const [refreshing, setRefreshing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    const cached = getListCache<T>(endpoint)
    if (cached) {
      setItems(cached.items)
      setLoading(false)
      setRefreshing(true)
    } else {
      setLoading(true)
      setRefreshing(false)
    }

    try {
      const res = await fetch(endpoint, { signal })
      if (!res.ok) {
        if (!cached) setItems([])
        return
      }
      const data = await res.json()
      storeListPayload<T>(endpoint, data)
      setItems(listItemsFromPayload<T>(data))
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError' && !cached) {
        setItems([])
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [endpoint])

  useEffect(() => {
    const ac = new AbortController()
    load(ac.signal)
    return () => ac.abort()
  }, [load, reloadToken, ...deps])

  const reload = () => setReloadToken(token => token + 1)
  const initialLoading = loading && items.length === 0
  const showRefreshing = refreshing && items.length > 0

  return { items, loading, initialLoading, refreshing: showRefreshing, reload, setItems }
}
