<script setup lang="ts">
import type { NotificationOut } from '@/features/notifications/service'
import type { AppModeSelection } from '@/domain/app-mode'
import { onLoad } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { getNotificationCategoryPresentation, getNotificationTone, resolveNotificationAction, resolveNotificationScope } from '@/domain/notifications'
import { getNotification, removeNotification, updateNotificationReadState } from '@/features/notifications/service'
import { syncNotificationTabbarBadge } from '@/features/notifications/tabbar-badge'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import { APP_ROUTES, getOrganizationCustomerDetailRoute } from '@/modules/routes'
import { convertOrganizationInquiry } from '@/services/manual/organization-customers'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '通知详情', navigationStyle: 'custom' } })

const appContextStore = useAppContextStore()
const notificationId = ref(0)
const notification = ref<NotificationOut | null>(null)
const notificationWorkspace = ref<AppModeSelection>()
const loading = ref(true)
const loadError = ref('')
const conversionVisible = ref(false)
const converting = ref(false)
const convertedCustomerId = ref(0)
const conversionForm = reactive({ name: '', phone: '' })
const canConvert = computed(() => notification.value?.category === 'house.contact' && notificationWorkspace.value?.mode === 'organization')
const category = computed(() => getNotificationCategoryPresentation(notification.value?.category || ''))
const action = computed(() => notification.value
  ? resolveNotificationAction({
      category: notification.value.category,
      data: notification.value.data,
      targetType: notification.value.target_type,
      targetId: notification.value.target_id,
      url: notification.value.url,
      expiresAt: notification.value.expires_at,
      workspace: notificationWorkspace.value,
    })
  : null)

function currentScope() {
  return resolveNotificationScope({ mode: appContextStore.navigationMode, organizationSlug: appContextStore.currentOrganization?.slug, landlordContactId: appContextStore.currentLandlordRelationship?.contact_id })
}

async function loadNotification() {
  loading.value = true
  loadError.value = ''
  try {
    const scope = currentScope()
    notificationWorkspace.value = scope.kind === 'organization'
      ? { mode: 'organization', organizationSlug: scope.organizationSlug }
      : scope.kind === 'landlord' ? { mode: 'landlord', landlordContactId: scope.landlordContactId } : { mode: 'personal' }
    const result = await getNotification(scope, notificationId.value)
    notification.value = result.is_read ? result : await updateNotificationReadState(scope, result.id, true)
    const customerContactId = Number(result.data.customer_contact_id)
    convertedCustomerId.value = Number.isInteger(customerContactId) && customerContactId > 0 ? customerContactId : 0
    if (!result.is_read) {
      void syncNotificationTabbarBadge({
        userId: appContextStore.user?.id,
        mode: appContextStore.navigationMode,
        organizationSlug: appContextStore.currentOrganization?.slug,
        landlordContactId: appContextStore.currentLandlordRelationship?.contact_id,
      })
    }
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '消息加载失败'
  }
  finally {
    loading.value = false
  }
}

function openTarget() {
  const target = action.value
  if (!target)
    return
  if (target.kind === 'external') {
    // #ifdef H5
    window.location.assign(target.url)
    // #endif
    // #ifndef H5
    uni.setClipboardData({ data: target.url, success: () => uni.showToast({ title: '链接已复制', icon: 'success' }) })
    // #endif
    return
  }
  uni.navigateTo({ url: target.route })
}

function copyContact(value: unknown) {
  if (typeof value !== 'string' || !value)
    return
  uni.setClipboardData({ data: value, success: () => uni.showToast({ title: '已复制', icon: 'success' }) })
}

function openConversion() {
  if (convertedCustomerId.value) {
    uni.navigateTo({ url: getOrganizationCustomerDetailRoute(convertedCustomerId.value) })
    return
  }
  const data = notification.value?.data
  conversionForm.name = typeof data?.customer_name === 'string' ? data.customer_name : notification.value?.actor?.full_name || ''
  conversionForm.phone = typeof data?.phone === 'string' ? data.phone : ''
  conversionVisible.value = true
}

async function convertInquiry() {
  const workspace = notificationWorkspace.value
  if (converting.value || !canConvert.value || workspace?.mode !== 'organization')
    return
  if (!conversionForm.name.trim() || !conversionForm.phone.trim()) {
    uni.showToast({ title: '请补充客户姓名和手机号', icon: 'none' })
    return
  }
  converting.value = true
  try {
    const customer = await convertOrganizationInquiry(workspace.organizationSlug, notificationId.value, { name: conversionForm.name.trim(), phone: conversionForm.phone.trim() })
    convertedCustomerId.value = customer.id
    conversionVisible.value = false
    uni.showToast({ title: '已转为客户', icon: 'success' })
    uni.navigateTo({ url: getOrganizationCustomerDetailRoute(customer.id) })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '转为客户失败', icon: 'none' })
  }
  finally { converting.value = false }
}

function deleteCurrent() {
  uni.showModal({
    title: '删除消息',
    content: '删除后无法在消息中心恢复，确认继续吗？',
    success: async ({ confirm }) => {
      if (!confirm)
        return
      try {
        await removeNotification(currentScope(), notificationId.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 350)
      }
      catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : '删除失败', icon: 'none' })
      }
    },
  })
}

onLoad((options) => {
  notificationId.value = Number(options?.id || 0)
  if (!notificationId.value) {
    loadError.value = '消息参数不正确'
    loading.value = false
    return
  }
  void loadNotification()
})
</script>

