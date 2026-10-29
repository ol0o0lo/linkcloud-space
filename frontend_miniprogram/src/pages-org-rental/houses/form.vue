<script setup lang="ts">
import type { BuildingOut, ContactOut, HouseOut } from '@/pages-org-rental/api/organization-rental'
import type { OrganizationHouseWriteInput } from '@/pages-org-rental/domain/organization-rental'
import type { HouseFormDraft } from '@/pages-org-rental/domain/house-form'
import type { VersionedStorage } from '@/infra/storage/versioned-storage'
import { onBackPress, onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, nextTick, reactive, ref, watch } from 'vue'
// #ifdef H5
import { onBeforeRouteLeave } from 'vue-router'
// #endif
import { buildOrganizationHouseCreatePayload, buildOrganizationHousePatchPayload } from '@/pages-org-rental/domain/organization-rental'
import { createEmptyHouseForm, getHouseDraftKey, getHouseFormErrors, houseLayoutPresets, isHouseFormDraft } from '@/pages-org-rental/domain/house-form'
import { createOrganizationHouse, getOrganizationHouse, listOrganizationBuildings, listOrganizationContacts, patchOrganizationHouse, uploadOrganizationHouseImages } from '@/pages-org-rental/api/organization-rental'
import { createVersionedStorage } from '@/infra/storage/versioned-storage'
import { platformStorage } from '@/platform'
import { APP_ROUTES, getOrganizationHouseDetailRoute } from '@/modules/routes'
import { resolveCustomNavigationLayout } from '@/components/utils/navigation'
import AppEntityPickerOption from '@/components/app/AppEntityPickerOption.vue'
import AppEntityPickerSheet from '@/pages-org-rental/components/AppEntityPickerSheet.vue'
import AppFormPage from '@/pages-org-rental/components/AppFormPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '房源资料' } })

interface PickerConfirmEvent { value: Array<string | number> }
type HouseMediaRef = Record<string, unknown> & { media_id: number, media_type?: 'image' | 'video' }

const toast = useToast()
const appContextStore = useAppContextStore()
const houseId = ref(0)
const currentHouse = ref<HouseOut | null>(null)
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const loadError = ref('')
const buildingVisible = ref(false)
const landlordVisible = ref(false)
const orientationVisible = ref(false)
const decorationVisible = ref(false)
const detailsExpanded = ref(false)
const buildingKeyword = ref('')
const landlordKeyword = ref('')
const buildingLoading = ref(false)
const landlordLoading = ref(false)
const buildings = ref<BuildingOut[]>([])
const landlords = ref<ContactOut[]>([])
const orientationSelection = ref<Array<string | number>>([])
const decorationSelection = ref<Array<string | number>>([])
const form = reactive<OrganizationHouseWriteInput>(createEmptyHouseForm())
const formRevision = ref(0)
const validationAttempted = ref(false)
const touchedFields = reactive<Partial<Record<keyof OrganizationHouseWriteInput, boolean>>>({})
const roomNumberFocused = ref(false)
const baseline = ref('')
const draftReady = ref(false)
const draftSaved = ref(false)
const draftSaveFailed = ref(false)
const draftBuildingLabel = ref('')
const draftLandlordLabel = ref('')
const pageOrganizationSlug = ref('')
const pageUserId = ref(0)
const saveMode = ref<'detail' | 'continue'>('detail')
let draftStore: VersionedStorage<HouseFormDraft> | null = null
let leaveAllowed = false
let confirmingLeave = false
let openingBuilding = false
let pageDisposed = false

const snapshot = computed(() => JSON.stringify(form))
const dirty = computed(() => draftReady.value && snapshot.value !== baseline.value)
const errors = computed(() => getHouseFormErrors(form))
const visibleErrors = computed(() => Object.fromEntries(
  Object.entries(errors.value).filter(([key]) => validationAttempted.value || touchedFields[key as keyof OrganizationHouseWriteInput]),
))
const draftStatus = computed(() => dirty.value
  ? draftSaveFailed.value ? '草稿未能保存，请先保存房源' : draftSaved.value ? '草稿已保存在本机' : ''
  : '')

function hasPageScope() {
  return appContextStore.user?.id === pageUserId.value && appContextStore.organizationSlug === pageOrganizationSlug.value
}

const orientationOptions = [
  { label: '不设置', value: '' },
  { label: '南', value: 'south' },
  { label: '北', value: 'north' },
  { label: '东', value: 'east' },
  { label: '西', value: 'west' },
  { label: '南北', value: 'south_north' },
  { label: '东西', value: 'east_west' },
]
const decorationOptions = [
  { label: '不设置', value: '' },
  { label: '毛坯', value: 'raw' },
  { label: '简装', value: 'simple' },
  { label: '精装', value: 'fine' },
  { label: '豪装', value: 'luxury' },
]
const listingTypeOptions = [
  { label: '整租', value: 'whole' },
  { label: '合租', value: 'shared' },
  { label: '公寓', value: 'apartment' },
  { label: '短租', value: 'short_term' },
] as const
const roomCountFields = [
  { key: 'bedrooms', label: '卧室', unit: '室' },
  { key: 'living_rooms', label: '客厅', unit: '厅' },
  { key: 'bathrooms', label: '卫生间', unit: '卫' },
] as const
const extraCountFields = [
  { key: 'kitchens', label: '厨房' },
  { key: 'balconies', label: '阳台' },
] as const

