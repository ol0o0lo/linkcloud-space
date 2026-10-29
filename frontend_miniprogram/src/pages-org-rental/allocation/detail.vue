<script setup lang="ts">
import type { AllocationCapabilitiesOut, AllocationRequestOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { formatOrganizationDateTime, formatOrganizationMoney, getAllocationRuleSourceLabel, getOrganizationAllocationActions, getOrganizationAllocationLeaseId, getOrganizationAllocationStatusTone } from '@/pages-org-rental/domain/organization-rental'
import { getAllocationCapabilities, getAllocationRequest } from '@/pages-org-rental/api/organization-rental'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppSection from '@/components/app/AppSection.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import { useAppContextStore } from '@/store/app-context-v2'
import { actOnLeaseAllocation } from '@/services/manual/rental-closure'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '收益申请详情' } })

const toast = useToast()
const appContextStore = useAppContextStore()
const requestId = ref(0)
const request = ref<AllocationRequestOut | null>(null)
const capabilities = ref<AllocationCapabilitiesOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const submitting = ref<string | null>(null)
const reasonVisible = ref(false)
const reasonMode = ref<'reject' | 'void'>('reject')
const reason = ref('')

const actions = computed(() => request.value ? getOrganizationAllocationActions(request.value, capabilities.value) : [])
const sourceSnapshot = computed(() => request.value?.source_snapshot || {})
const sourceHouse = computed(() => {
  const value = sourceSnapshot.value.house
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
})
const sourceTenant = computed(() => {
  const value = sourceSnapshot.value.tenant
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
})
const houseLabel = computed(() => [sourceHouse.value.estate_name, sourceHouse.value.building_name, sourceHouse.value.room_number].filter(Boolean).join(' / ') || '未记录房源')
const tenantLabel = computed(() => String(sourceTenant.value.name || '未记录租客'))

function distributionRuleText(value: AllocationRequestOut) {
  if (value.distribution_method === 'percentage')
    return `计算基数 × ${Number(value.distribution_rate_bp || 0) / 100}%`
  return `固定金额 ${formatOrganizationMoney(value.distributable_amount)}`
}

async function loadDetail() {
  if (!requestId.value) {
    loadError.value = '收益申请参数不正确'
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const [nextRequest, nextCapabilities] = await Promise.all([
      getAllocationRequest(appContextStore.organizationSlug, requestId.value),
      getAllocationCapabilities(appContextStore.organizationSlug),
    ])
    request.value = nextRequest
    capabilities.value = nextCapabilities
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '收益申请加载失败' }
  finally { loading.value = false }
}

async function approve() {
  if (!request.value || submitting.value)
    return
  const leaseId = getOrganizationAllocationLeaseId(request.value)
  if (!leaseId) {
    toast.error('未找到来源租约')
    return
  }
  const confirmation = await uni.showModal({ title: '确认通过收益分配申请', content: '通过后按本次成交固定的归属月份生成员工收益记录。', confirmText: '确认通过' })
  if (!confirmation.confirm)
    return
  submitting.value = 'approve'
  try {
    request.value = await actOnLeaseAllocation(appContextStore.organizationSlug, leaseId, request.value.id, 'review', { decision: 'approve' })
    toast.success('收益分配申请已通过')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '收益审核失败') }
  finally { submitting.value = null }
}

function openReason(mode: 'reject' | 'void') {
  reasonMode.value = mode
  reason.value = ''
  reasonVisible.value = true
}

async function submitReasonAction() {
  if (!request.value || submitting.value)
    return
  const normalizedReason = reason.value.trim()
  if (!normalizedReason) {
    toast.warning(reasonMode.value === 'reject' ? '请填写驳回原因' : '请填写作废原因')
    return
  }
  const leaseId = getOrganizationAllocationLeaseId(request.value)
  if (!leaseId) {
    toast.error('未找到来源租约')
    return
  }
  submitting.value = reasonMode.value
  try {
    request.value = reasonMode.value === 'reject'
      ? await actOnLeaseAllocation(appContextStore.organizationSlug, leaseId, request.value.id, 'review', { decision: 'reject', reason: normalizedReason })
      : await actOnLeaseAllocation(appContextStore.organizationSlug, leaseId, request.value.id, 'void', { reason: normalizedReason })
    reasonVisible.value = false
    toast.success(reasonMode.value === 'reject' ? '收益分配申请已驳回' : '申请已作废，冲销流水已生成')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : reasonMode.value === 'reject' ? '收益驳回失败' : '收益作废失败') }
  finally { submitting.value = null }
}

onLoad((options) => {
  requestId.value = Number(options?.id || 0)
  void loadDetail()
})
</script>

