<script setup lang="ts">
import type { ContactOut, HouseOut, LeaseOut } from '@/features/organization-rental/service'
import type { OrganizationLeaseWriteInput } from '@/domain/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref } from 'vue'
import { buildOrganizationLeasePatchPayload, formatOrganizationHouseTitle, getOrganizationLeaseStatusActions } from '@/domain/organization-rental'
import { getOrganizationLease, listOrganizationContacts, listOrganizationHouses, patchOrganizationLease } from '@/features/organization-rental/service'
import { getOrganizationLeaseDetailRoute } from '@/modules/routes'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '编辑租约' } })

interface PickerConfirmEvent { value: Array<string | number> }

const toast = useToast()
const appContextStore = useAppContextStore()
const leaseId = ref(0)
const lease = ref<LeaseOut | null>(null)
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const houseVisible = ref(false)
const tenantVisible = ref(false)
const statusVisible = ref(false)
const houseKeyword = ref('')
const tenantKeyword = ref('')
const houseLoading = ref(false)
const tenantLoading = ref(false)
const houses = ref<HouseOut[]>([])
const tenants = ref<ContactOut[]>([])
const statusSelection = ref<Array<string | number>>([])

const form = reactive<OrganizationLeaseWriteInput>({
  house_id: 0,
  tenant_id: 0,
  source_viewing_record_id: null,
  sign_at: null,
  start_date: '',
  end_date: '',
  monthly_rent: '',
  deposit: '',
  payment_day: 1,
  status: 'pending',
  contract_files: [],
  notes: '',
  extra: {},
})

const leaseStatusLabels: Record<string, string> = {
  pending: '待生效',
  active: '生效中',
  expired: '已到期',
  terminated: '已终止',
}
const statusOptions = computed(() => {
  const current = lease.value?.status || 'pending'
  return [current, ...getOrganizationLeaseStatusActions(current)].map(value => ({ value, label: leaseStatusLabels[value] || value }))
})
const selectedHouse = computed(() => houses.value.find(item => item.id === form.house_id))
const selectedTenant = computed(() => tenants.value.find(item => item.id === form.tenant_id))
const houseLabel = computed(() => selectedHouse.value ? formatOrganizationHouseTitle(selectedHouse.value) : lease.value?.house_id === form.house_id ? formatOrganizationHouseTitle(lease.value.house) : '请选择房源')
const tenantLabel = computed(() => selectedTenant.value ? `${selectedTenant.value.name} · ${selectedTenant.value.phone}` : lease.value?.tenant_id === form.tenant_id ? `${lease.value.tenant.name} · ${lease.value.tenant.phone}` : '请选择租客')
const statusLabel = computed(() => leaseStatusLabels[String(form.status || '')] || String(form.status || ''))

function fillLease(value: LeaseOut) {
  lease.value = value
  Object.assign(form, {
    house_id: value.house_id,
    tenant_id: value.tenant_id,
    source_viewing_record_id: value.source_viewing_record_id,
    sign_at: value.sign_at,
    start_date: value.start_date,
    end_date: value.end_date,
    monthly_rent: value.monthly_rent,
    deposit: value.deposit ?? '',
    payment_day: value.payment_day,
    status: value.status,
    contract_files: [...value.contract_files],
    notes: value.notes,
    extra: value.extra,
  })
  statusSelection.value = [value.status]
}

async function loadHouses() {
  houseLoading.value = true
  try {
    const result = await listOrganizationHouses(appContextStore.organizationSlug, 1, 100, { keyword: houseKeyword.value.trim() || undefined })
    houses.value = result.items
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '房源加载失败') }
  finally { houseLoading.value = false }
}

async function loadTenants() {
  tenantLoading.value = true
  try {
    const result = await listOrganizationContacts(appContextStore.organizationSlug, 1, 100, { role: 'tenant', task: 'active', keyword: tenantKeyword.value.trim() || undefined })
    tenants.value = result.items
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '租客联系人加载失败') }
  finally { tenantLoading.value = false }
}

function selectHouse(item: HouseOut) {
  form.house_id = item.id
  houseVisible.value = false
}

function selectTenant(item: ContactOut) {
  form.tenant_id = item.id
  tenantVisible.value = false
}

function changeStatus(event: PickerConfirmEvent) {
  form.status = String(event.value[0] || lease.value?.status || 'pending')
}

async function loadPage() {
  if (!leaseId.value) {
    loadError.value = '租约参数不正确'
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const [result] = await Promise.all([
      getOrganizationLease(appContextStore.organizationSlug, leaseId.value),
      loadHouses(),
      loadTenants(),
    ])
    fillLease(result)
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '租约加载失败' }
  finally { loading.value = false }
}