const selectedBuilding = computed(() => buildings.value.find(item => item.id === form.building_id))
const selectedLandlord = computed(() => landlords.value.find(item => item.id === form.landlord_id))
const buildingLabel = computed(() => {
  const building = selectedBuilding.value
  if (building)
    return [building.estate?.display_name || building.estate?.name, building.name].filter(Boolean).join(' ')
  if (currentHouse.value?.building_id === form.building_id)
    return [currentHouse.value.building.estate?.display_name || currentHouse.value.building.estate?.name, currentHouse.value.building.name].filter(Boolean).join(' ')
  return draftBuildingLabel.value || '请选择楼栋'
})
const landlordLabel = computed(() => selectedLandlord.value?.name || (currentHouse.value?.landlord_id === form.landlord_id ? currentHouse.value.landlord?.name : '') || draftLandlordLabel.value || '不关联房东')
const orientationLabel = computed(() => orientationOptions.find(item => item.value === form.orientation)?.label || '不设置')
const decorationLabel = computed(() => decorationOptions.find(item => item.value === form.decoration)?.label || '不设置')
const imageItems = computed(() => (form.images || []) as HouseMediaRef[])
const requiredCount = computed(() => Number(Boolean(form.building_id)) + Number(Boolean(form.room_number.trim())))
const selectedLayoutPreset = computed(() => {
  if (form.bedrooms == null || String(form.bedrooms).trim() === '' || form.living_rooms == null || String(form.living_rooms).trim() === '')
    return ''
  return houseLayoutPresets.find(item => item.bedrooms === Number(form.bedrooms) && item.living_rooms === Number(form.living_rooms))?.label || ''
})

function persistDraft() {
  if (!draftReady.value || !draftStore || !hasPageScope())
    return false
  try {
    if (dirty.value) {
      draftStore.write({ form: JSON.parse(snapshot.value), buildingLabel: buildingLabel.value, landlordLabel: landlordLabel.value, updatedAt: Date.now() })
      draftSaved.value = true
    }
    else {
      draftStore.remove()
      draftSaved.value = false
    }
    draftSaveFailed.value = false
    return true
  }
  catch {
    draftSaveFailed.value = true
    draftSaved.value = false
    return false
  }
}

async function restoreDraft() {
  const key = getHouseDraftKey(pageUserId.value, pageOrganizationSlug.value, houseId.value)
  if (!key)
    return
  draftStore = createVersionedStorage({ key, version: 1, storage: platformStorage.persistent, validate: isHouseFormDraft, migrations: {} })
  try {
    const draft = draftStore.read()
    if (!draft || pageDisposed || !hasPageScope())
      return
    const result = await uni.showModal({ title: '恢复未保存的房源资料？', content: '本设备保留了一份草稿，可以接着上次的内容继续填写。', confirmText: '恢复草稿', cancelText: '重新填写' })
    if (pageDisposed || !hasPageScope())
      return
    if (!result.confirm) {
      draftStore.remove()
      return
    }
    Object.assign(form, draft.form)
    draftBuildingLabel.value = draft.buildingLabel
    draftLandlordLabel.value = draft.landlordLabel
    orientationSelection.value = [form.orientation || '']
    decorationSelection.value = [form.decoration || '']
    draftSaved.value = true
  }
  catch {
    draftSaveFailed.value = true
  }
}

