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
      <view class="referral-summary app-card">
        <view class="metric-grid">
          <view class="metric-card">
            <strong>{{ summary.registered_count }}</strong><text>邀请注册</text>
          </view>
          <view class="metric-card metric-card--success">
            <strong>{{ summary.pending_review_count }}</strong><text>待审核</text>
          </view>
          <view class="metric-card metric-card--reward">
            <strong>{{ summary.rewarded_count }}</strong><text>已奖励</text>
          </view>
        </view>
        <view class="invite-code-row">
          <view><text>邀请码</text><strong>{{ summary.allow_code ? (summary.invite_code || '未生成') : '已关闭' }}</strong></view>
          <button :disabled="!summary.allow_code" @click="copyValue(summary.invite_code, '暂无邀请码')">
            <view class="i-carbon-copy" />复制
          </button>
        </view>
      </view>

      <view class="share-card app-touchable" :class="{ 'share-card--disabled': !summary.allow_link }" @click="summary.allow_link && copyValue(summary.share_link, '暂无邀请链接')">
        <view class="share-card__icon">
          <view class="i-carbon-link" />
        </view>
        <view class="share-card__copy">
          <strong>邀请链接</strong>
          <text v-if="summary.allow_link">{{ summary.share_link || '邀请链接尚未生成' }}</text>
          <text v-else>当前账号未开放链接邀请</text>
        </view>
        <view v-if="summary.allow_link" class="share-card__action">
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

<style scoped lang="scss">
.referral-summary {
  overflow: hidden;
  padding: 26rpx;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}
.metric-card {
  display: flex;
  min-width: 0;
  padding: 24rpx 10rpx;
  align-items: center;
  flex-direction: column;
  gap: 8rpx;
  border: 1rpx solid #dfe9f7;
  border-radius: 24rpx;
  background: #fbfdff;
}
.metric-card strong {
  color: #176fdb;
  font-size: 36rpx;
  line-height: 1.2;
}
.metric-card text {
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.metric-card--success strong {
  color: #159d77;
}
.metric-card--reward strong {
  color: #d98200;
}
.invite-code-row {
  display: flex;
  margin-top: 24rpx;
  padding-top: 24rpx;
  align-items: center;
  justify-content: space-between;
  border-top: 1rpx solid var(--app-border-color);
}
.invite-code-row > view {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 24rpx;
}
.invite-code-row text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.invite-code-row strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 30rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.invite-code-row button {
  display: flex;
  min-width: 150rpx;
  margin: 0;
  padding: 0 24rpx;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  border: 1rpx solid var(--app-color-brand);
  border-radius: 20rpx;
  color: var(--app-color-brand);
  font-size: 23rpx;
  font-weight: 600;
  line-height: 68rpx;
  background: #fff;
}
.invite-code-row button[disabled] {
  border-color: var(--app-border-color);
  color: var(--app-text-muted);
  background: var(--app-bg-page);
}
.invite-code-row button::after {
  border: 0;
}
.share-card {
  display: flex;
  margin-top: 24rpx;
  padding: 28rpx;
  align-items: center;
  gap: 20rpx;
  border-radius: 30rpx;
  background: var(--app-bg-card);
}
.share-card__icon {
  display: flex;
  width: 82rpx;
  height: 82rpx;
  flex: 0 0 82rpx;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  color: #176fdb;
  font-size: 36rpx;
  background: #eaf3ff;
}
.share-card__icon > view {
  width: 36rpx;
  height: 36rpx;
}
.share-card__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.share-card__copy strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.share-card__copy text {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.share-card__action {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7rpx;
  color: var(--app-color-brand);
  font-size: 22rpx;
  font-weight: 600;
}
.share-card--disabled {
  cursor: default;
}
.channel-notice {
  margin-top: 24rpx;
}
</style>
