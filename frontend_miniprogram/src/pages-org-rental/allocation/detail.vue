<script setup lang="ts">
import type { AllocationCapabilitiesOut, AllocationRequestOut } from '@/features/organization-rental/service'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { formatOrganizationDateTime, formatOrganizationMoney, getAllocationRuleSourceLabel, getOrganizationAllocationActions, getOrganizationAllocationLeaseId } from '@/domain/organization-rental'
import { getAllocationCapabilities, getAllocationRequest, reviewOrganizationAllocation, voidOrganizationAllocation } from '@/features/organization-rental/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '收益申请详情' } })

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

function statusTone(status: string) {
  if (status === 'approved')
    return 'success'
  if (status === 'rejected' || status === 'voided' || status === 'expired')
    return 'danger'
  return 'warning'
}

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
  const confirmation = await uni.showModal({ title: '确认通过收益分配申请', content: '通过后会立即按提交时间生成员工收益流水。', confirmText: '确认通过' })
  if (!confirmation.confirm)
    return
  submitting.value = 'approve'
  try {
    request.value = await reviewOrganizationAllocation(appContextStore.organizationSlug, leaseId, { decision: 'approve' })
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
      ? await reviewOrganizationAllocation(appContextStore.organizationSlug, leaseId, { decision: 'reject', reason: normalizedReason })
      : await voidOrganizationAllocation(appContextStore.organizationSlug, leaseId, { reason: normalizedReason })
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
  <view class="detail-page">
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载收益申请…" />
    <AppErrorView v-else-if="loadError" title="收益申请不可用" :message="loadError" @retry="loadDetail" />
    <template v-else-if="request">
      <view class="hero-card">
        <view class="hero-line">
          <strong>收益分配申请编号 {{ request.id }}</strong>
          <wd-tag :type="statusTone(request.status)" variant="light">
            {{ request.status__mapping }}
          </wd-tag>
        </view>
        <view class="hero-money">
          {{ formatOrganizationMoney(request.distributable_amount) }}
        </view>
        <view class="hero-meta">
          {{ request.submitted_by_name_snapshot }} · {{ formatOrganizationDateTime(request.submitted_at) }}
        </view>
      </view>

      <wd-cell-group title="签约摘要" insert>
        <wd-cell title="房源" :label="houseLabel" />
        <wd-cell title="租客" :value="tenantLabel" />
        <wd-cell title="租期" :value="`${sourceSnapshot.start_date || '--'} 至 ${sourceSnapshot.end_date || '--'}`" />
        <wd-cell title="月租" :value="formatOrganizationMoney(String(sourceSnapshot.monthly_rent || ''))" />
        <wd-cell title="归属团队" :value="request.team_name_snapshot || '全组织'" />
      </wd-cell-group>

      <wd-cell-group title="收益计算" insert>
        <wd-cell title="计算基数" :value="formatOrganizationMoney(request.basis_amount)" />
        <wd-cell title="规则来源" :value="getAllocationRuleSourceLabel(request.rule_source, request.rule_source__mapping)" />
        <wd-cell title="计算规则" :label="distributionRuleText(request)" />
        <wd-cell title="可分配收益" :value="formatOrganizationMoney(request.distributable_amount)" />
      </wd-cell-group>

      <view v-if="request.items.length" class="section-card">
        <view class="section-title">
          系统计算依据
        </view>
        <view v-for="item in request.items" :key="item.id" class="detail-row">
          <view><strong>{{ item.name }}</strong><text>{{ item.effect__mapping }}{{ item.remark ? ` · ${item.remark}` : '' }}</text></view>
          <strong>{{ formatOrganizationMoney(item.amount) }}</strong>
        </view>
      </view>

      <view v-if="request.shares.length" class="section-card">
        <view class="section-title">
          受益人分配
        </view>
        <view v-for="item in request.shares" :key="item.id" class="detail-row">
          <view><strong>{{ item.beneficiary_name_snapshot }}</strong><text>权重 {{ Number(item.weight_bp) / 100 }}% · 归属基数 {{ formatOrganizationMoney(item.attributed_basis_amount) }}</text></view>
          <strong>{{ formatOrganizationMoney(item.allocated_amount) }}</strong>
        </view>
      </view>

      <wd-cell-group title="审核记录" insert>
        <wd-cell title="审核截止" :value="formatOrganizationDateTime(request.expires_at)" />
        <wd-cell title="审核人" :value="request.reviewed_by_name_snapshot || '未审核'" />
        <wd-cell title="审核时间" :value="formatOrganizationDateTime(request.reviewed_at)" />
        <wd-cell v-if="request.rejection_reason" title="驳回原因" :label="request.rejection_reason" />
        <wd-cell v-if="request.voided_at" title="作废记录" :label="`${request.voided_by_name_snapshot} 于 ${formatOrganizationDateTime(request.voided_at)} 作废：${request.void_reason}`" />
      </wd-cell-group>

      <view v-if="actions.length" class="action-card">
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

    <wd-popup v-model="reasonVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx;">
      <view class="popup-title">
        {{ reasonMode === 'reject' ? '驳回收益分配申请' : '作废已生效收益' }}
      </view>
      <view class="popup-copy">
        {{ reasonMode === 'reject' ? '驳回后关联租约将终止。' : '已有流水不会删除，系统会追加等额负数冲销流水。' }}
      </view>
      <wd-textarea v-model="reason" :placeholder="reasonMode === 'reject' ? '请填写驳回原因' : '请填写作废原因'" :maxlength="2000" show-word-limit clearable />
      <wd-button block type="danger" :loading="submitting === reasonMode" :disabled="submitting !== null" @click="submitReasonAction">
        {{ reasonMode === 'reject' ? '确认驳回' : '确认作废并冲销' }}
      </wd-button>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  padding: 24rpx 0 60rpx;
  background: var(--app-bg-page);
}
.hero-card,
.section-card,
.action-card {
  margin: 0 24rpx 24rpx;
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.hero-line,
.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}
.hero-line > strong {
  color: var(--app-text-primary);
  font-size: 30rpx;
}
.hero-money {
  margin-top: 22rpx;
  color: var(--app-color-price);
  font-size: 44rpx;
  font-weight: 700;
}
.hero-meta,
.detail-row text,
.popup-copy {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.hero-meta {
  margin-top: 10rpx;
}
.section-title {
  margin-bottom: 10rpx;
  color: var(--app-text-primary);
  font-size: 27rpx;
  font-weight: 700;
}
.detail-row {
  padding: 20rpx 0;
  border-bottom: 1px solid var(--app-divider-color);
}
.detail-row:last-child {
  border-bottom: 0;
}
.detail-row > view {
  min-width: 0;
  flex: 1;
}
.detail-row strong,
.detail-row text {
  display: block;
}
.detail-row > strong {
  flex-shrink: 0;
  color: var(--app-color-price);
}
.detail-row text {
  margin-top: 6rpx;
  line-height: 1.5;
}
.action-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.popup-title {
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.popup-copy {
  margin: 12rpx 0 20rpx;
  line-height: 1.6;
}
</style>