async function confirmLeave() {
  if (saving.value || uploading.value || confirmingLeave)
    return false
  if (!leaveAllowed && dirty.value) {
    confirmingLeave = true
    try {
      const saved = persistDraft()
      const result = await uni.showModal({
        title: '房源还未保存',
        content: saved ? '草稿已保存在本机，下次进入可以继续填写。' : '草稿未能保存，离开后本次填写可能丢失。',
        confirmText: saved ? '保留并离开' : '仍然离开',
        cancelText: '继续填写',
      })
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

function syncUnloadAlert() {
  // #ifdef MP-WEIXIN
  if ((dirty.value || saving.value || uploading.value) && !leaveAllowed)
    wx.enableAlertBeforeUnload({ message: saving.value ? '房源正在保存，请稍候再离开。' : uploading.value ? '图片正在上传，离开会中断本次上传。' : draftSaved.value && !draftSaveFailed.value ? '房源尚未保存，离开后可从本机草稿继续填写。' : '草稿未能保存，离开后填写内容可能丢失。' })
  else
    wx.disableAlertBeforeUnload()
  // #endif
}

watch(snapshot, () => {
  persistDraft()
}, { flush: 'sync' })
watch([dirty, draftSaved, draftSaveFailed, saving, uploading], syncUnloadAlert)

onBackPress(() => {
  if (buildingVisible.value || landlordVisible.value || orientationVisible.value || decorationVisible.value) {
    buildingVisible.value = false
    landlordVisible.value = false
    orientationVisible.value = false
    decorationVisible.value = false
    return true
  }
  if (leaveAllowed || (!dirty.value && !saving.value && !uploading.value))
    return false
  void confirmLeave().then((allowed) => {
    if (allowed)
      uni.navigateBack()
  })
  return true
})
onHide(() => {
  persistDraft()
})
onShow(syncUnloadAlert)

// #ifdef H5
onBeforeRouteLeave(() => openingBuilding || leaveAllowed || (!dirty.value && !saving.value && !uploading.value) || confirmLeave())
function handleBeforeUnload(event: BeforeUnloadEvent) {
  persistDraft()
  if ((dirty.value || saving.value || uploading.value) && !leaveAllowed) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', handleBeforeUnload)
// #endif

onUnload(() => {
  persistDraft()
  pageDisposed = true
  draftReady.value = false
  // #ifdef H5
  window.removeEventListener('beforeunload', handleBeforeUnload)
  // #endif
  // #ifdef MP-WEIXIN
  wx.disableAlertBeforeUnload()
  // #endif
})

function mediaUrl(item: HouseMediaRef): string {
  return String(item.thumbnail || item.url || '')
}

function fillHouse(house: HouseOut) {
  currentHouse.value = house
  Object.assign(form, {
    building_id: house.building_id,
    landlord_id: house.landlord_id,
    room_number: house.room_number,
    listing_type: house.listing_type || null,
    floor: house.floor ?? '',
    area: house.area ?? '',
    interior_area: house.interior_area ?? '',
    asking_rent: house.asking_rent ?? '',
    deposit_amount: house.deposit_amount ?? '',
    bedrooms: house.bedrooms ?? '',
    living_rooms: house.living_rooms ?? '',
    bathrooms: house.bathrooms ?? '',
    kitchens: house.kitchens ?? '',
    balconies: house.balconies ?? '',
    orientation: house.orientation || '',
    decoration: house.decoration || '',
    has_elevator_access: house.has_elevator_access,
    images: [...house.images],
    videos: [...house.videos],
    tags: house.tags.join('，'),
    public_description: house.public_description,
    internal_notes: house.internal_notes,
  })
  orientationSelection.value = [house.orientation || '']
  decorationSelection.value = [house.decoration || '']
  detailsExpanded.value = true
}

async function loadBuildings() {
  buildingLoading.value = true
  try {
    const result = await listOrganizationBuildings(pageOrganizationSlug.value, 1, 100, { keyword: buildingKeyword.value.trim() || undefined })
    buildings.value = result.items
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '楼栋加载失败') }
  finally { buildingLoading.value = false }
}

async function loadLandlords() {
  landlordLoading.value = true
  try {
    const result = await listOrganizationContacts(pageOrganizationSlug.value, 1, 100, { role: 'landlord', task: 'active', keyword: landlordKeyword.value.trim() || undefined })
    landlords.value = result.items
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '房东联系人加载失败') }
  finally { landlordLoading.value = false }
}

function selectBuilding(item: BuildingOut) {
  draftBuildingLabel.value = [item.estate?.display_name || item.estate?.name, item.name].filter(Boolean).join(' ')
  form.building_id = item.id
  buildingVisible.value = false
}

function createBuilding() {
  buildingVisible.value = false
  openingBuilding = true
  uni.navigateTo({
    url: APP_ROUTES.organizationBuildingForm,
    events: {
      buildingCreated(building: BuildingOut) {
        buildings.value = [building, ...buildings.value.filter(item => item.id !== building.id)]
        selectBuilding(building)
      },
    },
    complete: () => { openingBuilding = false },
  })
}

function selectLandlord(item: ContactOut | null) {
  draftLandlordLabel.value = item?.name || ''
  form.landlord_id = item?.id || null
  landlordVisible.value = false
}

function changeOrientation(event: PickerConfirmEvent) {
  form.orientation = String(event.value[0] || '')
}

function changeDecoration(event: PickerConfirmEvent) {
  form.decoration = String(event.value[0] || '')
}

async function addImages() {
  if (uploading.value || saving.value)
    return
  const remaining = Math.max(0, 9 - imageItems.value.length)
  if (!remaining) {
    toast.warning('最多上传 9 张房源图片')
    return
  }
  uploading.value = true
  try {
    const uploaded = await uploadOrganizationHouseImages(pageOrganizationSlug.value, remaining)
    form.images = [...imageItems.value, ...uploaded.map(item => ({ ...item, media_id: item.id, media_type: 'image' as const }))]
    toast.success('图片已上传，保存后生效')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '房源图片上传失败') }
  finally { uploading.value = false }
}

function removeImage(index: number) {
  if (saving.value)
    return
  form.images = imageItems.value.filter((_item, itemIndex) => itemIndex !== index)
}

async function focusFirstError() {
  const key = Object.keys(errors.value)[0]
  if (!key)
    return
  if (['interior_area', 'kitchens', 'balconies'].includes(key))
    detailsExpanded.value = true
  roomNumberFocused.value = false
  await nextTick()
  const windowInfo = uni.getWindowInfo()
  let topOffset = resolveCustomNavigationLayout({ windowWidth: windowInfo.windowWidth }).height + 12
  // #ifdef MP-WEIXIN
  topOffset = resolveCustomNavigationLayout({ windowWidth: windowInfo.windowWidth, statusBarHeight: windowInfo.statusBarHeight, menuButton: uni.getMenuButtonBoundingClientRect() }).height + 12
  // #endif
  uni.createSelectorQuery().select(`#house-field-${key}`).boundingClientRect().selectViewport().scrollOffset(() => {}).exec(([field, viewport]) => {
    if (field)
      uni.pageScrollTo({ scrollTop: Math.max(0, field.top + (viewport?.scrollTop || 0) - topOffset), duration: 160 })
  })
  if (key === 'room_number')
    roomNumberFocused.value = true
}

async function submit(continueCreating = false) {
  if (saving.value || uploading.value)
    return
  if (!hasPageScope()) {
    toast.warning('登录用户或工作空间已变化，请重新打开房源页面')
    return
  }
  validationAttempted.value = true
  if (Object.keys(errors.value).length) {
    await focusFirstError()
    return
  }
  saveMode.value = continueCreating && !houseId.value ? 'continue' : 'detail'
  saving.value = true
  let savedHouse: HouseOut | null = null
  try {
    uni.hideKeyboard()
    savedHouse = houseId.value
      ? await patchOrganizationHouse(pageOrganizationSlug.value, houseId.value, buildOrganizationHousePatchPayload(form, currentHouse.value || undefined))
      : await createOrganizationHouse(pageOrganizationSlug.value, buildOrganizationHouseCreatePayload(form))
    draftReady.value = false
    try {
      draftStore?.remove()
    }
    catch { toast.warning('房源已保存，本机旧草稿未能清理') }
    draftSaved.value = false
    draftSaveFailed.value = false
    if (pageDisposed)
      return
    if (saveMode.value === 'continue') {
      const buildingId = form.building_id
      Object.assign(form, createEmptyHouseForm(buildingId))
      formRevision.value += 1
      orientationSelection.value = []
      decorationSelection.value = []
      draftLandlordLabel.value = ''
      detailsExpanded.value = false
      validationAttempted.value = false
      for (const key of Object.keys(touchedFields))
        delete touchedFields[key as keyof OrganizationHouseWriteInput]
      baseline.value = snapshot.value
      draftReady.value = true
      leaveAllowed = false
      toast.success('房源已创建，继续录入下一套')
      await nextTick()
      uni.pageScrollTo({ scrollTop: 0, duration: 0 })
      roomNumberFocused.value = true
      return
    }
    leaveAllowed = true
    syncUnloadAlert()
    toast.success(houseId.value ? '房源资料已更新' : '房源已创建')
    await uni.redirectTo({ url: getOrganizationHouseDetailRoute(savedHouse.id) })
  }
  catch (error) {
    if (pageDisposed)
      return
    if (savedHouse) {
      houseId.value = savedHouse.id
      fillHouse(savedHouse)
      baseline.value = snapshot.value
      leaveAllowed = false
      await restoreDraft()
      draftReady.value = true
      toast.warning('房源已保存，请在房源列表中查看')
    }
    else {
      toast.error(error instanceof Error ? error.message : '房源保存失败')
    }
  }
  finally { saving.value = false }
}

async function loadPage() {
  draftReady.value = false
  loading.value = true
  loadError.value = ''
  try {
    const [house] = await Promise.all([
      houseId.value ? getOrganizationHouse(pageOrganizationSlug.value, houseId.value) : Promise.resolve(null),
      loadBuildings(),
      loadLandlords(),
    ])
    if (pageDisposed || !hasPageScope())
      return
    if (house)
      fillHouse(house)
    baseline.value = snapshot.value
    await restoreDraft()
    draftReady.value = true
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '房源资料加载失败' }
  finally { loading.value = false }
}

onLoad((options) => {
  pageOrganizationSlug.value = appContextStore.organizationSlug
  pageUserId.value = appContextStore.user?.id || 0
  houseId.value = Number(options?.id || 0)
  uni.setNavigationBarTitle({ title: houseId.value ? '编辑房源' : '新建房源' })
  void loadPage()
})
</script>

<template>
  <AppFormPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载房源资料…"
    error-title="房源资料不可用"
    :submitting="saving"
    :submit-disabled="saving"
    :submit-text="houseId ? '保存房源资料' : '创建房源'"
    @retry="loadPage"
    @submit="submit"
  >
    <template #navigation>
      <AppCustomNavigation :title="houseId ? '编辑房源' : '新建房源'" back :before-back="confirmLeave" :fallback-url="APP_ROUTES.organizationHouses" scroll-mode="sticky" />
    </template>
    <template #feedback>
      <wd-toast />
    </template>

    <view :key="formRevision" class="house-form mx-app-gutter flex flex-col gap-2.5">
      <view class="px-1 pb-1">
        <view class="flex items-center justify-between gap-2">
          <text class="text-lg text-content-primary font-semibold">{{ houseId ? '完善房源资料' : '录入基本信息' }}</text>
          <text class="shrink-0 text-xs text-app-brand">{{ requiredCount }}/2 必填</text>
        </view>
        <view class="mt-1 text-xs text-content-secondary leading-relaxed">
          楼栋、房号必填，其余可稍后完善。
        </view>
      </view>

      <view class="house-form__section rounded-app-xl p-3.5">
        <view class="house-form__heading mb-2.5 items-center justify-between gap-2 text-size-base">
          <view class="flex items-center gap-2">
            <view class="house-form__section-icon i-carbon-location text-size-lg" />
            <text>房源位置</text>
          </view>
          <text class="house-form__hint shrink-0 text-size-2xs">从这里开始</text>
        </view>
        <view id="house-field-building_id" class="house-form__label text-size-xs leading-4.5">
          所属楼栋 <text class="house-form__required ml-0.5">*</text>
        </view>
        <button
          class="house-form__select house-form__building m-0 box-border items-center justify-between gap-1.5 overflow-hidden rounded-app-md px-2.5 py-3 leading-normal"
          :class="{ 'house-form__select--empty': !form.building_id, 'house-form__control--error': visibleErrors.building_id }"
          :disabled="saving"
          @click="buildingVisible = true"
        >
          <view class="min-w-0 flex-1 text-left">
            <view class="break-words">
              {{ form.building_id ? buildingLabel : '选择房源所在楼栋' }}
            </view>
            <view v-if="!form.building_id" class="mt-1 text-xs text-content-muted font-normal">
              关联小区和地址信息
            </view>
          </view>
          <view class="i-carbon-chevron-right shrink-0 text-content-muted" />
        </button>
        <view v-if="visibleErrors.building_id" class="house-form__error mt-1 text-size-xs leading-normal" role="alert">
          {{ visibleErrors.building_id }}
        </view>
        <view class="grid grid-cols-2 mt-3 gap-3">
          <view id="house-field-room_number" class="min-w-0">
            <view class="house-form__label text-size-xs leading-4.5">
              房号 <text class="house-form__required ml-0.5">*</text>
            </view>
            <view class="house-form__input overflow-hidden rounded-app-md" :class="{ 'house-form__control--error': visibleErrors.room_number }">
              <wd-input v-model="form.room_number" :disabled="saving" placeholder="例如 1201" clearable clear-trigger="focus" :focus="roomNumberFocused" :error="Boolean(visibleErrors.room_number)" :cursor-spacing="100" @blur="roomNumberFocused = false; touchedFields.room_number = true" />
            </view>
            <view v-if="visibleErrors.room_number" class="house-form__error mt-1 text-size-xs leading-normal" role="alert">
              {{ visibleErrors.room_number }}
            </view>
          </view>
          <view id="house-field-floor" class="min-w-0">
            <view class="house-form__label text-size-xs leading-4.5">
              所在楼层
            </view>
            <view class="house-form__input flex items-center overflow-hidden rounded-app-md" :class="{ 'house-form__control--error': visibleErrors.floor }">
              <wd-input v-model="form.floor" :disabled="saving" custom-class="min-w-0 flex-1" type="number" placeholder="例如 12" :cursor-spacing="100" @blur="touchedFields.floor = true" />
              <text class="house-form__unit shrink-0 pr-3 text-size-2xs">层</text>
            </view>
            <view v-if="visibleErrors.floor" class="house-form__error mt-1 text-size-xs leading-normal" role="alert">
              {{ visibleErrors.floor }}
            </view>
          </view>
        </view>
        <view class="house-form__label mt-3 text-size-xs leading-4.5">
          出租方式 <text class="house-form__hint ml-1 shrink-0 text-size-2xs">选填</text>
        </view>
        <view class="grid grid-cols-4 gap-2">
          <button
            v-for="option in listingTypeOptions"
            :key="option.value"
            class="house-form__choice m-0 box-border rounded-app-md px-0.5 py-2.5 leading-normal"
            :class="{ 'house-form__choice--selected': form.listing_type === option.value }"
            :aria-pressed="form.listing_type === option.value"
            :disabled="saving"
            @click="form.listing_type = form.listing_type === option.value ? null : option.value"
          >
            {{ option.label }}
          </button>
        </view>
      </view>

      <view class="house-form__section rounded-app-xl p-3.5">
        <view class="house-form__heading mb-2.5 items-center justify-between gap-2 text-size-base">
          <view class="flex items-center gap-2">
            <view class="house-form__section-icon i-carbon-currency text-size-lg" />
            <text>租金与面积</text>
          </view>
          <text class="house-form__hint shrink-0 text-size-2xs">选填</text>
        </view>
        <view class="grid grid-cols-2 gap-3">
          <view id="house-field-asking_rent" class="min-w-0">
            <view class="house-form__label text-size-xs leading-4.5">
              挂牌租金
            </view>
            <view class="house-form__input house-form__input--rent flex items-center overflow-hidden rounded-app-md" :class="{ 'house-form__control--error': visibleErrors.asking_rent }">
              <wd-input v-model="form.asking_rent" :disabled="saving" custom-class="min-w-0 flex-1" type="digit" placeholder="输入月租金" :cursor-spacing="100" @blur="touchedFields.asking_rent = true" />
              <text class="house-form__unit shrink-0 pr-3 text-size-2xs">元/月</text>
            </view>
            <view v-if="visibleErrors.asking_rent" class="house-form__error mt-1 text-size-xs leading-normal" role="alert">
              {{ visibleErrors.asking_rent }}
            </view>
          </view>
          <view id="house-field-deposit_amount" class="min-w-0">
            <view class="house-form__label text-size-xs leading-4.5">
              押金
            </view>
            <view class="house-form__input flex items-center overflow-hidden rounded-app-md" :class="{ 'house-form__control--error': visibleErrors.deposit_amount }">
              <wd-input v-model="form.deposit_amount" :disabled="saving" custom-class="min-w-0 flex-1" type="digit" placeholder="输入押金" :cursor-spacing="100" @blur="touchedFields.deposit_amount = true" />
              <text class="house-form__unit shrink-0 pr-3 text-size-2xs">元</text>
            </view>
            <view v-if="visibleErrors.deposit_amount" class="house-form__error mt-1 text-size-xs leading-normal" role="alert">
              {{ visibleErrors.deposit_amount }}
            </view>
          </view>
          <view id="house-field-area" class="col-span-2 min-w-0">
            <view class="house-form__label text-size-xs leading-4.5">
              建筑面积
            </view>
            <view class="house-form__input flex items-center overflow-hidden rounded-app-md" :class="{ 'house-form__control--error': visibleErrors.area }">
              <wd-input v-model="form.area" :disabled="saving" custom-class="min-w-0 flex-1" type="digit" placeholder="这套房有多大" :cursor-spacing="100" @blur="touchedFields.area = true" />
              <text class="house-form__unit shrink-0 pr-3 text-size-2xs">㎡</text>
            </view>
            <view v-if="visibleErrors.area" class="house-form__error mt-1 text-size-xs leading-normal" role="alert">
              {{ visibleErrors.area }}
            </view>
          </view>
        </view>
      </view>

      <view class="house-form__section rounded-app-xl p-3.5">
        <view class="house-form__heading mb-2.5 items-center justify-between gap-2 text-size-base">
          <view class="flex items-center gap-2">
            <view class="house-form__section-icon i-carbon-floorplan text-size-lg" />
            <text>户型与配置</text>
          </view>
          <text class="house-form__hint shrink-0 text-size-2xs">选填</text>
        </view>
        <view class="grid grid-cols-4 mb-3 gap-2" role="group" aria-label="常用户型">
          <button
            v-for="preset in houseLayoutPresets"
            :key="preset.label"
            class="house-form__choice house-form__layout-choice m-0 box-border rounded-app-md px-0.5 py-2.5 leading-normal"
            :class="{ 'house-form__choice--selected': selectedLayoutPreset === preset.label }"
            :aria-pressed="selectedLayoutPreset === preset.label"
            :disabled="saving"
            @click="Object.assign(form, { bedrooms: preset.bedrooms, living_rooms: preset.living_rooms })"
          >
            {{ preset.label }}
          </button>
        </view>
        <view class="grid grid-cols-2 gap-3">
          <view v-for="field in roomCountFields" :id="`house-field-${field.key}`" :key="field.key" class="house-form__counter min-w-0 rounded-app-md p-2.5">
            <view class="house-form__label text-size-xs leading-4.5">
              {{ field.label }}<text class="house-form__hint ml-1 shrink-0 text-size-2xs">/ {{ field.unit }}</text>
            </view>
            <wd-input-number :disabled="saving" :model-value="form[field.key] ?? ''" :min="0" allow-null placeholder="未填" :update-on-init="false" input-width="64rpx" @update:model-value="form[field.key] = $event" @blur="touchedFields[field.key] = true" />
            <view v-if="visibleErrors[field.key]" class="house-form__error mt-1 text-size-xs leading-normal" role="alert">
              {{ visibleErrors[field.key] }}
            </view>
          </view>
          <view class="house-form__counter min-w-0 rounded-app-md p-2.5">
            <view class="house-form__label text-size-xs leading-4.5">
              可使用电梯
            </view>
            <view class="h-9 flex items-center gap-2">
              <wd-switch v-model="form.has_elevator_access" :disabled="saving" size="22px" />
              <text class="text-xs text-content-secondary">{{ form.has_elevator_access ? '有电梯' : '无电梯' }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="house-form__section rounded-app-xl p-3.5">
        <view class="house-form__heading mb-2.5 items-center justify-between gap-2 text-size-base">
          <view class="flex items-center gap-2">
            <view class="house-form__section-icon i-carbon-image text-size-lg" />
            <text>房源照片</text>
          </view>
          <text class="house-form__hint shrink-0 text-size-2xs">{{ imageItems.length }}/9 张 · 选填</text>
        </view>
        <view class="grid grid-cols-3 gap-2">
          <view v-for="(item, index) in imageItems" :key="item.media_id" class="overflow-hidden rounded-app-md bg-surface-subtle">
            <image class="block h-24 w-full" :src="mediaUrl(item)" mode="aspectFill" />
            <button class="house-form__remove m-0 box-border rounded-0 p-2 leading-normal" :aria-label="`移除第 ${index + 1} 张照片`" @click="removeImage(index)">
              移除
            </button>
          </view>
          <button v-if="imageItems.length < 9" class="house-form__upload m-0 box-border min-h-24 flex-col items-center justify-center rounded-app-md p-1.5 leading-normal" :disabled="uploading" @click="addImages">
            <view class="i-carbon-camera mb-2 text-2xl" />
            <text>{{ uploading ? '上传中…' : '添加照片' }}</text>
          </button>
          <view v-if="!imageItems.length" class="col-span-2 flex flex-col justify-center pl-2 text-xs text-content-muted leading-relaxed">
            <text class="mb-1 text-sm text-content-secondary">让好房被看见</text>
            <text>拍下采光、布局和房间细节，</text>
            <text>也可以建档后再上传。</text>
          </view>
        </view>
        <view v-if="form.videos?.length" class="mt-3 text-xs text-content-muted">
          已保留 {{ form.videos.length }} 个现有视频
        </view>
      </view>

      <view class="house-form__section rounded-app-xl p-3.5">
        <button class="house-form__more m-0 box-border items-center justify-between gap-2 p-0 leading-normal" :aria-expanded="detailsExpanded" @click="detailsExpanded = !detailsExpanded">
          <view class="min-w-0 text-left">
            <view class="text-base text-content-primary font-semibold">
              补充更多资料
            </view>
            <view class="mt-1.5 text-xs text-content-muted font-normal">
              房东、朝向、装修与房源介绍
            </view>
          </view>
          <view class="flex shrink-0 items-center gap-1 text-xs text-app-brand">
            <text>{{ detailsExpanded ? '收起' : '展开' }}</text>
            <view :class="detailsExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
          </view>
        </button>
        <view v-show="detailsExpanded" class="mt-5 flex flex-col gap-4">
          <view>
            <view class="house-form__label text-size-xs leading-4.5">
              关联房东
            </view>
            <button class="house-form__select m-0 box-border items-center justify-between gap-1.5 overflow-hidden rounded-app-md px-2.5 py-3 leading-normal" @click="landlordVisible = true">
              <text class="min-w-0 flex-1 break-words text-left">{{ landlordLabel }}</text>
              <view class="i-carbon-chevron-right shrink-0 text-content-muted" />
            </button>
          </view>
          <view class="grid grid-cols-2 gap-3">
            <view>
              <view class="house-form__label text-size-xs leading-4.5">
                朝向
              </view>
              <button class="house-form__select m-0 box-border items-center justify-between gap-1.5 overflow-hidden rounded-app-md px-2.5 py-3 leading-normal" @click="orientationVisible = true">
                <text>{{ orientationLabel }}</text><view class="i-carbon-chevron-down text-content-muted" />
              </button>
            </view>
            <view>
              <view class="house-form__label text-size-xs leading-4.5">
                装修
              </view>
              <button class="house-form__select m-0 box-border items-center justify-between gap-1.5 overflow-hidden rounded-app-md px-2.5 py-3 leading-normal" @click="decorationVisible = true">
                <text>{{ decorationLabel }}</text><view class="i-carbon-chevron-down text-content-muted" />
              </button>
            </view>
            <view v-for="field in extraCountFields" :id="`house-field-${field.key}`" :key="field.key" class="house-form__counter min-w-0 rounded-app-md p-2.5">
              <view class="house-form__label text-size-xs leading-4.5">
                {{ field.label }}
              </view>
              <wd-input-number :disabled="saving" :model-value="form[field.key] ?? ''" :min="0" allow-null placeholder="未填" :update-on-init="false" input-width="64rpx" @update:model-value="form[field.key] = $event" @blur="touchedFields[field.key] = true" />
              <view v-if="visibleErrors[field.key]" class="house-form__error mt-1 text-size-xs leading-normal" role="alert">
                {{ visibleErrors[field.key] }}
              </view>
            </view>
          </view>
          <view id="house-field-interior_area">
            <view class="house-form__label text-size-xs leading-4.5">
              套内面积
            </view>
            <view class="house-form__input flex items-center overflow-hidden rounded-app-md" :class="{ 'house-form__control--error': visibleErrors.interior_area }">
              <wd-input v-model="form.interior_area" :disabled="saving" custom-class="min-w-0 flex-1" type="digit" placeholder="输入套内实际面积" :cursor-spacing="100" @blur="touchedFields.interior_area = true" />
              <text class="house-form__unit shrink-0 pr-3 text-size-2xs">㎡</text>
            </view>
            <view v-if="visibleErrors.interior_area" class="house-form__error mt-1 text-size-xs leading-normal" role="alert">
              {{ visibleErrors.interior_area }}
            </view>
          </view>
          <view>
            <view class="house-form__label text-size-xs leading-4.5">
              房源标签
            </view>
            <view class="house-form__input overflow-hidden rounded-app-md">
              <wd-input v-model="form.tags" :disabled="saving" placeholder="例如 近地铁，采光好（逗号分隔）" clearable clear-trigger="focus" :cursor-spacing="100" />
            </view>
          </view>
          <view>
            <view class="house-form__label text-size-xs leading-4.5">
              公开描述 <text class="house-form__hint ml-1 shrink-0 text-size-2xs">租客可见</text>
            </view>
            <view class="house-form__input overflow-hidden rounded-app-md">
              <wd-textarea v-model="form.public_description" :disabled="saving" placeholder="聊聊这套房的采光、交通或生活配套…" :maxlength="3000" show-word-limit auto-height />
            </view>
          </view>
          <view v-if="houseId">
            <view class="house-form__label text-size-xs leading-4.5">
              内部备注 <text class="house-form__hint ml-1 shrink-0 text-size-2xs">仅空间成员可见</text>
            </view>
            <view class="house-form__input overflow-hidden rounded-app-md">
              <wd-textarea v-model="form.internal_notes" :disabled="saving" placeholder="记录钥匙、带看或其他内部信息" :maxlength="3000" show-word-limit auto-height />
            </view>
          </view>
        </view>
      </view>
    </view>

    <template #actions>
      <view class="min-w-0 w-full">
        <view v-if="draftStatus" class="mb-1.5 text-center text-xs" :class="draftSaveFailed ? 'text-app-danger' : 'text-content-muted'" role="status">
          {{ draftStatus }}
        </view>
        <view class="flex items-center gap-2">
          <wd-button v-if="!houseId" block custom-class="min-w-0 flex-1" variant="plain" :loading="saving && saveMode === 'continue'" :disabled="saving || uploading" @click="submit(true)">
            保存并新增
          </wd-button>
          <wd-button block custom-class="min-w-0 flex-1" :loading="saving && saveMode === 'detail'" :disabled="saving || uploading" @click="submit()">
            {{ houseId ? '保存房源资料' : '创建房源' }}
          </wd-button>
        </view>
      </view>
    </template>

    <template #overlay>
      <AppEntityPickerSheet
        v-model:visible="buildingVisible"
        v-model:keyword="buildingKeyword"
        title="选择楼栋"
        search-placeholder="搜索小区 / 项目 / 楼栋"
        item-icon="i-carbon-building"
        :items="buildings"
        item-key="id"
        :selected="form.building_id ? [form.building_id] : []"
        :loading="buildingLoading"
        empty-text="未找到楼栋，可先新建再继续录入房源"
        @search="loadBuildings"
        @select="selectBuilding"
      >
        <template #item="{ item, selected }">
          <AppEntityPickerOption
            :title="item.name"
            :description="item.estate?.display_name || item.estate?.name || item.address || '独立楼栋'"
            :selected="selected"
            wrap
            indicator="radio"
          />
        </template>
        <template #footer>
          <wd-button block type="info" variant="text" css-icon="i-carbon-add" @click="createBuilding">
            新建楼栋
          </wd-button>
        </template>
      </AppEntityPickerSheet>

      <AppEntityPickerSheet
        v-model:visible="landlordVisible"
        v-model:keyword="landlordKeyword"
        title="选择房东"
        search-placeholder="搜索房东姓名或手机号"
        item-icon="i-carbon-user"
        :items="landlords"
        item-key="id"
        :selected="form.landlord_id ? [form.landlord_id] : []"
        :loading="landlordLoading"
        empty-text="未找到有效房东联系人"
        @search="loadLandlords"
        @select="selectLandlord"
      >
        <template #before-list>
          <button class="house-picker-skip m-0 box-border rounded-app-lg p-3 text-left leading-normal" :class="{ 'house-picker-skip--selected': form.landlord_id == null }" :aria-pressed="form.landlord_id == null" @click="selectLandlord(null)">
            <AppEntityPickerOption title="暂不关联房东" description="房源建档后也可补充" :selected="form.landlord_id == null" indicator="radio" wrap>
              <template #leading>
                <view class="house-picker-leading i-carbon-subtract shrink-0" />
              </template>
            </AppEntityPickerOption>
          </button>
        </template>
        <template #item="{ item, selected }">
          <AppEntityPickerOption :title="item.name" :description="item.phone" :selected="selected" indicator="radio" wrap />
        </template>
      </AppEntityPickerSheet>

      <wd-picker v-model="orientationSelection" v-model:visible="orientationVisible" :columns="orientationOptions" title="选择朝向" @confirm="changeOrientation" />
      <wd-picker v-model="decorationSelection" v-model:visible="decorationVisible" :columns="decorationOptions" title="选择装修情况" @confirm="changeDecoration" />
    </template>
  </AppFormPage>
</template>

<style lang="scss" scoped>
.house-picker-skip {
  @apply w-full border-hairline border-solid border-app-card bg-surface-page;
  &::after {
    @apply border-0;
  }
}
.house-picker-skip--selected {
  @apply border-app-brand bg-surface-brand-soft;
}
.house-picker-leading {
  @apply w-5 h-5 text-app-brand;
}
.house-form {
  --wot-input-bg: transparent;
  --wot-input-padding: 22rpx 20rpx;
  --wot-input-inner-height: 44rpx;
  --wot-input-inner-font-size: 28rpx;
  --wot-input-inner-placeholder-color: var(--app-text-muted);
  --wot-textarea-bg: transparent;
  --wot-textarea-padding: 24rpx;
  --wot-textarea-inner-min-height: 140rpx;
  --wot-textarea-inner-font-size: 28rpx;
  --wot-textarea-inner-placeholder-color: var(--app-text-muted);
  --wot-input-number-action-size: 64rpx;
  --wot-input-number-input-height: 64rpx;
  --wot-input-number-action-bg: var(--app-bg-card);
  --wot-input-number-input-bg: transparent;
  --wot-input-number-action-color: var(--app-color-primary);
  --wot-input-number-action-border-radius: 14rpx;
}

.house-form__section {
  @apply border-hairline border-solid border-app-divider bg-surface-card;
}

.house-form__heading {
  @apply flex font-semibold;
}

.house-form__section-icon {
  @apply text-app-brand;
}

.house-form__label {
  @apply mb-1.5 text-content-secondary;
}

.house-form__hint,
.house-form__unit {
  @apply text-content-muted font-normal;
}

.house-form__required {
  @apply text-app-danger;
}

.house-form__input,
.house-form__select {
  @apply border-hairline border-solid border-app-card bg-surface-page;
}

.house-form__input:focus-within {
  @apply border-app-brand;
  box-shadow: 0 0 0 4rpx var(--app-bg-brand-soft);
}

.house-form__input.house-form__control--error,
.house-form__select.house-form__control--error {
  @apply border-app-danger;
}

.house-form__error {
  @apply text-app-danger;
}

.house-form__layout-choice {
  @apply text-size-2xs;
}

.house-form__input--rent {
  --wot-input-inner-color: var(--app-color-price);
}

.house-form__select,
.house-form__choice,
.house-form__upload,
.house-form__more,
.house-form__remove {
  @apply w-full text-size-sm;
  &::after {
    @apply border-0;
  }
}

.house-form__select {
  @apply flex min-h-11 text-content-primary;
}

.house-form__building {
  @apply min-h-13 border-app-border-brand-soft bg-surface-brand-soft font-medium;
}

.house-form__select--empty {
  @apply text-app-brand;
}

.house-form__choice {
  @apply border-hairline border-solid border-transparent bg-surface-page text-content-secondary text-size-xs;
}

.house-form__choice--selected {
  @apply border-app-brand bg-surface-brand-soft text-app-brand font-semibold;
}

.house-form__counter {
  @apply bg-surface-page;
}

.house-form__upload {
  @apply flex;
  border: 2rpx dashed var(--app-border-brand-soft);
  @apply bg-surface-brand-soft text-app-brand text-size-xs;
}

.house-form__more {
  @apply flex bg-transparent;
}

.house-form__remove {
  @apply text-app-danger text-size-xs;
}
</style>
