import type { ShallowRef } from 'vue'
import { ref, shallowRef } from 'vue'
import { AppError, normalizeAppError } from '@/core/errors/app-error'

export interface FormSubmitOptions<TResult> {
  validate?: () => boolean | Promise<boolean>
  execute: () => Promise<TResult>
  successText?: string
  errorText?: string
  onSuccess?: (result: TResult) => void | Promise<void>
  onError?: (error: AppError) => void | Promise<void>
}

export function useFormSubmit<TResult>(options: FormSubmitOptions<TResult>) {
  const loading = ref(false)
  const error: ShallowRef<AppError | null> = shallowRef(null)

  async function run(): Promise<TResult | undefined> {
    if (loading.value)
      return
    if (options.validate && !(await options.validate()))
      return

    loading.value = true
    error.value = null
    try {
      const result = await options.execute()
      if (options.successText)
        uni.showToast({ title: options.successText, icon: 'success' })
      await options.onSuccess?.(result)
      return result
    }
    catch (cause) {
      const appError = cause instanceof AppError ? cause : normalizeAppError({ cause, fallbackMessage: options.errorText || '提交失败，请稍后重试' })
      error.value = appError
      uni.showToast({ title: appError.message, icon: 'none' })
      await options.onError?.(appError)
      return
    }
    finally {
      loading.value = false
    }
  }

  return { loading, error, run }
}
