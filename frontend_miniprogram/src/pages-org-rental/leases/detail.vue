<script setup lang="ts">
import LeaseContractFiles from '@/components/house/LeaseContractFiles.vue'
import type { LeaseOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatOrganizationDateTime, formatOrganizationHouseTitle, formatOrganizationMoney, getOrganizationLeaseStatusTone } from '@/pages-org-rental/domain/organization-rental'
import { getOrganizationLease } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationHouseDetailRoute, getOrganizationLeaseFormRoute, getOrganizationViewingDetailRoute } from '@/modules/routes'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '租约详情' } })

const appContextStore = useAppContextStore()
const leaseId = ref(0)
const lease = ref<LeaseOut | null>(null)
const loading = ref(true)
const loadError = ref('')

async function loadLease() {
  loading.value = true
  loadError.value = ''
  try {
    lease.value = await getOrganizationLease(appContextStore.organizationSlug, leaseId.value)
  }
  catch {
    loadError.value = '租约不存在或暂时无法加载'
  }
  finally {
    loading.value = false
  }
}

function openHouse() {
  if (lease.value)
    uni.navigateTo({ url: getOrganizationHouseDetailRoute(lease.value.house_id) })
}

function openViewing() {
  if (lease.value?.source_viewing_record_id)
    uni.navigateTo({ url: getOrganizationViewingDetailRoute(lease.value.source_viewing_record_id) })
}

function editLease() {
  uni.navigateTo({ url: getOrganizationLeaseFormRoute(leaseId.value) })
}

onLoad((options) => {
  leaseId.value = Number(options?.id || 0)
  if (!leaseId.value) {
    loadError.value = '租约参数不正确'
    loading.value = false
    return
  }
  void loadLease()
})
</script>

<template>
  <AppDetailPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载租约…"
    error-title="租约加载失败"
    :show-actions="Boolean(lease)"
    @retry="loadLease"
  >
    <template #navigation>
      <AppCustomNavigation title="租约详情" back scroll-mode="sticky" />
    </template>
    <template v-if="lease">
      <view class="mx-app-gutter app-card-plain p-4">
        <view class="app-row-between text-xs text-content-muted">
          <AppStatusTag :text="lease.status__mapping" :tone="getOrganizationLeaseStatusTone(lease.status)" />
          <text>{{ formatOrganizationDateTime(lease.sign_at) }}</text>
        </view>
        <view class="mt-2.5 text-lg text-content-primary font-bold">
          {{ formatOrganizationHouseTitle(lease.house) }}
        </view>
        <view class="mt-1.5 text-xs text-content-muted">
          {{ lease.tenant.name }} · {{ lease.tenant.phone }}
        </view>
        <view class="mt-2.5 text-xl text-app-price font-bold">
          {{ formatOrganizationMoney(lease.monthly_rent) }}<text class="ml-0.5 text-xs font-normal">/月</text>
        </view>
      </view>
      <wd-cell-group title="租约信息" insert>
        <wd-cell title="租期" :value="`${lease.start_date} 至 ${lease.end_date}`" />
        <wd-cell title="押金" :value="formatOrganizationMoney(lease.deposit)" />
        <wd-cell title="付款日" :value="`每月 ${lease.payment_day} 日`" />
        <LeaseContractFiles :files="lease.contract_files" />
        <wd-cell title="备注" :label="lease.notes || '暂无备注'" />
      </wd-cell-group>
      <wd-cell-group title="相关业务" insert>
        <wd-cell title="房源详情" is-link @click="openHouse" />
        <wd-cell v-if="lease.source_viewing_record_id" title="来源带看" is-link @click="openViewing" />
      </wd-cell-group>
    </template>

    <template #actions>
      <wd-button block variant="plain" @click="editLease">
        编辑租约
      </wd-button>
    </template>
  </AppDetailPage>
</template>
