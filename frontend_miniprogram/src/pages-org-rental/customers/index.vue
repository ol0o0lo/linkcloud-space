<script setup lang="ts">
import type { CustomerStage, OrganizationCustomer } from '@/services/manual/organization-customers'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref, watch } from 'vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import OrganizationInquiryList from './components/OrganizationInquiryList.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { getOrganizationCustomerDetailRoute } from '@/modules/routes'
import { formatCustomerBudget } from '@/domain/merchant-presentation'
import { formatPhoneDisplay } from '@/domain/phone'
import { createOrganizationCustomer, customerStages, getOrganizationCustomerCapabilities, listOrganizationCustomers } from '@/services/manual/organization-customers'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '客户与咨询', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const toast = useToast()
const keyword = ref('')
const stage = ref<CustomerStage | ''>('')
const stagePickerVisible = ref(false)
const stageSelection = ref<string[]>([''])
const stageOptions = [{ value: '', label: '全部阶段' }, ...customerStages]
const stageLabel = computed(() => stageOptions.find(item => item.value === stage.value)?.label || '全部阶段')
const activeTab = ref<'inquiries' | 'customers'>('inquiries')
const customerTabs = [{ value: 'inquiries', payload: { label: '客户咨询' } }, { value: 'customers', payload: { label: '客户档案' } }]
const inquiryList = ref<InstanceType<typeof OrganizationInquiryList> | null>(null)
const inquiryStatus = ref('')
const scope = ref<'mine' | 'all'>('mine')
const canManage = ref(false)
const ready = ref(false)
const editorVisible = ref(false)
const saving = ref(false)
const form = reactive({ name: '', phone: '', notes: '' })
const hasFilters = computed(() => Boolean(keyword.value.trim() || stage.value))
const list = usePagedPage<OrganizationCustomer>({
  pageSize: 15,
  enabled: () => ready.value && activeTab.value === 'customers',
  keyOf: item => item.id,
  loader: ({ page, pageSize }) => listOrganizationCustomers(appContextStore.organizationSlug, page, pageSize, {
    keyword: keyword.value.trim() || undefined,
    stage: stage.value || undefined,
    scope: scope.value,
  }),
})

watch(activeTab, (value) => {
  if (value === 'customers')
    void list.refresh()
})
function changeStage({ value }: { value: Array<string | number> }) {
  stage.value = customerStages.find(item => item.value === value[0])?.value || ''
  void list.refresh()
}

function selectScope(value: 'mine' | 'all') {
  if (scope.value === value)
    return
  scope.value = value
  void list.refresh()
}

function openStagePicker() {
  stageSelection.value = [stage.value]
  stagePickerVisible.value = true
}

function openCreate() {
  Object.assign(form, { name: '', phone: '', notes: '' })
  editorVisible.value = true
}

function openDetail(id: number) {
  uni.navigateTo({ url: getOrganizationCustomerDetailRoute(id) })
}

function handleEmptyAction() {
  if (!hasFilters.value) {
    openCreate()
    return
  }
  keyword.value = ''
  stage.value = ''
  void list.refresh()
}

async function saveCustomer() {
  if (saving.value)
    return
  if (!form.name.trim() || !form.phone.trim()) {
    toast.warning('请填写客户姓名和手机号')
    return
  }
  saving.value = true
  try {
    const customer = await createOrganizationCustomer(appContextStore.organizationSlug, { name: form.name.trim(), phone: form.phone.trim(), notes: form.notes.trim() })
    editorVisible.value = false
    toast.success('客户已创建')
    openDetail(customer.id)
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '客户创建失败') }
  finally { saving.value = false }
}

onShow(() => {
  if (activeTab.value === 'inquiries')
    void inquiryList.value?.refresh()
})
onPullDownRefresh(async () => {
  if (activeTab.value === 'inquiries') {
    await inquiryList.value?.refresh()
    uni.stopPullDownRefresh()
  }
})
onReachBottom(() => {
  if (activeTab.value === 'inquiries')
    void inquiryList.value?.loadMore()
})
onLoad((options) => {
  activeTab.value = options?.tab === 'customers' || options?.stage ? 'customers' : 'inquiries'
  inquiryStatus.value = String(options?.status || '')
  stage.value = customerStages.find(item => item.value === options?.stage)?.value || ''
  void getOrganizationCustomerCapabilities(appContextStore.organizationSlug)
    .then((result) => {
      canManage.value = result.can_manage
      scope.value = result.can_manage && options?.scope !== 'mine' ? 'all' : 'mine'
    })
    .catch(() => { canManage.value = false })
    .finally(() => {
      ready.value = true
      void list.refresh()
    })
})
</script>

