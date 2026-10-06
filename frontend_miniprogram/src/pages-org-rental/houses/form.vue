<script setup lang="ts">
import type { BuildingInventoryOut, ContactOut, HouseOut } from '@/pages-org-rental/api/organization-rental'
import type { OrganizationHouseWriteInput } from '@/pages-org-rental/domain/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref } from 'vue'
import { buildOrganizationHouseCreatePayload, buildOrganizationHousePatchPayload } from '@/pages-org-rental/domain/organization-rental'
import { createOrganizationHouse, getOrganizationHouse, listOrganizationBuildings, listOrganizationContacts, patchOrganizationHouse, uploadOrganizationHouseImages } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationHouseDetailRoute } from '@/modules/routes'
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
const listingTypeVisible = ref(false)
const buildingKeyword = ref('')
const landlordKeyword = ref('')
const buildingLoading = ref(false)
const landlordLoading = ref(false)
const buildings = ref<BuildingInventoryOut[]>([])
const landlords = ref<ContactOut[]>([])
const orientationSelection = ref<Array<string | number>>([])
const decorationSelection = ref<Array<string | number>>([])
const listingTypeSelection = ref<Array<string | number>>([])

const form = reactive<OrganizationHouseWriteInput>({
  building_id: 0,
  landlord_id: null,
  room_number: '',
  listing_type: null,
  floor: '',
  area: '',
  interior_area: '',
  asking_rent: '',
  deposit_amount: '',
  bedrooms: '',
  living_rooms: '',
  bathrooms: '',
  kitchens: '',
  balconies: '',
  orientation: '',
  decoration: '',
  has_elevator_access: false,
  images: [],
  videos: [],
  tags: '',
  public_description: '',
  internal_notes: '',
})

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
  { label: '暂不分类', value: '' },
  { label: '整租', value: 'whole' },
  { label: '合租', value: 'shared' },
  { label: '公寓', value: 'apartment' },
  { label: '短租', value: 'short_term' },
]

const selectedBuilding = computed(() => buildings.value.find(item => item.id === form.building_id))
const selectedLandlord = computed(() => landlords.value.find(item => item.id === form.landlord_id))
const buildingLabel = computed(() => {
  const building = selectedBuilding.value
  if (building)
    return [building.estate?.display_name || building.estate?.name, building.name].filter(Boolean).join(' ')
  if (currentHouse.value?.building_id === form.building_id)
    return [currentHouse.value.building.estate?.display_name || currentHouse.value.building.estate?.name, currentHouse.value.building.name].filter(Boolean).join(' ')
  return '请选择楼栋'
})
const landlordLabel = computed(() => selectedLandlord.value?.name || (currentHouse.value?.landlord_id === form.landlord_id ? currentHouse.value.landlord?.name : '') || '不关联房东')
const orientationLabel = computed(() => orientationOptions.find(item => item.value === form.orientation)?.label || '不设置')
const decorationLabel = computed(() => decorationOptions.find(item => item.value === form.decoration)?.label || '不设置')
const listingTypeLabel = computed(() => listingTypeOptions.find(item => item.value === form.listing_type)?.label || '暂不分类')
const imageItems = computed(() => (form.images || []) as HouseMediaRef[])

function mediaUrl(item: HouseMediaRef): string {
  return String(item.thumbnail || item.url || '')
}

function fillHouse(house: HouseOut) {
  currentHouse.value = house
  Object.assign(form, {
    building_id: house.building_id,
    landlord_id: house.landlord_id,
    room_number: house.room_number,
    listing_type: (house as HouseOut & { listing_type?: OrganizationHouseWriteInput['listing_type'] }).listing_type || null,
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
  listingTypeSelection.value = [form.listing_type || '']
}

async function loadBuildings() {
  buildingLoading.value = true
  try {
    const result = await listOrganizationBuildings(appContextStore.organizationSlug, 1, 100, { keyword: buildingKeyword.value.trim() || undefined })
    buildings.value = result.items
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '楼栋加载失败') }
  finally { buildingLoading.value = false }
}

async function loadLandlords() {
  landlordLoading.value = true
  try {
    const result = await listOrganizationContacts(appContextStore.organizationSlug, 1, 100, { role: 'landlord', task: 'active', keyword: landlordKeyword.value.trim() || undefined })
    landlords.value = result.items
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '房东联系人加载失败') }
  finally { landlordLoading.value = false }
}

