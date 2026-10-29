<script setup lang="ts">
import type { AnalyticsOverviewOut, AnalyticsTrendPointOut } from '@/pages-org-rental/api/organization-rental'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { canOpenOrganizationCapability, formatOrganizationLocalDate } from '@/pages-org-rental/domain/organization-rental'
import { getOrganizationAnalyticsOverview, getOrganizationAnalyticsTrends } from '@/pages-org-rental/api/organization-rental'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppDashboardSkeleton from '@/components/app/AppDashboardSkeleton.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '经营分析', enablePullDownRefresh: true } })

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
  <view class="analytics-page min-h-screen bg-surface-page px-3 pb-7 pt-0">
    <AppCustomNavigation title="经营分析" back scroll-mode="sticky" />
    <AppErrorView v-if="!allowed" title="无查看权限" message="当前账号无权查看经营分析" :retryable="false" />
    <template v-else>
      <view class="filter-card border-hairline border-app-card rounded-app-lg border-solid bg-surface-card px-3 pb-3.5 pt-1.5">
        <wd-cell title="开始日期" center>
          <wd-input v-model="startDate" placeholder="YYYY-MM-DD" clearable compact align-right />
        </wd-cell>
        <wd-cell title="结束日期" center>
          <wd-input v-model="endDate" placeholder="YYYY-MM-DD" clearable compact align-right />
        </wd-cell>
        <wd-button block size="small" @click="loadAnalytics">
          查询
        </wd-button>
      </view>
      <AppDashboardSkeleton v-if="loading" :metric-count="3" compact />
      <AppErrorView v-else-if="loadError" title="分析加载失败" :message="loadError" @retry="loadAnalytics" />
      <template v-else-if="overview">
        <view class="overview-card grid grid-cols-3 mt-2.5 gap-1.5 rounded-3 p-3.5 text-center text-white bg-gradient-brand">
          <view><strong>{{ overview.total_events }}</strong><text>行为总量</text></view>
          <view><strong>{{ overview.unique_visitors ?? '--' }}</strong><text>独立访客</text></view>
          <view><strong>{{ overview.metrics.length }}</strong><text>指标数量</text></view>
        </view>
        <view class="section mt-3.5">
          <view class="section-title mx-1 mb-2 mt-0 text-size-xs text-content-secondary font-bold">
            指标概览
          </view>
          <view v-if="overview.metrics.length" class="metric-list flex flex-col gap-2">
            <view v-for="item in overview.metrics" :key="item.event_name" class="metric-card flex items-center justify-between gap-2.5 border-hairline border-app-card rounded-app-md border-solid bg-surface-card p-3">
              <view>
                <view class="metric-name text-size-sm text-content-primary font-bold">
                  {{ item.label }}
                </view>
              </view>
              <view class="metric-value text-size-base text-app-brand font-bold">
                {{ item.count }}
              </view>
            </view>
          </view>
          <AppEmpty
            v-else
            title="所选日期内暂无经营数据"
            description="可调整日期范围后重新查询。"
            icon="no-content"
            compact
          />
        </view>
        <view v-if="trends.length" class="section mt-3.5">
          <view class="section-title mx-1 mb-2 mt-0 text-size-xs text-content-secondary font-bold">
            最近趋势
          </view>
          <view class="trend-list flex flex-col gap-2">
            <view v-for="(item, index) in trends" :key="`${item.date}-${item.event_name}-${index}`" class="trend-row flex items-center justify-between gap-2.5 border-hairline border-app-card rounded-app-md border-solid bg-surface-card p-3 text-size-xs text-content-secondary">
              <text>{{ item.date }} · {{ metricLabel(item.event_name) }}</text><strong>{{ item.count }}</strong>
            </view>
          </view>
        </view>
      </template>
    </template>
  </view>
</template>

<style scoped lang="scss">
.analytics-page :deep(.app-custom-navigation) {
  @apply mt-0 -mx-3 mb-3;
}
.overview-card strong,
.overview-card text {
  @apply block;
}
.overview-card strong {
  @apply text-size-lg;
}
.overview-card text {
  @apply mt-1 text-size-2xs opacity-78;
}
.trend-row strong {
  @apply text-content-primary;
}
</style>
