<script setup lang="ts">
import type { WorkspaceMemberOut } from '@/pages-org-rental/api/organization-rental'
import type { CustomerStage, OrganizationCustomer } from '@/services/manual/organization-customers'
import type { OrganizationInquiry } from '@/services/manual/rental-closure'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref, watch } from 'vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppEntityPickerOption from '@/components/app/AppEntityPickerOption.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { formatCustomerBudget, formatMerchantTime } from '@/domain/merchant-presentation'
import { usePagedPage } from '@/hooks/usePagedPage'
import { APP_ROUTES, getOrganizationViewingFormRoute } from '@/modules/routes'
import { listOrganizationViewingAssignees } from '@/pages-org-rental/api/organization-rental'
import AppEntityPickerSheet from '@/pages-org-rental/components/AppEntityPickerSheet.vue'
import { formatOrganizationLocalDate } from '@/pages-org-rental/domain/organization-rental'
import {
  customerStages,
  getOrganizationCustomer,
  getOrganizationCustomerCapabilities,
  patchOrganizationCustomer,
} from '@/services/manual/organization-customers'
import { listOrganizationInquiries } from '@/services/manual/rental-closure'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '客户详情' } })

const appContextStore = useAppContextStore()
const toast = useToast()
const customerId = ref(0)
const customer = ref<OrganizationCustomer | null>(null)
const loading = ref(true)
const loadError = ref('')
const canManage = ref(false)
const moreDetailsVisible = ref(false)
const editorVisible = ref(false)
const assigneeVisible = ref(false)
const moveInVisible = ref(false)
const moveInValue = ref(Date.now())
const saving = ref(false)
const assigneeKeyword = ref('')
let loadGeneration = 0
const form = reactive({
  name: '',
  phone: '',
  email: '',
  notes: '',
  wechat: '',
  source: '',
  stage: 'new' as CustomerStage,
  assigned_to_id: null as number | null,
  assigned_to_name: '',
  min_rent: '',
  max_rent: '',
  preferred_region: '',
  bedrooms: '',
  move_in_date: null as string | null,
})
const assignees = usePagedPage<WorkspaceMemberOut>({
  pageSize: 20,
  enabled: () => canManage.value,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  loader: ({ page, pageSize }) => listOrganizationViewingAssignees(appContextStore.organizationSlug, page, pageSize, { keyword: assigneeKeyword.value.trim() || undefined }),
})
const assigneeLabel = computed(() => form.assigned_to_name || '未分配')
const relatedInquiries = usePagedPage<OrganizationInquiry>({
  pageSize: 3,
  enabled: () => Number.isInteger(customerId.value) && customerId.value > 0 && Boolean(appContextStore.organizationSlug),
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
  loader: ({ page, pageSize }) => listOrganizationInquiries(appContextStore.organizationSlug, page, pageSize, { contact_id: customerId.value }),
})

function sourceLabel(value: string) {
  return ({ manual: '手动录入', inquiry: '租客咨询' } as Record<string, string>)[value] || value || '未填写'
}

async function loadCustomer() {
  if (!Number.isInteger(customerId.value) || customerId.value <= 0 || !appContextStore.organizationSlug)
    return
  const generation = ++loadGeneration
  const slug = appContextStore.organizationSlug
  loading.value = !customer.value
  loadError.value = ''
  try {
    const [record, capabilities] = await Promise.all([
      getOrganizationCustomer(slug, customerId.value),
      getOrganizationCustomerCapabilities(slug).catch(() => ({ can_manage: false })),
    ])
    if (generation !== loadGeneration || slug !== appContextStore.organizationSlug)
      return
    customer.value = record
    canManage.value = capabilities.can_manage
  }
  catch (error) {
    if (generation === loadGeneration && slug === appContextStore.organizationSlug)
      loadError.value = error instanceof Error ? error.message : '客户详情加载失败'
  }
  finally {
    if (generation === loadGeneration)
      loading.value = false
  }
}

function refresh() {
  void loadCustomer()
  void relatedInquiries.refresh()
}

function openInquiry(inquiryId: number) {
  uni.navigateTo({ url: `${APP_ROUTES.organizationInquiryDetail}?id=${inquiryId}` })
}

function openEditor() {
  const item = customer.value
  if (!item)
    return
  Object.assign(form, {
    name: item.name,
    phone: item.phone,
    email: item.email,
    notes: item.notes,
    wechat: item.wechat,
    source: item.source,
    stage: item.stage,
    assigned_to_id: item.assigned_to_id,
    assigned_to_name: item.assigned_to_name,
    min_rent: item.min_rent || '',
    max_rent: item.max_rent || '',
    preferred_region: item.preferred_region,
    bedrooms: item.bedrooms == null ? '' : String(item.bedrooms),
    move_in_date: item.move_in_date,
  })
  editorVisible.value = true
}

