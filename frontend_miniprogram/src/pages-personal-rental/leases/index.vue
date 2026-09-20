<script setup lang="ts">
import type { TenantLeaseOut } from '@/features/tenant-rental/service'
import { formatTenantHouseTitle, getTenantLeaseStatusTone } from '@/domain/tenant-rental'
import { listTenantLeases } from '@/features/tenant-rental/service'
import { APP_ROUTES, getTenantLeaseDetailRoute } from '@/modules/routes'
import AppNotice from '@/components/app/AppNotice.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import { usePagedPage } from '@/hooks/usePagedPage'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的租约',
    enablePullDownRefresh: true,
  },
})

const leasePage = usePagedPage<TenantLeaseOut>({
  loader: ({ page, pageSize }) => listTenantLeases(page, pageSize),
  pageSize: 12,
  keyOf: item => item.id,
})

function openLease(id: number) {
  uni.navigateTo({ url: getTenantLeaseDetailRoute(id) })
}

function openViewings() {
  uni.navigateTo({ url: APP_ROUTES.tenantViewings })
}
</script>

<template>
  <AppPage variant="list" gutter="loose">
    <template #navigation>
      <AppCustomNavigation title="我的租约" back scroll-mode="sticky" />
    </template>
    <AppPagedList
      :items="leasePage.items.value"
      item-key="id"
      :loading="leasePage.loading.value"
      :refreshing="leasePage.refreshing.value"
      :loading-more="leasePage.loadingMore.value"
      :finished="leasePage.finished.value"
      :error="leasePage.error.value"
      loading-text="正在加载租约…"
      empty-text="暂时没有与你关联的租约"
      empty-description="完成签约后，租期、租金和合同资料会显示在这里。"
      empty-icon="no-content"
      empty-action-text="查看看房预约"
      finished-text="没有更多租约了"
      @retry="leasePage.refresh"
      @empty-action="openViewings"
    >
      <template #item="{ item }">
        <AppRecordCard clickable @click="openLease(item.id)">
          <template #title>
            {{ formatTenantHouseTitle(item.house) }}
          </template>
          <template #status>
            <AppStatusTag :text="item.status__mapping" :tone="getTenantLeaseStatusTone(item.status)" />
          </template>
          <view class="text-xs text-content-muted">
            {{ item.organization.name }}
          </view>
          <view class="mt-3.5 text-app-price">
            <strong class="text-lg">¥{{ item.monthly_rent }}</strong><text class="ml-0.5 text-xs">/月</text>
          </view>
          <template #meta>
            {{ item.start_date }} 至 {{ item.end_date }}
          </template>
        </AppRecordCard>
      </template>
    </AppPagedList>
    <AppNotice
      v-if="leasePage.items.value.length"
      class="list-notice"
      title="查看范围"
      description="租客端当前只查看租期、租金、押金、付款日和合同文件，不提供缴费、报修或续租。"
      compact
    />
  </AppPage>
</template>

<style scoped lang="scss">
.list-notice {
  margin-top: 48rpx;
}
</style>
