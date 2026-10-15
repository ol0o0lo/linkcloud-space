<script setup lang="ts">
import type { HouseAIInsightOut, HouseOut, LeaseOut, ViewingRecordOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad, onPageScroll, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { favoriteHouse, getHouseFavorite, unfavoriteHouse } from '@/features/favorites/service'
import { AppError } from '@/core/errors/app-error'
import {
  formatOrganizationDateTime,
  formatOrganizationHouseTitle,
  formatOrganizationMoney,
  getOrganizationHouseLifecycleActions,
  getOrganizationLeaseStatusTone,
  getOrganizationViewingStatusTone,
} from '@/pages-org-rental/domain/organization-rental'
import {
  generateOrganizationHouseAIInsight,
  getAllocationCapabilities,
  getOrganizationHouse,
  getOrganizationHouseAIInsight,
  HouseStatus,
  listOrganizationLeases,
  listOrganizationViewings,
  patchOrganizationHouse,
} from '@/pages-org-rental/api/organization-rental'
import {
  APP_ROUTES,
  getHouseDetailRoute,
  getOrganizationHouseFormRoute,
  getOrganizationHouseSigningRoute,
  getOrganizationLeaseDetailRoute,
  getOrganizationSigningRoute,
  getOrganizationViewingDetailRoute,
  getOrganizationViewingFormRoute,
} from '@/modules/routes'
import AppActionSheetRow from '@/pages-org-rental/components/AppActionSheetRow.vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import HouseDetailPage from '@/components/house/HouseDetailPage.vue'
import HouseDetailSummary from '@/components/house/HouseDetailSummary.vue'
import HouseInsightCard from '@/components/house/HouseInsightCard.vue'
import HouseLocationCard from '@/components/house/HouseLocationCard.vue'
import HousePublicDetails from '@/components/house/HousePublicDetails.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import HouseMediaGallery from '@/components/house/HouseMediaGallery.vue'
import { useAppContextStore } from '@/store/app-context-v2'
import { useNavigationScrollState } from '@/hooks/useNavigationScrollState'

definePage({ style: { navigationBarTitleText: '房源详情', navigationStyle: 'custom' } })

type RecordTab = 'viewings' | 'leases'

const appContextStore = useAppContextStore()
const toast = useToast()
const houseId = ref(0)
const house = ref<HouseOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const submittingAction = ref<string | null>(null)
const moreVisible = ref(false)
const statusVisible = ref(false)
const recordTab = ref<RecordTab>('viewings')
const viewings = ref<ViewingRecordOut[]>([])
const leases = ref<LeaseOut[]>([])
const viewingsLoading = ref(false)
const leasesLoading = ref(false)
const viewingsError = ref('')
const leasesError = ref('')
const viewingsAccessDenied = ref(false)
const leasesAccessDenied = ref(false)
const canCreateLease = ref(false)
const aiInsight = ref<HouseAIInsightOut | null>(null)
const aiLoading = ref(false)
const aiGenerating = ref(false)
const aiError = ref('')
const aiAccessDenied = ref(false)
const { navigationScrolled, navigationProgress, navigationScrollTop, handleNavigationScroll } = useNavigationScrollState({ threshold: 190, fadeDistance: 190 })
const extraExpanded = ref(false)
const recordsExpanded = ref(false)
const recordSearchVisible = ref(false)
const recordKeyword = ref('')
const favorited = ref(false)
const favoriteLoading = ref(false)
const viewingFilter = ref('all')
const leaseFilter = ref('all')
const viewingsTotal = ref(0)
const leasesTotal = ref(0)
onPageScroll(handleNavigationScroll)
const viewingFilters = [{ value: 'all', label: '全部' }, { value: 'scheduled', label: '待带看' }, { value: 'viewed', label: '已带看' }]
const leaseFilters = [{ value: 'all', label: '全部' }, { value: 'active', label: '履约中' }, { value: 'pending', label: '待生效' }]
const filteredViewings = computed(() => viewings.value.filter(item => (viewingFilter.value === 'all' || item.status === viewingFilter.value) && `${item.customer_name} ${item.customer_phone}`.includes(recordKeyword.value.trim())))
const filteredLeases = computed(() => leases.value.filter(item => (leaseFilter.value === 'all' || item.status === leaseFilter.value) && `${item.tenant.name} ${item.tenant.phone}`.includes(recordKeyword.value.trim())))
const visibleViewings = computed(() => recordsExpanded.value ? filteredViewings.value : filteredViewings.value.slice(0, 3))
const visibleLeases = computed(() => recordsExpanded.value ? filteredLeases.value : filteredLeases.value.slice(0, 3))

const lifecycleActions = computed(() => house.value ? getOrganizationHouseLifecycleActions(house.value.status) : [])
const title = computed(() => house.value ? formatOrganizationHouseTitle(house.value) : '房源详情')
const location = computed(() => {
  if (!house.value)
    return ''
  const estate = house.value.building.estate
  return [estate?.display_name || estate?.name, house.value.building.address].filter(Boolean).join(' · ')
})
const showViewingTab = computed(() => hasCapability(['house_viewings', 'viewing_records', 'viewings']) && !viewingsAccessDenied.value)
const showLeaseTab = computed(() => hasCapability(['house_leases', 'lease_records', 'leases']) && !leasesAccessDenied.value)
const showBusinessRecords = computed(() => showViewingTab.value || showLeaseTab.value)
const extraEntries = computed(() => Object.entries(house.value?.extra || {}).filter(([, value]) => value !== null && value !== undefined && value !== ''))
const houseStatusOptions = [
  { value: HouseStatus.vacant, label: '空置' },
  { value: HouseStatus.listed, label: '招租中' },
  { value: HouseStatus.rented, label: '已出租' },
  { value: HouseStatus.renovating, label: '维护中' },
]

const inspectionLabels: Record<string, string> = {
  missing_images: '缺少房源图片',
  missing_videos: '缺少房源视频',
  expired: '房源资料需要复核',
}

function hasCapability(keys: string[]): boolean {
  for (const key of keys) {
    const value = appContextStore.capabilities[key]
    if (typeof value === 'boolean')
      return value
  }
  return true
}

function isForbidden(error: unknown): boolean {
  return error instanceof AppError && error.kind === 'forbidden'
}

function syncRecordTab() {
  if (recordTab.value === 'viewings' && !showViewingTab.value)
    recordTab.value = 'leases'
  if (recordTab.value === 'leases' && !showLeaseTab.value)
    recordTab.value = 'viewings'
}

function formatExtraValue(value: unknown): string {
  if (Array.isArray(value))
    return value.map(item => String(item)).join('、')
  if (value && typeof value === 'object')
    return JSON.stringify(value)
  if (typeof value === 'boolean')
    return value ? '是' : '否'
  return String(value)
}

async function loadAIInsight() {
  aiLoading.value = true
  aiError.value = ''
  aiAccessDenied.value = false
  try {
    aiInsight.value = await getOrganizationHouseAIInsight(appContextStore.organizationSlug, houseId.value)
  }
  catch (error) {
    if (isForbidden(error))
      aiAccessDenied.value = true
    else
      aiError.value = error instanceof Error ? error.message : 'AI 租房速览暂时无法加载'
  }
  finally {
    aiLoading.value = false
  }
}

async function generateAIInsight() {
  if (aiGenerating.value)
    return
  aiGenerating.value = true
  aiError.value = ''
  try {
    aiInsight.value = await generateOrganizationHouseAIInsight(appContextStore.organizationSlug, houseId.value)
    toast.success('AI 租房速览已生成')
  }
  catch (error) {
    aiError.value = error instanceof Error ? error.message : 'AI 租房速览生成失败'
    toast.error(aiError.value)
  }
  finally {
    aiGenerating.value = false
  }
}

async function loadViewings() {
  if (!hasCapability(['house_viewings', 'viewing_records', 'viewings']))
    return
  viewingsLoading.value = true
  viewingsError.value = ''
  viewingsAccessDenied.value = false
  try {
    const result = await listOrganizationViewings(appContextStore.organizationSlug, 1, 10, { house_id: houseId.value })
    viewings.value = result.items
    viewingsTotal.value = result.total
  }
  catch (error) {
    if (isForbidden(error))
      viewingsAccessDenied.value = true
    else
      viewingsError.value = error instanceof Error ? error.message : '带看记录暂时无法加载'
  }
  finally {
    viewingsLoading.value = false
    syncRecordTab()
  }
}

async function loadLeases() {
  if (!hasCapability(['house_leases', 'lease_records', 'leases']))
    return
  leasesLoading.value = true
  leasesError.value = ''
  leasesAccessDenied.value = false
  try {
    const result = await listOrganizationLeases(appContextStore.organizationSlug, 1, 5, { house_id: houseId.value })
    leases.value = result.items
    leasesTotal.value = result.total
  }
  catch (error) {
    if (isForbidden(error))
      leasesAccessDenied.value = true
    else
      leasesError.value = error instanceof Error ? error.message : '租约记录暂时无法加载'
  }
  finally {
    leasesLoading.value = false
    syncRecordTab()
  }
}

async function loadActionCapabilities() {
  try {
    const capabilities = await getAllocationCapabilities(appContextStore.organizationSlug)
    canCreateLease.value = capabilities.submit === true
  }
  catch {
    canCreateLease.value = false
  }
}

async function loadHouse() {
  loading.value = true
  loadError.value = ''
  try {
    house.value = await getOrganizationHouse(appContextStore.organizationSlug, houseId.value)
  }
  catch {
    loadError.value = '房源不存在或暂时无法加载'
    loading.value = false
    return
  }
  loading.value = false
  await Promise.allSettled([loadAIInsight(), loadViewings(), loadLeases(), loadActionCapabilities()])
}

function editHouse() {
  moreVisible.value = false
  uni.navigateTo({ url: getOrganizationHouseFormRoute(houseId.value) })
}

function createViewing() {
  if (!house.value)
    return
  moreVisible.value = false
  uni.navigateTo({ url: getOrganizationViewingFormRoute(house.value.id) })
}

async function openMore() {
  moreVisible.value = true
  if (house.value?.status !== HouseStatus.listed)
    return
  try {
    const result = await getHouseFavorite(houseId.value)
    favorited.value = result.items.length > 0
  }
  catch { favorited.value = false }
}

async function toggleFavorite() {
  if (favoriteLoading.value || house.value?.status !== HouseStatus.listed)
    return
  favoriteLoading.value = true
  try {
    if (favorited.value)
      await unfavoriteHouse(houseId.value)
    else
      await favoriteHouse(houseId.value)
    favorited.value = !favorited.value
    toast.success(favorited.value ? '已收藏' : '已取消收藏')
  }
  catch { toast.error('操作失败，请稍后重试') }
  finally { favoriteLoading.value = false }
}

function shareHouse() {
  // #ifdef H5
  const publicUrl = new URL(window.location.href)
  publicUrl.hash = getHouseDetailRoute(houseId.value)
  uni.setClipboardData({ data: publicUrl.toString() })
  // #endif
}

function resetRecordSearch() {
  recordsExpanded.value = false
  recordKeyword.value = ''
  recordSearchVisible.value = false
}

function scrollToManagement(section: 'internal' | 'records') {
  uni.createSelectorQuery().select(`#house-${section}`).boundingClientRect((rect) => {
    if (rect && !Array.isArray(rect))
      uni.pageScrollTo({ scrollTop: Math.max(0, navigationScrollTop.value + rect.top - 72), duration: 200 })
  }).exec()
}

function toggleRecordSearch() {
  recordSearchVisible.value = !recordSearchVisible.value
  if (!recordSearchVisible.value)
    recordKeyword.value = ''
}

function openStatusPicker() {
  moreVisible.value = false
  statusVisible.value = true
}

function createLease() {
  if (!house.value || !canCreateLease.value)
    return
  moreVisible.value = false
  uni.navigateTo({ url: getOrganizationHouseSigningRoute(house.value.id) })
}

function openViewing(record: ViewingRecordOut) {
  if (record.signed_lease_id) {
    uni.navigateTo({ url: getOrganizationLeaseDetailRoute(record.signed_lease_id) })
    return
  }
  if (record.status === 'converted' && canCreateLease.value) {
    uni.navigateTo({ url: getOrganizationSigningRoute(record.id) })
    return
  }
  uni.navigateTo({ url: getOrganizationViewingDetailRoute(record.id) })
}

function viewingActionLabel(record: ViewingRecordOut): string {
  if (record.signed_lease_id)
    return '查看租约'
  if (record.status === 'converted' && canCreateLease.value)
    return '去签约'
  return '查看带看'
}

function openLease(lease: LeaseOut) {
  uni.navigateTo({ url: getOrganizationLeaseDetailRoute(lease.id) })
}

function openAllViewings() {
  uni.navigateTo({ url: `${APP_ROUTES.organizationViewings}?house_id=${houseId.value}` })
}

function openAllLeases() {
  uni.navigateTo({ url: `${APP_ROUTES.organizationLeases}?house_id=${houseId.value}` })
}

async function setHouseStatus(status: HouseStatus) {
  if (!house.value || submittingAction.value || status === house.value.status)
    return
  statusVisible.value = false
  moreVisible.value = false
  const statusLabel = houseStatusOptions.find(item => item.value === status)?.label || '新状态'
  const confirmation = await uni.showModal({ title: `修改为${statusLabel}`, content: '房态会影响公开展示和后续业务，请确认当前实际经营状态。', confirmText: '确认修改' })
  if (!confirmation.confirm)
    return
  submittingAction.value = status
  try {
    house.value = await patchOrganizationHouse(appContextStore.organizationSlug, house.value.id, { status })
    toast.success('房态已更新')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '房态更新失败') }
  finally { submittingAction.value = null }
}

