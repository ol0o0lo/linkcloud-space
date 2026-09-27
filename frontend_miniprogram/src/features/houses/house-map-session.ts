import { createHouseMapResultCache } from '../../domain/house-map.ts'

interface HouseMapSessionCommitMeta {
  cached: boolean
  key: string
}

interface CreateHouseMapSessionOptions<TParams, TResult> {
  buildKey: (params: TParams) => string
  cacheSize?: number
  debounceMs?: number
  onCommit: (result: TResult, meta: HouseMapSessionCommitMeta) => void
  onError?: (error: unknown) => void
  onRefreshingChange?: (refreshing: boolean) => void
  request: (params: TParams) => Promise<TResult>
}

interface HouseMapLoadOptions {
  force?: boolean
}

export interface HouseMapSession<TParams> {
  cancelPending: () => void
  dispose: () => void
  load: (params: TParams, options?: HouseMapLoadOptions) => Promise<void>
  schedule: (params: TParams) => void
}

export function createHouseMapSession<TParams, TResult>(options: CreateHouseMapSessionOptions<TParams, TResult>): HouseMapSession<TParams> {
  const cache = createHouseMapResultCache<TResult>(options.cacheSize ?? 8)
  const debounceMs = options.debounceMs ?? 280
  let activeKey = ''
  let activePromise: Promise<void> | null = null
  let disposed = false
  let lastSuccessfulKey = ''
  let requestVersion = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  async function load(params: TParams, loadOptions: HouseMapLoadOptions = {}): Promise<void> {
    if (disposed)
      return
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const key = options.buildKey(params)
    if (!loadOptions.force && key === lastSuccessfulKey)
      return
    if (!loadOptions.force && key === activeKey && activePromise)
      return activePromise

    const cached = cache.get(key)
    if (cached !== undefined)
      options.onCommit(cached, { cached: true, key })

    const currentVersion = ++requestVersion
    activeKey = key
    options.onRefreshingChange?.(true)
    const task = (async () => {
      try {
        const result = await options.request(params)
        if (disposed || currentVersion !== requestVersion)
          return
        cache.set(key, result)
        lastSuccessfulKey = key
        options.onCommit(result, { cached: false, key })
      }
      catch (error) {
        if (!disposed && currentVersion === requestVersion)
          options.onError?.(error)
      }
      finally {
        if (!disposed && currentVersion === requestVersion) {
          activeKey = ''
          activePromise = null
          options.onRefreshingChange?.(false)
        }
      }
    })()
    activePromise = task
    return task
  }

  function schedule(params: TParams) {
    if (disposed)
      return
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void load(params)
    }, debounceMs)
  }

  function cancelPending() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    requestVersion += 1
    activeKey = ''
    activePromise = null
    options.onRefreshingChange?.(false)
  }

  function dispose() {
    disposed = true
    requestVersion += 1
    activeKey = ''
    activePromise = null
    if (timer)
      clearTimeout(timer)
    timer = null
    cache.clear()
    options.onRefreshingChange?.(false)
  }

  return { cancelPending, dispose, load, schedule }
}
