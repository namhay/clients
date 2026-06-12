const STORAGE_PREFIX = 'clientdesk:list:'
const JSON_STORAGE_PREFIX = 'clientdesk:json:'

type CacheEntry<T> = {
  items: T[]
  total?: number
  totalPages?: number
  meta?: Record<string, unknown>
  at: number
}

type JsonCacheEntry<T> = {
  data: T
  at: number
}

const memory = new Map<string, CacheEntry<unknown>>()
const jsonMemory = new Map<string, JsonCacheEntry<unknown>>()

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

function jsonStorageKey(key: string) {
  return `${JSON_STORAGE_PREFIX}${key}`
}

function readStorage<T>(key: string): CacheEntry<T> | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(storageKey(key))
    if (!raw) return undefined
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return undefined
  }
}

function readJsonStorage<T>(key: string): JsonCacheEntry<T> | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(jsonStorageKey(key))
    if (!raw) return undefined
    return JSON.parse(raw) as JsonCacheEntry<T>
  } catch {
    return undefined
  }
}

function writeStorage<T>(key: string, entry: CacheEntry<T>) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(entry))
  } catch {
    // Quota exceeded — memory cache still works this session
  }
}

function writeJsonStorage<T>(key: string, entry: JsonCacheEntry<T>) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(jsonStorageKey(key), JSON.stringify(entry))
  } catch {
    // Quota exceeded — memory cache still works this session
  }
}

export function getJsonCache<T>(key: string): T | undefined {
  const hit = jsonMemory.get(key) as JsonCacheEntry<T> | undefined
  if (hit) return hit.data
  const stored = readJsonStorage<T>(key)
  if (stored) {
    jsonMemory.set(key, stored)
    return stored.data
  }
  return undefined
}

export function setJsonCache<T>(key: string, data: T) {
  const entry = { data, at: Date.now() }
  jsonMemory.set(key, entry)
  writeJsonStorage(key, entry)
}

export function clearJsonCache(key: string) {
  jsonMemory.delete(key)
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(jsonStorageKey(key))
    } catch {
      // ignore
    }
  }
}

export function clientProfileApiUrl(clientId: string) {
  return `/api/clients/${clientId}`
}

export function prefetchClientProfile(clientId: string) {
  return prefetchJson(clientProfileApiUrl(clientId))
}

/** Warm cache for a single JSON resource (e.g. client profile). */
export async function prefetchJson<T>(url: string): Promise<void> {
  if (getJsonCache<T>(url)) return
  try {
    const res = await fetch(url)
    if (!res.ok) return
    const data = await res.json() as T
    setJsonCache(url, data)
  } catch {
    // Ignore prefetch failures
  }
}

export function getListCache<T>(key: string): CacheEntry<T> | undefined {
  const hit = memory.get(key) as CacheEntry<T> | undefined
  if (hit) return hit
  const stored = readStorage<T>(key)
  if (stored) memory.set(key, stored)
  return stored
}

export function setListCache<T>(
  key: string,
  data: { items: T[]; total?: number; totalPages?: number; meta?: Record<string, unknown> },
) {
  const entry = { ...data, at: Date.now() }
  memory.set(key, entry)
  writeStorage(key, entry)
}

/** Warm cache in background (e.g. sidebar hover, next page). */
export async function prefetchList<T extends { items?: T[] } | T[]>(
  url: string,
): Promise<void> {
  if (getListCache(url)) return
  try {
    const res = await fetch(url)
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data)) {
      setListCache(url, { items: data })
      return
    }
    setListCache(url, {
      items: data.items || [],
      total: data.total,
      totalPages: data.totalPages,
    })
  } catch {
    // Ignore prefetch failures
  }
}
