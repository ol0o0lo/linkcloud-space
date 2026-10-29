import type { MaybeRefOrGetter } from 'vue'
import type { Conversation, MessagingContext } from './types'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'
import { getMessagingUnreadCount, listConversations } from '@/services/manual/messaging'
import { setMessagingTabbarUnreadCount } from '@/features/notifications/tabbar-badge'
import { messagingContextKey } from './context'
import { createSerialPoller, observeMessagingForeground } from './polling'

export function useConversationList(context: MaybeRefOrGetter<MessagingContext | null>, enabled: MaybeRefOrGetter<boolean>) {
  const items = shallowRef<Conversation[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  const unread = ref(0)
  let page = 0
  let generation = 0
  let visible = false
  let foreground = true
  let busy = false
  let activeKey = ''

  function active() {
    return visible && foreground && toValue(enabled) && Boolean(toValue(context))
  }

  const poller = createSerialPoller(() => load(), 10000)

  async function load(append = false) {
    const input = toValue(context)
    if (!input || !active() || busy)
      return
    const captured = { ...input }
    const requestGeneration = generation
    const isCurrent = () => requestGeneration === generation && active() && messagingContextKey(captured) === messagingContextKey(toValue(context))
    busy = true
    loading.value = true
    error.value = ''
    try {
      const nextPage = append ? page + 1 : 1
      const result = await listConversations(captured, nextPage)
      if (!isCurrent())
        return
      if (append) {
        const unique = new Map(items.value.map(item => [item.id, item]))
        result.items.forEach(item => unique.set(item.id, item))
        items.value = Array.from(unique.values())
      }
      else {
        // 刷新保持已展开的页数，避免轮询把历史列表折回第一页。
        const refreshed = [...result.items]
        for (let currentPage = 2; currentPage <= page && refreshed.length < result.total; currentPage++) {
          const more = await listConversations(captured, currentPage)
          if (!isCurrent())
            return
          refreshed.push(...more.items)
        }
        items.value = Array.from(new Map(refreshed.map(item => [item.id, item])).values())
      }
      page = Math.max(append ? nextPage : page, 1)
      total.value = result.total
      const count = await getMessagingUnreadCount(captured)
      if (!isCurrent())
        return
      unread.value = count.message_count
      setMessagingTabbarUnreadCount(count.message_count)
    }
    catch (cause) {
      if (isCurrent())
        error.value = cause instanceof Error ? cause.message : '聊天加载失败，请稍后重试'
      throw cause
    }
    finally {
      busy = false
      if (isCurrent())
        loading.value = false
      else if (active())
        void poller.refresh()
    }
  }

  function syncActive() {
    if (active()) {
      poller.start()
    }
    else {
      generation += 1
      poller.stop()
      loading.value = false
    }
  }

  watch(() => [messagingContextKey(toValue(context)), toValue(enabled)] as const, ([key]) => {
    generation += 1
    poller.stop()
    if (key !== activeKey) {
      activeKey = key
      items.value = []
      total.value = 0
      unread.value = 0
      page = 0
      error.value = ''
      setMessagingTabbarUnreadCount(0)
    }
    syncActive()
  }, { immediate: true })
  const stopObserving = observeMessagingForeground((value) => {
    foreground = value
    syncActive()
  })
  onShow(() => {
    visible = true
    syncActive()
  })
  function stop() {
    visible = false
    syncActive()
  }
  onHide(stop)
  onUnload(stop)
  onScopeDispose(() => {
    stopObserving()
    stop()
  })

  async function loadMore() {
    if (items.value.length >= total.value)
      return
    try {
      await load(true)
    }
    catch { /* 错误已显示，保留可重试的列表。 */ }
  }

  return { items, total, loading, error, unread, refresh: poller.refresh, loadMore }
}
