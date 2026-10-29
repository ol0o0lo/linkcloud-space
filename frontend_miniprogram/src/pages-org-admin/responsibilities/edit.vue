<script setup lang="ts">
import type { PropertyResponsibilityMemberOut } from '@/features/organization-admin/service'
import type { ResponsibilityKind, ResponsibilitySelection } from '@/domain/organization-admin'
import type { CustomNavigationLayoutInput } from '@/components/utils/navigation'
import { onBackPress, onLoad, onUnload } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref, watch } from 'vue'
import { formatOrganizationAdminUser, getResponsibilitySelectionChanges, isEmptyResponsibilitySelection } from '@/domain/organization-admin'
import { getOrganizationResponsibility, listOrganizationResponsibilityBuildings, listOrganizationResponsibilityEstates, listOrganizationResponsibilityLandlords, replaceOrganizationResponsibility } from '@/features/organization-admin/service'
import AppBottomAction from '@/components/app/AppBottomAction.vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { APP_ROUTES } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'
import { resolveCustomNavigationLayout } from '@/components/utils/navigation'

definePage({ style: { navigationBarTitleText: '配置负责范围', navigationStyle: 'custom' } })

interface ScopeOption {
  id: number
  title: string
  description: string
}

const categories: { kind: ResponsibilityKind, label: string, placeholder: string, description: string }[] = [
  { kind: 'landlord_ids', label: '房东', placeholder: '搜索房东姓名、电话或邮箱', description: '负责所选房东的关联房源，优先于楼栋和小区分工。' },
  { kind: 'building_ids', label: '楼栋', placeholder: '搜索楼栋名称或地址', description: '负责所选楼栋内未按房东分工的房源。' },
  { kind: 'estate_ids', label: '小区', placeholder: '搜索小区名称或地址', description: '负责所选小区内未按房东、楼栋分工的房源。' },
]
const toast = useToast()
const appContextStore = useAppContextStore()
const organizationSlug = appContextStore.organizationSlug
const memberId = ref(0)
const member = ref<PropertyResponsibilityMemberOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const activeKind = ref<ResponsibilityKind>('landlord_ids')
const keywords = reactive<Record<ResponsibilityKind, string>>({ landlord_ids: '', building_ids: '', estate_ids: '' })
const searchKeywords = reactive<Record<ResponsibilityKind, string>>({ landlord_ids: '', building_ids: '', estate_ids: '' })
const selection = reactive<Record<ResponsibilityKind, number[]>>({ landlord_ids: [], building_ids: [], estate_ids: [] })
const initialSelection = ref<ResponsibilitySelection>({})
const options = reactive<Record<ResponsibilityKind, Record<number, ScopeOption>>>({ landlord_ids: {}, building_ids: {}, estate_ids: {} })
const selectedVisible = ref(false)
const reviewVisible = ref(false)
const rulesVisible = ref(false)
const windowInfo = uni.getWindowInfo()
const navigationLayout: CustomNavigationLayoutInput = {
  windowWidth: windowInfo.windowWidth,
  statusBarHeight: 0,
}
// #ifdef MP-WEIXIN
navigationLayout.statusBarHeight = windowInfo.statusBarHeight
navigationLayout.menuButton = uni.getMenuButtonBoundingClientRect()
// #endif
const navigationHeight = resolveCustomNavigationLayout(navigationLayout).height
let leaveAllowed = false
let confirmingLeave = false

const employeeName = computed(() => member.value ? formatOrganizationAdminUser(member.value.user) : '员工')
const activeCategory = computed(() => categories.find(item => item.kind === activeKind.value)!)
const selectedCount = computed(() => categories.reduce((sum, item) => sum + selection[item.kind].length, 0))
const changes = computed(() => getResponsibilitySelectionChanges(initialSelection.value, selection))
const dirty = computed(() => changes.value.some(item => item.added.length || item.removed.length))
const empty = computed(() => isEmptyResponsibilitySelection(selection))

