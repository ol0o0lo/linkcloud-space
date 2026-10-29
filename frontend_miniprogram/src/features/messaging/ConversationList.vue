<script setup lang="ts">
import type { Conversation, MessagingContext, PersonalMessagingOrganization } from './types'
import { onHide, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, onScopeDispose, ref, watch } from 'vue'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { getConversationRoute } from '@/modules/routes'
import { listPersonalMessagingOrganizations } from '@/services/manual/messaging'
import { useWorkspaceStore } from '@/store/workspace'
import { choosePersonalMessagingOrganization, conversationTitle, recalledMessagingOrganization, rememberMessagingOrganization } from './context'
import { useConversationList } from './useConversationList'
import { conversationLabel, conversationPeer, formatMessageTime } from './presentation'

const props = defineProps<{ active: boolean, namespace?: string }>()
const emit = defineEmits<{ unreadChange: [count: number] }>()
const workspace = useWorkspaceStore()
const organizations = ref<PersonalMessagingOrganization[]>([])
const selectedSlug = ref('')
const selecting = ref(false)
const discovering = ref(false)
const discoveryError = ref('')
const visible = ref(false)
let discoveryGeneration = 0
const isOrganization = computed(() => workspace.navigationMode === 'organization')
const context = computed<MessagingContext | null>(() => {
  const slug = isOrganization.value ? workspace.organizationSlug : selectedSlug.value
  return workspace.authenticated && workspace.user?.id && slug
    ? { userId: workspace.user.id, accessKind: isOrganization.value ? 'organization_member' : 'business_party', organizationSlug: slug, namespace: props.namespace }
    : null
})
const list = useConversationList(context, () => props.active)
watch(list.unread, count => emit('unreadChange', count), { immediate: true })
const organizationName = computed(() => isOrganization.value
  ? workspace.currentOrganization?.name || '当前工作空间'
  : organizations.value.find(item => item.slug === selectedSlug.value)?.name || '选择聊天空间')

async function discoverOrganizations() {
  const requestGeneration = ++discoveryGeneration
  const userId = workspace.user?.id
  if (!visible.value || !props.active || isOrganization.value || !userId)
    return
  discovering.value = true
  discoveryError.value = ''
  try {
    const items: PersonalMessagingOrganization[] = []
    for (let page = 1; ; page++) {
      const result = await listPersonalMessagingOrganizations(page, props.namespace)
      if (requestGeneration !== discoveryGeneration)
        return
      items.push(...result.items)
      if (!result.items.length || items.length >= result.total)
        break
    }
    organizations.value = items
    selectedSlug.value = choosePersonalMessagingOrganization(items, selectedSlug.value || recalledMessagingOrganization(userId, props.namespace))
    if (selectedSlug.value)
      rememberMessagingOrganization(userId, selectedSlug.value, props.namespace)
    selecting.value = !selectedSlug.value && items.length > 1
  }
  catch (cause) {
    if (requestGeneration === discoveryGeneration)
      discoveryError.value = cause instanceof Error ? cause.message : '聊天空间加载失败'
  }
  finally {
    if (requestGeneration === discoveryGeneration)
      discovering.value = false
  }
}

watch(() => [workspace.user?.id, workspace.navigationMode, workspace.organizationSlug, props.namespace] as const, () => {
  discoveryGeneration += 1
  organizations.value = []
  selectedSlug.value = ''
  discoveryError.value = ''
  discovering.value = false
  void discoverOrganizations()
})
watch(() => props.active, (active) => {
  if (active)
    void discoverOrganizations()
  else
    discoveryGeneration += 1
})
onShow(() => {
  visible.value = true
  void discoverOrganizations()
})
onHide(() => {
  selecting.value = false
  visible.value = false
  discoveryGeneration += 1
})
onScopeDispose(() => {
  visible.value = false
  discoveryGeneration += 1
})
onReachBottom(() => {
  if (props.active)
    void list.loadMore()
})

function selectOrganization(slug: string) {
  selectedSlug.value = slug
  selecting.value = false
  if (workspace.user?.id)
    rememberMessagingOrganization(workspace.user.id, slug, props.namespace)
}

function openConversation(conversation: Conversation) {
  if (context.value)
    uni.navigateTo({ url: getConversationRoute(conversation.id, conversation.organization.slug, context.value.accessKind) })
}

async function refresh() {
  if (!isOrganization.value)
    await discoverOrganizations()
  await list.refresh()
  uni.stopPullDownRefresh()
}

defineExpose({ refresh })
</script>

