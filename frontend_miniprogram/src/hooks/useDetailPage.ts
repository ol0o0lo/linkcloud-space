import type { MaybeRefOrGetter, Ref, ShallowRef } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { ref, shallowRef, toValue } from 'vue'
import { AppError, normalizeAppError } from '@/core/errors/app-error'

export interface DetailPageOptions<TKey, TData> {
  resolveKey: (options: Record<string, string | undefined>) => TKey | null | undefined
  loader: (key: TKey) => Promise<TData>
  enabled?: MaybeRefOrGetter<boolean>
  refreshOnShow?: boolean
  pullDownRefresh?: boolean
  invalidKeyMessage?: string
}

export interface DetailPageState<TKey, TData> {
  key: ShallowRef<TKey | null>
  data: ShallowRef<TData | null>
  loading: Ref<boolean>
  refreshing: Ref<boolean>
  error: ShallowRef<AppError | null>
  refresh: () => Promise<void>
  replace: (data: TData) => void
  patch: (data: Partial<TData>) => void
}

export function useDetailPage<TKey, TData>(options: DetailPageOptions<TKey, TData>): DetailPageState<TKey, TData> {
  const key = shallowRef<TKey | null>(null)
  const data = shallowRef<TData | null>(null)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = shallowRef<AppError | null>(null)
  let generation = 0
  let skipFirstShow = false

  function enabled() {
    return options.enabled === undefined ? true : Boolean(toValue(options.enabled))
  }

  async function refresh() {
    if (!enabled() || key.value === null)
      return
    const currentGeneration = ++generation
    const hasData = data.value !== null
    loading.value = !hasData
    refreshing.value = hasData
    error.value = null
    try {
      const result = await options.loader(key.value)
      if (currentGeneration === generation)
        data.value = result
    }
    catch (cause) {
      if (currentGeneration === generation)
        error.value = cause instanceof AppError ? cause : normalizeAppError({ cause, fallbackMessage: '详情加载失败，请稍后重试' })
    }
    finally {
      if (currentGeneration === generation) {
        loading.value = false
        refreshing.value = false
      }
      uni.stopPullDownRefresh()
    }
  }

  function replace(nextData: TData) {
    data.value = nextData
  }

  function patch(nextData: Partial<TData>) {
    if (data.value)
      data.value = { ...data.value, ...nextData }
  }

  onLoad((routeOptions) => {
    const resolvedKey = options.resolveKey(routeOptions || {})
    if (resolvedKey === null || resolvedKey === undefined) {
      error.value = new AppError({
        kind: 'validation',
        message: options.invalidKeyMessage || '页面参数无效',
        retryable: false,
      })
      return
    }
    key.value = resolvedKey
    skipFirstShow = true
    void refresh()
  })

  if (options.refreshOnShow) {
    onShow(() => {
      if (skipFirstShow) {
        skipFirstShow = false
        return
      }
      void refresh()
    })
  }
  if (options.pullDownRefresh !== false)
    onPullDownRefresh(() => void refresh())

  return { key, data, loading, refreshing, error, refresh, replace, patch }
}