<template>
  <AppDetailPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载消息…"
    error-title="消息加载失败"
    :show-actions="Boolean(notification)"
    @retry="loadNotification"
  >
    <template #navigation>
      <AppCustomNavigation title="通知详情" back scroll-mode="sticky" :fallback-url="APP_ROUTES.notifications" />
    </template>
    <template v-if="notification">
      <view class="message-hero mx-app-gutter my-0 app-card-plain p-4">
        <view class="message-hero__topline flex items-center justify-between">
          <view class="message-hero__icon h-11.5 w-11.5 flex items-center justify-center rounded-3.5 bg-surface-brand-soft text-size-2xl text-app-brand" :class="category.icon" />
          <AppStatusTag :text="notification.is_read ? '已读' : '未读'" :tone="getNotificationTone(notification.is_read)" />
        </view>
        <view class="message-hero__title mt-3.5 text-size-lg text-content-primary font-bold">
          {{ notification.title || '无标题通知' }}
        </view>
        <view class="message-hero__meta mt-2 text-size-xs text-content-muted">
          {{ category.label }} · {{ new Date(notification.created_at).toLocaleString() }}
        </view>
      </view>
      <view class="message-body mx-app-gutter my-0 box-border min-h-31 whitespace-pre-wrap app-card-plain px-4 py-4.5 text-size-sm text-content-secondary leading-loose">
        {{ notification.body || '暂无正文' }}
      </view>
      <view v-if="notification.category === 'house.contact'" class="message-contact mx-app-gutter my-0 app-card-plain px-4 pb-1.5 pt-3.5">
        <view class="message-section-title mb-3 text-size-sm text-content-primary font-bold">
          租客联系方式
        </view>
        <view v-if="notification.data.phone" class="message-row min-h-9.5 flex items-center justify-between border-t-hairline border-t-app-divider border-t-solid text-size-xs text-content-secondary">
          <text>手机号</text><button @click="copyContact(notification.data.phone)">
            {{ notification.data.phone }} · 复制
          </button>
        </view>
        <view v-if="notification.data.wechat" class="message-row min-h-9.5 flex items-center justify-between border-t-hairline border-t-app-divider border-t-solid text-size-xs text-content-secondary">
          <text>微信号</text><button @click="copyContact(notification.data.wechat)">
            {{ notification.data.wechat }} · 复制
          </button>
        </view>
        <view v-if="canConvert" class="py-3">
          <wd-button block variant="soft" @click="openConversion">
            {{ convertedCustomerId ? '查看客户' : '转为客户' }}
          </wd-button>
        </view>
      </view>
      <view v-if="notification.actor" class="message-source mx-app-gutter my-0 app-card-plain px-4 pb-1.5 pt-3.5">
        <view class="message-section-title mb-3 text-size-sm text-content-primary font-bold">
          消息来源
        </view>
        <view class="message-row min-h-9.5 flex items-center justify-between border-t-hairline border-t-app-divider border-t-solid text-size-xs text-content-secondary">
          <text>发起人</text><strong>{{ notification.actor.full_name || notification.actor.username }}</strong>
        </view>
      </view>
      <view class="message-note mx-app-gutter my-0 flex gap-3 border-hairline border-app-border-brand-soft rounded-3.5 border-solid bg-surface-brand-soft px-3.5 py-3.5">
        <view class="message-note__bar w-1 flex-none basis-1 rounded-full bg-app-brand" />
        <view><strong>{{ action ? '可继续处理' : '消息说明' }}</strong><text>{{ action ? `此消息关联业务记录，可通过下方“${action.label}”继续处理。` : '该消息仅用于告知，目前没有可继续处理的业务操作。' }}</text></view>
      </view>
    </template>

    <template #actions>
      <view class="grid w-full gap-2" :class="action ? 'grid-cols-2' : 'grid-cols-1'">
        <wd-button block type="danger" variant="plain" @click="deleteCurrent">
          删除
        </wd-button>
        <wd-button v-if="action" block @click="openTarget">
          {{ action.label }}
        </wd-button>
      </view>
    </template>
    <template #overlay>
      <AppBottomSheet v-model:visible="conversionVisible" title="转为客户" description="确认客户姓名和手机号，保存后可继续跟进需求。" height="compact">
        <wd-cell title="客户姓名" center>
          <wd-input v-model="conversionForm.name" placeholder="请补充客户姓名" clearable compact align-right />
        </wd-cell>
        <wd-cell title="手机号" center>
          <wd-input v-model="conversionForm.phone" type="tel" placeholder="请补充手机号" clearable compact align-right />
        </wd-cell>
        <template #footer>
          <wd-button block :loading="converting" :disabled="converting" @click="convertInquiry">
            保存并查看客户
          </wd-button>
        </template>
      </AppBottomSheet>
    </template>
  </AppDetailPage>
</template>

<style scoped>
.message-row strong {
  @apply text-content-primary font-medium;
}
.message-row button {
  @apply m-0 p-0 text-app-brand text-size-xs leading-normal bg-transparent;
}
.message-row button::after {
  @apply border-0;
}
.message-note > view:last-child {
  @apply flex flex-col gap-1.5;
}
.message-note strong {
  @apply text-content-primary text-size-sm;
}
.message-note text {
  @apply text-content-secondary text-size-xs leading-relaxed;
}
</style>
