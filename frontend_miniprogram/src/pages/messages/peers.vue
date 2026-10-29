<script setup lang="ts">
import type { MessagingContext, MessagingPeer } from '@/features/messaging/types'
import { onHide, onPullDownRefresh, onReachBottom, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import { messagingContextKey } from '@/features/messaging/context'
import { usePagedPage } from '@/hooks/usePagedPage'
import { APP_ROUTES, getConversationRoute } from '@/modules/routes'
import { createDirectConversation, listMessagingPeers } from '@/services/manual/messaging'
import { useWorkspaceStore } from '@/store/workspace'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '发起聊天', enablePullDownRefresh: true } })

const workspace = useWorkspaceStore()
const keyword = ref('')
const creating = ref(false)
let generation = 0
const context = computed<MessagingContext | null>(() => workspace.navigationMode === 'organization' && workspace.organizationSlug && workspace.user?.id
  ? { userId: workspace.user.id, accessKind: 'organization_member', organizationSlug: workspace.organizationSlug }
  : null)
const peers = usePagedPage<MessagingPeer>({
  loader: ({ page }) => listMessagingPeers(context.value!, page, keyword.value.trim()),
  enabled: () => Boolean(context.value),
  pageSize: 20,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: peer => peer.user_id,
})

async function refresh() {
  generation += 1
  creating.value = false
  await peers.refresh()
}

watch(() => messagingContextKey(context.value), () => {
  generation += 1
  creating.value = false
  peers.reset()
  if (context.value)
    void refresh()
})

async function startChat(peer: MessagingPeer) {
  if (!context.value || creating.value)
    return
  const captured = { ...context.value }
  const requestGeneration = generation
  creating.value = true
  try {
    const conversation = await createDirectConversation(captured, peer.user_id)
    if (requestGeneration === generation && messagingContextKey(captured) === messagingContextKey(context.value))
      uni.redirectTo({ url: getConversationRoute(conversation.id, conversation.organization.slug, 'organization_member') })
  }
  catch (cause) {
    if (requestGeneration === generation)
      uni.showToast({ title: cause instanceof Error ? cause.message : '创建聊天失败', icon: 'none' })
  }
  finally {
    if (requestGeneration === generation)
      creating.value = false
  }
}

onShow(() => void refresh())
function stop() {
  generation += 1
  creating.value = false
  peers.reset()
}
onHide(stop)
onUnload(stop)
onPullDownRefresh(() => void refresh())
onReachBottom(() => void peers.loadMore())
</script>

<template>
  <AppPage>
    <template #navigation>
      <AppCustomNavigation title="发起聊天" back :fallback-url="APP_ROUTES.messages" />
    </template>
    <AppEmpty v-if="!context" title="请先选择经纪人身份" description="空间成员可以与同一工作空间的其他成员聊天。" icon="no-message" />
    <template v-else>
      <view class="peer-search mb-3.5 flex items-center justify-between gap-2.5">
        <input v-model="keyword" class="peer-input min-w-0 flex-1 rounded-2.5 bg-surface-card p-2.5 text-size-xs" placeholder="搜索成员姓名" confirm-type="search" @confirm="refresh">
        <wd-button size="small" variant="plain" @click="refresh">
          搜索
        </wd-button>
      </view>
      <AppPagedList :items="peers.items.value" item-key="user_id" :loading="peers.loading.value" :loading-more="peers.loadingMore.value" :finished="peers.finished.value" :error="peers.error.value" empty-text="没有可聊天的成员" finished-text="没有更多成员了" @retry="refresh">
        <template #item="{ item }">
          <view class="peer-card flex items-center justify-between gap-2.5 rounded-3 bg-surface-card p-3 text-size-sm text-content-primary" @click="startChat(item)">
            <text>{{ item.display_name || '空间成员' }}</text>
            <wd-button size="small" variant="text" :disabled="creating" @click.stop="startChat(item)">
              聊天
            </wd-button>
          </view>
        </template>
      </AppPagedList>
    </template>
  </AppPage>
</template>