<template>
  <view class="conversation-list">
    <slot name="before" />
    <view class="list-heading flex items-center justify-between gap-2 px-5 pb-1.5 pt-4 text-size-xs">
      <text>最近聊天</text>
      <button v-if="!isOrganization && organizations.length > 1" class="chat-space m-0 flex items-center gap-1 overflow-hidden bg-transparent p-0 text-size-2xs leading-relaxed" @click="selecting = true">
        {{ organizationName }}<text class="i-carbon-chevron-down" />
      </button>
      <text v-else-if="list.total.value">{{ list.total.value }} 个会话</text>
    </view>
    <AppEmpty v-if="discovering && !context" title="正在加载聊天空间…" icon="no-message" compact />
    <AppEmpty v-else-if="discoveryError && !context" title="聊天空间加载失败" :description="discoveryError" action-text="重新加载" @action="discoverOrganizations" />
    <AppEmpty v-else-if="!context" title="暂时没有聊天" :description="organizations.length > 1 ? '选择一个聊天空间，查看与你相关的会话。' : '与你相关的聊天会显示在这里。'" icon="no-message" />
    <AppPagedList
      v-else :items="list.items.value" item-key="id" layout="cell"
      :loading="list.loading.value" :finished="list.items.value.length >= list.total.value" :error="list.error.value"
      empty-text="暂时没有聊天" empty-description="新的聊天会显示在这里。" empty-icon="no-message" finished-text="没有更多聊天了" @retry="list.refresh"
    >
      <template #item="{ item }">
        <t-cell hover :aria-label="`${conversationTitle(item)}，${item.unread_count} 条未读`" @click="openConversation(item)">
          <template #left-icon>
            <view class="peer-avatar mr-3" :class="`peer-avatar--${item.id % 5}`">
              <t-avatar :image="conversationPeer(item)?.avatar_url || ''" :alt="conversationTitle(item)" shape="round" size="96rpx">
                {{ conversationTitle(item).slice(0, 1) }}
              </t-avatar>
            </view>
          </template>
          <template #title>
            <view class="conversation-title min-w-0 flex items-center gap-1.5">
              <text class="conversation-name overflow-hidden text-ellipsis whitespace-nowrap text-size-sm font-semibold">{{ conversationTitle(item) }}</text><text class="conversation-role shrink-0 rounded-1 bg-surface-page text-size-2xs font-normal">{{ conversationLabel(item) }}</text>
            </view>
          </template>
          <template #description>
            <text class="conversation-preview mt-1.5 block overflow-hidden text-ellipsis whitespace-nowrap text-size-xs" :class="{ 'conversation-preview--unread': item.unread_count }">{{ !item.can_send ? `${item.send_block_reason__mapping || '当前不可发送'} · ` : '' }}{{ item.last_message?.preview || '开始聊天吧' }}</text>
          </template>
          <template #note>
            <view class="conversation-tail ml-1.5 min-h-11 min-w-8 flex flex-col items-end justify-between">
              <text class="conversation-time text-size-2xs">{{ formatMessageTime(item.last_message?.created_at) }}</text><t-badge v-if="item.unread_count" :count="item.unread_count" :max-count="99" />
            </view>
          </template>
        </t-cell>
      </template>
    </AppPagedList>
    <AppBottomSheet v-model:visible="selecting" title="选择聊天空间" description="每个工作空间的会话单独展示" height="compact">
      <t-cell v-for="organization in organizations" :key="organization.slug" :title="organization.name" :note="organization.unread_count ? `${organization.unread_count} 条未读` : ''" :right-icon="organization.slug === selectedSlug ? 'check-circle' : ''" hover @click="selectOrganization(organization.slug)" />
    </AppBottomSheet>
  </view>
</template>

<style scoped lang="scss">
.conversation-list {
  --td-cell-bg-color: transparent;
  --td-cell-horizontal-padding: 40rpx;
  --td-cell-vertical-padding: 32rpx;
  --td-cell-border-color: var(--app-divider-color);
  --td-cell-border-left-space: 160rpx;
  --td-cell-border-right-space: 40rpx;
  --td-cell-right-icon-color: var(--app-color-brand);
  --td-avatar-text-font-size: 40rpx;
  --td-radius-default: 28rpx;
  --td-badge-bg-color: #ee5a55;
}
.chat-space::after {
  @apply border-0;
}
.list-heading {
  @apply text-content-muted;
}
.list-heading > text:last-child {
  @apply text-size-2xs;
}
.chat-space {
  max-width: 60%;
  @apply text-content-muted;
}
.peer-avatar {
  --td-avatar-bg-color: #f9e8e0;
  --td-avatar-content-color: #ad7055;
}
.peer-avatar--1 {
  --td-avatar-bg-color: #e5edfa;
  --td-avatar-content-color: #577bb0;
}
.peer-avatar--2 {
  --td-avatar-bg-color: #e1eee8;
  --td-avatar-content-color: #5b8873;
}
.peer-avatar--3 {
  --td-avatar-bg-color: #efeae1;
  --td-avatar-content-color: #928166;
}
.peer-avatar--4 {
  --td-avatar-bg-color: #eee7f4;
  --td-avatar-content-color: #9579ad;
}
.conversation-name {
  @apply text-content-primary;
}
.conversation-role {
  padding: 2rpx 8rpx;
  @apply text-content-muted;
}
.conversation-preview {
  @apply text-content-muted;
}
.conversation-preview--unread {
  @apply text-content-secondary;
}
.conversation-time {
  @apply text-content-muted;
}
</style>
