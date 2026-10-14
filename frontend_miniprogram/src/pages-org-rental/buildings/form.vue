<script setup lang="ts">
import PropertyLocationField from '@/components/house/PropertyLocationField.vue'
import type { OrganizationBuildingWriteInput } from '@/pages-org-rental/domain/organization-rental'
import type { BuildingInventoryOut, EstateDetailOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref } from 'vue'
import { buildOrganizationBuildingPayload } from '@/pages-org-rental/domain/organization-rental'
import { createOrganizationBuilding, getOrganizationBuilding, listOrganizationEstates, patchOrganizationBuilding } from '@/pages-org-rental/api/organization-rental'
import AppEntityPickerOption from '@/components/app/AppEntityPickerOption.vue'
import AppEntityPickerSheet from '@/pages-org-rental/components/AppEntityPickerSheet.vue'
import AppFormPage from '@/pages-org-rental/components/AppFormPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '楼栋资料' } })

const toast = useToast()
const appContextStore = useAppContextStore()
const buildingId = ref(0)
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const estateVisible = ref(false)
const estateLoading = ref(false)
const estateKeyword = ref('')
const estates = ref<EstateDetailOut[]>([])

const form = reactive<OrganizationBuildingWriteInput>({
  estate_id: null,
  name: '',
  floors: '',
  under_floors: '',
  year_built: '',
  elevator: false,
  address: '',
  tags: '',
})

const selectedEstate = computed(() => estates.value.find(item => item.id === form.estate_id))
const estateLabel = computed(() => selectedEstate.value ? selectedEstate.value.display_name || selectedEstate.value.name : '独立楼栋')

function fillBuilding(value: BuildingInventoryOut) {
  Object.assign(form, {
    estate_id: value.estate_id,
    name: value.name,
    floors: value.floors,
    under_floors: value.under_floors ?? '',
    year_built: value.year_built ?? '',
    elevator: value.elevator,
    address: value.address,
    tags: value.tags.join('，'),
    location: value.location ? { longitude: value.location.longitude, latitude: value.location.latitude, coordinate_system: 'gcj02' } : null,
  })
}

async function loadEstates() {
  estateLoading.value = true
  try {
    const result = await listOrganizationEstates(appContextStore.organizationSlug, 1, 100, { keyword: estateKeyword.value.trim() || undefined })
    estates.value = result.items
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '小区列表加载失败')
  }
  finally {
    estateLoading.value = false
  }
}

function selectEstate(item: EstateDetailOut | null) {
  form.estate_id = item?.id || null
  estateVisible.value = false
}

async function loadPage() {
  loading.value = true
  loadError.value = ''
  try {
    const [building] = await Promise.all([
      buildingId.value ? getOrganizationBuilding(appContextStore.organizationSlug, buildingId.value) : Promise.resolve(null),
      loadEstates(),
    ])
    if (building)
      fillBuilding(building)
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '楼栋资料加载失败'
  }
  finally {
    loading.value = false
  }
}

async function submit() {
  if (saving.value)
    return
  const floors = Number(form.floors)
  if (!form.name.trim() || !form.address.trim() || !Number.isInteger(floors) || floors <= 0) {
    toast.warning('请填写楼栋名称、地址和正确的地上楼层')
    return
  }
  for (const [value, label] of [[form.under_floors, '地下楼层'], [form.year_built, '建成年份']] as const) {
    if (value !== '' && value != null && (!Number.isInteger(Number(value)) || Number(value) < 0)) {
      toast.warning(`${label}格式不正确`)
      return
    }
  }

  saving.value = true
  try {
    const payload = buildOrganizationBuildingPayload(form)
    if (buildingId.value)
      await patchOrganizationBuilding(appContextStore.organizationSlug, buildingId.value, payload)
    else
      await createOrganizationBuilding(appContextStore.organizationSlug, payload)
    toast.success(buildingId.value ? '楼栋资料已更新' : '楼栋已创建')
    setTimeout(() => uni.navigateBack(), 350)
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '楼栋保存失败')
  }
  finally {
    saving.value = false
  }
}

onLoad((options) => {
  buildingId.value = Number(options?.id || 0)
  uni.setNavigationBarTitle({ title: buildingId.value ? '编辑楼栋' : '新建楼栋' })
  void loadPage()
})
</script>

<template>
  <AppFormPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载楼栋资料…"
    error-title="楼栋资料不可用"
    :submitting="saving"
    :submit-disabled="saving"
    :submit-text="buildingId ? '保存楼栋资料' : '创建楼栋'"
    @retry="loadPage"
    @submit="submit"
  >
    <template #navigation>
      <AppCustomNavigation title="楼栋资料" back scroll-mode="sticky" />
    </template>
    <template #feedback>
      <wd-toast />
    </template>
    <wd-cell-group title="归属与基础" insert>
      <wd-cell title="所属小区" :value="estateLabel" is-link @click="estateVisible = true" />
      <wd-input v-model="form.name" label="楼栋名称" placeholder="例如 1栋" clearable />
      <wd-input v-model="form.address" label="楼栋地址" placeholder="请输入详细地址" clearable />
      <PropertyLocationField v-model="form.location" :disabled="saving" :city="selectedEstate?.city" />
      <wd-cell title="配备电梯" center>
        <wd-switch v-model="form.elevator" size="20px" />
      </wd-cell>
    </wd-cell-group>

    <wd-cell-group title="楼层与标签" insert>
      <wd-input v-model="form.floors" label="地上楼层" type="number" placeholder="必填" clearable />
      <wd-input v-model="form.under_floors" label="地下楼层" type="number" placeholder="可不填" clearable />
      <wd-input v-model="form.year_built" label="建成年份" type="number" placeholder="可不填" clearable />
      <wd-input v-model="form.tags" label="楼栋标签" placeholder="用逗号分隔" clearable />
    </wd-cell-group>

    <template #overlay>
      <AppEntityPickerSheet
        v-model:visible="estateVisible"
        v-model:keyword="estateKeyword"
        title="选择所属小区"
        search-placeholder="搜索小区名称"
        :items="estates"
        item-key="id"
        :selected="form.estate_id ? [form.estate_id] : []"
        :loading="estateLoading"
        empty-text="未找到小区，可使用独立楼栋"
        @search="loadEstates"
        @select="selectEstate"
      >
        <template #before-list>
          <view class="app-touchable border-0 border-b border-app-divider border-solid py-2.5" @click="selectEstate(null)">
            <AppEntityPickerOption title="独立楼栋" description="不归属具体小区" :selected="form.estate_id == null" />
          </view>
        </template>
        <template #item="{ item, selected }">
          <AppEntityPickerOption
            :title="item.display_name || item.name"
            :description="[item.city, item.district].filter(Boolean).join(' ')"
            :selected="selected"
          />
        </template>
      </AppEntityPickerSheet>
    </template>
  </AppFormPage>
</template>
