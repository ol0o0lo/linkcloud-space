<script setup lang="ts">
import type { OrganizationViewingAction } from '@/domain/organization-rental'
import type { ViewingRecordOut } from '@/features/organization-rental/service'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatOrganizationDateTime, formatOrganizationHouseTitle, getOrganizationViewingStatusTone, getViewingActions } from '@/domain/organization-rental'
import { getAllocationCapabilities, getOrganizationViewing, patchOrganizationViewing } from '@/features/organization-rental/service'
import { getOrganizationHouseDetailRoute, getOrganizationLeaseDetailRoute, getOrganizationSigningRoute } from '@/modules/routes'
import AppBottomAction from '@/shared/components/AppBottomAction.vue'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '带看详情' } })

const actionLabels: Record<OrganizationViewingAction, string> = {
  viewed: '已带看',
  canceled: '取消',
  no_show: '爽约',
  converted: '已成交',
}

const appContextStore = useAppContextStore()
const recordId = ref(0)
const record = ref<ViewingRecordOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const updatingAction = ref<OrganizationViewingAction | null>(null)
const canSubmitSigning = ref(false)
const actions = computed(() => record.value ? getViewingActions(record.value.status) : [])

async function loadRecord() {
  loading.value = true
  loadError.value = ''
  try {
    const [nextRecord, allocationCapabilities] = await Promise.all([
      getOrganizationViewing(appContextStore.organizationSlug, recordId.value),
      getAllocationCapabilities(appContextStore.organizationSlug).catch(() => null),
    ])
    record.value = nextRecord
    canSubmitSigning.value = allocationCapabilities?.submit === true
  }
  catch { loadError.value = '带看记录不存在或暂时无法加载' }
  finally { loading.value = false }
}

async function updateStatus(action: OrganizationViewingAction) {
  if (updatingAction.value || !record.value || !actions.value.includes(action))
    return
  const confirmation = await uni.showModal({ title: `更新为${actionLabels[action]}`, content: '状态更新后将进入下一业务阶段，确定继续吗？', confirmText: '确认更新' })
  if (!confirmation.confirm)
    return
  updatingAction.value = action
  try {
    record.value = await patchOrganizationViewing(appContextStore.organizationSlug, record.value.id, {
      status: action,
      ...(action === 'viewed' ? { viewed_at: new Date().toISOString() } : {}),
    })
    uni.showToast({ title: '带看状态已更新', icon: 'success' })
  }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '状态更新失败', icon: 'none' }) }
  finally { updatingAction.value = null }
}

function openHouse() {
  if (record.value)
    uni.navigateTo({ url: getOrganizationHouseDetailRoute(record.value.house_id) })
}

function openLease() {
  if (record.value?.signed_lease_id)
    uni.navigateTo({ url: getOrganizationLeaseDetailRoute(record.value.signed_lease_id) })
}

function openSigning() {
  if (record.value)
    uni.navigateTo({ url: getOrganizationSigningRoute(record.value.id) })
}

onLoad((options) => {
  recordId.value = Number(options?.id || 0)
  if (!recordId.value) {
    loadError.value = '带看参数不正确'
    loading.value = false
    return
  }
  void loadRecord()
})
</script>

<template>
  <view class="detail-page">
    <AppLoading v-if="loading" text="正在加载带看…" />
    <AppErrorView v-else-if="loadError" title="带看加载失败" :message="loadError" @retry="loadRecord" />
    <template v-else-if="record">
      <view class="hero-card">
        <wd-tag :type="getOrganizationViewingStatusTone(record.status)" variant="light">
          {{ record.status__mapping }}
        </wd-tag>
        <view class="house-title">
          {{ formatOrganizationHouseTitle(record.house) }}
        </view>
        <view class="customer">
          {{ record.customer_name }} · {{ record.customer_phone }}
        </view>
      </view>
      <wd-cell-group title="带看信息" insert>
        <wd-cell title="预约时间" :value="formatOrganizationDateTime(record.scheduled_at)" />
        <wd-cell title="实际带看" :value="formatOrganizationDateTime(record.viewed_at)" />
        <wd-cell title="联系人" :value="record.contact?.name || '临时客户'" />
        <wd-cell title="备注" :label="record.notes || '暂无备注'" />
      </wd-cell-group>
      <wd-cell-group title="相关业务" insert>
        <wd-cell title="房源详情" is-link @click="openHouse" />
        <wd-cell v-if="record.signed_lease_id" title="成交租约" is-link @click="openLease" />
        <wd-cell v-else-if="record.status === 'converted' && canSubmitSigning" title="登记签约" is-link @click="openSigning" />
      </wd-cell-group>
      <AppBottomAction v-if="actions.length">
        <view class="action-row">
          <wd-button v-for="action in actions" :key="action" size="small" :type="action === 'canceled' ? 'danger' : (action === 'no_show' ? 'warning' : 'primary')" :variant="action === 'converted' ? 'base' : 'plain'" :loading="updatingAction === action" :disabled="updatingAction !== null" @click="updateStatus(action)">
            {{ actionLabels[action] }}
          </wd-button>
        </view>
      </AppBottomAction>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  padding: 24rpx 0 160rpx;
  background: var(--app-bg-page);
}
.hero-card {
  margin: 0 24rpx 24rpx;
  padding: 32rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.house-title {
  margin-top: 18rpx;
  color: var(--app-text-primary);
  font-size: 35rpx;
  font-weight: 700;
}
.customer {
  margin-top: 12rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
}
.action-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12rpx;
}
</style>
