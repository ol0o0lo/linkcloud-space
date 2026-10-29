import type { MaybeRefOrGetter } from 'vue'
import type { MessagingContext } from './types'
import type { ConversationState } from './conversation-controller'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { onScopeDispose, shallowRef, toValue, watch } from 'vue'
import { messagingApi } from '@/services/manual/messaging'
import { useWorkspaceStore } from '@/store/workspace'
import { observeMessagingForeground } from './polling'
import { createConversationController } from './conversation-controller'

export function useConversation(context: MaybeRefOrGetter<MessagingContext | null>, id: MaybeRefOrGetter<number>, onRead?: () => void) {
  const workspace = useWorkspaceStore()
  const state = shallowRef<ConversationState>({ conversation: null, messages: [], pending: [], loading: false, historyLoading: false, hasMore: false, error: '' })
  const controller = createConversationController(messagingApi, value => state.value = value, onRead)
  let visible = false
  let foreground = true
  function syncActive() {
    if (visible && foreground)
      controller.activate()
    else
      controller.deactivate()
  }
  const stopObserving = observeMessagingForeground((value) => {
    foreground = value
    syncActive()
  })
  watch(() => [toValue(context), toValue(id), workspace.user?.id] as const, ([value, conversationId, userId]) => {
    controller.setAccount(userId || null)
    controller.setContext(value, conversationId)
  }, { immediate: true })
  onShow(() => {
    visible = true
    syncActive()
  })
  onHide(() => {
    visible = false
    syncActive()
  })
  onUnload(controller.deactivate)
  onScopeDispose(() => {
    stopObserving()
    controller.deactivate()
  })
  return { state, ...controller }
}
