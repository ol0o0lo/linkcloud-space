<script setup lang="ts">
import type { ReferralRecordOut, ReferralSummaryOut } from '@/features/account/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getReferralStatusLabel } from '@/domain/personal-account'
import { getReferralRecords, getReferralSummary } from '@/features/account/service'
import AppListState from '@/shared/components/AppListState.vue'

definePage({ style: { navigationBarTitleText: '我的推广', enablePullDownRefresh: true } })

const summary = ref<ReferralSummaryOut | null>(null)
const items = ref<ReferralRecordOut[]>([])
const page = ref(1)
const pageSize = 20
const total = ref(0)
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

async function loadData(reset = false) {
  if (loading.value || (!reset && finished.value))
    return
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  loadError.value = ''
  try {
    const [nextSummary, records] = await Promise.all([
      reset || !summary.value ? getReferralSummary() : Promise.resolve(summary.value),
      getReferralRecords(page.value, pageSize),
    ])
    summary.value = nextSummary
    items.value = reset ? records.items : [...items.value, ...records.items]
    total.value = records.total
    finished.value = items.value.length >= records.total || records.items.length < pageSize
    if (!finished.value)
      page.value += 1
  }
  catch {
    loadError.value = '推广记录加载失败，请稍后重试'
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function copyValue(value: string | null, emptyMessage: string) {
  if (!value) {
    uni.showToast({ title: emptyMessage, icon: 'none' })
    return
  }
  uni.setClipboardData({ data: value })
}

onShow(() => void loadData(true))
onPullDownRefresh(() => loadData(true))
onReachBottom(() => void loadData())
</script>

<template>
  <view class="account-page">
    <view v-if="summary" class="summary-card">
      <view class="summary-grid">
        <view><strong>{{ summary.registered_count }}</strong><text>邀请注册</text></view>
        <view><strong>{{ summary.pending_review_count }}</strong><text>待审核</text></view>
        <view><strong>{{ summary.rewarded_count }}</strong><text>已奖励</text></view>
      </view>
      <wd-cell-group border>
        <wd-cell title="邀请码" :value="summary.allow_code ? (summary.invite_code || '未生成') : '已关闭'" :is-link="summary.allow_code" @click="summary.allow_code && copyValue(summary.invite_code, '暂无邀请码')" />
        <wd-cell title="邀请链接" :value="summary.allow_link ? (summary.share_link || '未生成') : '已关闭'" :is-link="summary.allow_link" @click="summary.allow_link && copyValue(summary.share_link, '暂无邀请链接')" />
      </wd-cell-group>
    </view>

    <view class="section-title">
      邀请记录（{{ total }}）
    </view>
    <view v-if="items.length" class="record-list">
      <view v-for="item in items" :key="item.id" class="record-card">
        <view class="record-topline">
          <view class="record-title">
            {{ item.invitee_display }}
          </view>
          <wd-tag variant="light" size="small">
            {{ getReferralStatusLabel(item.status, item.status__mapping) }}
          </wd-tag>
        </view>
        <view class="record-time">
          {{ formatDateTime(item.created_at) }}
        </view>
      </view>
    </view>
    <AppListState :loading="loading" :has-items="Boolean(items.length)" :finished="finished" :error-message="loadError" loading-text="正在加载推广记录…" empty-text="暂无邀请记录" finished-text="没有更多推广记录了" @retry="loadData(items.length === 0)" />
  </view>
</template>

<style scoped lang="scss">
.account-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.summary-card,
.record-card {
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.summary-card {
  overflow: hidden;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 30rpx 16rpx;
}
.summary-grid view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.summary-grid strong {
  color: var(--app-text-primary);
  font-size: 36rpx;
}
.summary-grid text,
.record-time {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.section-title {
  margin: 32rpx 8rpx 16rpx;
  color: var(--app-text-secondary);
  font-size: 25rpx;
  font-weight: 600;
}
.record-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
.record-card {
  padding: 26rpx;
}
.record-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.record-title {
  min-width: 0;
  flex: 1;
  color: var(--app-text-primary);
  font-size: 29rpx;
  font-weight: 650;
}
.record-time {
  margin-top: 12rpx;
}
</style>
