<script setup lang="ts">
import LeaseContractFiles from '@/components/house/LeaseContractFiles.vue'
import type { LeaseOut } from '@/features/landlord/service'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatTenantHouseTitle, getTenantLeaseStatusTone } from '@/domain/tenant-rental'
import { getLandlordLease } from '@/features/landlord/service'
import { APP_ROUTES } from '@/modules/routes'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '租约详情', navigationStyle: 'custom' } })

const appContextStore = useAppContextStore()
const leaseId = ref(0)
const lease = ref<LeaseOut | null>(null)
const loading = ref(true)
const loadError = ref('')

async function loadLease() {
  const contactId = appContextStore.currentLandlordRelationship?.contact_id
  if (!contactId) {
    loadError.value = '当前房东关系已失效，请重新选择身份'
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    lease.value = await getLandlordLease(contactId, leaseId.value)
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '租约加载失败'
  }
  finally {
    loading.value = false
  }
}

function openHouse() {
  if (lease.value)
    uni.navigateTo({ url: `${APP_ROUTES.landlordHouseDetail}?id=${encodeURIComponent(String(lease.value.house_id))}` })
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
  <AppPage variant="detail" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="租约详情" back scroll-mode="sticky" />
    </template>
    <view class="detail-page min-h-screen bg-surface-page px-0 pb-9 pt-5">
      <AppLoading v-if="loading" text="正在加载租约…" />
      <AppErrorView v-else-if="loadError" title="租约加载失败" :message="loadError" @retry="loadLease" />
      <template v-else-if="lease">
        <view class="hero-card mx-3 mb-3 mt-0 rounded-3.5 bg-surface-card p-4">
          <wd-tag :type="getTenantLeaseStatusTone(lease.status)" variant="light">
            {{ lease.status__mapping }}
          </wd-tag>
          <view class="title mt-2.5 text-size-lg text-content-primary font-bold">
            {{ formatTenantHouseTitle(lease.house) }}
          </view>
          <view class="rent mt-3 text-size-lg text-app-price font-bold">
            ¥{{ lease.monthly_rent }} / 月
          </view>
        </view>
        <wd-cell-group title="租赁信息" insert>
          <wd-cell title="租客" :value="lease.tenant.name" />
          <wd-cell title="联系电话" :value="lease.tenant.phone" />
          <wd-cell title="租期" :value="`${lease.start_date} 至 ${lease.end_date}`" />
          <wd-cell title="押金" :value="lease.deposit ? `¥${lease.deposit}` : '未登记'" />
          <wd-cell title="付款日" :value="`每月 ${lease.payment_day} 日`" />
          <LeaseContractFiles :files="lease.contract_files" />
        </wd-cell-group>
        <wd-cell-group title="相关内容" insert>
          <wd-cell title="房源详情" is-link @click="openHouse" />
        </wd-cell-group>
      </template>
    </view>
  </AppPage>
</template>
