<script setup lang="ts">
import type { ReferralRecordOut, ReferralSummaryOut } from '@/features/account/service'
import { ref } from 'vue'
import { getReferralStatusLabel } from '@/domain/personal-account'
import { getReferralRecords, getReferralSummary } from '@/features/account/service'
import AppNotice from '@/components/app/AppNotice.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { usePagedPage } from '@/hooks/usePagedPage'

definePage({ style: { navigationBarTitleText: '邀请好友', navigationStyle: 'custom', enablePullDownRefresh: true } })

const summary = ref<ReferralSummaryOut | null>(null)
const referralPage = usePagedPage<ReferralRecordOut>({
  loader: async ({ page, pageSize }) => {
    const [nextSummary, records] = await Promise.all([
      page === 1 || !summary.value ? getReferralSummary() : Promise.resolve(summary.value),
      getReferralRecords(page, pageSize),
    ])
    summary.value = nextSummary
    return records
  },
  pageSize: 20,
  keyOf: item => item.id,
})

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function copyValue(value: string | null, emptyMessage: string) {
  if (!value) {
    uni.showToast({ title: emptyMessage, icon: 'none' })
    return
  }
  uni.setClipboardData({ data: value })
}
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="邀请好友" back scroll-mode="sticky" />
    </template>
    <template v-if="summary">
      <view class="referral-summary overflow-hidden app-card p-3.5">
        <view class="metric-grid grid grid-cols-3 gap-2">
          <view class="metric-card min-w-0 flex flex-col items-center gap-1 rounded-3 px-1.5 py-3">
            <strong>{{ summary.registered_count }}</strong><text>邀请注册</text>
          </view>
          <view class="metric-card metric-card--success min-w-0 flex flex-col items-center gap-1 rounded-3 px-1.5 py-3">
            <strong>{{ summary.pending_review_count }}</strong><text>待审核</text>
          </view>
          <view class="metric-card metric-card--reward min-w-0 flex flex-col items-center gap-1 rounded-3 px-1.5 py-3">
            <strong>{{ summary.rewarded_count }}</strong><text>已奖励</text>
          </view>
        </view>
        <view class="invite-code-row mt-3 flex items-center justify-between border-t-hairline border-t-app-border border-t-solid pt-3">
          <view><text>邀请码</text><strong>{{ summary.allow_code ? (summary.invite_code || '未生成') : '已关闭' }}</strong></view>
          <button :disabled="!summary.allow_code" @click="copyValue(summary.invite_code, '暂无邀请码')">
            <view class="i-carbon-copy" />复制
          </button>
        </view>
      </view>

      <view class="share-card mt-3 flex app-touchable items-center gap-2.5 rounded-4 bg-surface-card p-3.5" :class="{ 'share-card--disabled': !summary.allow_link }" @click="summary.allow_link && copyValue(summary.share_link, '暂无邀请链接')">
        <view class="share-card__icon h-10.5 w-10.5 flex flex-none basis-10.5 items-center justify-center rounded-3 text-size-lg">
          <view class="i-carbon-link" />
        </view>
        <view class="share-card__copy min-w-0 flex flex-1 flex-col gap-1">
          <strong>邀请链接</strong>
          <text v-if="summary.allow_link">{{ summary.share_link || '邀请链接尚未生成' }}</text>
          <text v-else>当前账号未开放链接邀请</text>
        </view>
        <view v-if="summary.allow_link" class="share-card__action flex flex-none items-center gap-1 text-size-2xs text-app-brand font-semibold">
          <view class="i-carbon-copy" /><text>复制</text>
        </view>
        <wd-tag v-else variant="light">
          已关闭
        </wd-tag>
      </view>

      <AppNotice
        v-if="!summary.allow_code || !summary.allow_link"
        class="channel-notice"
        tone="warning"
        title="部分邀请渠道不可用"
        description="已关闭的邀请渠道不提供复制入口，开放状态以当前账号配置为准。"
        compact
      />
    </template>

    <view class="mb-2 ml-1 mr-1 mt-4 text-xs text-content-secondary font-semibold">
      邀请记录（{{ referralPage.total.value }}）
    </view>
    <AppPagedList
      :items="referralPage.items.value"
      item-key="id"
      :loading="referralPage.loading.value"
      :refreshing="referralPage.refreshing.value"
      :loading-more="referralPage.loadingMore.value"
      :finished="referralPage.finished.value"
      :error="referralPage.error.value"
      loading-text="正在加载推广记录…"
      empty-text="还没有邀请记录"
      empty-description="通过邀请码或邀请链接完成注册后，处理进度会显示在这里。"
      empty-icon="no-content"
      finished-text="没有更多推广记录了"
      @retry="referralPage.refresh"
    >
      <template #item="{ item }">
        <AppRecordCard>
          <template #title>
            {{ item.invitee_display }}
          </template>
          <template #status>
            <wd-tag variant="light" size="small">
              {{ getReferralStatusLabel(item.status, item.status__mapping) }}
            </wd-tag>
          </template>
          <template #meta>
            {{ formatDateTime(item.created_at) }}
          </template>
        </AppRecordCard>
      </template>
    </AppPagedList>
  </AppPage>
</template>

<style scoped>
.metric-card {
  border: 1rpx solid #dfe9f7;
  background: #fbfdff;
}
.metric-card strong {
  color: #176fdb;
  @apply text-size-lg leading-tight;
}
.metric-card text {
  @apply text-content-muted text-size-2xs;
}
.metric-card--success strong {
  color: #159d77;
}
.metric-card--reward strong {
  color: #d98200;
}
.invite-code-row > view {
  @apply flex min-w-0 items-center gap-3;
}
.invite-code-row text {
  @apply text-content-muted text-size-2xs;
}
.invite-code-row strong {
  @apply overflow-hidden text-content-primary text-size-sm text-ellipsis whitespace-nowrap;
}
.invite-code-row button {
  @apply flex min-w-19 m-0 py-0 px-3 items-center justify-center gap-1.5 border-hairline border-solid border-app-brand rounded-2.5 text-app-brand text-size-xs font-semibold leading-8.5 bg-white;
}
.invite-code-row button[disabled] {
  @apply border-app-border text-content-muted bg-surface-page;
}
.invite-code-row button::after {
  @apply border-0;
}
.share-card__icon {
  color: #176fdb;
  background: #eaf3ff;
}
.share-card__icon > view {
  @apply w-4.5 h-4.5;
}
.share-card__copy strong {
  @apply text-content-primary text-size-sm;
}
.share-card__copy text {
  @apply overflow-hidden text-content-muted text-size-2xs text-ellipsis whitespace-nowrap;
}
.share-card--disabled {
  @apply cursor-default;
}
.channel-notice {
  @apply mt-3;
}
</style>
