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

export const CLIENTS_ALL_URL = '/api/clients'
export const CLIENTS_PAGE_1_URL = '/api/clients?page=1'
export const PRODUCT_TYPES_URL = '/api/product-types'
export const PRODUCT_TYPES_ACTIVE_URL = '/api/product-types?active=true'

export function listItemsFromPayload<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && 'items' in data) {
    return ((data as { items?: T[] }).items || []) as T[]
  }
  return []
}

export function metaFromPayload(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined
  const meta: Record<string, unknown> = {}
  if ('summary' in data && data.summary !== undefined) meta.summary = (data as { summary: unknown }).summary
  if ('allTime' in data && data.allTime !== undefined) meta.allTime = (data as { allTime: unknown }).allTime
  return Object.keys(meta).length ? meta : undefined
}

export function storeListPayload<T>(url: string, data: unknown) {
  if (Array.isArray(data)) {
    setListCache(url, { items: data as T[] })
    return
  }
  if (data && typeof data === 'object') {
    const payload = data as { items?: T[]; total?: number; totalPages?: number }
    setListCache(url, {
      items: payload.items || [],
      total: payload.total,
      totalPages: payload.totalPages,
      meta: metaFromPayload(data),
    })
  }
}

/** Read list cache first; always refresh in background. */
export async function fetchCachedList<T>(url: string): Promise<T[]> {
  const cached = getListCache<T>(url)
  const refresh = fetch(url)
    .then(async res => {
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      storeListPayload<T>(url, data)
      return listItemsFromPayload<T>(data)
    })

  if (cached) {
    void refresh.catch(() => {})
    return cached.items
  }

  return refresh
}

export function prefetchClientsAll() {
  return prefetchList(CLIENTS_ALL_URL)
}

export function prefetchActiveProductTypes() {
  return prefetchList(PRODUCT_TYPES_ACTIVE_URL)
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
    storeListPayload<T>(url, data)
  } catch {
    // Ignore prefetch failures
  }
}
