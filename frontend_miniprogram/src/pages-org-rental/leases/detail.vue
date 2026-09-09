<script setup lang="ts">
import type { LeaseOut } from '@/features/organization-rental/service'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatOrganizationDateTime, formatOrganizationHouseTitle, formatOrganizationMoney, getOrganizationLeaseStatusTone } from '@/domain/organization-rental'
import { getOrganizationLease } from '@/features/organization-rental/service'
import { getOrganizationHouseDetailRoute, getOrganizationLeaseFormRoute, getOrganizationViewingDetailRoute } from '@/modules/routes'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '租约详情' } })

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
  <view class="detail-page">
    <AppLoading v-if="loading" text="正在加载租约…" />
    <AppErrorView v-else-if="loadError" title="租约加载失败" :message="loadError" @retry="loadLease" />
    <template v-else-if="lease">
      <view class="hero-card">
        <view class="hero-topline">
          <wd-tag :type="getOrganizationLeaseStatusTone(lease.status)" variant="light">
            {{ lease.status__mapping }}
          </wd-tag><text>{{ formatOrganizationDateTime(lease.sign_at) }}</text>
        </view>
        <view class="house-title">
          {{ formatOrganizationHouseTitle(lease.house) }}
        </view>
        <view class="tenant">
          {{ lease.tenant.name }} · {{ lease.tenant.phone }}
        </view>
        <view class="rent">
          {{ formatOrganizationMoney(lease.monthly_rent) }}<text>/月</text>
        </view>
      </view>
      <wd-cell-group title="租约信息" insert>
        <wd-cell title="租期" :value="`${lease.start_date} 至 ${lease.end_date}`" />
        <wd-cell title="押金" :value="formatOrganizationMoney(lease.deposit)" />
        <wd-cell title="付款日" :value="`每月 ${lease.payment_day} 日`" />
        <wd-cell title="合同文件" :value="lease.contract_files.length ? `${lease.contract_files.length} 份` : '未上传'" />
        <wd-cell title="备注" :label="lease.notes || '暂无备注'" />
      </wd-cell-group>
      <wd-cell-group title="相关业务" insert>
        <wd-cell title="房源详情" is-link @click="openHouse" />
        <wd-cell v-if="lease.source_viewing_record_id" title="来源带看" is-link @click="openViewing" />
      </wd-cell-group>
      <view class="action-card">
        <wd-button block variant="plain" @click="editLease">
          编辑租约
        </wd-button>
      </view>
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
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.hero-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.house-title {
  margin-top: 20rpx;
  color: var(--app-text-primary);
  font-size: 35rpx;
  font-weight: 700;
}
.tenant {
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.rent {
  margin-top: 22rpx;
  color: var(--app-color-price);
  font-size: 42rpx;
  font-weight: 700;
}
.rent text {
  margin-left: 4rpx;
  font-size: 23rpx;
  font-weight: 400;
}
.action-card {
  margin: 24rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
</style>
