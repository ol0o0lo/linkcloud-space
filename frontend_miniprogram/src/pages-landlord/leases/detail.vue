<script setup lang="ts">
import type { LeaseOut } from '@/features/landlord/service'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatTenantHouseTitle, getTenantLeaseStatusTone } from '@/domain/tenant-rental'
import { getLandlordLease } from '@/features/landlord/service'
import { APP_ROUTES } from '@/modules/routes'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '房东租约详情' } })

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
  <view class="detail-page">
    <AppLoading v-if="loading" text="正在加载租约…" />
    <AppErrorView v-else-if="loadError" title="租约加载失败" :message="loadError" @retry="loadLease" />
    <template v-else-if="lease">
      <view class="hero-card">
        <wd-tag :type="getTenantLeaseStatusTone(lease.status)" variant="light">
          {{ lease.status__mapping }}
        </wd-tag>
        <view class="title">
          {{ formatTenantHouseTitle(lease.house) }}
        </view>
        <view class="rent">
          ¥{{ lease.monthly_rent }} / 月
        </view>
      </view>
      <wd-cell-group title="租赁信息" insert>
        <wd-cell title="租客" :value="lease.tenant.name" />
        <wd-cell title="联系电话" :value="lease.tenant.phone" />
        <wd-cell title="租期" :value="`${lease.start_date} 至 ${lease.end_date}`" />
        <wd-cell title="押金" :value="lease.deposit ? `¥${lease.deposit}` : '未登记'" />
        <wd-cell title="付款日" :value="`每月 ${lease.payment_day} 日`" />
        <wd-cell title="合同文件" :value="lease.contract_files.length ? `${lease.contract_files.length} 份` : '未上传'" />
      </wd-cell-group>
      <wd-cell-group title="相关内容" insert>
        <wd-cell title="房源详情" is-link @click="openHouse" />
      </wd-cell-group>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  padding: 24rpx 0 56rpx;
  background: var(--app-bg-page);
}
.hero-card {
  margin: 0 24rpx 24rpx;
  padding: 32rpx;
  border-radius: 26rpx;
  background: var(--app-bg-card);
}
.title {
  margin-top: 20rpx;
  color: var(--app-text-primary);
  font-size: 36rpx;
  font-weight: 700;
}
.rent {
  margin-top: 22rpx;
  color: var(--app-color-price);
  font-size: 36rpx;
  font-weight: 700;
}
</style>
