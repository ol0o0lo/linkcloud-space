import type { Ref, ShallowRef } from 'vue'
import { ref, shallowRef } from 'vue'
import { AppError, normalizeAppError } from '@/core/errors/app-error'

export interface EntityPickerOptions<T> {
  loader: (keyword: string) => Promise<T[]>
  initialKeyword?: string
  clearOnClose?: boolean
}

export interface EntityPickerState<T> {
  visible: Ref<boolean>
  keyword: Ref<string>
  items: ShallowRef<T[]>
  loading: Ref<boolean>
  error: ShallowRef<AppError | null>
  open: (keyword?: string) => Promise<void>
  close: () => void
  search: () => Promise<void>
  replace: (items: T[]) => void
}

export function useEntityPicker<T>(options: EntityPickerOptions<T>): EntityPickerState<T> {
  const visible = ref(false)
  const keyword = ref(options.initialKeyword || '')
  const items = shallowRef<T[]>([])
  const loading = ref(false)
  const error = shallowRef<AppError | null>(null)
  let generation = 0

  async function search() {
    const currentGeneration = ++generation
    loading.value = true
    error.value = null
    try {
      const result = await options.loader(keyword.value.trim())
      if (currentGeneration === generation)
        items.value = result
    }
    catch (cause) {
      if (currentGeneration === generation)
        error.value = cause instanceof AppError ? cause : normalizeAppError({ cause, fallbackMessage: '候选项加载失败，请稍后重试' })
    }
    finally {
      if (currentGeneration === generation)
        loading.value = false
    }
  }

  async function open(nextKeyword = '') {
    visible.value = true
    keyword.value = nextKeyword
    await search()
  }

  function close() {
    generation += 1
    visible.value = false
    loading.value = false
    error.value = null
    if (options.clearOnClose !== false) {
      keyword.value = options.initialKeyword || ''
      items.value = []
    }
  }

  function replace(nextItems: T[]) {
    items.value = nextItems
  }

  return { visible, keyword, items, loading, error, open, close, search, replace }
}
