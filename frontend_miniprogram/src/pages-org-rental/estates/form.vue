<script setup lang="ts">
import type { OrganizationEstateWriteInput } from '@/pages-org-rental/domain/organization-rental'
import type { OrganizationEstateDetailOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref } from 'vue'
import { buildOrganizationEstatePayload } from '@/pages-org-rental/domain/organization-rental'
import { createOrganizationEstate, getOrganizationEstate, patchOrganizationEstate } from '@/pages-org-rental/api/organization-rental'
import AppFormPage from '@/pages-org-rental/components/AppFormPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '小区资料' } })

interface PickerConfirmEvent { value: Array<string | number> }

const toast = useToast()
const appContextStore = useAppContextStore()
const estateId = ref(0)
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const propertyTypeVisible = ref(false)
const propertyTypeSelection = ref<Array<string | number>>(['residential'])

const form = reactive<OrganizationEstateWriteInput>({
  name: '',
  display_name: '',
  developer: '',
  built_year: '',
  property_type: 'residential',
  province: '',
  city: '',
  district: '',
  subdistrict: '',
  address: '',
  description: '',
})

const propertyTypeOptions = [
  { value: 'residential', label: '住宅' },
  { value: 'commercial', label: '商业' },
  { value: 'industrial', label: '工业' },
  { value: 'mixed', label: '综合' },
]
const propertyTypeLabel = computed(() => propertyTypeOptions.find(item => item.value === form.property_type)?.label || '请选择')

function fillEstate(value: OrganizationEstateDetailOut) {
  Object.assign(form, {
    name: value.name,
    display_name: value.display_name,
    developer: value.developer || '',
    built_year: value.built_year ?? '',
    property_type: value.property_type,
    province: value.province,
    city: value.city,
    district: value.district,
    subdistrict: value.subdistrict || '',
    address: value.address,
    description: value.description,
  })
  propertyTypeSelection.value = [value.property_type]
}

function changePropertyType(event: PickerConfirmEvent) {
  form.property_type = String(event.value[0] || 'residential')
}

async function loadPage() {
  if (!estateId.value)
    return
  loading.value = true
  loadError.value = ''
  try {
    fillEstate(await getOrganizationEstate(appContextStore.organizationSlug, estateId.value))
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '小区资料加载失败'
  }
  finally {
    loading.value = false
  }
}

async function submit() {
  if (saving.value)
    return
  if (!form.name.trim() || !form.display_name.trim() || !form.province.trim() || !form.city.trim() || !form.district.trim()) {
    toast.warning('请完整填写名称和所在地区')
    return
  }
  if (form.built_year !== '' && form.built_year != null) {
    const year = Number(form.built_year)
    if (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear() + 10) {
      toast.warning('建成年份格式不正确')
      return
    }
  }

  saving.value = true
  try {
    const payload = buildOrganizationEstatePayload(form)
    if (estateId.value)
      await patchOrganizationEstate(appContextStore.organizationSlug, estateId.value, payload)
    else
      await createOrganizationEstate(appContextStore.organizationSlug, payload)
    toast.success(estateId.value ? '小区资料已更新' : '小区已创建')
    setTimeout(() => uni.navigateBack(), 350)
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '小区保存失败')
  }
  finally {
    saving.value = false
  }
}

onLoad((options) => {
  estateId.value = Number(options?.id || 0)
  uni.setNavigationBarTitle({ title: estateId.value ? '编辑小区' : '新建小区' })
  void loadPage()
})
</script>

<template>
  <AppFormPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载小区资料…"
    error-title="小区资料不可用"
    :submitting="saving"
    :submit-disabled="saving"
    :submit-text="estateId ? '保存小区资料' : '创建小区'"
    @retry="loadPage"
    @submit="submit"
  >
    <template #navigation>
      <AppCustomNavigation title="小区资料" back scroll-mode="sticky" />
    </template>
    <template #feedback>
      <wd-toast />
    </template>
    <wd-cell-group title="基础信息" insert>
      <wd-input v-model="form.name" label="标准名称" placeholder="请输入小区标准名称" clearable />
      <wd-input v-model="form.display_name" label="展示名称" placeholder="请输入对外展示名称" clearable />
      <wd-cell title="物业类型" :value="propertyTypeLabel" is-link @click="propertyTypeVisible = true" />
      <wd-input v-model="form.developer" label="开发商" placeholder="可不填" clearable />
      <wd-input v-model="form.built_year" label="建成年份" type="number" placeholder="可不填" clearable />
    </wd-cell-group>

    <wd-cell-group title="所在地区" insert>
      <wd-input v-model="form.province" label="省份" placeholder="例如 广东省" clearable />
      <wd-input v-model="form.city" label="城市" placeholder="例如 深圳市" clearable />
      <wd-input v-model="form.district" label="区县" placeholder="例如 南山区" clearable />
      <wd-input v-model="form.subdistrict" label="街道/板块" placeholder="例如 科技园，可不填" clearable />
      <wd-input v-model="form.address" label="详细地址" placeholder="可稍后补充" clearable />
    </wd-cell-group>

    <wd-cell-group title="补充说明" insert>
      <wd-cell title="小区描述" layout="vertical">
        <wd-textarea v-model="form.description" placeholder="补充交通、配套等信息" :maxlength="3000" show-word-limit />
      </wd-cell>
    </wd-cell-group>

    <template #overlay>
      <wd-picker v-model="propertyTypeSelection" v-model:visible="propertyTypeVisible" :columns="propertyTypeOptions" title="选择物业类型" @confirm="changePropertyType" />
    </template>
  </AppFormPage>
</template>
