<script setup lang="ts">
import type { HouseOut } from '@/pages-org-rental/api/organization-rental'
import type { HouseMatchShareCreateOut } from '@/services/manual/organization-matches'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref, watch } from 'vue'
import { HouseStatus, listOrganizationHouses } from '@/pages-org-rental/api/organization-rental'
import { buildMerchantHouseFilters, canSelectMatchHouse } from '@/pages-org-rental/domain/organization-matches'
import { formatOrganizationHouseTitle } from '@/pages-org-rental/domain/organization-rental'
import { APP_ROUTES, getHouseMatchRoute, getOrganizationHouseDetailRoute } from '@/modules/routes'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import OrganizationHouseCard from './components/OrganizationHouseCard.vue'
import RentalPageHeading from '../components/RentalPageHeading.vue'
import RentalFilterTabs from '../components/RentalFilterTabs.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { getOrganizationCustomer } from '@/services/manual/organization-customers'
import { createOrganizationMatch } from '@/services/manual/organization-matches'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '工作空间房源', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const toast = useToast()
const keyword = ref('')
const statusOptions = [{ value: 'all', label: '全部房源' }, { value: HouseStatus.listed, label: '招租中' }, { value: HouseStatus.rented, label: '已出租' }, { value: HouseStatus.paused, label: '暂不出租' }]
const statusFilter = ref<'all' | HouseStatus>('all')
const inspectionOnly = ref(false)
const filterVisible = ref(false)
const emptyFilters = { minRent: '', maxRent: '', bedrooms: '', district: '', isActive: 'all' as 'all' | 'true' | 'false' }
const filters = reactive({ ...emptyFilters })
const filterDraft = reactive({ ...filters })
const selectionMode = ref(false)
const selectedHouses = ref<Record<number, { id: number, title: string }>>({})
const selectedItems = computed(() => Object.values(selectedHouses.value))
const selectionCount = computed(() => selectedItems.value.length)
const createVisible = ref(false)
const saving = ref(false)
const matchForm = reactive({ title: '', remark: '' })
const createdShare = ref<(HouseMatchShareCreateOut & { title: string }) | null>(null)
const customerName = ref('')
const customerLoading = ref(false)
const customerLoadError = ref('')
const customerId = ref(0)

onLoad((options) => {
  selectionMode.value = options?.match === 'true'
  inspectionOnly.value = options?.inspection_due === 'true'
  const status = options?.status
  if (status === HouseStatus.paused || status === HouseStatus.listed || status === HouseStatus.rented)
    statusFilter.value = status
  if (options?.is_active === 'true' || options?.is_active === 'false')
    filters.isActive = options.is_active
  customerId.value = Number(options?.customer_id || 0)
  if (Number.isInteger(customerId.value) && customerId.value > 0)
    void loadCustomerRequirements()
})
const summaryCounts = reactive({ paused: 0, inspection: 0 })
const extraFilterCount = computed(() => [filters.minRent, filters.maxRent, filters.bedrooms, filters.district, filters.isActive === 'all' ? '' : filters.isActive].filter(value => value !== '').length)
const hasFilters = computed(() => Boolean(keyword.value.trim() || statusFilter.value !== 'all' || inspectionOnly.value || extraFilterCount.value))
const filterSummary = computed(() => [
  filters.minRent || filters.maxRent ? `租金 ${filters.minRent || '不限'} ~ ${filters.maxRent || '不限'}` : '',
  filters.bedrooms !== '' ? `${filters.bedrooms} 室` : '',
  filters.district,
  filters.isActive === 'all' ? '' : filters.isActive === 'true' ? '仅启用房源' : '仅停用房源',
].filter(Boolean).join(' · '))
const list = usePagedPage<HouseOut>({
  pageSize: 15,
  enabled: () => !customerLoading.value && Boolean(appContextStore.organizationSlug),
  loader: async ({ page, pageSize }) => {
    const organizationSlug = appContextStore.organizationSlug
    const result = await listOrganizationHouses(organizationSlug, page, pageSize, {
      ...buildMerchantHouseFilters(filters),
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      inspection_due: inspectionOnly.value || undefined,
      is_active: filters.isActive === 'all' ? undefined : filters.isActive === 'true',
    })
    if (organizationSlug !== appContextStore.organizationSlug)
      return { ...result, items: [], total: 0 }
    for (const house of result.items) {
      if (selectedHouses.value[house.id] && !canSelectMatchHouse(house))
        delete selectedHouses.value[house.id]
    }
    if (page === 1) {
      const [paused, inspection] = await Promise.all([
        listOrganizationHouses(organizationSlug, 1, 1, { status: HouseStatus.paused, is_active: true }),
        listOrganizationHouses(organizationSlug, 1, 1, { inspection_due: true, is_active: true }),
      ])
      if (organizationSlug !== appContextStore.organizationSlug)
        return { ...result, items: [], total: 0 }
      summaryCounts.paused = paused.total
      summaryCounts.inspection = inspection.total
    }
    return result
  },
})

