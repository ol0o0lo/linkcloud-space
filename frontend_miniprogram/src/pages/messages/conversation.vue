<script setup lang="ts">
import type { MessagingContext } from '@/features/messaging/types'
import type { PublicHouseDetailOut } from '@/features/houses/service'
import type { FavoriteOut } from '@/features/favorites/service'
import { onLoad, onReady } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppPage from '@/components/app/AppPage.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import MessageContent from '@/features/messaging/MessageContent.vue'
import FavoriteHousePicker from '@/features/messaging/FavoriteHousePicker.vue'
import { favoriteHouseMessage } from '@/features/messaging/message-content'
import { conversationTitle, rememberMessagingOrganization } from '@/features/messaging/context'
import { getPublicHouse } from '@/features/houses/service'
import ContactSharingSheet from '@/features/tenant-rental/ContactSharingSheet.vue'
import { useConversation } from '@/features/messaging/useConversation'
import { conversationLabel, formatMessageDay, senderInputValue, showMessageTime } from '@/features/messaging/presentation'
import { syncNotificationTabbarBadge } from '@/features/notifications/tabbar-badge'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import { useWorkspaceStore } from '@/store/workspace'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '聊天', disableScroll: true } })

const workspace = useWorkspaceStore()
const conversationId = ref(0)
const routeTenant = ref('')
const routeAccess = ref<'organization_member' | 'business_party'>('business_party')
const routeError = ref('')
const draft = ref('')
const contactVisible = ref(false)
const housePickerVisible = ref(false)
const chatHouse = ref<PublicHouseDetailOut | null>(null)
const scrollTarget = ref('')
const atBottom = ref(true)
const newMessageCount = ref(0)
const instance = getCurrentInstance()
let viewportHeight = 0
const context = computed<MessagingContext | null>(() => {
  if (!workspace.authenticated || !workspace.user?.id || !routeTenant.value || routeError.value)
    return null
  if (routeAccess.value === 'organization_member' && (workspace.navigationMode !== 'organization' || workspace.organizationSlug !== routeTenant.value))
    return null
  return { userId: workspace.user.id, accessKind: routeAccess.value, organizationSlug: routeTenant.value }
})
const chat = useConversation(context, conversationId, () => {
  void syncNotificationTabbarBadge({ userId: workspace.user?.id, mode: workspace.navigationMode, organizationSlug: workspace.organizationSlug, landlordContactId: workspace.landlordContactId })
})
const title = computed(() => chat.state.value.conversation ? conversationTitle(chat.state.value.conversation) : '聊天')
const blockedReason = computed(() => chat.state.value.conversation?.send_block_reason__mapping || '当前会话不可发送新消息')
const isHouseInquiry = computed(() => chat.state.value.conversation?.namespace === 'real_estate.inquiry')
const canShare = computed(() => isHouseInquiry.value && context.value?.accessKind === 'business_party' && Boolean(chat.state.value.conversation?.can_send))
const chatHouseId = computed(() => isHouseInquiry.value ? Number(/^listing:(\d+)$/.exec(chat.state.value.conversation?.context_key || '')?.[1] || 0) : 0)
let houseRequestVersion = 0
watch(chatHouseId, async (id) => {
  const version = ++houseRequestVersion
  chatHouse.value = null
  if (!id)
    return
  try {
    const house = await getPublicHouse(id)
    if (version === houseRequestVersion)
      chatHouse.value = house
  }
  catch {
    // 房源下架后仍允许从消息列表继续已有会话。
  }
})

function openHouse() {
  if (chatHouse.value)
    uni.navigateTo({ url: getHouseDetailRoute(chatHouse.value.id) })
}

function onContactSent() {
  void chat.refresh()
  void scrollToBottom()
}

watch(() => chat.state.value.conversation, (conversation) => {
  if (conversation && context.value?.accessKind === 'business_party')
    rememberMessagingOrganization(context.value.userId, conversation.organization.slug)
})

onLoad((options) => {
  const id = Number(options?.id)
  const organizationSlug = options?.organization_slug || ''
  const externalSlug = options?.chat_tenant_slug || ''
  if (!Number.isInteger(id) || id <= 0 || Boolean(organizationSlug) === Boolean(externalSlug)) {
    routeError.value = '聊天地址无效，请从消息列表重新进入'
    return
  }
  conversationId.value = id
  routeTenant.value = organizationSlug || externalSlug
  routeAccess.value = organizationSlug ? 'organization_member' : 'business_party'
})

