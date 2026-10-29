<script setup lang="ts">
import type { WorkspaceMemberOut } from '@/pages-org-rental/api/organization-rental'
import type { OrganizationInquiry } from '@/services/manual/rental-closure'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref, watch } from 'vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppEntityPickerOption from '@/components/app/AppEntityPickerOption.vue'
import { formatMerchantTime } from '@/domain/merchant-presentation'
import { APP_ROUTES, getOrganizationLeaseDetailRoute, getOrganizationViewingDetailRoute, getOrganizationViewingFormRoute } from '@/modules/routes'
import { listOrganizationViewingAssignees } from '@/pages-org-rental/api/organization-rental'
import AppEntityPickerSheet from '@/pages-org-rental/components/AppEntityPickerSheet.vue'
import { assignOrganizationInquiry, bindOrganizationInquiry, getOrganizationInquiry, updateOrganizationInquiry } from '@/services/manual/rental-closure'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '客户咨询' } })
const context = useAppContextStore()
const toast = useToast()
const id = ref(0)
const inquiry = ref<OrganizationInquiry | null>(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const canManage = computed(() => Boolean(inquiry.value?.can_manage))
const needsContactDetails = computed(() => !inquiry.value?.customer_name || !inquiry.value?.phone)
const editorVisible = ref(false)
const assigneeVisible = ref(false)
const assigneeKeyword = ref('')
const assignees = ref<WorkspaceMemberOut[]>([])
const assigneeLoading = ref(false)
const assigneeError = ref('')
const form = reactive({ customer_name: '', phone: '', wechat: '', notes: '' })
let loadGeneration = 0
let assigneeGeneration = 0

async function load() {
  if (!Number.isInteger(id.value) || id.value <= 0 || !context.organizationSlug)
    return
  const generation = ++loadGeneration
  const slug = context.organizationSlug
  loading.value = !inquiry.value
  error.value = ''
  try {
    const record = await getOrganizationInquiry(slug, id.value)
    if (generation === loadGeneration && slug === context.organizationSlug)
      inquiry.value = record
  }
  catch (failure) {
    if (generation === loadGeneration && slug === context.organizationSlug)
      error.value = failure instanceof Error ? failure.message : '咨询加载失败'
  }
  finally {
    if (generation === loadGeneration)
      loading.value = false
  }
}
function edit() {
  if (!inquiry.value)
    return
  Object.assign(form, { customer_name: inquiry.value.customer_name, phone: inquiry.value.phone, wechat: inquiry.value.wechat, notes: inquiry.value.notes })
  editorVisible.value = true
}
async function save() {
  if (saving.value || !inquiry.value?.can_process)
    return
  const slug = context.organizationSlug
  saving.value = true
  try {
    const changes = inquiry.value.contact_id ? { wechat: form.wechat, notes: form.notes } : { ...form }
    const updated = await updateOrganizationInquiry(slug, id.value, changes)
    if (slug !== context.organizationSlug)
      return
    inquiry.value = updated
    editorVisible.value = false
    toast.success('咨询资料已保存')
  }
  catch (failure) { toast.error(failure instanceof Error ? failure.message : '保存失败') }
  finally { saving.value = false }
}
async function setStatus(status: 'processing' | 'closed') {
  if (saving.value || !inquiry.value?.can_process)
    return
  const slug = context.organizationSlug
  if (status === 'closed' && !(await uni.showModal({ title: '关闭本次咨询', content: '仅结束这次咨询的处理，保留已有业务记录。', confirmText: '确认关闭' })).confirm)
    return
  if (slug !== context.organizationSlug)
    return
  saving.value = true
  try {
    const updated = await updateOrganizationInquiry(slug, id.value, { status })
    if (slug === context.organizationSlug)
      inquiry.value = updated
  }
  catch (failure) { toast.error(failure instanceof Error ? failure.message : '状态更新失败') }
  finally { saving.value = false }
}
async function prepareBusiness(kind: 'viewing' | 'signing') {
  if (!inquiry.value?.can_process || saving.value)
    return
  if (kind === 'signing' && inquiry.value.house.is_active === false) {
    toast.warning('房源已停用，请恢复后再登记签约')
    return
  }
  if (!inquiry.value.phone || !inquiry.value.customer_name) {
    edit()
    toast.warning('请先补齐客户称呼和手机号，再办理带看或签约')
    return
  }
  const slug = context.organizationSlug
  let record = inquiry.value
  saving.value = true
  try {
    if (!record.contact_id) {
      await bindOrganizationInquiry(slug, id.value, { name: record.customer_name, phone: record.phone })
      if (slug !== context.organizationSlug)
        return
      record = await getOrganizationInquiry(slug, id.value)
    }
    if (slug !== context.organizationSlug)
      return
    inquiry.value = record
    const path = kind === 'viewing' ? getOrganizationViewingFormRoute() : APP_ROUTES.organizationSigning
    uni.navigateTo({ url: `${path}?inquiry_id=${id.value}&houseId=${record.house_id}` })
  }
  catch (failure) { toast.error(failure instanceof Error ? failure.message : '客户绑定失败') }
  finally { saving.value = false }
}
async function loadAssignees() {
  const generation = ++assigneeGeneration
  const slug = context.organizationSlug
  assigneeLoading.value = true
  assigneeError.value = ''
  try {
    const result = await listOrganizationViewingAssignees(slug, 1, 100, { keyword: assigneeKeyword.value.trim() || undefined })
    if (generation === assigneeGeneration && slug === context.organizationSlug)
      assignees.value = result.items
  }
  catch (failure) {
    if (generation === assigneeGeneration && slug === context.organizationSlug)
      assigneeError.value = failure instanceof Error ? failure.message : '成员加载失败'
  }
  finally {
    if (generation === assigneeGeneration)
      assigneeLoading.value = false
  }
}
function memberName(member: WorkspaceMemberOut) {
  return member.employee_name || [member.user.first_name, member.user.last_name].filter(Boolean).join('') || member.user.username
}
async function assign(member: WorkspaceMemberOut) {
  if (saving.value || !canManage.value)
    return
  const slug = context.organizationSlug
  if (!(await uni.showModal({ title: '转派咨询', content: `将本次咨询和未完成带看交给${memberName(member)}，客户整体归属保持原状。`, confirmText: '确认转派' })).confirm)
    return
  if (slug !== context.organizationSlug)
    return
  saving.value = true
  try {
    const updated = await assignOrganizationInquiry(slug, id.value, member.user.id)
    if (slug !== context.organizationSlug)
      return
    inquiry.value = updated
    assigneeVisible.value = false
    toast.success('咨询已转派')
  }
  catch (failure) { toast.error(failure instanceof Error ? failure.message : '转派失败') }
  finally { saving.value = false }
}
function openViewing(id: number) {
  uni.navigateTo({ url: getOrganizationViewingDetailRoute(id) })
}
function openLease() {
  if (inquiry.value?.signed_lease_id)
    uni.navigateTo({ url: getOrganizationLeaseDetailRoute(inquiry.value.signed_lease_id) })
}
function callCustomer() {
  if (inquiry.value?.phone)
    uni.makePhoneCall({ phoneNumber: inquiry.value.phone })
}
function copyWechat() {
  if (inquiry.value?.wechat)
    uni.setClipboardData({ data: inquiry.value.wechat })
}
onLoad((options) => {
  id.value = Number(options?.id || 0)
  if (!Number.isInteger(id.value) || id.value <= 0)
    error.value = '咨询参数不正确'
})
onShow(() => void load())
watch(() => context.organizationSlug, () => {
  loadGeneration += 1
  assigneeGeneration += 1
  inquiry.value = null
  editorVisible.value = false
  assigneeVisible.value = false
  assignees.value = []
  assigneeKeyword.value = ''
  assigneeLoading.value = false
  assigneeError.value = ''
  void load()
})
</script>

<template>
  <AppDetailPage :loading="loading" :error="error" loading-text="正在加载咨询…" error-title="咨询不可用" :show-actions="Boolean(inquiry?.can_process)" @retry="load">
    <template #navigation>
      <AppCustomNavigation title="客户咨询" back scroll-mode="sticky" />
    </template>
    <template #feedback>
      <wd-toast />
    </template>
    <template v-if="inquiry">
      <view class="mx-app-gutter app-card-plain p-4">
        <view class="app-row-between items-start">
          <view class="min-w-0 break-words text-lg text-content-primary font-bold">
            {{ inquiry.customer_name || '咨询客户' }}
          </view>
          <view class="flex shrink-0 items-center gap-2">
            <wd-tag size="small" variant="light" :type="inquiry.status === 'signed' ? 'success' : inquiry.status === 'closed' ? 'info' : 'primary'">
              {{ inquiry.status === 'new' ? '待处理' : inquiry.status_label }}
            </wd-tag>
            <wd-button v-if="inquiry.can_process" size="small" variant="text" :disabled="saving" @click="edit">
              编辑
            </wd-button>
          </view>
        </view>
        <view class="mt-2 app-row-between">
          <view class="text-base" :class="inquiry.phone ? 'text-content-primary' : 'text-content-muted'">
            {{ inquiry.phone || '尚未提供手机号' }}
          </view>
          <wd-button v-if="inquiry.phone" size="small" variant="text" @click="callCustomer">
            拨打
          </wd-button>
        </view>
        <view class="mt-1 text-sm text-content-secondary">
          负责人：{{ inquiry.assigned_to_name || '未分配' }}
        </view>
      </view>
      <view v-if="inquiry.can_process" class="mx-app-gutter rounded-app-lg bg-surface-brand-soft p-4">
        <view class="app-section-title">
          下一步
        </view>
        <view class="mt-2 text-sm text-content-secondary leading-relaxed">
          {{ needsContactDetails ? '补齐客户称呼和手机号后，可安排带看或登记签约。' : '可先安排带看，确认成交后登记签约。' }}
        </view>
        <view v-if="needsContactDetails || inquiry.status === 'new'" class="mt-3 flex flex-wrap gap-2">
          <wd-button v-if="needsContactDetails" size="small" :disabled="saving" @click="edit">
            完善联系方式
          </wd-button>
          <wd-button v-if="inquiry.status === 'new'" size="small" variant="plain" :disabled="saving" @click="setStatus('processing')">
            开始处理
          </wd-button>
        </view>
      </view>
      <view class="mx-app-gutter app-card-plain p-4">
        <view class="app-section-title">
          本次需求
        </view>
        <view class="mt-3 text-xs text-content-muted">
          咨询房源
        </view>
        <view class="mt-1 break-words text-base text-content-primary font-medium">
          {{ [inquiry.house?.building?.name, inquiry.house?.room_number].filter(Boolean).join(' · ') || '房源信息待确认' }}
        </view>
        <view class="mt-4 text-xs text-content-muted">
          需求备注
        </view>
        <view class="mt-1 whitespace-pre-wrap break-words text-sm text-content-secondary leading-relaxed">
          {{ inquiry.notes || '暂无备注' }}
        </view>
        <view class="mt-3 text-xs text-content-muted">
          咨询时间 · {{ formatMerchantTime(inquiry.created_at) }}
        </view>
      </view>
      <wd-cell-group title="带看记录" insert>
        <wd-cell v-for="item in inquiry.viewings || []" :key="item.id" :title="item.house?.room_number || '带看记录'" :value="item.status__mapping" :label="formatMerchantTime(item.scheduled_at)" is-link @click="openViewing(item.id)" />
        <wd-cell v-if="!inquiry.viewings?.length" title="暂无带看记录" label="安排带看后，可在这里查看进度。" />
      </wd-cell-group>
      <wd-cell-group v-if="inquiry.signed_lease_id" title="成交结果" insert>
        <wd-cell title="查看关联租约" is-link @click="openLease" />
      </wd-cell-group>
      <wd-cell-group title="咨询管理" insert>
        <wd-cell title="微信" :value="inquiry.wechat || '尚未提供'" :label="inquiry.wechat ? '点击复制微信号' : ''" :is-link="Boolean(inquiry.wechat)" @click="copyWechat" />
        <wd-cell v-if="inquiry.can_process" title="完善联系方式与备注" is-link @click="edit" />
        <wd-cell v-if="canManage && !['closed', 'signed'].includes(inquiry.status)" title="转派本次咨询" label="同时转交未完成带看" is-link @click="assigneeVisible = true; loadAssignees()" />
        <wd-cell v-if="inquiry.can_process" title="关闭本次咨询" is-link @click="setStatus('closed')" />
      </wd-cell-group>
    </template>
    <template #actions>
      <view class="grid grid-cols-2 w-full gap-2">
        <wd-button variant="plain" :disabled="saving" @click="prepareBusiness('viewing')">
          安排带看
        </wd-button>
        <wd-button :disabled="saving || inquiry?.house.is_active === false" @click="prepareBusiness('signing')">
          登记签约
        </wd-button>
      </view>
    </template>
    <template #overlay>
      <AppBottomSheet v-model:visible="editorVisible" title="完善咨询资料" height="default">
        <wd-cell title="客户称呼">
          <wd-input v-model="form.customer_name" :readonly="Boolean(inquiry?.contact_id)" compact align-right />
        </wd-cell>
        <wd-cell title="手机号">
          <wd-input v-model="form.phone" type="tel" :readonly="Boolean(inquiry?.contact_id)" placeholder="转带看、签约时需填写" compact align-right />
        </wd-cell>
        <view v-if="inquiry?.contact_id" class="px-3 py-2 text-xs text-content-secondary leading-relaxed">
          已确认客户的姓名与手机号请在客户档案中维护。
        </view>
        <wd-cell title="微信">
          <wd-input v-model="form.wechat" compact align-right />
        </wd-cell>
        <wd-cell title="需求备注" layout="vertical">
          <wd-textarea v-model="form.notes" placeholder="补充租房需求或注意事项" :maxlength="2000" auto-height compact show-word-limit custom-style="--wot-textarea-inner-min-height: 96px;" />
        </wd-cell>
        <template #footer>
          <wd-button block :loading="saving" @click="save">
            保存
          </wd-button>
        </template>
      </AppBottomSheet>
      <AppEntityPickerSheet v-model:visible="assigneeVisible" v-model:keyword="assigneeKeyword" title="选择接手人" :items="assignees" :item-key="(item: WorkspaceMemberOut) => item.user.id" :loading="assigneeLoading" :error="assigneeError" @search="loadAssignees" @select="assign">
        <template #item="{ item }">
          <AppEntityPickerOption :title="memberName(item)" />
        </template>
      </AppEntityPickerSheet>
    </template>
  </AppDetailPage>
</template>