async function loadCustomerRequirements() {
  const organizationSlug = appContextStore.organizationSlug
  customerLoading.value = true
  customerLoadError.value = ''
  try {
    const customer = await getOrganizationCustomer(organizationSlug, customerId.value)
    if (organizationSlug !== appContextStore.organizationSlug)
      return
    customerName.value = customer.name
    Object.assign(filters, {
      minRent: customer.min_rent ?? '',
      maxRent: customer.max_rent ?? '',
      bedrooms: customer.bedrooms == null ? '' : String(customer.bedrooms),
      district: customer.preferred_region || '',
    })
    statusFilter.value = HouseStatus.listed
    selectionMode.value = true
  }
  catch (error) {
    if (organizationSlug === appContextStore.organizationSlug)
      customerLoadError.value = error instanceof Error ? error.message : '客户需求加载失败，可重试或手动筛选'
  }
  finally {
    customerLoading.value = false
    void list.refresh()
  }
}

function openFilters() {
  Object.assign(filterDraft, filters)
  filterVisible.value = true
}

function applyFilters() {
  try {
    buildMerchantHouseFilters(filterDraft)
    Object.assign(filters, filterDraft)
    filterVisible.value = false
    void list.refresh()
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '筛选条件不正确')
  }
}

function resetFilters() {
  Object.assign(filters, emptyFilters)
  keyword.value = ''
  statusFilter.value = 'all'
  inspectionOnly.value = false
  void list.refresh()
}

function toggleHouse(house: HouseOut) {
  if (saving.value)
    return
  if (!selectionMode.value) {
    openHouse(house.id)
    return
  }
  if (!canSelectMatchHouse(house))
    return
  if (selectedHouses.value[house.id]) {
    delete selectedHouses.value[house.id]
    return
  }
  if (selectionCount.value >= 100) {
    toast.warning('每份配房单最多选择 100 套房源')
    return
  }
  selectedHouses.value[house.id] = { id: house.id, title: formatOrganizationHouseTitle(house) }
}

async function toggleSelection() {
  if (saving.value)
    return
  if (selectionMode.value && selectionCount.value) {
    const result = await uni.showModal({ title: '退出批选', content: '退出后会清空已选房源，是否继续？', confirmText: '退出并清空' })
    if (!result.confirm)
      return
    selectedHouses.value = {}
  }
  selectionMode.value = !selectionMode.value
}

async function clearSelection() {
  if (saving.value || !selectionCount.value)
    return
  const result = await uni.showModal({ title: '清空已选房源', content: `确认清空已选的 ${selectionCount.value} 套房源？`, confirmText: '清空已选' })
  if (result.confirm)
    selectedHouses.value = {}
}

function prepareMatch() {
  if (!selectionCount.value || saving.value)
    return
  createdShare.value = null
  matchForm.title = customerName.value ? `给${customerName.value}的房源推荐` : '为你精选的房源'
  matchForm.remark = ''
  createVisible.value = true
}

async function saveMatch() {
  if (saving.value || createdShare.value || !selectionCount.value)
    return
  const title = matchForm.title.trim()
  if (!title) {
    toast.warning('请填写配房标题')
    return
  }
  saving.value = true
  const organizationSlug = appContextStore.organizationSlug
  try {
    const result = await createOrganizationMatch(organizationSlug, {
      title,
      remark: matchForm.remark.trim(),
      house_ids: selectedItems.value.map(house => house.id),
    })
    if (organizationSlug !== appContextStore.organizationSlug)
      return
    createdShare.value = { ...result, title }
    createVisible.value = true
    selectedHouses.value = {}
    selectionMode.value = false
    toast.success('配房单已生成')
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '生成失败，请确认所选房源仍处于招租状态')
  }
  finally {
    saving.value = false
  }
}

