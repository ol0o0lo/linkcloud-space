<script setup lang="ts">
import type { AllocationCapabilitiesOut, HouseOut, ViewingRecordOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatOrganizationLocalDate } from '@/pages-org-rental/domain/organization-rental'
import { getAllocationCapabilities, getOrganizationHouse, getOrganizationViewing, registerOrganizationDeal } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationLeaseDetailRoute } from '@/modules/routes'
import AppErrorView from '@/components/app/AppErrorView.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '登记签约' } })

const appContextStore = useAppContextStore()
const allocationCapabilities = ref<AllocationCapabilitiesOut | null>(null)
const sourceViewing = ref<ViewingRecordOut | null>(null)
const selectedHouse = ref<HouseOut | null>(null)
const viewingId = ref(0)
const loading = ref(false)
const loadError = ref('')
const submitting = ref(false)
const houseId = ref('')
const customerName = ref('')
const customerPhone = ref('')
const defaultStartDate = new Date()
const defaultEndDate = new Date(defaultStartDate)
defaultEndDate.setDate(defaultEndDate.getDate() + 365)
const startDate = ref(formatOrganizationLocalDate(defaultStartDate))
const endDate = ref(formatOrganizationLocalDate(defaultEndDate))
const monthlyRent = ref('')
const deposit = ref('')
const paymentDay = ref('1')
const notes = ref('')
const allowed = computed(() => allocationCapabilities.value?.submit === true)
const previewHouse = computed(() => selectedHouse.value || sourceViewing.value?.house || null)

function applyViewing(viewing: ViewingRecordOut) {
  if (viewing.status !== 'converted')
    throw new Error('只有已成交带看可以登记签约')
  sourceViewing.value = viewing
  houseId.value = String(viewing.house_id)
  customerName.value = viewing.customer_name
  customerPhone.value = viewing.customer_phone
}

async function loadSigningContext() {
  loading.value = true
  loadError.value = ''
  try {
    const [capabilities, viewing] = await Promise.all([
      getAllocationCapabilities(appContextStore.organizationSlug),
      viewingId.value ? getOrganizationViewing(appContextStore.organizationSlug, viewingId.value) : Promise.resolve(null),
    ])
    allocationCapabilities.value = capabilities
    if (viewing)
      applyViewing(viewing)
    const resolvedHouseId = viewing?.house_id || Number(houseId.value)
    selectedHouse.value = resolvedHouseId
      ? await getOrganizationHouse(appContextStore.organizationSlug, resolvedHouseId).catch(() => null)
      : null
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '成交带看加载失败' }
  finally { loading.value = false }
}

async function submit() {
  if (!allowed.value) {
    uni.showToast({ title: '当前账号没有签约提交权限', icon: 'none' })
    return
  }
  const beneficiaryUserId = appContextStore.user?.id
  if (!beneficiaryUserId || !Number(houseId.value) || !customerName.value.trim() || !customerPhone.value.trim() || !startDate.value || !endDate.value || !Number(monthlyRent.value)) {
    uni.showToast({ title: '请完整填写房源、租客、租期和月租金', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const result = await registerOrganizationDeal(appContextStore.organizationSlug, {
      lease: {
        house_id: Number(houseId.value),
        tenant_identity: { name: customerName.value.trim(), phone: customerPhone.value.trim() },
        source_viewing_record_id: viewingId.value || undefined,
        sign_at: new Date().toISOString(),
        start_date: startDate.value,
        end_date: endDate.value,
        monthly_rent: monthlyRent.value,
        deposit: deposit.value || undefined,
        payment_day: Number(paymentDay.value) || 1,
        notes: notes.value.trim(),
      },
      beneficiary_user_ids: [beneficiaryUserId],
    })
    uni.showToast({ title: '签约登记成功', icon: 'success' })
    setTimeout(() => uni.redirectTo({ url: getOrganizationLeaseDetailRoute(result.lease.id) }), 500)
  }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '签约登记失败', icon: 'none' }) }
  finally { submitting.value = false }
}

onLoad((options) => {
  viewingId.value = Number(options?.viewingId || 0)
  houseId.value = String(Number(options?.houseId || 0) || '')
  void loadSigningContext()
})
</script>

<template>
  <view class="signing-page">
    <AppCustomNavigation title="登记签约" back scroll-mode="sticky" />
    <AppLoading v-if="loading" text="正在核验签约权限…" />
    <AppErrorView v-else-if="loadError" title="签约信息不可用" :message="loadError" @retry="loadSigningContext" />
    <AppErrorView v-else-if="!allowed" title="无登记权限" message="当前账号可以查看收益模块，但没有提交签约收益申请的权限" :retryable="false" />
    <view v-else class="form-card">
      <view v-if="previewHouse" class="source-card">
        <view class="source-label">
          {{ sourceViewing ? '来源带看房源' : '签约房源' }}
        </view>
        <HouseCard class="source-house" :house="previewHouse" variant="compact" />
        <view v-if="sourceViewing" class="source-customer">
          {{ sourceViewing.customer_name }} · {{ sourceViewing.customer_phone }}
        </view>
      </view>
      <wd-input v-model="houseId" label="房源编号" type="number" placeholder="请输入组织房源编号" :disabled="Boolean(sourceViewing)" clearable />
      <wd-input v-model="customerName" label="租客姓名" placeholder="请输入租客姓名" clearable />
      <wd-input v-model="customerPhone" label="租客手机号" type="number" placeholder="请输入租客手机号" clearable />
      <wd-input v-model="startDate" label="开始日期" placeholder="YYYY-MM-DD" clearable />
      <wd-input v-model="endDate" label="结束日期" placeholder="YYYY-MM-DD" clearable />
      <wd-input v-model="monthlyRent" label="月租金" type="digit" placeholder="请输入月租金" clearable />
      <wd-input v-model="deposit" label="押金" type="digit" placeholder="可不填" clearable />
      <wd-input v-model="paymentDay" label="付款日" type="number" placeholder="1-31" clearable />
      <wd-textarea v-model="notes" label="备注" placeholder="补充成交说明" :maxlength="1000" />
      <view class="submit-row">
        <wd-button block :loading="submitting" @click="submit">
          登记签约并提交收益分配
        </wd-button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.signing-page {
  min-height: 100vh;
  padding: 0 24rpx 56rpx;
  background: var(--app-bg-page);
}
.signing-page :deep(.app-custom-navigation) {
  margin: 0 -24rpx 24rpx;
}
.form-card {
  overflow: hidden;
  padding: 12rpx 24rpx 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.source-card {
  margin: 12rpx 0 20rpx;
  padding: 20rpx;
  border-radius: 18rpx;
  background: var(--app-bg-subtle);
}
.source-label,
.source-customer {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.source-house {
  margin-top: 14rpx;
}
.source-customer {
  margin-top: 8rpx;
}
.submit-row {
  margin-top: 28rpx;
}
</style>