<template>
  <AppPage class="rental-page" variant="list">
    <template #navigation>
      <AppCustomNavigation title="客户与咨询" back scroll-mode="sticky" />
    </template>
    <wd-toast />
    <view class="mb-3 mt-2 flex flex-wrap items-center gap-2">
      <view class="min-w-0 flex-1 rounded-app-lg bg-surface-card p-2">
        <wd-segmented v-model:value="activeTab" :options="customerTabs" aria-label="客户业务">
          <template #label="{ option }">
            {{ option.payload.label }}
          </template>
        </wd-segmented>
      </view>
      <wd-button size="small" @click="openCreate">
        新增客户
      </wd-button>
    </view>
    <OrganizationInquiryList v-if="activeTab === 'inquiries'" ref="inquiryList" :initial-status="inquiryStatus" />
    <template v-else>
      <view class="overflow-hidden rounded-app-lg bg-surface-card">
        <wd-search v-model="keyword" variant="filled" placeholder="搜索客户姓名或手机号" placeholder-left hide-cancel @search="list.refresh" @clear="list.refresh" />
        <view class="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
          <wd-button size="small" :variant="stage ? 'soft' : 'plain'" @click="openStagePicker">
            {{ stageLabel }}
            <view class="i-carbon-chevron-down ml-1 inline-block align-middle" />
          </wd-button>
          <view v-if="canManage" class="flex gap-1">
            <wd-button size="small" :variant="scope === 'mine' ? 'soft' : 'text'" @click="selectScope('mine')">
              我的客户
            </wd-button>
            <wd-button size="small" :variant="scope === 'all' ? 'soft' : 'text'" @click="selectScope('all')">
              全部客户
            </wd-button>
          </view>
        </view>
      </view>
      <view class="min-h-10 flex items-center text-[12px] text-content-secondary">
        {{ scope === 'mine' ? '我负责的客户' : '空间内全部客户' }} · 共 {{ list.total.value }} 位
      </view>
      <AppPagedList
        :items="list.items.value"
        :loading="!ready || list.loading.value"
        :refreshing="list.refreshing.value"
        :loading-more="list.loadingMore.value"
        :finished="list.finished.value"
        :error="list.error.value"
        loading-text="正在加载客户…"
        :empty-text="hasFilters ? '没有符合条件的客户' : '还没有客户'"
        :empty-description="hasFilters ? '试试清除筛选条件。' : '新增客户，或在租客咨询消息中转为客户。'"
        :empty-action-text="hasFilters ? '清除筛选' : '新建客户'"
        finished-text="没有更多客户了"
        @retry="list.refresh"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <AppRecordCard variant="compact" clickable @click="openDetail(item.id)">
            <template #header>
              <view class="flex items-center justify-between gap-2">
                <view class="min-w-0 flex flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <strong class="max-w-full truncate text-[16px] text-content-primary">{{ item.name }}</strong>
                  <text class="text-[12px] text-content-secondary">{{ formatPhoneDisplay(item.phone) }}</text>
                </view>
                <wd-tag size="medium" variant="light" :type="item.stage === 'won' ? 'success' : item.stage === 'lost' ? 'default' : 'primary'">
                  {{ item.stage_label }}
                </wd-tag>
              </view>
            </template>
            <view v-if="!item.is_active" class="mt-1 text-[12px] text-content-secondary">
              已停用 · 不可用于新建带看
            </view>
            <view class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] leading-normal">
              <text class="text-content-primary font-medium">{{ formatCustomerBudget(item.min_rent, item.max_rent) }}</text>
              <text class="text-[12px] text-content-secondary">{{ item.preferred_region || '区域不限' }} · {{ item.bedrooms == null ? '户型不限' : `${item.bedrooms} 间卧室` }}</text>
            </view>
            <template #footer>
              <text class="text-[12px] text-content-secondary">负责人：{{ item.assigned_to_name || '未分配' }}</text>
            </template>
            <template #actions>
              <wd-button size="small" variant="plain" @click.stop="openDetail(item.id)">
                跟进客户
              </wd-button>
            </template>
          </AppRecordCard>
        </template>
      </AppPagedList>
    </template>
    <AppBottomSheet v-model:visible="editorVisible" title="新建客户" height="compact">
      <wd-cell title="姓名" center>
        <wd-input v-model="form.name" placeholder="请输入客户姓名" clearable compact align-right />
      </wd-cell>
      <wd-cell title="手机号" center>
        <wd-input v-model="form.phone" type="tel" placeholder="请输入手机号" clearable compact align-right />
      </wd-cell>
      <wd-cell title="备注" layout="vertical">
        <wd-textarea v-model="form.notes" placeholder="补充客户说明" :maxlength="1000" auto-height compact custom-style="--wot-textarea-inner-min-height: 80px;" show-word-limit />
      </wd-cell>
      <template #footer>
        <wd-button block :loading="saving" :disabled="saving" @click="saveCustomer">
          保存并完善需求
        </wd-button>
      </template>
    </AppBottomSheet>
    <wd-picker v-model="stageSelection" v-model:visible="stagePickerVisible" :columns="stageOptions" title="客户阶段" @confirm="changeStage" />
  </AppPage>
</template>