function copyShare() {
  if (createdShare.value)
    uni.setClipboardData({ data: createdShare.value.share_url })
}

function previewShare() {
  if (createdShare.value)
    uni.navigateTo({ url: getHouseMatchRoute(createdShare.value.share_key) })
}

function openMatches() {
  uni.navigateTo({ url: APP_ROUTES.organizationMatches })
}

onShareAppMessage(() => ({
  title: createdShare.value?.title || '为你精选的房源',
  path: createdShare.value ? getHouseMatchRoute(createdShare.value.share_key) : APP_ROUTES.houses,
}))

watch(() => appContextStore.organizationSlug, (slug, previous) => {
  if (!previous || slug === previous)
    return
  selectedHouses.value = {}
  createdShare.value = null
  createVisible.value = false
  selectionMode.value = false
  customerName.value = ''
  customerId.value = 0
  customerLoadError.value = ''
  summaryCounts.paused = 0
  summaryCounts.inspection = 0
  list.reset()
  resetFilters()
})

function changeStatus(status: 'all' | HouseStatus) {
  if (statusFilter.value === status && !inspectionOnly.value)
    return
  statusFilter.value = status
  inspectionOnly.value = false
  void list.refresh()
}

function showPaused() {
  filters.isActive = 'true'
  statusFilter.value = HouseStatus.paused
  inspectionOnly.value = false
  void list.refresh()
}

function showInspection() {
  keyword.value = ''
  statusFilter.value = 'all'
  inspectionOnly.value = true
  filters.isActive = 'true'
  void list.refresh()
}

function openHouse(id: number) {
  uni.navigateTo({ url: getOrganizationHouseDetailRoute(id) })
}

function createHouse() {
  uni.navigateTo({ url: APP_ROUTES.organizationHouseForm })
}

function openMap() {
  uni.navigateTo({ url: APP_ROUTES.organizationMap })
}

function handleEmptyAction() {
  if (!hasFilters.value) {
    createHouse()
    return
  }
  resetFilters()
}
</script>

