import type { ComputedRef, MaybeRefOrGetter, Ref, ShallowRef } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, ref, shallowRef, toValue } from 'vue'
import { AppError, normalizeAppError } from '../core/errors/app-error.ts'

export interface PagedPageInput {
  page: number
  pageSize: number
}

export interface PagedPageResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

type ItemKey = string | number

export interface PagedPageOptions<T> {
  loader: (input: PagedPageInput) => Promise<PagedPageResult<T>>
  pageSize?: number
  enabled?: MaybeRefOrGetter<boolean>
  refreshOnShow?: boolean
  pullDownRefresh?: boolean
  reachBottom?: boolean
  preserveOnRefresh?: boolean
  initialData?: T[]
  keyOf?: (item: T) => ItemKey
  transform?: (items: T[]) => T[]
  merge?: (current: T[], incoming: T[]) => T[]
}

export interface PagedPageState<T> {
  items: ShallowRef<T[]>
  total: Ref<number>
  page: Ref<number>
  loaded: Ref<boolean>
  loading: ComputedRef<boolean>
  refreshing: Ref<boolean>
  loadingMore: Ref<boolean>
  error: ShallowRef<AppError | null>
  finished: ComputedRef<boolean>
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  reset: () => void
  replace: (items: T[], total?: number) => void
  upsert: (item: T) => void
  remove: (itemOrKey: T | ItemKey) => void
}

export function usePagedPage<T>(options: PagedPageOptions<T>): PagedPageState<T> {
  const pageSize = options.pageSize || 20
  const items = shallowRef<T[]>(options.initialData || [])
  const total = ref(options.initialData?.length || 0)
  const page = ref(0)
  const loaded = ref(false)
  const refreshing = ref(false)
  const loadingMore = ref(false)
  const error = shallowRef<AppError | null>(null)
  const loading = computed(() => refreshing.value || loadingMore.value)
  const finished = computed(() => loaded.value && items.value.length >= total.value)
  let generation = 0

  function enabled() {
    return options.enabled === undefined ? true : Boolean(toValue(options.enabled))
  }

  function stopPullDownRefresh() {
    if (typeof uni !== 'undefined')
      uni.stopPullDownRefresh()
  }

  function normalizeItems(nextItems: T[]) {
    return options.transform ? options.transform(nextItems) : nextItems
  }

  async function refresh() {
    if (!enabled())
      return
    const currentGeneration = ++generation
    loadingMore.value = false
    refreshing.value = true
    error.value = null
    try {
      const result = await options.loader({ page: 1, pageSize })
      if (currentGeneration !== generation)
        return
      const nextItems = normalizeItems(result.items)
      items.value = options.preserveOnRefresh && items.value.length && options.merge
        ? options.merge(items.value, nextItems)
        : nextItems
      total.value = result.total
      page.value = result.page
      loaded.value = true
    }
    catch (cause) {
      if (currentGeneration === generation)
        error.value = cause instanceof AppError ? cause : normalizeAppError({ cause, fallbackMessage: '列表加载失败，请稍后重试' })
    }
    finally {
      if (currentGeneration === generation)
        refreshing.value = false
      stopPullDownRefresh()
    }
  }

  async function loadMore() {
    if (!enabled() || refreshing.value || loadingMore.value || finished.value)
      return
    const currentGeneration = generation
    loadingMore.value = true
    error.value = null
    try {
      const result = await options.loader({ page: page.value + 1, pageSize })
      if (currentGeneration !== generation)
        return
      const nextItems = normalizeItems(result.items)
      items.value = options.merge ? options.merge(items.value, nextItems) : [...items.value, ...nextItems]
      total.value = result.total
      page.value = result.page
      loaded.value = true
    }
    catch (cause) {
      if (currentGeneration === generation)
        error.value = cause instanceof AppError ? cause : normalizeAppError({ cause, fallbackMessage: '加载更多失败，请稍后重试' })
    }
    finally {
      if (currentGeneration === generation)
        loadingMore.value = false
    }
  }

  function reset() {
    generation += 1
    items.value = []
    total.value = 0
    page.value = 0
    loaded.value = false
    refreshing.value = false
    loadingMore.value = false
    error.value = null
  }

  function replace(nextItems: T[], nextTotal = nextItems.length) {
    items.value = normalizeItems(nextItems)
    total.value = nextTotal
    loaded.value = true
  }

  function upsert(item: T) {
    if (!options.keyOf) {
      items.value = [...items.value, item]
      total.value += 1
      return
    }
    const key = options.keyOf(item)
    const index = items.value.findIndex(candidate => options.keyOf?.(candidate) === key)
    if (index < 0) {
      items.value = [...items.value, item]
      total.value += 1
      return
    }
    items.value = items.value.map((candidate, candidateIndex) => candidateIndex === index ? item : candidate)
  }

  function remove(itemOrKey: T | ItemKey) {
    if (!options.keyOf)
      return
    const key = typeof itemOrKey === 'object' ? options.keyOf(itemOrKey) : itemOrKey
    const nextItems = items.value.filter(item => options.keyOf?.(item) !== key)
    if (nextItems.length !== items.value.length) {
      items.value = nextItems
      total.value = Math.max(0, total.value - 1)
    }
  }

  if (options.refreshOnShow !== false)
    onShow(() => void refresh())
  if (options.pullDownRefresh !== false)
    onPullDownRefresh(() => void refresh())
  if (options.reachBottom !== false)
    onReachBottom(() => void loadMore())

  return { items, total, page, loaded, loading, refreshing, loadingMore, error, finished, refresh, loadMore, reset, replace, upsert, remove }
}
