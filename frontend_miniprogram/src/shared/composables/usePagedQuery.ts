import type { ComputedRef, Ref, ShallowRef } from 'vue'
import { computed, ref, shallowRef } from 'vue'
import { AppError, normalizeAppError } from '../../core/errors/app-error.ts'

export interface PagedQueryInput {
  page: number
  pageSize: number
}

export interface PagedQueryResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface PagedQueryOptions {
  pageSize?: number
}

export interface PagedQueryState<T> {
  items: ShallowRef<T[]>
  total: Ref<number>
  page: Ref<number>
  loading: Ref<boolean>
  error: ShallowRef<AppError | null>
  finished: ComputedRef<boolean>
  refresh: () => Promise<void | undefined>
  loadMore: () => Promise<void | undefined>
  reset: () => void
}

export function usePagedQuery<T>(loader: (input: PagedQueryInput) => Promise<PagedQueryResult<T>>, options: PagedQueryOptions = {}): PagedQueryState<T> {
  const pageSize = options.pageSize || 20
  const items = shallowRef<T[]>([])
  const total = ref(0)
  const page = ref(0)
  const loading = ref(false)
  const error = shallowRef<AppError | null>(null)
  const finished = computed(() => items.value.length >= total.value && page.value > 0)
  let generation = 0

  async function load(targetPage: number, replace: boolean, currentGeneration: number, allowConcurrent = false) {
    if (loading.value && !allowConcurrent)
      return
    loading.value = true
    error.value = null
    try {
      const result = await loader({ page: targetPage, pageSize })
      if (currentGeneration !== generation)
        return
      items.value = replace ? result.items : [...items.value, ...result.items]
      total.value = result.total
      page.value = result.page
    }
    catch (cause) {
      if (currentGeneration === generation)
        error.value = normalizeAppError(cause instanceof AppError ? cause : { cause })
      throw error.value
    }
    finally {
      if (currentGeneration === generation)
        loading.value = false
    }
  }

  async function refresh() {
    generation += 1
    page.value = 0
    total.value = 0
    return load(1, true, generation, true)
  }

  async function loadMore() {
    if (loading.value || finished.value)
      return
    return load(page.value + 1, false, generation)
  }

  function reset() {
    generation += 1
    items.value = []
    total.value = 0
    page.value = 0
    loading.value = false
    error.value = null
  }

  return { items, total, page, loading, error, finished, refresh, loadMore, reset }
}
