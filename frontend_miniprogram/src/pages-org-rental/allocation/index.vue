<script setup lang="ts">
import type { AllocationCapabilitiesOut, AllocationRequestOut, MonthlyAccrualTotalOut } from '@/features/organization-rental/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { canOpenOrganizationCapability, formatOrganizationMoney } from '@/domain/organization-rental'
import { getAllocationCapabilities, listAllocationRequests, listMonthlyAccrualTotals } from '@/features/organization-rental/service'
import { getOrganizationAllocationDetailRoute } from '@/modules/routes'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppListState from '@/shared/components/AppListState.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '收益分配', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const capabilities = ref<AllocationCapabilitiesOut | null>(null)
const totals = ref<MonthlyAccrualTotalOut[]>([])
const requests = ref<AllocationRequestOut[]>([])
const page = ref(1)
const pageSize = 12
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')
const allowed = computed(() => canOpenOrganizationCapability(appContextStore.capabilities, 'allocation'))

function openRequest(id: number) {
  uni.navigateTo({ url: getOrganizationAllocationDetailRoute(id) })
}

async function loadAllocation(reset = false) {
  if (!allowed.value || loading.value || (!reset && finished.value))
    return
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  loadError.value = ''
  try {
    const [nextCapabilities, totalResult, requestResult] = await Promise.all([
      capabilities.value ? Promise.resolve(capabilities.value) : getAllocationCapabilities(appContextStore.organizationSlug),
      listMonthlyAccrualTotals(appContextStore.organizationSlug, page.value, pageSize),
      listAllocationRequests(appContextStore.organizationSlug, page.value, pageSize),
    ])
    capabilities.value = nextCapabilities
    totals.value = reset ? totalResult.items : [...totals.value, ...totalResult.items]
    requests.value = reset ? requestResult.items : [...requests.value, ...requestResult.items]
    const totalFinished = totals.value.length >= totalResult.total || totalResult.items.length < pageSize
    const requestFinished = requests.value.length >= requestResult.total || requestResult.items.length < pageSize
    finished.value = totalFinished && requestFinished
    if (!finished.value)
      page.value += 1
  }
  catch { loadError.value = '收益分配数据加载失败，请稍后重试' }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onShow(() => void loadAllocation(true))
onPullDownRefresh(() => loadAllocation(true))
onReachBottom(() => void loadAllocation())
</script>

<template>
  <view class="allocation-page">
    <AppErrorView v-if="!allowed" title="无查看权限" message="当前账号无权查看收益分配" :retryable="false" />
    <template v-else>
      <view v-if="capabilities" class="capability-card">
        <view><strong>{{ capabilities.view_scope === 'organization' ? '组织范围' : '仅本人' }}</strong><text>可见范围</text></view>
        <view><strong>{{ capabilities.submit ? '可提交' : '只读' }}</strong><text>申请权限</text></view>
        <view><strong>{{ capabilities.review ? '可审核' : '不可审核' }}</strong><text>审核权限</text></view>
      </view>
      <view v-if="totals.length" class="section">
        <view class="section-title">
          月度收益
        </view>
        <view class="card-list">
          <view v-for="item in totals" :key="`${item.beneficiary_user_id}-${item.effective_month}`" class="record-card">
            <view class="card-topline">
              <view class="record-title">
                {{ item.beneficiary_name_snapshot }}
              </view><strong>{{ formatOrganizationMoney(item.total_amount) }}</strong>
            </view>
            <view class="record-meta">
              {{ item.effective_month }} · {{ item.entry_count }} 笔 · 分配 {{ formatOrganizationMoney(item.allocation_amount) }}
            </view>
          </view>
        </view>
      </view>
      <view v-if="requests.length" class="section">
        <view class="section-title">
          分配申请
        </view>
        <view class="card-list">
          <view v-for="item in requests" :key="item.id" class="record-card" @click="openRequest(item.id)">
            <view class="card-topline">
              <view class="record-title">
                申请编号 {{ item.id }}
              </view><wd-tag :type="item.status === 'approved' ? 'success' : (item.status === 'rejected' ? 'danger' : 'warning')" variant="light" size="small">
                {{ item.status__mapping }}
              </wd-tag>
            </view>
            <view class="record-meta">
              {{ item.submitted_by_name_snapshot }} · 基数 {{ formatOrganizationMoney(item.basis_amount) }} · 可分配 {{ formatOrganizationMoney(item.distributable_amount) }}
            </view>
            <view class="detail-link">
              查看计算与审核详情
            </view>
          </view>
        </view>
      </view>
      <AppListState :loading="loading" :has-items="Boolean(totals.length || requests.length)" :finished="finished" :error-message="loadError" loading-text="正在加载收益数据…" empty-text="当前暂无收益分配记录" finished-text="没有更多收益数据了" @retry="loadAllocation(true)" />
    </template>
  </view>
</template>

<style scoped lang="scss">
.allocation-page {
  min-height: 100vh;
  padding: 24rpx;
  background: var(--app-bg-page);
}
.capability-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
  text-align: center;
}
.capability-card strong,
.capability-card text {
  display: block;
}
.capability-card strong {
  color: var(--app-text-primary);
  font-size: 25rpx;
}
.capability-card text {
  margin-top: 7rpx;
  color: var(--app-text-muted);
  font-size: 20rpx;
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
.card-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.record-card {
  padding: 25rpx;
  border-radius: 21rpx;
  background: var(--app-bg-card);
}
.card-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.record-title {
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 650;
}
.card-topline strong {
  color: var(--app-color-price);
}
.record-meta {
  margin-top: 11rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.6;
}
.detail-link {
  margin-top: 14rpx;
  color: var(--app-color-primary);
  font-size: 22rpx;
}
</style>