function openMoveIn() {
  moveInValue.value = form.move_in_date ? new Date(`${form.move_in_date}T12:00:00`).getTime() : Date.now()
  moveInVisible.value = true
}

function confirmMoveIn({ value }: { value: string | number | Array<string | number> }) {
  const timestamp = Number(value)
  if (Number.isFinite(timestamp))
    form.move_in_date = formatOrganizationLocalDate(new Date(timestamp))
}

function memberLabel(member: WorkspaceMemberOut) {
  return member.employee_name || [member.user.first_name, member.user.last_name].filter(Boolean).join('') || member.user.username
}

function selectAssignee(member: WorkspaceMemberOut | null) {
  form.assigned_to_id = member?.user.id || null
  form.assigned_to_name = member ? memberLabel(member) : ''
  assigneeVisible.value = false
}

function openAssignees() {
  assigneeVisible.value = true
  void assignees.refresh()
}

async function saveCustomer() {
  if (saving.value || !customer.value)
    return
  if (!form.name.trim() || !form.phone.trim()) {
    toast.warning('请填写客户姓名和手机号')
    return
  }
  const minimum = form.min_rent.trim() ? Number(form.min_rent) : null
  const maximum = form.max_rent.trim() ? Number(form.max_rent) : null
  const bedrooms = form.bedrooms.trim() ? Number(form.bedrooms) : null
  if ([minimum, maximum].some(value => value !== null && (!Number.isFinite(value) || value < 0)) || (minimum !== null && maximum !== null && minimum > maximum)) {
    toast.warning('请填写有效预算，最低预算不能高于最高预算')
    return
  }
  if (bedrooms !== null && (!Number.isInteger(bedrooms) || bedrooms < 0)) {
    toast.warning('卧室数量须为非负整数')
    return
  }
  saving.value = true
  const slug = appContextStore.organizationSlug
  try {
    const updated = await patchOrganizationCustomer(slug, customer.value.id, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      notes: form.notes.trim(),
      wechat: form.wechat.trim(),
      source: form.source.trim(),
      stage: form.stage,
      preferred_region: form.preferred_region.trim(),
      min_rent: minimum === null ? null : form.min_rent.trim(),
      max_rent: maximum === null ? null : form.max_rent.trim(),
      bedrooms,
      move_in_date: form.move_in_date,
      ...(canManage.value ? { assigned_to_id: form.assigned_to_id } : {}),
    })
    if (slug !== appContextStore.organizationSlug)
      return
    customer.value = updated
    editorVisible.value = false
    toast.success('客户资料已保存')
  }
  catch (error) {
    if (slug === appContextStore.organizationSlug)
      toast.error(error instanceof Error ? error.message : '客户保存失败')
  }
  finally { saving.value = false }
}

function callCustomer() {
  if (customer.value?.phone)
    uni.makePhoneCall({ phoneNumber: customer.value.phone })
}

function recommendHouses() {
  uni.navigateTo({ url: `${APP_ROUTES.organizationHouses}?customer_id=${customerId.value}` })
}

function createViewing() {
  if (customer.value?.is_active)
    uni.navigateTo({ url: `${getOrganizationViewingFormRoute()}?contact_id=${customerId.value}` })
}

onLoad((options) => {
  customerId.value = Number(options?.id || 0)
  if (!Number.isInteger(customerId.value) || customerId.value <= 0) {
    loading.value = false
    loadError.value = '客户参数不正确'
    return
  }
})
onShow(() => {
  if (Number.isInteger(customerId.value) && customerId.value > 0)
    refresh()
})
watch(() => appContextStore.organizationSlug, () => {
  loadGeneration += 1
  customer.value = null
  canManage.value = false
  editorVisible.value = false
  assigneeVisible.value = false
  moveInVisible.value = false
  moreDetailsVisible.value = false
  assignees.reset()
  relatedInquiries.reset()
  if (Number.isInteger(customerId.value) && customerId.value > 0)
    refresh()
})
</script>

