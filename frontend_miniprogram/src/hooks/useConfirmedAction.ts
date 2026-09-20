import type { ShallowRef } from 'vue'
import { computed, shallowRef } from 'vue'
import { AppError, normalizeAppError } from '@/core/errors/app-error'

export interface ConfirmationOptions {
  title: string
  content: string
  confirmText?: string
  cancelText?: string
}

export interface ConfirmedActionOptions {
  confirm: ConfirmationOptions
  execute: () => Promise<unknown>
  pendingKey?: string | number
  successText?: string
  errorText?: string
  onSuccess?: () => void | Promise<void>
  onError?: (error: AppError) => void | Promise<void>
}

export function useConfirmedAction() {
  const pendingKey = shallowRef<string | number | null>(null)
  const error: ShallowRef<AppError | null> = shallowRef(null)
  const loading = computed(() => pendingKey.value !== null)

  async function run(options: ConfirmedActionOptions): Promise<boolean> {
    if (loading.value)
      return false
    const confirmation = await uni.showModal({
      title: options.confirm.title,
      content: options.confirm.content,
      confirmText: options.confirm.confirmText || '确认',
      cancelText: options.confirm.cancelText || '取消',
    })
    if (!confirmation.confirm)
      return false

    pendingKey.value = options.pendingKey ?? 'global'
    error.value = null
    try {
      await options.execute()
      if (options.successText)
        uni.showToast({ title: options.successText, icon: 'success' })
      await options.onSuccess?.()
      return true
    }
    catch (cause) {
      const appError = cause instanceof AppError ? cause : normalizeAppError({ cause, fallbackMessage: options.errorText || '操作失败，请稍后重试' })
      error.value = appError
      uni.showToast({ title: appError.message, icon: 'none' })
      await options.onError?.(appError)
      return false
    }
    finally {
      pendingKey.value = null
    }
  }

  return { loading, pendingKey, error, run }
}
