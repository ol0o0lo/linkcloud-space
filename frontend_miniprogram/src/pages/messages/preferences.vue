<script setup lang="ts">
import type { NotificationChannel } from '@/domain/notifications'
import type { NotificationPreferenceOut } from '@/features/notifications/service'
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { isRequiredNotificationChannel } from '@/domain/notifications'
import { listNotificationPreferences, updateNotificationPreference } from '@/features/notifications/service'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'

definePage({ style: { navigationBarTitleText: '通知设置', navigationStyle: 'custom' } })

const items = ref<NotificationPreferenceOut[]>([])
const loading = ref(true)
const loadError = ref('')
const savingKey = ref('')

async function loadPreferences() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = await listNotificationPreferences()
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '通知设置加载失败'
  }
  finally {
    loading.value = false
  }
}

async function changeChannel(item: NotificationPreferenceOut, channel: NotificationChannel, value: boolean | string | number) {
  const checked = Boolean(value)
  if (isRequiredNotificationChannel(item, channel))
    return
  const previous = item[channel]
  item[channel] = checked
  savingKey.value = `${item.key}:${channel}`
  try {
    Object.assign(item, await updateNotificationPreference(item.key, { [channel]: checked }))
  }
  catch (error) {
    item[channel] = previous
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  }
  finally {
    savingKey.value = ''
  }
}

onShow(() => void loadPreferences())
</script>

<template>
  <AppPage variant="list" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="通知设置" back scroll-mode="sticky" />
    </template>
    <view class="preferences-page box-border bg-surface-page p-5 min-h-inherit">
      <AppLoading v-if="loading" text="正在加载通知设置…" />
      <AppErrorView v-else-if="loadError" title="加载失败" :message="loadError" @retry="loadPreferences" />
      <AppEmpty
        v-else-if="!items.length"
        title="当前没有可配置的通知类别"
        description="管理员开放新的通知类别后，会在这里显示接收渠道设置。"
        icon="no-message"
      />
      <template v-else>
        <AppNotice
          class="preference-notice"
          title="按类别管理"
          description="站内信用于关键业务提醒，必选渠道不能关闭；其他渠道修改后立即保存。"
          compact
        />
        <view class="preference-list flex flex-col gap-2.5">
          <view v-for="item in items" :key="item.key" class="preference-card overflow-hidden rounded-4 bg-surface-card">
            <view class="preference-heading flex flex-col gap-1 border-b-hairline border-b-app-divider border-b-solid p-3.5">
              <strong>{{ item.label }}</strong>
              <text>{{ item.description || '按需选择接收渠道' }}</text>
            </view>
            <view class="channel-row flex items-center justify-between border-b-hairline border-b-app-divider border-b-solid px-3.5 py-3">
              <view><strong>站内信</strong><text>{{ isRequiredNotificationChannel(item, 'in_app') ? '关键业务消息 · 必选' : '可按需关闭' }}</text></view>
              <wd-switch :model-value="isRequiredNotificationChannel(item, 'in_app') || item.in_app" :disabled="isRequiredNotificationChannel(item, 'in_app')" :loading="savingKey === `${item.key}:in_app`" @change="({ value }) => changeChannel(item, 'in_app', value)" />
            </view>
            <view class="channel-row flex items-center justify-between border-b-hairline border-b-app-divider border-b-solid px-3.5 py-3">
              <view><strong>邮件</strong><text>{{ isRequiredNotificationChannel(item, 'email') ? '关键业务消息 · 必选' : savingKey === `${item.key}:email` ? '正在保存' : '发送到已绑定邮箱' }}</text></view>
              <wd-switch :model-value="isRequiredNotificationChannel(item, 'email') || item.email" :disabled="isRequiredNotificationChannel(item, 'email')" :loading="savingKey === `${item.key}:email`" @change="({ value }) => changeChannel(item, 'email', value)" />
            </view>
          </view>
        </view>
      </template>
    </view>
  </AppPage>
</template>

<style scoped>
.preference-notice {
  @apply mb-4;
}
.preference-heading strong,
.channel-row strong {
  @apply text-content-primary text-size-sm;
}
.preference-heading text,
.channel-row text {
  @apply text-content-muted text-size-2xs;
}
.channel-row:last-child {
  @apply border-b-0;
}
.channel-row > view {
  @apply flex flex-col gap-0.5;
}
</style>
