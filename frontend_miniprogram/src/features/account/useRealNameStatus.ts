import { onShow } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import { getRealNameStatus } from './service'
import { useAppContextStore } from '@/store/app-context-v2'

export function useRealNameStatus() {
  const appContext = useAppContextStore()
  const verification = ref<{ userId: number, status: string } | null>(null)
  let requestId = 0
  const status = computed(() => verification.value?.userId === appContext.user?.id
    ? verification.value?.status
    : appContext.user?.real_name_status)

  watch([() => appContext.user?.id, () => appContext.user?.real_name_status], () => {
    requestId += 1
    verification.value = null
  }, { flush: 'sync' })

  async function refresh() {
    const currentRequestId = ++requestId
    const userId = appContext.user?.id
    if (!userId)
      return
    try {
      const result = await getRealNameStatus()
      if (currentRequestId === requestId && userId === appContext.user?.id)
        verification.value = { userId, status: result.status }
    }
    catch {
      // 请求失败时继续使用当前账号最近已知的认证状态。
    }
  }

  onShow(() => void refresh())
  return { status, refresh }
}
