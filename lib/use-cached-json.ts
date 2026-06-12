'use client'
import { useEffect, useState } from 'react'
import { getJsonCache, setJsonCache } from '@/lib/list-cache'

/** Fetch JSON once; show cached payload instantly on revisit while refreshing in background. */
export function useCachedJson<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(() => getJsonCache<T>(url) ?? null)
  const [loading, setLoading] = useState(() => !getJsonCache<T>(url))
  const [refreshing, setRefreshing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const cached = getJsonCache<T>(url)
    if (cached) {
      setData(cached)
      setLoading(false)
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    const ac = new AbortController()
    fetch(url, { signal: ac.signal })
      .then(async res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json() as Promise<T>
      })
      .then(next => {
        setData(next)
        setJsonCache(url, next)
      })
      .catch(err => {
        if (err?.name !== 'AbortError' && !cached) setData(null)
      })
      .finally(() => {
        if (!ac.signal.aborted) {
          setLoading(false)
          setRefreshing(false)
        }
      })

    return () => ac.abort()
  }, [url, reloadToken, ...deps])

  const reload = () => setReloadToken(token => token + 1)
  const initialLoading = loading && !data

  return { data, loading, initialLoading, refreshing, reload }
}