async function updateStatus(action: 'publish' | 'unpublish' | 'disable') {
  if (!house.value || submittingAction.value)
    return
  moreVisible.value = false
  const actionConfig = {
    publish: { title: '确认发布房源', content: '确认后房源状态将切换为招租，继续承接带看。', confirmText: '确认发布', status: HouseStatus.listed, success: '房源已发布' },
    unpublish: { title: '确认下架房源', content: '确认后房源状态将切换为空置，不再对外展示。', confirmText: '确认下架', status: HouseStatus.vacant, success: '房源已下架' },
    disable: { title: '确认停用房源', content: '停用后不再参与日常经营筛选，历史业务关联仍会保留。', confirmText: '确认停用', status: HouseStatus.inactive, success: '房源已停用' },
  }[action]
  const confirmation = await uni.showModal({ title: actionConfig.title, content: actionConfig.content, confirmText: actionConfig.confirmText })
  if (!confirmation.confirm)
    return
  submittingAction.value = action
  try {
    house.value = await patchOrganizationHouse(appContextStore.organizationSlug, house.value.id, { status: actionConfig.status })
    toast.success(actionConfig.success)
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '房源状态更新失败') }
  finally { submittingAction.value = null }
}

onLoad((options) => {
  houseId.value = Number(options?.id || 0)
  if (!houseId.value) {
    loadError.value = '房源参数不正确'
    loading.value = false
  }
})