async function submit() {
  if (saving.value)
    return
  if (!form.house_id || !form.tenant_id || !form.start_date || !form.end_date || form.monthly_rent === '') {
    toast.warning('请完整填写房源、租客、租期和月租金')
    return
  }
  if (form.end_date < form.start_date) {
    toast.warning('租期结束日期不能早于开始日期')
    return
  }
  const paymentDay = Number(form.payment_day || 1)
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
    toast.warning('付款日必须为 1 到 31')
    return
  }
  saving.value = true
  try {
    const saved = await patchOrganizationLease(appContextStore.organizationSlug, leaseId.value, buildOrganizationLeasePatchPayload(form))
    toast.success('租约已更新')
    setTimeout(() => uni.redirectTo({ url: getOrganizationLeaseDetailRoute(saved.id) }), 400)
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '租约保存失败') }
  finally { saving.value = false }
}

onLoad((options) => {
  leaseId.value = Number(options?.id || 0)
  void loadPage()
})
</script>

<template>
  <view class="form-page">
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载租约…" />
    <AppErrorView v-else-if="loadError" title="租约资料不可用" :message="loadError" @retry="loadPage" />
    <template v-else-if="lease">
      <wd-cell-group title="签约信息" insert>
        <wd-cell title="房源" :value="houseLabel" is-link @click="houseVisible = true" />
        <wd-cell title="租客" :value="tenantLabel" is-link @click="tenantVisible = true" />
        <wd-cell v-if="lease.source_viewing_record_id" title="来源带看" :value="`#${lease.source_viewing_record_id}`" />
        <wd-cell title="租约状态" :value="statusLabel" :is-link="statusOptions.length > 1" @click="statusOptions.length > 1 && (statusVisible = true)" />
      </wd-cell-group>

      <wd-cell-group title="租期与金额" insert>
        <wd-input v-model="form.start_date" label="起租日期" placeholder="YYYY-MM-DD" clearable />
        <wd-input v-model="form.end_date" label="到期日期" placeholder="YYYY-MM-DD" clearable />
        <wd-input v-model="form.monthly_rent" label="月租金" type="digit" placeholder="元/月" clearable />
        <wd-input v-model="form.deposit" label="押金" type="digit" placeholder="可不填" clearable />
        <wd-input v-model="form.payment_day" label="付款日" type="number" placeholder="1-31" clearable />
      </wd-cell-group>

      <wd-cell-group title="合同与备注" insert>
        <wd-cell title="合同文件" :value="form.contract_files?.length ? `${form.contract_files.length} 份（本次保留）` : '未上传'" />
        <wd-cell title="备注" layout="vertical">
          <wd-textarea v-model="form.notes" placeholder="补充履约说明" :maxlength="3000" show-word-limit />
        </wd-cell>
      </wd-cell-group>

      <view class="submit-bar">
        <wd-button block size="large" :loading="saving" :disabled="saving" @click="submit">
          保存租约
        </wd-button>
      </view>
    </template>

    <wd-popup v-model="houseVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 28rpx; max-height: 78vh; overflow: auto;">
      <view class="popup-title">
        选择房源
      </view>
      <wd-search v-model="houseKeyword" placeholder="搜索房号、小区或楼栋" hide-cancel @search="loadHouses" @clear="loadHouses" />
      <view v-if="houseLoading" class="popup-state">
        正在加载房源…
      </view>
      <view v-for="item in houses" :key="item.id" class="candidate-row" @click="selectHouse(item)">
        <strong>{{ formatOrganizationHouseTitle(item) }}</strong><text>{{ item.status__mapping }}</text>
      </view>
      <view v-if="!houseLoading && !houses.length" class="popup-state">
        未找到房源
      </view>
    </wd-popup>

    <wd-popup v-model="tenantVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 28rpx; max-height: 78vh; overflow: auto;">
      <view class="popup-title">
        选择租客
      </view>
      <wd-search v-model="tenantKeyword" placeholder="搜索租客姓名或手机号" hide-cancel @search="loadTenants" @clear="loadTenants" />
      <view v-if="tenantLoading" class="popup-state">
        正在加载租客联系人…
      </view>
      <view v-for="item in tenants" :key="item.id" class="candidate-row" @click="selectTenant(item)">
        <strong>{{ item.name }}</strong><text>{{ item.phone }}</text>
      </view>
      <view v-if="!tenantLoading && !tenants.length" class="popup-state">
        未找到有效租客联系人
      </view>
    </wd-popup>

    <wd-picker v-model="statusSelection" v-model:visible="statusVisible" :columns="statusOptions" title="选择租约状态" @confirm="changeStatus" />
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 24rpx 6rpx;
  border-bottom: 1px solid var(--app-divider-color);
}
.candidate-row strong {
  min-width: 0;
  flex: 1;
  color: var(--app-text-primary);
  font-size: 26rpx;
}
.candidate-row text,
.popup-state {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.candidate-row text {
  flex-shrink: 0;
}
.popup-state {
  padding: 32rpx 6rpx;
  text-align: center;
}
</style>
