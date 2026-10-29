<script setup lang="ts">
import type { AllocationCapabilitiesOut, LeaseAllocationOut, LeaseOut } from '@/pages-org-rental/api/organization-rental'
import type { AllocationBeneficiaryOut } from '@/services/manual/organization-signing'
import type { LeaseAllocationPreview } from '@/services/manual/rental-closure'
import { onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref, watch } from 'vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppEntityPickerOption from '@/components/app/AppEntityPickerOption.vue'
import { getOrganizationAllocationDetailRoute } from '@/modules/routes'
import { getAllocationCapabilities } from '@/pages-org-rental/api/organization-rental'
import AppEntityPickerSheet from '@/pages-org-rental/components/AppEntityPickerSheet.vue'
import { formatOrganizationDateTime, formatOrganizationMoney } from '@/pages-org-rental/domain/organization-rental'
import { actOnLeaseAllocation, createRentalRequestId, listLeaseAllocationHistory, previewLeaseAllocation, submitLeaseAllocation } from '@/services/manual/rental-closure'
import { listSigningBeneficiaries } from '@/services/manual/organization-signing'
import { useAppContextStore } from '@/store/app-context-v2'

const props = defineProps<{ lease: LeaseOut }>()
const context = useAppContextStore()
const toast = useToast()
const history = ref<LeaseAllocationOut[]>([])
const capabilities = ref<AllocationCapabilitiesOut | null>(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const editorVisible = ref(false)
const preview = ref<LeaseAllocationPreview | null>(null)
const previewLoading = ref(false)
const previewError = ref('')
const reason = ref('')
const mode = ref<'initial' | 'resubmit' | 'correction'>('initial')
const beneficiaryIds = ref<number[]>([])
const beneficiaries = ref<AllocationBeneficiaryOut[]>([])
const pickerVisible = ref(false)
const keyword = ref('')
const membersLoading = ref(false)
const membersError = ref('')
const visibleMembers = computed(() => beneficiaries.value.filter(member => member.name.includes(keyword.value.trim())))
const beneficiaryLabel = computed(() => beneficiaryIds.value.map(id => beneficiaries.value.find(member => member.user_id === id)?.name || (id === context.user?.id ? '本人' : `成员 ${id}`)).join('、'))
const latest = computed(() => history.value[0]?.allocation_request || null)
const canApply = computed(() => capabilities.value?.submit && props.lease.can_maintain && props.lease.status !== 'terminated' && (!latest.value || ['rejected', 'expired', 'withdrawn', 'voided'].includes(latest.value.status)))
const canWithdraw = computed(() => latest.value?.status === 'pending' && latest.value.submitted_by_id === context.user?.id)
let requestId = createRentalRequestId()
let generation = 0

async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const [result, caps] = await Promise.all([listLeaseAllocationHistory(context.organizationSlug, props.lease.id), getAllocationCapabilities(context.organizationSlug)])
    if (current !== generation)
      return
    history.value = result.items
    capabilities.value = caps
  }
  catch (failure) {
    if (current === generation)
      error.value = failure instanceof Error ? failure.message : '收益申请加载失败'
  }
  finally {
    if (current === generation)
      loading.value = false
  }
}
async function open(nextMode: 'initial' | 'resubmit' | 'correction') {
  mode.value = nextMode
  reason.value = ''
  beneficiaryIds.value = latest.value?.shares.map(share => share.beneficiary_user_id) || (context.user ? [context.user.id] : [])
  requestId = createRentalRequestId()
  editorVisible.value = true
  preview.value = null
  previewError.value = ''
  if (nextMode === 'resubmit')
    return
  previewLoading.value = true
  try {
    preview.value = await previewLeaseAllocation(context.organizationSlug, props.lease.id, { mode: nextMode, previous_request_id: latest.value?.id })
  }
  catch (failure) { previewError.value = failure instanceof Error ? failure.message : '收益方案预览失败' }
  finally { previewLoading.value = false }
}
async function loadMembers() {
  pickerVisible.value = true
  membersLoading.value = true
  membersError.value = ''
  try {
    beneficiaries.value = await listSigningBeneficiaries(context.organizationSlug)
  }
  catch (failure) { membersError.value = failure instanceof Error ? failure.message : '成员加载失败' }
  finally { membersLoading.value = false }
}
function selectMember(member: AllocationBeneficiaryOut) {
  beneficiaryIds.value = beneficiaryIds.value.includes(member.user_id) ? beneficiaryIds.value.filter(id => id !== member.user_id) : [...beneficiaryIds.value, member.user_id]
}
async function submit() {
  if (saving.value)
    return
  if (mode.value !== 'resubmit' && !preview.value) {
    toast.warning('请先取得有效的收益方案预览')
    return
  }
  if (mode.value === 'correction' && !reason.value.trim()) {
    toast.warning('请填写纠错原因')
    return
  }
  if (mode.value !== 'resubmit' && !beneficiaryIds.value.length) {
    toast.warning('请至少选择一名受益人')
    return
  }
  saving.value = true
  try {
    await submitLeaseAllocation(context.organizationSlug, props.lease.id, {
      mode: mode.value,
      previous_request_id: latest.value?.id,
      ...(mode.value !== 'resubmit' ? { beneficiary_user_ids: beneficiaryIds.value } : {}),
      reason: reason.value.trim() || undefined,
      client_request_id: requestId,
      preview_hash: mode.value === 'resubmit' ? undefined : preview.value?.preview_hash,
    })
    editorVisible.value = false
    toast.success('收益申请已提交，租约保持原状')
    await load()
  }
  catch (failure) { toast.error(failure instanceof Error ? failure.message : '申请未成功，租约已登记，可重试申请') }
  finally { saving.value = false }
}
async function withdraw() {
  if (!latest.value || saving.value)
    return
  if (!(await uni.showModal({ title: '撤回收益申请', content: '撤回后可修改租约资料并纠错重提，租约保持有效。', confirmText: '确认撤回' })).confirm)
    return
  saving.value = true
  try {
    await actOnLeaseAllocation(context.organizationSlug, props.lease.id, latest.value.id, 'withdraw', { reason: '申请人撤回以核对或修正资料' })
    await load()
    toast.success('申请已撤回')
  }
  catch (failure) { toast.error(failure instanceof Error ? failure.message : '撤回失败') }
  finally { saving.value = false }
}
function openRequest(id: number) {
  uni.navigateTo({ url: getOrganizationAllocationDetailRoute(id) })
}
watch(() => [props.lease.id, context.organizationSlug], () => void load(), { immediate: true })
onShow(() => void load())
</script>