onShow(() => {
  if (houseId.value)
    void loadHouse()
})

onShareAppMessage(() => ({ title: title.value, path: getHouseDetailRoute(houseId.value) }))
</script>

<template>
  <HouseDetailPage
    :loading="loading"
    :error="loadError"
    :show-actions="Boolean(house)"
    :fallback-url="APP_ROUTES.organizationHouses"
    :scrolled="navigationScrolled"
    :scroll-progress="navigationProgress"
    management
    @retry="loadHouse"
  >
    <template #feedback>
      <wd-toast />
    </template>

    <template #hero>
      <HouseMediaGallery v-if="house" :videos="house.videos" :images="house.images" />
    </template>

    <template v-if="house">
      <HouseDetailSummary :house="house" management />
      <view class="mx-app-gutter flex flex-wrap gap-2">
        <wd-button size="small" variant="plain" @click="scrollToManagement('internal')">
          内部资料
        </wd-button>
        <wd-button v-if="showBusinessRecords" size="small" variant="plain" @click="scrollToManagement('records')">
          业务记录
        </wd-button>
      </view>

      <view v-if="house.inspection_reasons.length" class="inspection-card">
        <text class="i-carbon-warning-alt inspection-card__icon" />
        <view>
          <view class="inspection-card__title">
            房源资料待完善
          </view>
          <view class="inspection-card__copy">
            {{ house.inspection_reasons.map(item => inspectionLabels[item] || item).join('、') }}
          </view>
        </view>
      </view>

      <HouseInsightCard v-if="!aiAccessDenied" :insight="aiInsight" :loading="aiLoading" :generating="aiGenerating" :error="aiError" can-generate @generate="generateAIInsight" @retry="loadAIInsight" />
      <HousePublicDetails :house="house" editable @edit="editHouse" />
      <HouseLocationCard
        :name="house.building.estate?.display_name || house.building.name"
        :address="house.building.address || location"
        :latitude="house.building.location?.latitude"
        :longitude="house.building.location?.longitude"
      />
      <view class="section-eyebrow">
        <text>内部管理</text>
      </view>

      <view id="house-internal" class="section internal-card">
        <view class="section-heading">
          <view>
            <view class="section-title">
              内部资料
            </view>
          </view>
          <view class="private-badge">
            <text class="i-carbon-locked" />
            仅内部可见
          </view>
        </view>
        <view class="data-list">
          <view class="data-row">
            <text>所属组织</text><text class="detail-value">{{ appContextStore.currentOrganization?.name || '当前组织' }}</text>
          </view>
          <view class="data-row">
            <text>归属房东</text><text class="detail-value">{{ house.landlord ? `${house.landlord.name} · ${house.landlord.phone}` : '未关联房东' }}</text>
          </view>
          <view class="data-row">
            <text>所属楼栋</text><text class="detail-value">{{ house.building.name }}</text>
          </view>
          <view class="data-row">
            <text>房源编号</text><text class="detail-value">#{{ house.id }}</text>
          </view>
          <view class="data-row">
            <text>资料更新</text><text class="detail-value">{{ formatOrganizationDateTime(house.updated_at) }}</text>
          </view>
        </view>
        <view class="notes-box">
          <view class="notes-box__label">
            内部备注
          </view>
          <view :class="{ 'notes-box__empty': !house.internal_notes }">
            {{ house.internal_notes || '尚未填写内部备注' }}
          </view>
        </view>
        <view v-if="extraEntries.length" class="extra-fields">
          <button class="extra-toggle" :aria-expanded="extraExpanded" @click="extraExpanded = !extraExpanded">
            <text>内部扩展字段</text><text class="detail-meta">{{ extraEntries.length }} 项</text><text :class="extraExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
          </button>
          <template v-if="extraExpanded">
            <view v-for="entry in extraEntries" :key="entry[0]" class="data-row">
              <text>{{ entry[0] }}</text><text class="detail-value">{{ formatExtraValue(entry[1]) }}</text>
            </view>
          </template>
        </view>
      </view>

      <view v-if="showBusinessRecords" id="house-records" class="section records-card">
        <view class="section-heading records-heading">
          <view>
            <view class="section-title">
              业务记录
            </view>
          </view>
          <view class="private-badge">
            <text class="i-carbon-locked" />
            内部
          </view>
        </view>
        <wd-tabs v-model="recordTab" color="#006bcc" inactive-color="#526177" line-theme="text" :line-height="3" @change="resetRecordSearch">
          <wd-tab v-if="showViewingTab" name="viewings" :title="`带看记录 ${viewingsTotal}`">
            <view class="record-panel">
              <view class="record-filters">
                <button v-for="filter in viewingFilters" :key="filter.value" class="record-filter" :class="{ 'record-filter--active': viewingFilter === filter.value }" @click="viewingFilter = filter.value; recordsExpanded = false">
                  {{ filter.label }} {{ filter.value === 'all' ? viewings.length : viewings.filter(item => item.status === filter.value).length }}
                </button><button class="record-search-toggle" aria-label="搜索带看记录" @click="toggleRecordSearch">
                  <text class="i-carbon-search" />
                </button>
              </view>
              <input v-if="recordSearchVisible" v-model="recordKeyword" class="record-search" placeholder="搜索姓名或手机号">
              <view class="record-caption">
                <text>最近 {{ viewings.length }} 条带看记录</text><text>姓名 · 时间 · 业务状态</text>
              </view>
              <view v-if="viewingsLoading" class="section-state">
                正在加载带看记录…
              </view>
              <view v-else-if="viewingsError" class="record-empty">
                <text>{{ viewingsError }}</text>
                <button class="text-button" @click="loadViewings">
                  重新加载
                </button>
              </view>
              <view v-else-if="!filteredViewings.length" class="record-empty">
                暂无带看记录
              </view>
              <template v-else>
                <view v-for="record in visibleViewings" :key="record.id" class="record-row">
                  <view class="record-row__head">
                    <view class="avatar">
                      {{ record.customer_name.slice(0, 1) || '客' }}
                    </view>
                    <view class="record-row__person">
                      <text class="detail-value">{{ record.customer_name }}</text>
                      <text>{{ record.customer_phone }}</text>
                    </view>
                    <AppStatusTag :text="record.status__mapping" :tone="getOrganizationViewingStatusTone(record.status)" />
                  </view>
                  <view class="record-row__date">
                    <text class="i-carbon-calendar" />
                    <text>{{ formatOrganizationDateTime(record.scheduled_at) }}</text>
                  </view>
                  <view class="record-row__foot">
                    <text>{{ record.contact ? `已关联租客：${record.contact.name}` : '尚未关联租客联系人' }}</text>
                    <button class="text-button" @click="openViewing(record)">
                      {{ viewingActionLabel(record) }} <text class="i-carbon-chevron-right" />
                    </button>
                  </view>
                </view>
              </template>
              <view v-if="viewings.length" class="records-footer">
                <button v-if="filteredViewings.length > 3" class="text-button" @click="recordsExpanded = !recordsExpanded">
                  {{ recordsExpanded ? '收起记录' : `展开其余 ${filteredViewings.length - 3} 条` }}<text :class="recordsExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
                </button><button class="text-button" @click="openAllViewings">
                  全部带看 <text class="i-carbon-chevron-right" />
                </button>
              </view>
            </view>
          </wd-tab>

          <wd-tab v-if="showLeaseTab" name="leases" :title="`租约记录 ${leasesTotal}`">
            <view class="record-panel">
              <view class="record-filters">
                <button v-for="filter in leaseFilters" :key="filter.value" class="record-filter" :class="{ 'record-filter--active': leaseFilter === filter.value }" @click="leaseFilter = filter.value; recordsExpanded = false">
                  {{ filter.label }} {{ filter.value === 'all' ? leases.length : leases.filter(item => item.status === filter.value).length }}
                </button><button class="record-search-toggle" aria-label="搜索租约记录" @click="toggleRecordSearch">
                  <text class="i-carbon-search" />
                </button>
              </view>
              <input v-if="recordSearchVisible" v-model="recordKeyword" class="record-search" placeholder="搜索姓名或手机号">
              <view class="record-caption">
                <text>最近 {{ leases.length }} 条租约记录</text><text>租期 · 租金 · 合同状态</text>
              </view>
              <view v-if="leasesLoading" class="section-state">
                正在加载租约记录…
              </view>
              <view v-else-if="leasesError" class="record-empty">
                <text>{{ leasesError }}</text>
                <button class="text-button" @click="loadLeases">
                  重新加载
                </button>
              </view>
              <view v-else-if="!filteredLeases.length" class="record-empty">
                暂无租约记录
              </view>
              <template v-else>
                <view v-for="lease in visibleLeases" :key="lease.id" class="record-row">
                  <view class="record-row__head">
                    <view class="avatar avatar--lease">
                      {{ lease.tenant.name.slice(0, 1) || '租' }}
                    </view>
                    <view class="record-row__person">
                      <text class="detail-value">{{ lease.tenant.name }}</text>
                      <text>{{ lease.tenant.phone }}</text>
                    </view>
                    <AppStatusTag :text="lease.status__mapping" :tone="getOrganizationLeaseStatusTone(lease.status)" />
                  </view>
                  <view class="lease-amount">
                    <text class="detail-value">{{ formatOrganizationMoney(lease.monthly_rent) }}</text><text>/月</text>
                    <text class="lease-deposit">押金 {{ formatOrganizationMoney(lease.deposit) }}</text>
                  </view>
                  <view class="record-row__date">
                    <text class="i-carbon-calendar" />
                    <text>{{ lease.start_date }} 至 {{ lease.end_date }}</text>
                  </view>
                  <view class="record-row__foot">
                    <text>{{ lease.contract_files.length ? `${lease.contract_files.length} 份合同文件` : '未上传合同文件' }}</text>
                    <button class="text-button" @click="openLease(lease)">
                      查看租约 <text class="i-carbon-chevron-right" />
                    </button>
                  </view>
                </view>
              </template>
              <view v-if="leases.length" class="records-footer">
                <button v-if="filteredLeases.length > 3" class="text-button" @click="recordsExpanded = !recordsExpanded">
                  {{ recordsExpanded ? '收起记录' : `展开其余 ${filteredLeases.length - 3} 条` }}<text :class="recordsExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
                </button><button class="text-button" @click="openAllLeases">
                  全部租约 <text class="i-carbon-chevron-right" />
                </button>
              </view>
            </view>
          </wd-tab>
        </wd-tabs>
      </view>

      <view class="detail-page-end">
        房源编号 #{{ house.id }} · 资料更新于 {{ formatOrganizationDateTime(house.updated_at) }}<view>当前房源内容已展示完毕</view>
      </view>
    </template>

    <template #actions>
      <view class="detail-actions">
        <button class="detail-action-icon" @click="openMore">
          <text class="i-carbon-overflow-menu-horizontal detail-action-icon__glyph" /><text>更多</text>
        </button>
        <view class="detail-action-secondary" :class="{ 'detail-action-secondary--wide': !showViewingTab }">
          <wd-button block variant="plain" :disabled="submittingAction !== null" @click="editHouse">
            <text class="i-carbon-edit" /> 编辑资料
          </wd-button>
        </view>
        <view v-if="showViewingTab" class="detail-action-primary">
          <wd-button block :disabled="submittingAction !== null" @click="createViewing">
            <text class="i-carbon-calendar" /> 登记带看
          </wd-button>
        </view>
      </view>
    </template>

    <template #overlay>
      <template v-if="house">
        <AppBottomSheet v-model:visible="moreVisible" :z-index="1200" title="房源管理" :description="title" height="tall" show-handle custom-style="--wot-popup-radius:22px;--wot-popup-close-margin:24px;--wot-popup-close-size:20px">
          <view class="management-menu">
            <button v-if="showViewingTab" class="management-menu__tile" @click="createViewing">
              <text class="i-carbon-calendar text-xl text-app-brand" />
              <text>登记带看</text>
            </button>
            <button v-if="canCreateLease" class="management-menu__tile" @click="createLease">
              <text class="i-carbon-document-add text-xl text-app-brand" />
              <text>新建租约</text>
            </button>
            <button class="management-menu__tile" @click="editHouse">
              <text class="i-carbon-edit text-xl text-app-brand" />
              <text>编辑资料</text>
            </button>
          </view>
          <view class="management-menu__label">
            房态与发布
          </view>
          <view class="management-menu__list">
            <AppActionSheetRow title="修改房态" :description="`当前：${house.status__mapping}`" @click="openStatusPicker">
              <template #icon>
                <text class="i-carbon-home" />
              </template>
            </AppActionSheetRow>
            <AppActionSheetRow v-if="lifecycleActions.includes('publish')" title="发布房源" description="发布后租客可浏览并预约" @click="updateStatus('publish')">
              <template #icon>
                <text class="i-carbon-view" />
              </template>
            </AppActionSheetRow>
            <AppActionSheetRow v-if="lifecycleActions.includes('unpublish')" title="下架房源" description="管理资料与历史记录仍保留" @click="updateStatus('unpublish')">
              <template #icon>
                <text class="i-carbon-view-off" />
              </template>
            </AppActionSheetRow>
          </view>
          <template v-if="house.status === HouseStatus.listed">
            <view class="management-menu__label">
              分享与收藏
            </view>
            <view class="management-menu__list">
              <button class="management-share" open-type="share" @click="shareHouse">
                <text class="i-carbon-share" /><view><text>分享公开房源</text><text>分享页仅包含租客可见内容</text></view><text class="i-carbon-chevron-right" />
              </button>
              <AppActionSheetRow :title="favorited ? '取消收藏' : '收藏房源'" :disabled="favoriteLoading" @click="toggleFavorite">
                <template #icon>
                  <text :class="favorited ? 'i-carbon-bookmark-filled' : 'i-carbon-bookmark'" />
                </template>
              </AppActionSheetRow>
            </view>
          </template>
          <template v-if="lifecycleActions.includes('disable')">
            <view class="management-menu__label">
              其他操作
            </view>
            <view class="management-menu__list">
              <AppActionSheetRow title="停用房源" description="停止新业务，保留历史记录" danger @click="updateStatus('disable')">
                <template #icon>
                  <text class="i-carbon-stop-outline" />
                </template>
              </AppActionSheetRow>
            </view>
          </template>
          <button class="detail-sheet-cancel" @click="moreVisible = false">
            取消
          </button>
        </AppBottomSheet>

        <AppBottomSheet v-model:visible="statusVisible" :z-index="1200" title="修改房态" :description="`当前状态：${house.status__mapping}`" height="compact" show-handle custom-style="--wot-popup-radius:22px;--wot-popup-close-margin:24px;--wot-popup-close-size:20px">
          <view class="management-menu__list">
            <AppActionSheetRow
              v-for="option in houseStatusOptions"
              :key="option.value"
              :title="option.label"
              :selected="option.value === house.status"
              @click="setHouseStatus(option.value)"
            />
          </view>
          <button class="detail-sheet-cancel" @click="statusVisible = false; moreVisible = true">
            返回
          </button>
        </AppBottomSheet>
      </template>
    </template>
  </HouseDetailPage>
