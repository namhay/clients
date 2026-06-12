'use client'
import { useCallback, useEffect, useState } from 'react'
import { getListCache, setListCache } from '@/lib/list-cache'

/** Fetch a list once; show cached rows instantly on revisit while refreshing in background. */
export function useCachedList<T>(endpoint: string, deps: unknown[] = []) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    const cached = getListCache<T>(endpoint)
    if (cached) {
      setItems(cached.items)
      setLoading(false)
    } else {
      setLoading(true)
    }

    try {
      const res = await fetch(endpoint, { signal })
      if (!res.ok) {
        if (!cached) setItems([])
        return
      }
      const data = await res.json()
      const nextItems = Array.isArray(data) ? data : (data.items || [])
      setItems(nextItems)
      setListCache(endpoint, { items: nextItems })
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError' && !cached) {
        setItems([])
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    const ac = new AbortController()
    load(ac.signal)
    return () => ac.abort()
  }, [load, reloadToken, ...deps])

  const reload = () => setReloadToken(token => token + 1)
  const initialLoading = loading && items.length === 0
  const refreshing = loading && items.length > 0

  return { items, loading, initialLoading, refreshing, reload, setItems }
}