function landlordOption(item: PropertyResponsibilityMemberOut['landlords'][number]): ScopeOption {
  return { id: item.id, title: item.name, description: item.phone || '未填写电话' }
}

function buildingOption(item: PropertyResponsibilityMemberOut['buildings'][number]): ScopeOption {
  return { id: item.id, title: `${item.estate?.display_name || item.estate?.name || '独立楼栋'} · ${item.name}`, description: item.address || '未填写地址' }
}

function estateOption(item: PropertyResponsibilityMemberOut['estates'][number] & { address?: string }): ScopeOption {
  return { id: item.id, title: item.display_name || item.name, description: item.address || '' }
}

function rememberOptions(kind: ResponsibilityKind, items: ScopeOption[]) {
  for (const item of items)
    options[kind][item.id] = item
}

const candidates = usePagedPage<ScopeOption>({
  enabled: () => Boolean(member.value) && !loading.value,
  refreshOnShow: false,
  pullDownRefresh: false,
  pageSize: 20,
  keyOf: item => item.id,
  loader: async ({ page, pageSize }) => {
    const kind = activeKind.value
    const keyword = searchKeywords[kind] || undefined
    let result
    if (kind === 'landlord_ids') {
      const response = await listOrganizationResponsibilityLandlords(organizationSlug, page, pageSize, { role: 'landlord', task: 'active', keyword })
      result = { ...response, items: response.items.map(landlordOption) }
    }
    else if (kind === 'building_ids') {
      const response = await listOrganizationResponsibilityBuildings(organizationSlug, page, pageSize, { keyword, scope: 'all' })
      result = { ...response, items: response.items.map(buildingOption) }
    }
    else {
      const response = await listOrganizationResponsibilityEstates(organizationSlug, page, pageSize, { keyword, scope: 'all' })
      result = { ...response, items: response.items.map(estateOption) }
    }
    rememberOptions(kind, result.items)
    return result
  },
})

async function loadMember() {
  loading.value = true
  loadError.value = ''
  try {
    if (!Number.isInteger(memberId.value) || memberId.value <= 0)
      throw new Error('员工信息无效，请返回列表重新选择')
    member.value = await getOrganizationResponsibility(organizationSlug, memberId.value)
    const current = member.value
    selection.landlord_ids = current.landlords.map(item => item.id)
    selection.building_ids = current.buildings.map(item => item.id)
    selection.estate_ids = current.estates.map(item => item.id)
    initialSelection.value = {
      landlord_ids: [...selection.landlord_ids],
      building_ids: [...selection.building_ids],
      estate_ids: [...selection.estate_ids],
    }
    rememberOptions('landlord_ids', current.landlords.map(landlordOption))
    rememberOptions('building_ids', current.buildings.map(buildingOption))
    rememberOptions('estate_ids', current.estates.map(estateOption))
    uni.setNavigationBarTitle({ title: `${employeeName.value}的负责范围` })
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '负责范围加载失败' }
  finally { loading.value = false }
  if (!loadError.value)
    await candidates.refresh()
}

watch(activeKind, () => {
  searchKeywords[activeKind.value] = keywords[activeKind.value].trim()
  candidates.reset()
  void candidates.refresh()
})

function searchCandidates() {
  searchKeywords[activeKind.value] = keywords[activeKind.value].trim()
  candidates.reset()
  void candidates.refresh()
}

function toggleOption(kind: ResponsibilityKind, id: number) {
  if (saving.value)
    return
  selection[kind] = selection[kind].includes(id) ? selection[kind].filter(value => value !== id) : [...selection[kind], id]
}

function optionTitle(kind: ResponsibilityKind, id: number) {
  return options[kind][id]?.title || '范围信息已失效，请重新加载'
}

async function confirmLeave() {
  if (saving.value || confirmingLeave)
    return false
  if (dirty.value) {
    confirmingLeave = true
    try {
      const result = await uni.showModal({ title: '放弃本次修改？', content: '负责范围尚未保存，离开后本次修改将丢失。', confirmText: '放弃修改', cancelText: '继续编辑' })
      if (!result.confirm)
        return false
    }
    finally { confirmingLeave = false }
  }
  leaveAllowed = true
  // #ifdef MP-WEIXIN
  wx.disableAlertBeforeUnload()
  // #endif
  return true
}

