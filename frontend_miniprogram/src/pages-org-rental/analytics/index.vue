<script setup lang="ts">
import type { AnalyticsOverviewOut, AnalyticsTrendPointOut } from '@/features/organization-rental/service'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { canOpenOrganizationCapability, formatOrganizationLocalDate } from '@/domain/organization-rental'
import { getOrganizationAnalyticsOverview, getOrganizationAnalyticsTrends } from '@/features/organization-rental/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '经营分析', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const defaultEndDate = new Date()
const defaultStartDate = new Date(defaultEndDate)
defaultStartDate.setDate(defaultStartDate.getDate() - 29)
const endDate = ref(formatOrganizationLocalDate(defaultEndDate))
const startDate = ref(formatOrganizationLocalDate(defaultStartDate))
const overview = ref<AnalyticsOverviewOut | null>(null)
const trends = ref<AnalyticsTrendPointOut[]>([])
const loading = ref(false)
const loadError = ref('')
const allowed = computed(() => canOpenOrganizationCapability(appContextStore.capabilities, 'analytics'))
const metricLabels = computed(() => Object.fromEntries((overview.value?.metrics || []).map(item => [item.event_name, item.label])))

function metricLabel(eventName: string) {
  return metricLabels.value[eventName] || '其他指标'
}

async function loadAnalytics() {
  if (!allowed.value)
    return
  loading.value = true
  loadError.value = ''
  try {
    const [nextOverview, nextTrends] = await Promise.all([
      getOrganizationAnalyticsOverview(appContextStore.organizationSlug, startDate.value, endDate.value),
      getOrganizationAnalyticsTrends(appContextStore.organizationSlug, startDate.value, endDate.value),
    ])
    overview.value = nextOverview
    trends.value = nextTrends
  }
  catch { loadError.value = '经营分析加载失败，请稍后重试' }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onShow(() => void loadAnalytics())
onPullDownRefresh(loadAnalytics)
</script>

<template>
  <view class="analytics-page">
    <AppErrorView v-if="!allowed" title="无查看权限" message="当前账号无权查看经营分析" :retryable="false" />
    <template v-else>
      <view class="filter-card">
        <wd-input v-model="startDate" label="开始日期" placeholder="YYYY-MM-DD" clearable />
        <wd-input v-model="endDate" label="结束日期" placeholder="YYYY-MM-DD" clearable />
        <wd-button block size="small" @click="loadAnalytics">
          查询
        </wd-button>
      </view>
      <AppLoading v-if="loading" text="正在加载经营分析…" />
      <AppErrorView v-else-if="loadError" title="分析加载失败" :message="loadError" @retry="loadAnalytics" />
      <template v-else-if="overview">
        <view class="overview-card">
          <view><strong>{{ overview.total_events }}</strong><text>行为总量</text></view>
          <view><strong>{{ overview.unique_visitors ?? '--' }}</strong><text>独立访客</text></view>
          <view><strong>{{ overview.metrics.length }}</strong><text>指标数量</text></view>
        </view>
        <view class="section">
          <view class="section-title">
            指标概览
          </view>
          <view v-if="overview.metrics.length" class="metric-list">
            <view v-for="item in overview.metrics" :key="item.event_name" class="metric-card">
              <view>
                <view class="metric-name">
                  {{ item.label }}
                </view>
              </view>
              <view class="metric-value">
                {{ item.count }}
              </view>
            </view>
          </view>
          <wd-empty v-else icon="chart" tip="所选日期内暂无经营事件" />
        </view>
        <view v-if="trends.length" class="section">
          <view class="section-title">
            最近趋势
          </view>
          <view class="trend-list">
            <view v-for="(item, index) in trends" :key="`${item.date}-${item.event_name}-${index}`" class="trend-row">
              <text>{{ item.date }} · {{ metricLabel(item.event_name) }}</text><strong>{{ item.count }}</strong>
            </view>
          </view>
        </view>
      </template>
    </template>
  </view>
</template>

<style scoped lang="scss">
.analytics-page {
  min-height: 100vh;
  padding: 24rpx;
  background: var(--app-bg-page);
}
.filter-card {
  padding: 12rpx 24rpx 26rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.overview-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 20rpx;
  padding: 28rpx;
  border-radius: 22rpx;
  background: var(--app-gradient-organization);
  color: #fff;
  text-align: center;
}
.overview-card strong,
.overview-card text {
  display: block;
}
.overview-card strong {
  font-size: 38rpx;
}
.overview-card text {
  margin-top: 7rpx;
  font-size: 21rpx;
  opacity: 0.78;
}
.section {
  margin-top: 28rpx;
}
.section-title {
  margin: 0 6rpx 14rpx;
  color: var(--app-text-secondary);
  font-size: 26rpx;
  font-weight: 650;
}
.metric-list,
.trend-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.metric-card,
.trend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: var(--app-bg-card);
}
.metric-name {
  color: var(--app-text-primary);
  font-size: 27rpx;
  font-weight: 650;
}
.metric-value {
  color: var(--app-color-primary);
  font-size: 34rpx;
  font-weight: 700;
}
.trend-row {
  color: var(--app-text-secondary);
  font-size: 23rpx;
}
.trend-row strong {
  color: var(--app-text-primary);
}
</style>