<template>
  <wd-cell-group title="收益申请" insert>
    <wd-cell v-if="loading" title="正在加载收益申请…" />
    <wd-cell v-else-if="error" title="收益申请加载失败" :label="error" is-link @click="load" />
    <template v-else>
      <wd-cell title="当前状态" :value="latest?.status__mapping || '收益待申请'" />
      <wd-cell v-if="latest" title="当前申请" :value="`#${latest.id}`" :label="latest.rejection_reason || latest.void_reason || undefined" is-link @click="openRequest(latest!.id)" />
      <wd-cell v-if="latest" title="申请金额" :value="formatOrganizationMoney(latest.distributable_amount)" />
      <wd-cell v-if="canWithdraw" title="撤回并修改资料" is-link @click="withdraw" />
      <wd-cell v-if="canApply && !latest" title="申请收益分配" label="按当前团队规则确认收益申请，独立于租约登记" is-link @click="open('initial')" />
      <wd-cell v-if="canApply && latest && latest.status !== 'voided'" title="按原方案重新申请" label="沿用原团队、金额、规则与业绩月份，重新开始审核期限" is-link @click="open('resubmit')" />
      <wd-cell v-if="canApply && latest" title="资料纠错后重新申请" label="填写原因，按修正后的资料确认新方案" is-link @click="open('correction')" />
      <wd-cell v-if="latest?.status === 'approved'" title="需要修改成交资料？" label="先由有权限的财务作废并冲销当前申请，再修改并纠错重提。" />
      <wd-cell v-for="item in history.slice(1)" :key="item.id" :title="`历史申请 #${item.allocation_request.id}`" :value="item.allocation_request.status__mapping" :label="formatOrganizationDateTime(item.allocation_request.submitted_at)" is-link @click="openRequest(item.allocation_request.id)" />
    </template>
  </wd-cell-group>
  <AppBottomSheet v-model:visible="editorVisible" :title="mode === 'initial' ? '申请收益' : mode === 'correction' ? '纠错重提' : '按原方案重提'" height="default">
    <template v-if="mode === 'resubmit' && latest">
      <wd-cell title="原申请" :value="`#${latest.id}`" />
      <wd-cell title="团队" :value="latest.team_name_snapshot || '空间直属'" />
      <wd-cell title="原方案金额" :value="formatOrganizationMoney(latest.distributable_amount)" />
      <wd-cell title="重提说明" label="原方案保持不变，仅重新计算七天审核期限。" />
    </template>
    <template v-else>
      <wd-cell title="本次月租基数" :value="formatOrganizationMoney(lease.monthly_rent)" />
      <wd-cell v-if="mode === 'correction' && latest" title="原申请月租基数" :value="formatOrganizationMoney(String(latest.source_snapshot.monthly_rent || ''))" />
      <wd-cell title="收益受益人" :value="beneficiaryLabel" :is-link="capabilities?.change_beneficiaries" @click="capabilities?.change_beneficiaries && loadMembers()" />
      <wd-cell v-if="mode === 'correction'" title="纠错原因" layout="vertical">
        <wd-textarea v-model="reason" placeholder="说明本次资料或收益方案的更正原因" :maxlength="2000" />
      </wd-cell>
      <wd-cell v-if="previewLoading" title="正在计算收益方案…" />
      <wd-cell v-else-if="previewError" title="预览失败，点击重试" :label="previewError" is-link @click="open(mode === 'correction' ? 'correction' : 'initial')" />
      <template v-else-if="preview">
        <wd-cell title="归属团队" :value="preview.team_name || '空间直属'" />
        <wd-cell title="业绩归属月" :value="preview.performance_month?.slice(0, 7)" />
        <wd-cell title="计算规则" :value="preview.distribution_method === 'percentage' ? `月租 × ${Number(preview.distribution_rate_bp || 0) / 100}%` : '固定金额'" />
        <wd-cell title="可分配收益" :value="formatOrganizationMoney(preview.distributable_amount)" />
      </template>
    </template>
    <template #footer>
      <wd-button block :loading="saving" :disabled="previewLoading || (mode !== 'resubmit' && !preview)" @click="submit">
        确认提交
      </wd-button>
    </template>
  </AppBottomSheet>
  <AppEntityPickerSheet v-model:visible="pickerVisible" v-model:keyword="keyword" title="选择收益受益人" :items="visibleMembers" item-key="user_id" selection="multiple" :selected="beneficiaryIds" :loading="membersLoading" :error="membersError" @search="loadMembers" @select="selectMember" @confirm="pickerVisible = false">
    <template #item="{ item, selected }">
      <AppEntityPickerOption :title="item.name" :selected="selected" />
    </template>
  </AppEntityPickerSheet>
</template>