<template>
  <AppDetailPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载收益申请…"
    error-title="收益申请不可用"
    :show-actions="actions.length > 0"
    @retry="loadDetail"
  >
    <template #navigation>
      <AppCustomNavigation title="收益申请详情" back scroll-mode="sticky" />
    </template>
    <template #feedback>
      <wd-toast />
    </template>

    <template v-if="request">
      <view class="mx-app-gutter app-card-plain p-3.5">
        <view class="app-row-between">
          <view class="text-base text-content-primary font-bold">
            收益分配申请编号 {{ request.id }}
          </view>
          <AppStatusTag :text="request.status__mapping" :tone="getOrganizationAllocationStatusTone(request.status)" />
        </view>
        <view class="mt-2.5 text-2xl text-app-price font-bold">
          {{ formatOrganizationMoney(request.distributable_amount) }}
        </view>
        <view class="mt-1.5 text-xs text-content-muted">
          {{ request.submitted_by_name_snapshot }} · {{ formatOrganizationDateTime(request.submitted_at) }}
        </view>
      </view>

      <wd-cell-group title="签约摘要" insert>
        <wd-cell title="房源" :label="houseLabel" />
        <wd-cell title="租客" :value="tenantLabel" />
        <wd-cell title="租期" :value="`${sourceSnapshot.start_date || '--'} 至 ${sourceSnapshot.end_date || '--'}`" />
        <wd-cell title="月租" :value="formatOrganizationMoney(String(sourceSnapshot.monthly_rent || ''))" />
        <wd-cell title="归属团队" :value="request.team_name_snapshot || '整个工作空间'" />
        <wd-cell title="业绩归属月" :value="request.performance_month?.slice(0, 7) || '未记录'" />
      </wd-cell-group>

      <wd-cell-group title="收益计算" insert>
        <wd-cell title="计算基数" :value="formatOrganizationMoney(request.basis_amount)" />
        <wd-cell title="规则来源" :value="getAllocationRuleSourceLabel(request.rule_source, request.rule_source__mapping)" />
        <wd-cell title="计算规则" :label="distributionRuleText(request)" />
        <wd-cell title="可分配收益" :value="formatOrganizationMoney(request.distributable_amount)" />
      </wd-cell-group>

      <AppSection v-if="request.items.length" class="mx-app-gutter" title="系统计算依据">
        <view v-for="item in request.items" :key="item.id" class="flex items-center justify-between gap-2 border-0 border-b border-app-divider border-solid py-2.5 last:border-b-0">
          <view class="min-w-0 flex-1">
            <view class="text-content-primary font-semibold">
              {{ item.name }}
            </view>
            <view class="mt-1 text-xs text-content-muted leading-normal">
              {{ item.effect__mapping }}{{ item.remark ? ` · ${item.remark}` : '' }}
            </view>
          </view>
          <view class="shrink-0 text-app-price font-semibold">
            {{ formatOrganizationMoney(item.amount) }}
          </view>
        </view>
      </AppSection>

      <AppSection v-if="request.shares.length" class="mx-app-gutter" title="受益人分配">
        <view v-for="item in request.shares" :key="item.id" class="flex items-center justify-between gap-2 border-0 border-b border-app-divider border-solid py-2.5 last:border-b-0">
          <view class="min-w-0 flex-1">
            <view class="text-content-primary font-semibold">
              {{ item.beneficiary_name_snapshot }}
            </view>
            <view class="mt-1 text-xs text-content-muted leading-normal">
              权重 {{ Number(item.weight_bp) / 100 }}% · 归属基数 {{ formatOrganizationMoney(item.attributed_basis_amount) }}
            </view>
          </view>
          <view class="shrink-0 text-app-price font-semibold">
            {{ formatOrganizationMoney(item.allocated_amount) }}
          </view>
        </view>
      </AppSection>

      <wd-cell-group title="审核记录" insert>
        <wd-cell title="审核截止" :value="formatOrganizationDateTime(request.expires_at)" />
        <wd-cell title="审核人" :value="request.reviewed_by_name_snapshot || '未审核'" />
        <wd-cell title="审核时间" :value="formatOrganizationDateTime(request.reviewed_at)" />
        <wd-cell v-if="request.rejection_reason" title="驳回原因" :label="request.rejection_reason" />
        <wd-cell v-if="request.voided_at" title="作废记录" :label="`${request.voided_by_name_snapshot} 于 ${formatOrganizationDateTime(request.voided_at)} 作废：${request.void_reason}`" />
      </wd-cell-group>
    </template>

    <template #actions>
      <view class="w-full flex flex-col gap-2">
        <wd-button v-if="actions.includes('approve')" block :loading="submitting === 'approve'" :disabled="submitting !== null" @click="approve">
          通过申请
        </wd-button>
        <wd-button v-if="actions.includes('reject')" block type="danger" variant="plain" :disabled="submitting !== null" @click="openReason('reject')">
          驳回申请
        </wd-button>
        <wd-button v-if="actions.includes('void')" block type="danger" variant="plain" :disabled="submitting !== null" @click="openReason('void')">
          作废并冲销
        </wd-button>
      </view>
    </template>

    <template #overlay>
      <AppBottomSheet
        v-model:visible="reasonVisible"
        :title="reasonMode === 'reject' ? '驳回收益分配申请' : '作废已生效收益'"
        :description="reasonMode === 'reject' ? '驳回后可在原租约重新申请，关联租约保持有效。' : '已有流水保留，系统追加等额负数冲销记录，关联租约保持原状。'"
        height="compact"
      >
        <wd-textarea v-model="reason" :placeholder="reasonMode === 'reject' ? '请填写驳回原因' : '请填写作废原因'" :maxlength="2000" show-word-limit clearable />
        <template #footer>
          <wd-button block type="danger" :loading="submitting === reasonMode" :disabled="submitting !== null" @click="submitReasonAction">
            {{ reasonMode === 'reject' ? '确认驳回' : '确认作废并冲销' }}
          </wd-button>
        </template>
      </AppBottomSheet>
    </template>
  </AppDetailPage>
</template>