function selectBuilding(item: BuildingInventoryOut) {
  form.building_id = item.id
  buildingVisible.value = false
}

function selectLandlord(item: ContactOut | null) {
  form.landlord_id = item?.id || null
  landlordVisible.value = false
}

function changeOrientation(event: PickerConfirmEvent) {
  form.orientation = String(event.value[0] || '')
}

function changeDecoration(event: PickerConfirmEvent) {
  form.decoration = String(event.value[0] || '')
}

function changeListingType(event: PickerConfirmEvent) {
  form.listing_type = String(event.value[0] || '') as OrganizationHouseWriteInput['listing_type'] || null
}

async function addImages() {
  if (uploading.value)
    return
  const remaining = Math.max(0, 9 - imageItems.value.length)
  if (!remaining) {
    toast.warning('最多上传 9 张房源图片')
    return
  }
  uploading.value = true
  try {
    const uploaded = await uploadOrganizationHouseImages(appContextStore.organizationSlug, remaining)
    form.images = [...imageItems.value, ...uploaded.map(item => ({ ...item, media_id: item.id, media_type: 'image' as const }))]
    toast.success('图片已上传，保存后生效')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '房源图片上传失败') }
  finally { uploading.value = false }
}

function removeImage(index: number) {
  form.images = imageItems.value.filter((_item, itemIndex) => itemIndex !== index)
}

async function submit() {
  if (saving.value)
    return
  if (!form.building_id || !form.room_number.trim()) {
    toast.warning('请选择楼栋并填写房号')
    return
  }
  saving.value = true
  try {
    const saved = houseId.value
      ? await patchOrganizationHouse(appContextStore.organizationSlug, houseId.value, buildOrganizationHousePatchPayload(form))
      : await createOrganizationHouse(appContextStore.organizationSlug, buildOrganizationHouseCreatePayload(form))
    toast.success(houseId.value ? '房源资料已更新' : '房源已创建')
    setTimeout(() => uni.redirectTo({ url: getOrganizationHouseDetailRoute(saved.id) }), 400)
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '房源保存失败') }
  finally { saving.value = false }
}

async function loadPage() {
  loading.value = true
  loadError.value = ''
  try {
    const [house] = await Promise.all([
      houseId.value ? getOrganizationHouse(appContextStore.organizationSlug, houseId.value) : Promise.resolve(null),
      loadBuildings(),
      loadLandlords(),
    ])
    if (house)
      fillHouse(house)
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '房源资料加载失败' }
  finally { loading.value = false }
}

