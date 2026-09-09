<script setup lang="ts">
import type { BuildingInventoryOut, ContactOut, HouseOut } from '@/features/organization-rental/service'
import type { OrganizationHouseWriteInput } from '@/domain/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref } from 'vue'
import { buildOrganizationHouseCreatePayload, buildOrganizationHousePatchPayload } from '@/domain/organization-rental'
import { createOrganizationHouse, getOrganizationHouse, listOrganizationBuildings, listOrganizationContacts, patchOrganizationHouse, uploadOrganizationHouseImages } from '@/features/organization-rental/service'
import { getOrganizationHouseDetailRoute } from '@/modules/routes'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '房源资料' } })

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
const buildingKeyword = ref('')
const landlordKeyword = ref('')
const buildingLoading = ref(false)
const landlordLoading = ref(false)
const buildings = ref<BuildingInventoryOut[]>([])
const landlords = ref<ContactOut[]>([])
const orientationSelection = ref<Array<string | number>>([])
const decorationSelection = ref<Array<string | number>>([])

const form = reactive<OrganizationHouseWriteInput>({
  building_id: 0,
  landlord_id: null,
  room_number: '',
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
  <view class="form-page">
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载房源资料…" />
    <AppErrorView v-else-if="loadError" title="房源资料不可用" :message="loadError" @retry="loadPage" />
    <template v-else>
      <wd-cell-group title="归属与基础" insert>
        <wd-cell title="楼栋" :value="buildingLabel" is-link @click="buildingVisible = true" />
        <wd-cell title="房东" :value="landlordLabel" is-link @click="landlordVisible = true" />
        <wd-input v-model="form.room_number" label="房号" placeholder="请输入房号" clearable />
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

      <view class="media-card">
        <view class="section-head">
          <view><strong>房源图片</strong><text>{{ imageItems.length }}/9 张</text></view>
          <wd-button size="small" variant="plain" :loading="uploading" @click="addImages">
            上传图片
          </wd-button>
        </view>
        <view v-if="imageItems.length" class="image-grid">
          <view v-for="(item, index) in imageItems" :key="item.media_id" class="image-item">
            <image :src="mediaUrl(item)" mode="aspectFill" />
            <view class="image-remove" @click="removeImage(index)">
              移除
            </view>
          </view>
        </view>
        <view v-else class="empty-media">
          尚未上传房源图片
        </view>
        <view v-if="form.videos?.length" class="existing-video-tip">
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

      <view class="submit-bar">
        <wd-button block size="large" :loading="saving" :disabled="saving" @click="submit">
          {{ houseId ? '保存房源资料' : '创建房源' }}
        </wd-button>
      </view>
    </template>

    <wd-popup v-model="buildingVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 28rpx; max-height: 78vh; overflow: auto;">
      <view class="popup-title">
        选择楼栋
      </view>
      <wd-search v-model="buildingKeyword" placeholder="搜索小区、项目或楼栋" hide-cancel @search="loadBuildings" @clear="loadBuildings" />
      <view v-if="buildingLoading" class="popup-state">
        正在加载楼栋…
      </view>
      <view v-for="item in buildings" :key="item.id" class="candidate-row" @click="selectBuilding(item)">
        <strong>{{ item.name }}</strong><text>{{ item.estate?.display_name || item.estate?.name || item.address || '非小区楼栋' }}</text>
      </view>
      <view v-if="!buildingLoading && !buildings.length" class="popup-state">
        未找到楼栋，请先在管理端或楼栋模块建档
      </view>
    </wd-popup>

    <wd-popup v-model="landlordVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 28rpx; max-height: 78vh; overflow: auto;">
      <view class="popup-title">
        选择房东
      </view>
      <wd-search v-model="landlordKeyword" placeholder="搜索房东姓名或手机号" hide-cancel @search="loadLandlords" @clear="loadLandlords" />
      <view class="candidate-row" @click="selectLandlord(null)">
        <strong>不关联房东</strong><text>可创建后再补齐</text>
      </view>
      <view v-for="item in landlords" :key="item.id" class="candidate-row" @click="selectLandlord(item)">
        <strong>{{ item.name }}</strong><text>{{ item.phone }}</text>
      </view>
      <view v-if="landlordLoading" class="popup-state">
        正在加载房东联系人…
      </view>
    </wd-popup>

    <wd-picker v-model="orientationSelection" v-model:visible="orientationVisible" :columns="orientationOptions" title="选择朝向" @confirm="changeOrientation" />
    <wd-picker v-model="decorationSelection" v-model:visible="decorationVisible" :columns="decorationOptions" title="选择装修情况" @confirm="changeDecoration" />
  </view>
</template>

<style scoped lang="scss">
.form-page {
  min-height: 100vh;
  padding: 24rpx 0 150rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.form-page :deep(.wd-cell-group) {
  margin-bottom: 22rpx;
}
.media-card {
  margin: 0 24rpx 22rpx;
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.section-head,
.candidate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}
.section-head strong,
.section-head text,
.candidate-row strong,
.candidate-row text {
  display: block;
}
.section-head strong,
.candidate-row strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.section-head text,
.candidate-row text,
.empty-media,
.existing-video-tip,
.popup-state {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 24rpx;
}
.image-item {
  overflow: hidden;
  border-radius: 16rpx;
  background: var(--app-bg-subtle);
}
.image-item image {
  display: block;
  width: 100%;
  height: 180rpx;
}
.image-remove {
  padding: 10rpx;
  color: var(--app-color-danger);
  font-size: 21rpx;
  text-align: center;
}
.empty-media,
.existing-video-tip {
  margin-top: 24rpx;
}
.submit-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: var(--app-bg-card);
  box-shadow: 0 -8rpx 28rpx rgb(15 23 42 / 8%);
}
.popup-title {
  margin-bottom: 18rpx;
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.candidate-row {
  padding: 24rpx 6rpx;
  border-bottom: 1px solid var(--app-divider-color);
}
.candidate-row text {
  max-width: 55%;
  text-align: right;
}
.popup-state {
  padding: 32rpx 6rpx;
  text-align: center;
}
</style>