<template>
  <AppPage class="rental-page" variant="list" :reserve-footer-space="selectionMode">
    <template #navigation>
      <AppCustomNavigation title="房源管理" back scroll-mode="sticky" />
    </template>
    <RentalPageHeading title="房源库" description="维护房态与资料，为客户挑选合适的房源" :total="!hasFilters && list.loaded.value ? list.total.value : null" unit="套">
      <wd-button size="small" @click="createHouse">
        录入房源
      </wd-button>
    </RentalPageHeading>
    <view class="rental-summary">
      <view class="rental-summary__item app-touchable" role="button" @click="showPaused">
        <strong>{{ list.loaded.value ? summaryCounts.paused : '—' }}</strong><text>暂不出租</text>
      </view>
      <view class="rental-summary__item app-touchable" role="button" @click="showInspection">
        <strong>{{ list.loaded.value ? summaryCounts.inspection : '—' }}</strong><text>资料待完善</text>
      </view>
      <view class="rental-summary__item app-touchable" role="button" @click="openMatches">
        <view class="i-carbon-share text-2xl text-app-brand" /><text>配房记录</text>
      </view>
    </view>
    <RentalFilterTabs :model-value="statusFilter" :options="statusOptions" @change="changeStatus($event as typeof statusFilter)" />
    <view class="rental-search">
      <AppListToolbar v-model:keyword="keyword" search-placeholder="搜索房号、小区或楼栋" @search="list.refresh" @clear="list.refresh">
        <template #actions>
          <wd-button size="small" variant="soft" @click="openMap">
            <view class="i-carbon-map mr-1 inline-block align-middle" />地图
          </wd-button>
        </template>
      </AppListToolbar>
    </view>
    <view class="rental-results">
      <strong>{{ inspectionOnly ? '资料待完善' : statusOptions.find(item => item.value === statusFilter)?.label }}<text v-if="list.loaded.value" class="ml-2 text-xs text-content-muted font-normal">{{ list.total.value }} 套</text></strong>
      <view class="flex items-center gap-2">
        <wd-button size="small" variant="text" :disabled="customerLoading" @click="openFilters">
          筛选{{ extraFilterCount ? ` (${extraFilterCount})` : '' }}
        </wd-button>
        <wd-button size="small" :variant="selectionMode ? 'soft' : 'text'" :disabled="saving || customerLoading" @click="toggleSelection">
          {{ selectionMode ? '退出批选' : '批选配房' }}
        </wd-button>
      </view>
    </view>
    <view v-if="customerLoading" class="mt-3 text-xs text-content-secondary">
      正在读取客户需求…
    </view>
    <view v-else-if="customerLoadError" class="mt-3 flex items-center justify-between text-xs text-content-secondary">
      <text>{{ customerLoadError }}</text>
      <wd-button v-if="customerId" size="small" variant="text" @click="loadCustomerRequirements">
        重试
      </wd-button>
    </view>
    <view v-else-if="customerName" class="mt-3 text-xs text-content-secondary">
      已按 {{ customerName }} 的需求预填，可继续调整筛选条件。
    </view>
    <view v-if="filterSummary" class="mt-3 flex items-center justify-between gap-2 text-xs text-content-secondary">
      <text>{{ filterSummary }}</text>
      <wd-button size="small" variant="text" @click="resetFilters">
        清除筛选
      </wd-button>
    </view>
    <view v-if="selectionMode" class="mt-3 rounded-app-lg bg-surface-brand-soft p-3 text-xs text-content-secondary leading-relaxed">
      仅可选择启用且招租中的房源，最多 100 套。翻页、搜索和调整筛选会保留已选；退出批选会清空。
    </view>
    <view v-if="inspectionOnly" class="mt-3 flex items-center justify-between text-xs text-content-secondary">
      <text>仅显示资料待完善的房源</text>
      <wd-button size="small" variant="plain" @click="handleEmptyAction">
        清除筛选
      </wd-button>
    </view>
    <view class="mt-2.5">
      <AppPagedList
        :items="list.items.value"
        :loading="list.loading.value"
        :refreshing="list.refreshing.value"
        :loading-more="list.loadingMore.value"
        :finished="list.finished.value"
        :error="list.error.value"
        loading-text="正在加载房源…"
        :empty-text="hasFilters ? '没有符合条件的房源' : '当前工作空间还没有房源'"
        :empty-description="hasFilters ? '试试调整租金、户型或区域条件，已选房源会继续保留。' : '先新建第一套房源，再补充图片、租金和招租状态。'"
        empty-icon="no-result"
        :empty-action-text="hasFilters ? '清除筛选' : '新建房源'"
        finished-text="没有更多房源了"
        @retry="list.refresh"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <OrganizationHouseCard
            :house="item"
            :selectable="selectionMode"
            :selected="Boolean(selectedHouses[item.id])"
            :disabled="selectionMode && (!canSelectMatchHouse(item) || saving)"
            @click="toggleHouse(item)"
          />
        </template>
      </AppPagedList>
    </view>
    <template #footer>
      <view v-if="selectionMode" class="selection-footer fixed bottom-0 left-0 right-0 z-20 flex items-center gap-3 border-t-hairline border-t-app-border border-t-solid bg-surface-card">
        <view class="min-w-0 flex-1">
          <view class="text-sm text-content-primary font-semibold">
            已选 {{ selectionCount }} 套房源
          </view>
          <wd-button size="small" variant="text" :disabled="!selectionCount || saving" @click="clearSelection">
            清空已选
          </wd-button>
        </view>
        <wd-button :disabled="!selectionCount || saving" @click="prepareMatch">
          生成配房单
        </wd-button>
      </view>
    </template>
    <template #overlay>
      <wd-toast />
      <AppBottomSheet v-model:visible="filterVisible" title="筛选房源" description="筛选当前工作空间内的房源；已选房源会保留。">
        <view class="py-2 space-y-4">
          <view>
            <view class="mb-2 text-sm text-content-primary font-medium">
              启用状态
            </view>
            <view class="flex flex-wrap gap-2">
              <wd-button v-for="option in ([['all', '全部'], ['true', '启用'], ['false', '停用']] as const)" :key="option[0]" size="small" :variant="filterDraft.isActive === option[0] ? 'base' : 'plain'" @click="filterDraft.isActive = option[0]">
                {{ option[1] }}
              </wd-button>
            </view>
          </view>
          <view>
            <view class="mb-2 text-sm text-content-primary font-medium">
              月租金（元）
            </view>
            <view class="flex items-center gap-2">
              <wd-input v-model="filterDraft.minRent" custom-class="min-w-0 flex-1" type="digit" placeholder="最低租金" clearable />
              <text class="text-content-muted">至</text>
              <wd-input v-model="filterDraft.maxRent" custom-class="min-w-0 flex-1" type="digit" placeholder="最高租金" clearable />
            </view>
          </view>
          <view>
            <view class="mb-2 text-sm text-content-primary font-medium">
              户型（卧室数）
            </view>
            <view class="flex flex-wrap gap-2">
              <wd-button v-for="option in [['', '不限'], ['0', '0 室'], ['1', '1 室'], ['2', '2 室'], ['3', '3 室'], ['4', '4 室']]" :key="option[0]" size="small" :variant="filterDraft.bedrooms === option[0] ? 'base' : 'plain'" @click="filterDraft.bedrooms = option[0]">
                {{ option[1] }}
              </wd-button>
            </view>
          </view>
          <view>
            <view class="mb-2 text-sm text-content-primary font-medium">
              区域
            </view>
            <wd-input v-model="filterDraft.district" placeholder="输入完整区县名称，如南山区" :maxlength="64" clearable />
          </view>
        </view>
        <template #footer>
          <view class="flex gap-2">
            <wd-button variant="plain" @click="Object.assign(filterDraft, emptyFilters)">
              重置
            </wd-button>
            <wd-button block custom-class="flex-1" @click="applyFilters">
              查看房源
            </wd-button>
          </view>
        </template>
      </AppBottomSheet>
      <AppBottomSheet v-model:visible="createVisible" :title="createdShare ? '配房单已生成' : '确认配房单'" :close-on-click-modal="!saving" height="tall">
        <view v-if="!createdShare" class="py-2 space-y-4">
          <view class="text-xs text-content-muted">
            已选 {{ selectionCount }} 套。标题和备注会展示给收件人，链接默认有效 30 天。
          </view>
          <view>
            <view class="mb-2 text-sm text-content-primary font-medium">
              配房标题
            </view>
            <wd-input v-model="matchForm.title" placeholder="给这份房源推荐起个标题" :maxlength="150" :disabled="saving" clearable />
          </view>
          <view>
            <view class="mb-2 text-sm text-content-primary font-medium">
              给客户的备注（选填）
            </view>
            <wd-textarea v-model="matchForm.remark" placeholder="说明房源亮点、看房安排等" :maxlength="5000" :disabled="saving" show-word-limit />
          </view>
          <view v-for="house in selectedItems" :key="house.id" class="flex items-center justify-between gap-2 border-0 border-b border-app-divider border-solid py-2 text-sm text-content-primary">
            <text>{{ house.title }}</text>
            <wd-button size="small" variant="text" :disabled="saving" @click="delete selectedHouses[house.id]">
              移除
            </wd-button>
          </view>
        </view>
        <view v-else class="py-3 space-y-3">
          <view class="text-base text-content-primary font-semibold">
            {{ createdShare.title }}
          </view>
          <view class="text-xs text-content-muted">
            可以复制链接，或发送给微信好友。已选房源已清空。
          </view>
          <view class="break-all rounded-app-lg bg-surface-subtle p-3 text-xs text-content-secondary">
            {{ createdShare.share_url }}
          </view>
          <view class="flex flex-wrap gap-2">
            <wd-button size="small" variant="plain" @click="previewShare">
              预览
            </wd-button>
            <wd-button size="small" variant="plain" @click="openMatches">
              管理配房单
            </wd-button>
          </view>
        </view>
        <template #footer>
          <wd-button v-if="!createdShare" block :loading="saving" :disabled="saving || !selectionCount" @click="saveMatch">
            确认生成 {{ selectionCount }} 套房源的配房单
          </wd-button>
          <view v-else class="flex gap-2">
            <wd-button block custom-class="flex-1" @click="copyShare">
              复制分享链接
            </wd-button>
            <!-- #ifdef MP-WEIXIN -->
            <wd-button block custom-class="flex-1" open-type="share">
              发送给好友
            </wd-button>
            <!-- #endif -->
          </view>
        </template>
      </AppBottomSheet>
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
@use '../components/management';

.selection-footer {
  padding: 18rpx 32rpx calc(18rpx + env(safe-area-inset-bottom));
}
</style>
