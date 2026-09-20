<script setup lang="ts">
import type { AllocationCapabilitiesOut, AllocationRequestOut, MonthlyAccrualTotalOut } from '@/pages-org-rental/api/organization-rental'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { canOpenOrganizationCapability, formatOrganizationMoney, getOrganizationAllocationStatusTone } from '@/pages-org-rental/domain/organization-rental'
import { getAllocationCapabilities, listAllocationRequests, listMonthlyAccrualTotals } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationAllocationDetailRoute } from '@/modules/routes'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppSection from '@/components/app/AppSection.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '收益分配', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const capabilities = ref<AllocationCapabilitiesOut | null>(null)
const allowed = computed(() => canOpenOrganizationCapability(appContextStore.capabilities, 'allocation'))
const totalPage = usePagedPage<MonthlyAccrualTotalOut>({
  loader: ({ page, pageSize }) => listMonthlyAccrualTotals(appContextStore.organizationSlug, page, pageSize),
  pageSize: 12,
  enabled: allowed,
  keyOf: item => `${item.beneficiary_user_id}-${item.effective_month}`,
})
const requestPage = usePagedPage<AllocationRequestOut>({
  loader: ({ page, pageSize }) => listAllocationRequests(appContextStore.organizationSlug, page, pageSize),
  pageSize: 12,
  enabled: allowed,
  keyOf: item => item.id,
})

function openRequest(id: number) {
  uni.navigateTo({ url: getOrganizationAllocationDetailRoute(id) })
}

async function loadCapabilities() {
  if (!allowed.value || capabilities.value)
    return
  try {
    capabilities.value = await getAllocationCapabilities(appContextStore.organizationSlug)
  }
  catch {
    capabilities.value = null
  }
}

onShow(() => void loadCapabilities())
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="收益分配" back scroll-mode="sticky" />
    </template>
    <AppErrorView v-if="!allowed" title="无查看权限" message="当前账号无权查看收益分配" :retryable="false" />
    <view v-else class="flex flex-col gap-3.5">
      <view v-if="capabilities" class="grid grid-cols-3 gap-1.5 app-card-plain p-3 text-center">
        <view class="flex flex-col gap-1">
          <strong class="text-xs text-content-primary">{{ capabilities.view_scope === 'organization' ? '组织范围' : '仅本人' }}</strong><text class="text-2xs text-content-muted">可见范围</text>
        </view>
        <view class="flex flex-col gap-1">
          <strong class="text-xs text-content-primary">{{ capabilities.submit ? '可提交' : '只读' }}</strong><text class="text-2xs text-content-muted">申请权限</text>
        </view>
        <view class="flex flex-col gap-1">
          <strong class="text-xs text-content-primary">{{ capabilities.review ? '可审核' : '不可审核' }}</strong><text class="text-2xs text-content-muted">审核权限</text>
        </view>
      </view>

      <AppSection title="月度收益" variant="plain">
        <AppPagedList
          :items="totalPage.items.value"
          :item-key="item => `${item.beneficiary_user_id}-${item.effective_month}`"
          :loading="totalPage.loading.value"
          :refreshing="totalPage.refreshing.value"
          :loading-more="totalPage.loadingMore.value"
          :finished="totalPage.finished.value"
          :error="totalPage.error.value"
          loading-text="正在加载月度收益…"
          empty-text="当前暂无月度收益"
          finished-text="没有更多月度收益了"
          @retry="totalPage.refresh"
        >
          <template #item="{ item }">
            <AppRecordCard>
              <template #title>
                {{ item.beneficiary_name_snapshot }}
              </template>
              <template #status>
                <strong class="text-app-price">{{ formatOrganizationMoney(item.total_amount) }}</strong>
              </template>
              <template #description>
                {{ item.effective_month }} · {{ item.entry_count }} 笔 · 分配 {{ formatOrganizationMoney(item.allocation_amount) }}
              </template>
            </AppRecordCard>
          </template>
        </AppPagedList>
      </AppSection>

      <AppSection title="分配申请" variant="plain">
        <AppPagedList
          :items="requestPage.items.value"
          item-key="id"
          :loading="requestPage.loading.value"
          :refreshing="requestPage.refreshing.value"
          :loading-more="requestPage.loadingMore.value"
          :finished="requestPage.finished.value"
          :error="requestPage.error.value"
          loading-text="正在加载分配申请…"
          empty-text="当前暂无分配申请"
          finished-text="没有更多分配申请了"
          @retry="requestPage.refresh"
        >
          <template #item="{ item }">
            <AppRecordCard clickable @click="openRequest(item.id)">
              <template #title>
                申请编号 {{ item.id }}
              </template>
              <template #status>
                <AppStatusTag :text="item.status__mapping" :tone="getOrganizationAllocationStatusTone(item.status)" />
              </template>
              <template #description>
                {{ item.submitted_by_name_snapshot }} · 基数 {{ formatOrganizationMoney(item.basis_amount) }} · 可分配 {{ formatOrganizationMoney(item.distributable_amount) }}
              </template>
              <template #footer>
                <text class="text-xs text-app-brand">查看计算与审核详情</text>
              </template>
            </AppRecordCard>
          </template>
        </AppPagedList>
      </AppSection>
    </view>
  </AppPage>
</template>