onBackPress(() => {
  if (leaveAllowed)
    return false
  if (reviewVisible.value || selectedVisible.value || rulesVisible.value) {
    reviewVisible.value = false
    selectedVisible.value = false
    rulesVisible.value = false
    return true
  }
  if (!dirty.value && !saving.value)
    return false
  void confirmLeave().then((allowed) => {
    if (allowed)
      uni.navigateBack()
  })
  return true
})

// #ifdef MP-WEIXIN
watch(dirty, (value) => {
  if (value)
    wx.enableAlertBeforeUnload({ message: '负责范围尚未保存，离开后修改将丢失。' })
  else
    wx.disableAlertBeforeUnload()
})
// #endif

// #ifdef H5
function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value && !leaveAllowed) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', handleBeforeUnload)
// #endif

onUnload(() => {
  candidates.reset()
  // #ifdef H5
  window.removeEventListener('beforeunload', handleBeforeUnload)
  // #endif
  // #ifdef MP-WEIXIN
  wx.disableAlertBeforeUnload()
  // #endif
})

async function saveResponsibility() {
  if (saving.value || !member.value || !dirty.value || !reviewVisible.value)
    return
  saving.value = true
  try {
    const updated = await replaceOrganizationResponsibility(organizationSlug, memberId.value, {
      landlord_ids: [...selection.landlord_ids],
      building_ids: [...selection.building_ids],
      estate_ids: [...selection.estate_ids],
    })
    member.value = updated
    initialSelection.value = {
      landlord_ids: updated.landlords.map(item => item.id),
      building_ids: updated.buildings.map(item => item.id),
      estate_ids: updated.estates.map(item => item.id),
    }
    reviewVisible.value = false
    toast.success('负责范围已保存')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '保存失败，已保留本次选择，请重试') }
  finally { saving.value = false }
}

onLoad((query) => {
  memberId.value = Number(query?.id || 0)
  void loadMember()
})
</script>