onLoad((options) => {
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
      <AppCustomNavigation title="房源资料" back scroll-mode="sticky" />
    </template>
    <template #feedback>
      <wd-toast />
    </template>

    <wd-cell-group title="归属与基础" insert>
      <wd-cell title="楼栋" :value="buildingLabel" is-link @click="buildingVisible = true" />
      <wd-cell title="房东" :value="landlordLabel" is-link @click="landlordVisible = true" />
      <wd-input v-model="form.room_number" label="房号" placeholder="请输入房号" clearable />
      <wd-cell title="出租分类" :value="listingTypeLabel" is-link @click="listingTypeVisible = true" />
      <wd-input v-model="form.floor" label="楼层" type="number" placeholder="例如 12" clearable />
    </wd-cell-group>

    <wd-cell-group title="面积与租金" insert>
      <wd-input v-model="form.area" label="建筑面积" type="digit" placeholder="平方米" clearable />
      <wd-input v-model="form.interior_area" label="套内面积" type="digit" placeholder="平方米" clearable />
      <wd-input v-model="form.asking_rent" label="挂牌租金" type="digit" placeholder="元/月" clearable />
      <wd-input v-model="form.deposit_amount" label="押金" type="digit" placeholder="元" clearable />
    </wd-cell-group>

    <wd-cell-group title="户型资料" insert>
      <wd-input v-model="form.bedrooms" label="卧室" type="number" placeholder="0" clearable />
      <wd-input v-model="form.living_rooms" label="客厅" type="number" placeholder="0" clearable />
      <wd-input v-model="form.bathrooms" label="卫生间" type="number" placeholder="0" clearable />
      <wd-input v-model="form.kitchens" label="厨房" type="number" placeholder="0" clearable />
      <wd-input v-model="form.balconies" label="阳台" type="number" placeholder="0" clearable />
      <wd-cell title="朝向" :value="orientationLabel" is-link @click="orientationVisible = true" />
      <wd-cell title="装修" :value="decorationLabel" is-link @click="decorationVisible = true" />
      <wd-cell title="可使用电梯" center>
        <wd-switch v-model="form.has_elevator_access" size="20px" />
      </wd-cell>
    </wd-cell-group>

    <view class="mx-app-gutter app-card-plain p-3.5">
      <view class="app-row-between">
        <view>
          <view class="text-sm text-content-primary font-semibold">
            房源图片
          </view>
          <view class="mt-1 text-xs text-content-muted">
            {{ imageItems.length }}/9 张
          </view>
        </view>
        <wd-button size="small" variant="plain" :loading="uploading" @click="addImages">
          上传图片
        </wd-button>
      </view>
      <view v-if="imageItems.length" class="grid grid-cols-3 mt-3 gap-1.5">
        <view v-for="(item, index) in imageItems" :key="item.media_id" class="overflow-hidden rounded-app-md bg-surface-subtle">
          <image class="block h-24 w-full" :src="mediaUrl(item)" mode="aspectFill" />
          <view class="app-touchable py-1.5 text-center text-2xs text-app-danger" @click="removeImage(index)">
            移除
          </view>
        </view>
      </view>
      <view v-else class="mt-3 text-xs text-content-muted">
        尚未上传房源图片
      </view>
      <view v-if="form.videos?.length" class="mt-3 text-xs text-content-muted">
        已保留 {{ form.videos.length }} 个现有视频
      </view>
    </view>

    <wd-cell-group title="展示与备注" insert>
      <wd-input v-model="form.tags" label="标签" placeholder="用逗号分隔" clearable />
      <wd-cell title="公开描述" layout="vertical">
        <wd-textarea v-model="form.public_description" placeholder="面向租客展示的房源介绍" :maxlength="3000" show-word-limit />
      </wd-cell>
      <wd-cell v-if="houseId" title="内部备注" layout="vertical">
        <wd-textarea v-model="form.internal_notes" placeholder="仅组织成员可见" :maxlength="3000" show-word-limit />
      </wd-cell>
    </wd-cell-group>

    <template #overlay>
      <AppEntityPickerSheet
        v-model:visible="buildingVisible"
        v-model:keyword="buildingKeyword"
        title="选择楼栋"
        search-placeholder="搜索小区、项目或楼栋"
        :items="buildings"
        item-key="id"
        :selected="form.building_id ? [form.building_id] : []"
        :loading="buildingLoading"
        empty-text="未找到楼栋，请先在管理端或楼栋模块建档"
        @search="loadBuildings"
        @select="selectBuilding"
      >
        <template #item="{ item, selected }">
          <AppEntityPickerOption
            :title="item.name"
            :description="item.estate?.display_name || item.estate?.name || item.address || '非小区楼栋'"
            :selected="selected"
          />
        </template>
      </AppEntityPickerSheet>

      <AppEntityPickerSheet
        v-model:visible="landlordVisible"
        v-model:keyword="landlordKeyword"
        title="选择房东"
        search-placeholder="搜索房东姓名或手机号"
        :items="landlords"
        item-key="id"
        :selected="form.landlord_id ? [form.landlord_id] : []"
        :loading="landlordLoading"
        empty-text="未找到有效房东联系人"
        @search="loadLandlords"
        @select="selectLandlord"
      >
        <template #before-list>
          <view class="app-touchable border-0 border-b border-app-divider border-solid py-2.5" @click="selectLandlord(null)">
            <AppEntityPickerOption title="不关联房东" description="可创建后再补齐" :selected="form.landlord_id == null" />
          </view>
        </template>
        <template #item="{ item, selected }">
          <AppEntityPickerOption :title="item.name" :description="item.phone" :selected="selected" />
        </template>
      </AppEntityPickerSheet>

      <wd-picker v-model="orientationSelection" v-model:visible="orientationVisible" :columns="orientationOptions" title="选择朝向" @confirm="changeOrientation" />
      <wd-picker v-model="decorationSelection" v-model:visible="decorationVisible" :columns="decorationOptions" title="选择装修情况" @confirm="changeDecoration" />
      <wd-picker v-model="listingTypeSelection" v-model:visible="listingTypeVisible" :columns="listingTypeOptions" title="选择出租分类" @confirm="changeListingType" />
    </template>
  </AppFormPage>
</template>