<template>
  <AppDetailPage :loading="loading" :error="loadError" loading-text="正在加载客户…" error-title="客户加载失败" :show-actions="Boolean(customer)" @retry="refresh">
    <template #navigation>
      <AppCustomNavigation title="客户详情" back scroll-mode="sticky" />
    </template>
    <template #feedback>
      <wd-toast />
    </template>
    <template v-if="customer">
      <view class="mx-app-gutter app-card-plain p-4">
        <view class="app-row-between gap-2">
          <view class="min-w-0 break-words text-lg text-content-primary font-bold">
            {{ customer.name }}
          </view>
          <view class="flex shrink-0 items-center gap-2">
            <wd-tag variant="light" size="small">
              {{ customer.stage_label }}
            </wd-tag>
            <wd-button size="small" variant="text" @click="openEditor">
              编辑
            </wd-button>
          </view>
        </view>
        <view class="mt-2 text-base text-content-primary">
          {{ customer.phone }}
        </view>
        <view class="mt-1 text-sm text-content-secondary">
          负责人：{{ customer.assigned_to_name || '未分配' }}
        </view>
        <view v-if="!customer.is_active" class="mt-2 text-xs text-content-muted">
          客户已停用，请在联系人管理中启用后再新建带看。
        </view>
      </view>
      <view class="mx-app-gutter app-card-plain p-4">
        <view class="app-section-title">
          客户需求
        </view>
        <view class="mt-3 text-xs text-content-muted">
          月租预算
        </view>
        <view class="mt-1 whitespace-nowrap text-lg text-app-price font-semibold">
          {{ formatCustomerBudget(customer.min_rent, customer.max_rent) }}
        </view>
        <view class="grid grid-cols-2 mt-4 gap-x-4 gap-y-3">
          <view class="min-w-0">
            <view class="text-xs text-content-muted">
              意向区域
            </view>
            <view class="mt-1 break-words text-sm text-content-primary">
              {{ customer.preferred_region || '不限' }}
            </view>
          </view>
          <view>
            <view class="text-xs text-content-muted">
              卧室数
            </view>
            <view class="mt-1 text-sm text-content-primary">
              {{ customer.bedrooms == null ? '不限' : `${customer.bedrooms} 间` }}
            </view>
          </view>
          <view>
            <view class="text-xs text-content-muted">
              入住日期
            </view>
            <view class="mt-1 text-sm text-content-primary">
              {{ customer.move_in_date || '未确定' }}
            </view>
          </view>
        </view>
      </view>
      <view class="mx-app-gutter overflow-hidden app-card-plain">
        <wd-cell title="更多客户资料" :value="moreDetailsVisible ? '收起' : '展开'" is-link @click="moreDetailsVisible = !moreDetailsVisible" />
        <template v-if="moreDetailsVisible">
          <wd-cell title="微信" :value="customer.wechat || '未填写'" />
          <wd-cell title="邮箱" :value="customer.email || '未填写'" />
          <wd-cell title="来源" :value="sourceLabel(customer.source)" />
          <wd-cell title="备注" :label="customer.notes || '暂无备注'" />
        </template>
      </view>
      <view class="mx-app-gutter app-card-plain p-4">
        <view class="mb-3 app-row-between">
          <view class="app-section-title">
            关联咨询
          </view>
          <text v-if="relatedInquiries.loaded.value" class="text-xs text-content-muted">共 {{ relatedInquiries.total.value }} 条</text>
        </view>
        <AppPagedList
          :items="relatedInquiries.items.value" :loading="relatedInquiries.loading.value" :error="relatedInquiries.error.value"
          empty-text="暂无关联咨询" empty-description="该客户的咨询及后续带看、成交记录会显示在这里。" empty-compact
          @retry="relatedInquiries.refresh"
        >
          <template #item="{ item }">
            <view class="app-touchable rounded-app-md bg-surface-subtle p-3" @click="openInquiry(item.id)">
              <view class="app-row-between items-start">
                <view class="min-w-0 break-words text-sm text-content-primary font-medium">
                  {{ [item.house?.building?.name, item.house?.room_number].filter(Boolean).join(' · ') || '咨询房源' }}
                </view>
                <wd-tag size="small" variant="light" :type="item.status === 'signed' ? 'success' : 'primary'" custom-class="shrink-0">
                  {{ item.status_label }}
                </wd-tag>
              </view>
              <view class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-content-secondary">
                <text>带看 {{ item.viewing_count }} 次</text>
                <text :class="item.signed_lease_id ? 'text-app-success' : 'text-content-muted'">{{ item.signed_lease_id ? '已关联成交租约' : '暂无成交' }}</text>
              </view>
              <view class="mt-2 app-row-between text-xs text-content-muted">
                <text>{{ formatMerchantTime(item.created_at) }}</text>
                <text class="shrink-0 text-app-brand">查看咨询 ›</text>
              </view>
            </view>
          </template>
          <template #loadmore>
            <view v-if="relatedInquiries.error.value" class="mt-3 text-center">
              <view class="text-xs text-app-danger">
                {{ relatedInquiries.error.value.message }}
              </view>
              <wd-button size="small" variant="text" @click="relatedInquiries.refresh">
                重试加载
              </wd-button>
            </view>
            <wd-button v-else-if="!relatedInquiries.finished.value" block size="small" variant="text" :loading="relatedInquiries.loadingMore.value" @click="relatedInquiries.loadMore">
              查看更多咨询
            </wd-button>
          </template>
        </AppPagedList>
      </view>
    </template>
    <template #actions>
      <view class="grid grid-cols-3 w-full gap-2">
        <wd-button variant="plain" :disabled="!customer?.phone" @click="callCustomer">
          拨打
        </wd-button>
        <wd-button variant="soft" @click="recommendHouses">
          推荐房源
        </wd-button>
        <wd-button :disabled="!customer?.is_active" @click="createViewing">
          新建带看
        </wd-button>
      </view>
    </template>
    <template #overlay>
      <AppBottomSheet v-model:visible="editorVisible" title="编辑客户与需求" height="tall">
        <wd-cell title="姓名" center>
          <wd-input v-model="form.name" placeholder="客户姓名" clearable compact align-right />
        </wd-cell>
        <wd-cell title="手机号" center>
          <wd-input v-model="form.phone" type="tel" placeholder="客户手机号" clearable compact align-right />
        </wd-cell>
        <wd-cell title="微信" center>
          <wd-input v-model="form.wechat" placeholder="可不填" clearable compact align-right />
        </wd-cell>
        <wd-cell title="邮箱" center>
          <wd-input v-model="form.email" placeholder="可不填" clearable compact align-right />
        </wd-cell>
        <wd-cell title="来源" :value="sourceLabel(form.source)" />
        <wd-cell v-if="canManage" title="负责人" :value="assigneeLabel" is-link @click="openAssignees" />
        <wd-cell title="客户阶段" layout="vertical">
          <view class="flex flex-wrap gap-2">
            <wd-button v-for="item in customerStages" :key="item.value" size="small" :variant="form.stage === item.value ? 'base' : 'plain'" @click="form.stage = item.value">
              {{ item.label }}
            </wd-button>
          </view>
        </wd-cell>
        <wd-cell title="最低月租" center>
          <wd-input v-model="form.min_rent" type="digit" placeholder="不限" compact align-right />
        </wd-cell>
        <wd-cell title="最高月租" center>
          <wd-input v-model="form.max_rent" type="digit" placeholder="不限" compact align-right />
        </wd-cell>
        <wd-cell title="意向区域" center>
          <wd-input v-model="form.preferred_region" placeholder="不限" clearable compact align-right />
        </wd-cell>
        <wd-cell title="卧室数" center>
          <wd-input v-model="form.bedrooms" type="number" placeholder="不限" compact align-right />
        </wd-cell>
        <wd-cell title="入住日期" :value="form.move_in_date || '未确定'" is-link @click="openMoveIn" />
        <wd-button v-if="form.move_in_date" size="small" variant="text" @click="form.move_in_date = null">
          清除入住日期
        </wd-button>
        <wd-cell title="备注" layout="vertical">
          <wd-textarea v-model="form.notes" placeholder="补充客户需求或注意事项" :maxlength="2000" auto-height compact show-word-limit custom-style="--wot-textarea-inner-min-height: 96px;" />
        </wd-cell>
        <template #footer>
          <wd-button block :loading="saving" :disabled="saving" @click="saveCustomer">
            保存客户
          </wd-button>
        </template>
      </AppBottomSheet>
      <AppEntityPickerSheet
        v-model:visible="assigneeVisible" v-model:keyword="assigneeKeyword" title="选择负责人" search-placeholder="搜索员工姓名或账号"
        :items="assignees.items.value" :item-key="(item: WorkspaceMemberOut) => item.user.id" :selected="form.assigned_to_id ? [form.assigned_to_id] : []"
        :loading="assignees.loading.value" :error="assignees.error.value" :finished="assignees.finished.value" empty-text="未找到空间成员"
        @search="assignees.refresh" @load-more="assignees.loadMore" @select="selectAssignee"
      >
        <template #before-list>
          <view class="app-touchable border-0 border-b border-app-divider border-solid py-2.5" @click="selectAssignee(null)">
            <AppEntityPickerOption title="暂不指定" description="保留为未分配客户" :selected="form.assigned_to_id == null" />
          </view>
        </template>
        <template #item="{ item, selected }">
          <AppEntityPickerOption :title="memberLabel(item)" :description="item.job_title || item.user.username" :selected="selected" />
        </template>
      </AppEntityPickerSheet>
      <wd-datetime-picker v-model="moveInValue" v-model:visible="moveInVisible" type="date" title="入住日期" @confirm="confirmMoveIn" />
    </template>
  </AppDetailPage>
</template>