<template>
  <AppPage variant="list" reserve-footer-space>
    <template #navigation>
      <AppCustomNavigation :title="member ? `${employeeName}的负责范围` : '配置负责范围'" back :before-back="confirmLeave" :fallback-url="APP_ROUTES.organizationAdminResponsibilities" scroll-mode="sticky" />
    </template>
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载员工负责范围…" />
    <AppErrorView v-else-if="loadError" title="负责范围加载失败" :message="loadError" @retry="loadMember" />
    <template v-else-if="member">
      <view class="scope-overview flex items-center justify-between gap-3 px-0 pb-4 pt-3">
        <view>
          <view class="scope-overview-title text-size-base text-content-primary font-semibold leading-6">
            选择负责范围
          </view>
          <view class="scope-caption mt-1 text-size-xs text-content-muted leading-4.5">
            当前负责 {{ member.responsible_house_count }} 套房源，修改后需保存
          </view>
        </view>
        <wd-button size="small" variant="text" @click="rulesVisible = true">
          分工规则
        </wd-button>
      </view>
      <view class="scope-controls sticky z-30 border-b-1 border-b-app-divider border-b-solid" :style="{ top: `${navigationHeight}px` }">
        <wd-tabs v-model="activeKind" :slidable-num="4">
          <wd-tab v-for="category in categories" :key="category.kind" :name="category.kind" :title="`${category.label} ${selection[category.kind].length}`" />
        </wd-tabs>
        <view class="scope-search px-3 pb-0 pt-2">
          <wd-search v-model="keywords[activeKind]" variant="filled" :placeholder="activeCategory.placeholder" placeholder-left hide-cancel @search="searchCandidates" @clear="searchCandidates" />
        </view>
        <view class="scope-description px-4 pb-3 pt-2.5 text-size-xs text-content-secondary leading-4.5">
          {{ activeCategory.description }}
        </view>
      </view>
      <view class="scope-panel overflow-hidden">
        <AppPagedList
          :items="candidates.items.value"
          item-key="id"
          layout="cell"
          :loading="candidates.loading.value"
          :loading-more="candidates.loadingMore.value"
          :finished="candidates.finished.value"
          :error="candidates.error.value"
          :empty-text="searchKeywords[activeKind] ? '没有找到匹配的范围' : `暂无可选择的${activeCategory.label}`"
          :empty-description="searchKeywords[activeKind] ? '试试其他关键词，已选范围会为你保留。' : '已有的选择仍可在「查看已选」中调整。'"
          loading-text="正在加载可选范围…"
          finished-text="没有更多了"
          @retry="candidates.error.value && candidates.items.value.length ? candidates.loadMore() : candidates.refresh()"
        >
          <template #item="{ item }">
            <view class="scope-row border-b-1 border-b-app-divider border-b-solid px-4 py-0" :class="{ 'scope-row--selected': selection[activeKind].includes(item.id) }">
              <wd-checkbox
                :model-value="selection[activeKind].includes(item.id)"
                :disabled="saving"
                type="square"
                custom-style="width: 100%; margin: 0; padding: 14px 0;"
                custom-label-class="scope-option-label"
                @change="toggleOption(activeKind, item.id)"
              >
                <view class="scope-option-title text-size-sm text-content-primary font-medium leading-5.5">
                  {{ item.title }}
                </view>
                <view v-if="item.description" class="scope-option-description mt-1 text-size-xs text-content-muted leading-4.5">
                  {{ item.description }}
                </view>
              </wd-checkbox>
            </view>
          </template>
        </AppPagedList>
      </view>
      <view class="scope-footnote mt-3.5 text-size-xs text-content-muted leading-5">
        已选内容会保留，可在底部统一查看和调整。
      </view>
    </template>
    <template #footer>
      <AppBottomAction v-if="member && !loading && !loadError">
        <view class="scope-footer flex items-center gap-6">
          <wd-button variant="text" custom-style="height: auto; padding: 0;" :disabled="saving" @click="selectedVisible = true">
            <view class="scope-selection-trigger min-w-22 text-left text-size-xs leading-5">
              <view>已选 <text class="scope-selection-count text-size-base font-semibold">{{ selectedCount }}</text> 项</view>
              <view class="scope-selection-caption text-size-2xs text-content-muted leading-4">
                查看并调整
              </view>
            </view>
          </wd-button>
          <view class="min-w-0 flex-1">
            <wd-button block :disabled="!dirty || saving" :loading="saving" @click="reviewVisible = true">
              核对并保存
            </wd-button>
          </view>
        </view>
      </AppBottomAction>
    </template>
    <AppBottomSheet v-model:visible="rulesVisible" title="分工规则" height="compact">
      <AppNotice title="房东 → 楼栋 → 小区" description="先按房东分工；房东未分工时按楼栋；前两项均未分工时按小区。同一层级允许多名员工负责。" compact />
      <view class="scope-rule-example mt-3.5 text-size-xs text-content-muted leading-5">
        例如，小区归刘雅负责，但张女士已分给吴晨，张女士的房源由吴晨负责。
      </view>
      <view class="scope-rule-example mt-3.5 text-size-xs text-content-muted leading-5">
        已选范围的数量不等于实际负责房源套数，保存后会重新计算。
      </view>
    </AppBottomSheet>
    <AppBottomSheet v-model:visible="selectedVisible" title="已选负责范围" :description="`共 ${selectedCount} 项，取消勾选后需保存才会生效`" height="tall">
      <AppEmpty v-if="!selectedCount" title="尚未选择负责范围" description="返回页面，搜索并勾选要分配的房东、楼栋或小区。" compact />
      <view v-for="category in categories" v-else :key="category.kind">
        <template v-if="selection[category.kind].length">
          <view class="mb-1 mt-3 text-sm text-content-primary font-semibold">
            {{ category.label }} · {{ selection[category.kind].length }}
          </view>
          <view v-for="id in selection[category.kind]" :key="id" class="scope-row border-b-1 border-b-app-divider border-b-solid px-4 py-0">
            <wd-checkbox :model-value="true" type="square" custom-style="width: 100%; margin: 0; padding: 14px 0;" :disabled="saving" @change="toggleOption(category.kind, id)">
              <view class="text-sm text-content-primary leading-relaxed">
                {{ optionTitle(category.kind, id) }}
              </view>
              <view v-if="options[category.kind][id]?.description" class="mt-1 text-xs text-content-muted">
                {{ options[category.kind][id].description }}
              </view>
            </wd-checkbox>
          </view>
        </template>
      </view>
    </AppBottomSheet>
    <AppBottomSheet v-model:visible="reviewVisible" title="核对本次修改" :description="`${employeeName}的负责范围`" height="tall" :close-on-click-modal="!saving">
      <AppNotice v-if="empty" title="将清空该员工的全部负责范围" description="保存后，该员工不再通过房东、楼栋或小区分工负责房源。" tone="danger" compact />
      <view v-for="(change, index) in changes" :key="change.kind">
        <template v-if="change.added.length || change.removed.length">
          <view class="mb-2 mt-4 text-sm text-content-primary font-semibold">
            {{ categories[index].label }}
          </view>
          <view v-for="id in change.added" :key="`add-${id}`" class="review-row flex gap-3 px-0 py-2 text-size-xs text-content-secondary leading-relaxed">
            <text class="shrink-0 text-app-brand">新增</text>
            <view class="min-w-0 flex-1">
              <view>{{ optionTitle(change.kind, id) }}</view>
              <view v-if="options[change.kind][id]?.description" class="mt-1 text-xs text-content-muted">
                {{ options[change.kind][id].description }}
              </view>
            </view>
          </view>
          <view v-for="id in change.removed" :key="`remove-${id}`" class="review-row flex gap-3 px-0 py-2 text-size-xs text-content-secondary leading-relaxed">
            <text class="shrink-0 text-app-danger">取消</text>
            <view class="min-w-0 flex-1">
              <view>{{ optionTitle(change.kind, id) }}</view>
              <view v-if="options[change.kind][id]?.description" class="mt-1 text-xs text-content-muted">
                {{ options[change.kind][id].description }}
              </view>
            </view>
          </view>
        </template>
      </view>
      <view class="mt-4 text-xs text-content-muted leading-relaxed">
        确认后将保存该员工的完整负责范围，未调整的范围会保留，实际负责套数将重新计算。
      </view>
      <template #footer>
        <view class="flex gap-3">
          <view class="flex-1">
            <wd-button block variant="outlined" :disabled="saving" @click="reviewVisible = false">
              返回修改
            </wd-button>
          </view>
          <view class="flex-1">
            <wd-button block :type="empty ? 'danger' : 'primary'" :loading="saving" :disabled="saving || !dirty" @click="saveResponsibility">
              {{ empty ? '确认清空' : '确认保存' }}
            </wd-button>
          </view>
        </view>
      </template>
    </AppBottomSheet>
  </AppPage>
</template>

<style scoped lang="scss">
.scope-controls {
  border-radius: 14px 14px 0 0;
  @apply bg-surface-card;
}
.scope-search {
  --wot-search-padding: 0;
  --wot-search-bg: transparent;
  --wot-search-input-bg: var(--app-bg-page);
  --wot-search-cover-bg: var(--app-bg-page);
  --wot-search-input-radius: 10px;
  --wot-search-input-height: 40px;
}
.scope-panel {
  border-radius: 0 0 14px 14px;
  @apply bg-surface-card;
}
.scope-row--selected {
  @apply bg-surface-brand-soft;
}
.scope-row :deep(.scope-option-label) {
  @apply flex-1 min-w-0;
}
.scope-option-title {
  overflow-wrap: anywhere;
}
.scope-option-description {
  overflow-wrap: anywhere;
}
</style>