function measureTimeline() {
  uni.createSelectorQuery().in(instance?.proxy).select('.chat-timeline').boundingClientRect((rect) => {
    if (rect && !Array.isArray(rect))
      viewportHeight = rect.height
  }).exec()
}

onReady(measureTimeline)
watch([chatHouse, () => chat.state.value.conversation?.can_send], () => nextTick(measureTimeline))

async function onComposerResize() {
  await nextTick()
  measureTimeline()
  if (atBottom.value)
    void scrollToBottom()
}

function onDraftChange(event: unknown) {
  draft.value = senderInputValue(event)
  void onComposerResize()
}

function memberAvatar(memberId: number) {
  return chat.state.value.conversation?.members.find(member => member.id === memberId)?.avatar_url || ''
}

function memberName(memberId: number) {
  return chat.state.value.conversation?.members.find(member => member.id === memberId)?.display_name || '我'
}

function messageTimeLabel(value: string) {
  return `${formatMessageDay(value)} ${new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

function sendFavoriteHouse(favorite: FavoriteOut) {
  const message = favoriteHouseMessage(favorite)
  if (message && chat.sendHouse(message.payload, message.media)) {
    housePickerVisible.value = false
    void scrollToBottom()
  }
  else {
    uni.showToast({ title: '当前无法发送该房源，请稍后重试', icon: 'none' })
  }
}

async function scrollToBottom() {
  scrollTarget.value = ''
  await nextTick()
  scrollTarget.value = 'chat-bottom'
  atBottom.value = true
  newMessageCount.value = 0
  await nextTick()
  chat.setAtBottom(true)
}

watch(() => chat.state.value.messages, (messages, previous) => {
  const newest = messages[messages.length - 1]?.seq || 0
  const previousNewest = previous?.[previous.length - 1]?.seq || 0
  if (atBottom.value)
    void scrollToBottom()
  else if (newest > previousNewest)
    newMessageCount.value += messages.filter(message => message.seq > previousNewest).length
})
watch(() => chat.state.value.pending, () => {
  if (atBottom.value)
    void scrollToBottom()
})
watch(context, () => {
  draft.value = ''
  contactVisible.value = false
  housePickerVisible.value = false
  atBottom.value = true
  newMessageCount.value = 0
})

function onScroll(event: { detail: { scrollTop: number, scrollHeight: number } }) {
  if (!viewportHeight)
    return
  const bottom = event.detail.scrollHeight - event.detail.scrollTop - viewportHeight <= 4
  atBottom.value = bottom
  chat.setAtBottom(bottom)
  if (bottom)
    newMessageCount.value = 0
}

async function loadHistory() {
  if (!chat.state.value.hasMore || chat.state.value.historyLoading)
    return
  atBottom.value = false
  chat.setAtBottom(false)
  const anchor = chat.state.value.messages[0]?.seq
  await chat.loadHistory()
  if (anchor) {
    scrollTarget.value = ''
    await nextTick()
    scrollTarget.value = `message-${anchor}`
  }
}

function send() {
  if (draft.value.trim().length > 2000) {
    uni.showToast({ title: '每条消息最多 2000 字', icon: 'none' })
    return
  }
  if (chat.send(draft.value)) {
    draft.value = ''
    void scrollToBottom()
  }
}
</script>

<template>
  <AppPage class="conversation-page" gutter="none">
    <template #navigation>
      <AppCustomNavigation :title="title" :subtitle="chat.state.value.conversation ? `${conversationLabel(chat.state.value.conversation)} · ${chat.state.value.conversation.organization.name}` : ''" back :fallback-url="APP_ROUTES.messages" />
    </template>
    <AppEmpty v-if="routeError || !context" title="无法打开聊天" :description="routeError || '当前账号或工作空间已切换，请从消息列表重新进入。'" icon="no-message" />
    <view v-else class="conversation-layout h-full min-h-0 flex flex-col">
      <view v-if="chatHouse" class="chat-house m-0 flex shrink-0 items-center gap-2.5 border-b-hairline border-b-app-divider border-b-solid bg-surface-card px-4 py-3">
        <HouseCard :house="chatHouse" variant="compact" @click="openHouse" />
      </view>
      <view v-if="chat.state.value.error" class="chat-error bg-surface-warm-soft px-4 py-2.5 text-size-xs" @click="chat.refresh()">
        {{ chat.state.value.error }} · 点击重试
      </view>
      <scroll-view class="chat-timeline box-border h-0 min-h-0 flex-1" scroll-y :scroll-into-view="scrollTarget" :scroll-with-animation="false" :upper-threshold="80" :lower-threshold="4" @scroll="onScroll" @scrolltoupper="loadHistory" @scrolltolower="chat.setAtBottom(true)">
        <view class="history-control p-3 text-center text-size-2xs">
          <wd-button v-if="chat.state.value.hasMore" size="small" variant="text" :loading="chat.state.value.historyLoading" @click="loadHistory">
            加载更早消息
          </wd-button>
          <text v-else>{{ chat.state.value.loading ? '正在加载消息…' : '已显示全部历史' }}</text>
        </view>
        <view v-for="(message, index) in chat.state.value.messages" :id="`message-${message.seq}`" :key="message.seq" class="message-item">
          <view v-if="showMessageTime(message.created_at, chat.state.value.messages[index - 1]?.created_at)" class="message-time px-3 py-2.5 text-center text-size-2xs">
            {{ messageTimeLabel(message.created_at) }}
          </view>
          <view class="chat-bubble px-4 py-1.5" :class="{ 'chat-bubble--mine': message.sender_member_id === chat.state.value.conversation?.my_member_id }">
            <view class="chat-bubble__row flex items-start gap-3">
              <t-avatar :image="memberAvatar(message.sender_member_id)" :alt="memberName(message.sender_member_id)" shape="round" size="68rpx">
                {{ memberName(message.sender_member_id).slice(0, 1) }}
              </t-avatar>
              <view class="chat-bubble__message min-w-0 flex-1">
                <MessageContent :message="message" :placement="message.sender_member_id === chat.state.value.conversation?.my_member_id ? 'right' : 'left'" />
              </view>
            </view>
          </view>
        </view>
        <view v-for="message in chat.state.value.pending" :key="message.client_message_id" class="message-item">
          <view class="chat-bubble chat-bubble--mine px-4 py-1.5">
            <view class="chat-bubble__row flex items-start gap-3">
              <t-avatar :image="memberAvatar(chat.state.value.conversation?.my_member_id || 0)" shape="round" size="68rpx">
                我
              </t-avatar>
              <view class="chat-bubble__message min-w-0 flex-1">
                <MessageContent :message="message" placement="right" />
              </view>
            </view>
            <view class="pending-status mb-0 ml-0 mr-11.5 mt-1 flex flex-col items-end text-size-2xs">
              <text v-if="message.state === 'sending'">发送中…</text>
              <wd-button v-else size="small" variant="text" type="danger" @click="chat.retry(message.client_message_id)">
                发送失败 · 点击重试
              </wd-button>
              <text v-if="message.error" class="pending-error max-w-full text-size-2xs">{{ message.error }}</text>
            </view>
          </view>
        </view>
        <AppEmpty v-if="!chat.state.value.loading && !chat.state.value.error && !chat.state.value.messages.length && !chat.state.value.pending.length" title="开始聊天吧" description="发送第一条消息，开启沟通。" icon="no-message" compact />
        <view id="chat-bottom" class="chat-bottom h-3.5" />
      </scroll-view>
      <view v-if="newMessageCount" class="new-messages flex items-center justify-center gap-1.5 border-t-hairline border-t-app-divider border-t-solid bg-surface-card p-2.5 text-size-xs" @click="scrollToBottom">
        {{ newMessageCount }} 条新消息<text class="i-carbon-arrow-down" />
      </view>
      <view v-if="chat.state.value.conversation && !chat.state.value.conversation.can_send" class="chat-blocked bg-surface-warm-soft px-4 py-2.5 text-size-xs">
        {{ blockedReason }}
      </view>
      <view class="composer-area shrink-0 border-t-hairline border-t-app-divider border-t-solid bg-surface-card">
        <t-chat-sender :value="draft" placeholder="输入消息…" :render-presets="[{ name: 'send', type: 'icon' }]" :textarea-props="{ autosize: { minHeight: 48, maxHeight: 200 } }" :disabled="!chat.state.value.conversation?.can_send || chat.state.value.loading" :auto-rise-with-keyboard="true" @change="onDraftChange" @send="send" @keyboardheightchange="onComposerResize">
          <template #footer-prefix>
            <button v-if="canShare" class="chat-contact-shortcut m-0 h-7 w-7 flex items-center justify-center bg-transparent p-0 text-size-xl" aria-label="发送联系方式" @click="contactVisible = true">
              <text class="i-carbon-identification" />
            </button>
            <button v-if="chat.state.value.conversation?.can_send" class="chat-contact-shortcut m-0 h-7 w-7 flex items-center justify-center bg-transparent p-0 text-size-xl" aria-label="发送收藏房源" @click="housePickerVisible = true">
              <text class="i-carbon-home" />
            </button>
          </template>
        </t-chat-sender>
        <text v-if="draft.length > 1800" class="draft-count mt-1 block text-right text-size-2xs" :class="{ 'draft-count--over': draft.trim().length > 2000 }">{{ draft.length }} / 2000</text>
      </view>
    </view>
    <ContactSharingSheet v-if="canShare && chat.state.value.conversation" v-model:visible="contactVisible" :conversation="chat.state.value.conversation" @sent="onContactSent" />
    <FavoriteHousePicker v-if="chat.state.value.conversation?.can_send" v-model:visible="housePickerVisible" :conversation-id="conversationId" @select="sendFavoriteHouse" />
  </AppPage>
</template>

<style scoped>
.conversation-page {
  @apply flex h-screen;
  height: 100dvh;
  @apply flex-col overflow-hidden bg-surface-card;
  --td-brand-color: var(--app-color-brand);
  --td-text-color-primary: var(--app-text-primary);
}
.conversation-page :deep(.app-page__content) {
  @apply flex-1 min-h-0 overflow-hidden;
}
.chat-timeline {
  background: #f7f9fc;
}
.history-control {
  @apply text-content-muted;
}
.message-time {
  @apply text-content-muted;
}
.chat-bubble {
  --td-bg-color-secondarycontainer: var(--app-bg-card);
  --td-radius-extraLarge: 22rpx;
  --td-avatar-bg-color: #e5edf7;
  --td-avatar-content-color: #577bb0;
  --td-radius-default: 22rpx;
}
.chat-bubble--mine {
  --td-bg-color-secondarycontainer: var(--app-color-brand);
  --td-chat-content-user-text-color: #fff;
}
.chat-bubble :deep(.t-chat-message__content) {
  @apply flex-initial w-auto max-w-full;
}
.chat-bubble--mine .chat-bubble__row {
  @apply flex-row-reverse;
}
.chat-bubble :deep(.t-chat-message__detail) {
  @apply max-w-full;
}
.chat-bubble :deep(.t-chat-content) {
  @apply py-2.5 px-3 text-size-sm leading-relaxed;
}
.pending-status {
  @apply text-content-muted;
}
.pending-error {
  @apply text-app-danger;
}
.chat-error,
.chat-blocked {
  @apply text-content-secondary;
}
.new-messages {
  @apply text-app-brand;
}
.composer-area {
  @apply pt-2.5 px-3.5;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}
.composer-area :deep(.t-chat-sender) {
  @apply m-0 border-0 rounded-3 py-2 px-0 shadow-none bg-surface-page;
}
.composer-area :deep(.t-chat-sender__actions) {
  @apply flex-row items-end gap-2 py-0 px-2.5;
}
.composer-area :deep(.t-chat-sender__textarea),
.composer-area :deep(.t-chat-sender__textarea--control) {
  @apply pb-0;
}
.composer-area :deep(.t-chat-sender__textarea--control),
.composer-area :deep(.t-chat-sender__textarea--placeholder) {
  @apply text-size-sm;
}
.composer-area :deep(.t-chat-sender__footer) {
  @apply shrink-0 gap-1.5 items-center;
}
.chat-contact-shortcut {
  @apply text-app-brand;
}
.chat-contact-shortcut::after {
  @apply border-0;
}
.draft-count {
  @apply text-content-muted;
}
.draft-count--over {
  @apply text-app-danger;
}
.chat-house :deep(.house-card) {
  @apply w-full border-0 shadow-none bg-transparent;
}
</style>