</template>

<style scoped lang="scss">
@use '@/components/house/detail.scss';
.detail-action-secondary--wide {
  flex: 1;
}
.management-menu {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.management-menu__tile {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 83px;
  margin: 0;
  padding: 11px 5px;
  border: 1px solid #e8eef4;
  border-radius: 10px;
  background: #f6f8fb;
  color: #526177;
  font-size: 12px;
  line-height: 18px;
}
.management-menu__tile::after,
.management-share::after {
  border: 0;
}
.management-menu__label {
  margin: 17px 0 7px;
  color: #78869a;
  font-size: 10px;
}
.management-menu__list {
  overflow: hidden;
  border: 1px solid #e7ecf2;
  border-radius: 12px;
}
.management-menu__list :deep(button) {
  min-height: 57px;
  padding: 12px;
  line-height: 1.5;
}
.management-share {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 57px;
  margin: 0;
  padding: 12px;
  border: 0;
  border-bottom: 1px solid #e7ecf2;
  border-radius: 0;
  background: #fff;
  color: #58738f;
  font-size: 19px;
  text-align: left;
  line-height: 19px;
}
.management-share > view {
  flex: 1;
  color: #182538;
  font-size: 13px;
}
.management-share > view > text {
  display: block;
}
.management-share > view > text + text {
  margin-top: 2px;
  color: #78869a;
  font-size: 10px;
}
.management-share > text:last-child {
  color: #91a0b1;
  font-size: 15px;
}

.section {
  box-sizing: border-box;
  margin: 10px 12px 0;
  padding: 14px;
  overflow: hidden;
  border: 1px solid #e7ecf2;
  border-radius: 14px;
  background: #fff;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 26px;
  margin-bottom: 8px;
}
.section-title {
  font-size: 14px;
  font-weight: 650;
  line-height: 22px;
}
.section-eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 18px 13px 0;
  color: #8592a5;
  font-size: 10px;
}
.section-eyebrow::before,
.section-eyebrow::after {
  height: 1px;
  flex: 1;
  background: #dce4ee;
  content: '';
}
.private-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  border-radius: 4px;
  color: #758398;
  font-size: 9px;
  line-height: 14px;
  background: #f2f4f7;
}
.data-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 0;
  border-bottom: 1px solid #eef1f5;
  font-size: 12px;
  line-height: 20px;
}
.data-row > text:not(.detail-value) {
  flex: none;
  color: #78869a;
}
.data-row > .detail-value {
  color: #3d4d63;
  font-weight: 500;
  text-align: right;
  overflow-wrap: anywhere;
}
.notes-box {
  margin-top: 14px;
  color: #526177;
  font-size: 12px;
  line-height: 21px;
}
.notes-box__label {
  margin-bottom: 6px;
  color: #78869a;
  font-size: 10px;
}
.notes-box > view:last-child {
  padding: 9px 10px;
  border: 1px solid #e9edf3;
  border-radius: 8px;
  background: #f8f9fb;
  white-space: pre-wrap;
}
.notes-box__empty {
  color: #78869a;
}
.extra-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  margin: 0;
  padding: 0;
  border: 0;
  color: #182538;
  font-size: 13px;
  font-weight: 600;
  background: transparent;
}
.extra-toggle > text:nth-child(2) {
  margin-left: auto;
}
.extra-toggle::after {
  border: 0;
}
.inspection-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 12px 0;
  padding: 11px 12px;
  border: 1px solid #f0ddb8;
  border-radius: 12px;
  color: #8a5a11;
  background: #fff8ec;
}
.inspection-card__icon {
  flex: none;
  margin-top: 2px;
  font-size: 16px;
}
.inspection-card__title {
  font-size: 12px;
  font-weight: 600;
}
.inspection-card__copy {
  margin-top: 3px;
  font-size: 11px;
  line-height: 18px;
}
.records-card {
  --wot-tabs-nav-item-font-size: 13px;
  --wot-tabs-nav-item-padding: 13px 14px;
  --wot-tabs-nav-item-line-height: 20px;
  --wot-tabs-nav-line-bottom: 0px;
  --wot-tabs-nav-line-bg: #0081ff;
  padding: 12px 0 0;
}
.records-heading {
  padding: 0 14px;
  margin: 0;
}
.record-panel {
  padding: 12px 14px 2px;
}
.record-filters {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 9px;
}
.record-filter {
  min-height: 36px;
  margin: 0;
  padding: 7px 11px;
  border: 0;
  border-radius: 7px;
  color: #526177;
  font-size: 11px;
  line-height: 22px;
  background: #e9edf3;
}
.record-filter--active {
  color: #006bcc;
  background: #edf6ff;
  box-shadow: inset 0 0 0 1px #c5e1fc;
}
.record-filter::after,
.record-search-toggle::after {
  border: 0;
}
.record-search-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin: 0 0 0 auto;
  padding: 0;
  border: 1px solid #dee5ee;
  border-radius: 8px;
  color: #526177;
  font-size: 16px;
  background: #fff;
}
.record-search {
  box-sizing: border-box;
  height: 38px;
  margin-bottom: 10px;
  padding: 0 10px;
  border: 1px solid #dce4ed;
  border-radius: 8px;
  font-size: 12px;
}
.record-caption {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #78869a;
  font-size: 10px;
}
.record-row {
  padding: 12px 0 0;
  border-bottom: 1px solid #e7ecf2;
}
.record-row__head {
  display: flex;
  align-items: center;
  gap: 9px;
}
.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 10px;
  color: #547797;
  font-size: 12px;
  font-weight: 600;
  background: #edf4fc;
}
.avatar--lease {
  color: #98714b;
  background: #f6f0e8;
}
.record-row__person {
  min-width: 0;
  flex: 1;
}
.record-row__person .detail-value {
  display: block;
  font-size: 14px;
  font-weight: 600;
}
.record-row__person > text:not(.detail-value) {
  display: block;
  margin-top: 1px;
  color: #78869a;
  font-size: 11px;
}
.record-row__date {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0;
  padding: 7px 9px;
  border-radius: 6px;
  color: #526177;
  font-size: 11px;
  background: #f7f9fb;
}
.record-row__date > text:first-child {
  color: #78869a;
  font-size: 14px;
}
.record-row__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  border-top: 1px solid #e7ecf2;
}
.record-row__foot > text {
  color: #78869a;
  font-size: 10px;
}
.text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 36px;
  margin: 0;
  padding: 0 2px;
  border: 0;
  color: #006bcc;
  font-size: 12px;
  font-weight: 550;
  line-height: 1.5;
  background: transparent;
  white-space: nowrap;
}
.text-button::after {
  border: 0;
}
.records-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
}
.records-footer > button:last-child {
  margin-left: auto;
}
.section-state,
.record-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 120px;
  color: #78869a;
  font-size: 12px;
}
.lease-amount {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 10px 0 8px;
}
.lease-amount .detail-value {
  font-size: 20px;
  font-weight: 650;
}
.lease-amount > text:not(.detail-value) {
  color: #526177;
  font-size: 11px;
}
.lease-amount .lease-deposit {
  margin-left: auto;
}
</style>
