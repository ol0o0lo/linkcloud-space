<script setup lang="ts">
import type { OrganizationViewingAction } from '@/pages-org-rental/domain/organization-rental'
import type { ViewingRecordOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatOrganizationDateTime, formatOrganizationHouseTitle, getOrganizationViewingStatusTone, getViewingActions } from '@/pages-org-rental/domain/organization-rental'
import { getAllocationCapabilities, getOrganizationViewing, patchOrganizationViewing } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationHouseDetailRoute, getOrganizationLeaseDetailRoute, getOrganizationSigningRoute } from '@/modules/routes'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '带看详情' } })

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
  <AppDetailPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载带看…"
    error-title="带看加载失败"
    :show-actions="actions.length > 0"
    @retry="loadRecord"
  >
    <template #navigation>
      <AppCustomNavigation title="带看详情" back scroll-mode="sticky" />
    </template>
    <template v-if="record">
      <view class="mx-app-gutter app-card-plain p-4">
        <AppStatusTag :text="record.status__mapping" :tone="getOrganizationViewingStatusTone(record.status)" />
        <view class="mt-2 text-lg text-content-primary font-bold">
          {{ formatOrganizationHouseTitle(record.house) }}
        </view>
        <view class="mt-1.5 text-xs text-content-muted">
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
    </template>

    <template #actions>
      <view class="w-full flex flex-wrap justify-end gap-1.5">
        <template v-if="record">
          <wd-button v-for="action in actions" :key="action" size="small" :type="action === 'canceled' ? 'danger' : (action === 'no_show' ? 'warning' : 'primary')" :variant="action === 'converted' ? 'base' : 'plain'" :loading="updatingAction === action" :disabled="updatingAction !== null" @click="updateStatus(action)">
            {{ actionLabels[action] }}
          </wd-button>
        </template>
      </view>
    </template>
  </AppDetailPage>
</template>
