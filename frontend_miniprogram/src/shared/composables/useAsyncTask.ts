import type { Ref, ShallowRef } from 'vue'
import { ref, shallowRef } from 'vue'
import { AppError, normalizeAppError } from '../../core/errors/app-error.ts'

export interface AsyncTaskState<TResult, TArgs extends unknown[]> {
  data: ShallowRef<TResult | null>
  error: ShallowRef<AppError | null>
  loading: Ref<boolean>
  run: (...args: TArgs) => Promise<TResult>
  retry: () => Promise<TResult>
  cancel: () => void
}

export interface LatestRequestGuard {
  begin: () => number
  isCurrent: (generation: number) => boolean
  invalidate: () => void
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let generation = 0

  return {
    begin: () => ++generation,
    isCurrent: candidate => candidate === generation,
    invalidate: () => {
      generation += 1
    },
  }
}

export function useAsyncTask<TResult, TArgs extends unknown[]>(task: (...args: TArgs) => Promise<TResult>): AsyncTaskState<TResult, TArgs> {
  const data = shallowRef<TResult | null>(null)
  const error = shallowRef<AppError | null>(null)
  const loading = ref(false)
  let executionId = 0
  let lastArgs: TArgs | null = null

  async function run(...args: TArgs): Promise<TResult> {
    const currentExecution = ++executionId
    lastArgs = args
    loading.value = true
    error.value = null
    try {
      const result = await task(...args)
      if (currentExecution === executionId)
        data.value = result
      return result
    }
    catch (cause) {
      const appError = normalizeAppError(cause instanceof AppError ? cause : { cause })
      if (currentExecution === executionId)
        error.value = appError
      throw appError
    }
    finally {
      if (currentExecution === executionId)
        loading.value = false
    }
  }

  function retry(): Promise<TResult> {
    if (!lastArgs)
      return Promise.reject(new AppError({ kind: 'unexpected', message: '当前任务尚未执行' }))
    return run(...lastArgs)
  }

  function cancel() {
    executionId += 1
    loading.value = false
    error.value = new AppError({ kind: 'cancelled', message: '请求已取消' })
  }

  return { data, error, loading, run, retry, cancel }
}
