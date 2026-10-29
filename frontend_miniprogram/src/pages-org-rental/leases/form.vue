<script setup lang="ts">
import LeaseContractEditor from '@/pages-org-rental/components/LeaseContractEditor.vue'
import type { ContactOut, HouseOut, LeaseOut } from '@/pages-org-rental/api/organization-rental'
import type { OrganizationLeaseWriteInput } from '@/pages-org-rental/domain/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref } from 'vue'
import { buildOrganizationLeasePatchPayload, getOrganizationLeaseStatusActions } from '@/pages-org-rental/domain/organization-rental'
import { getOrganizationLease, listOrganizationContacts, listOrganizationHouses, patchOrganizationLease } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationLeaseDetailRoute } from '@/modules/routes'
import AppEntityPickerOption from '@/components/app/AppEntityPickerOption.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import AppEntityPickerSheet from '@/pages-org-rental/components/AppEntityPickerSheet.vue'
import AppFormPage from '@/pages-org-rental/components/AppFormPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { getOrganizationCustomerCapabilities } from '@/services/manual/organization-customers'
import { listAllOrganizationAdminTeams } from '@/features/organization-admin/service'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '编辑租约' } })

interface PickerConfirmEvent { value: Array<string | number> }

const toast = useToast()
const appContextStore = useAppContextStore()
const leaseId = ref(0)
const lease = ref<LeaseOut | null>(null)
const loading = ref(true)
const saving = ref(false)
const uploadingContract = ref(false)
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
const canManage = ref(false)
const dealTeamId = ref<number | null>(null)
const teams = ref<Array<{ id: number, name: string }>>([])
const teamVisible = ref(false)
const teamSelection = ref<Array<string | number>>([])
const signedDateVisible = ref(false)
const signedDateValue = ref(Date.now())
const teamOptions = computed(() => [{ label: '空间直属', value: 0 }, ...teams.value.map(item => ({ label: item.name, value: item.id }))])
const dealTeamLabel = computed(() => teams.value.find(item => item.id === dealTeamId.value)?.name || (dealTeamId.value ? lease.value?.deal_team_name_snapshot || '原成交团队' : '空间直属'))
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

function editSignedDate() {
  signedDateValue.value = form.sign_at ? new Date(form.sign_at).getTime() : Date.now()
  signedDateVisible.value = true
}
function confirmSignedDate({ value }: { value: string | number | Array<string | number> }) {
  const date = new Date(Number(value))
  if (Number.isFinite(date.getTime())) {
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    form.sign_at = new Date(`${day}T12:00:00+08:00`).toISOString()
  }
}
function confirmDealTeam({ value }: PickerConfirmEvent) {
  dealTeamId.value = Number(value[0]) || null
}

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
const selectedHousePreview = computed(() => selectedHouse.value || (lease.value?.house_id === form.house_id ? lease.value.house : null))
const tenantLabel = computed(() => selectedTenant.value ? `${selectedTenant.value.name} · ${selectedTenant.value.phone}` : lease.value?.tenant_id === form.tenant_id ? `${lease.value.tenant.name} · ${lease.value.tenant.phone}` : '请选择租客')
const statusLabel = computed(() => leaseStatusLabels[String(form.status || '')] || String(form.status || ''))

function fillLease(value: LeaseOut) {
  lease.value = value
  dealTeamId.value = value.deal_team_id
  teamSelection.value = [value.deal_team_id || 0]
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
    const result = await listOrganizationHouses(appContextStore.organizationSlug, 1, 100, { keyword: houseKeyword.value.trim() || undefined, is_active: true })
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
    const [result, capabilities] = await Promise.all([
      getOrganizationLease(appContextStore.organizationSlug, leaseId.value),
      getOrganizationCustomerCapabilities(appContextStore.organizationSlug),
      loadHouses(),
      loadTenants(),
    ])
    if (!result.can_maintain)
      throw new Error('当前账号仅可查看这份租约摘要，请联系原登记人或空间管理员维护。')
    fillLease(result)
    canManage.value = capabilities.can_manage
    if (canManage.value)
      teams.value = await listAllOrganizationAdminTeams(appContextStore.organizationSlug).catch(() => [])
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '租约加载失败' }
  finally { loading.value = false }
}

async function submit() {
  if (saving.value || uploadingContract.value)
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
    const saved = await patchOrganizationLease(appContextStore.organizationSlug, leaseId.value, ({ ...buildOrganizationLeasePatchPayload(form), ...(canManage.value && dealTeamId.value !== lease.value?.deal_team_id ? { deal_team_id: dealTeamId.value } : {}) }))
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
  <AppFormPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载租约…"
    error-title="租约资料不可用"
    :submitting="saving"
    :submit-disabled="saving || uploadingContract"
    submit-text="保存租约"
    :show-actions="Boolean(lease)"
    @retry="loadPage"
    @submit="submit"
  >
    <template #navigation>
      <AppCustomNavigation title="编辑租约" back scroll-mode="sticky" />
    </template>
    <template #feedback>
      <wd-toast />
    </template>

    <template v-if="lease">
      <wd-cell-group title="签约信息" insert>
        <HouseCard v-if="selectedHousePreview" class="mx-3 mb-2.5" :house="selectedHousePreview" variant="compact" action-text="更换" @click="houseVisible = true" @action="houseVisible = true" />
        <wd-cell v-else title="房源" value="请选择房源" is-link @click="houseVisible = true" />
        <wd-cell title="租客" :value="tenantLabel" is-link @click="tenantVisible = true" />
        <wd-cell v-if="lease.source_viewing_record_id" title="来源带看" :value="`#${lease.source_viewing_record_id}`" />
        <wd-cell title="租约状态" :value="statusLabel" :is-link="statusOptions.length > 1" @click="statusOptions.length > 1 && (statusVisible = true)" />
      </wd-cell-group>

      <wd-cell-group v-if="canManage" title="管理员成交资料纠错" insert>
        <wd-cell title="实际签约日期" :value="form.sign_at ? new Date(form.sign_at).toLocaleDateString('zh-CN') : '未填写'" is-link @click="editSignedDate" />
        <wd-cell title="成交团队" :value="dealTeamLabel" is-link @click="teamVisible = true" />
        <wd-cell title="修改说明" label="已有待审核或已通过收益时，请先撤回或由财务作废；修改后需填写原因纠错重提。" />
      </wd-cell-group>
      <wd-cell-group title="租期与金额" insert>
        <wd-cell title="起租日期" center>
          <wd-input v-model="form.start_date" placeholder="YYYY-MM-DD" clearable compact align-right />
        </wd-cell>
        <wd-cell title="到期日期" center>
          <wd-input v-model="form.end_date" placeholder="YYYY-MM-DD" clearable compact align-right />
        </wd-cell>
        <wd-cell title="月租金" center>
          <wd-input v-model="form.monthly_rent" type="digit" placeholder="元/月" clearable compact align-right />
        </wd-cell>
        <wd-cell title="押金" center>
          <wd-input v-model="form.deposit" type="digit" placeholder="可不填" clearable compact align-right />
        </wd-cell>
        <wd-cell title="付款日" center>
          <wd-input v-model="form.payment_day" type="number" placeholder="1-31" clearable compact align-right />
        </wd-cell>
      </wd-cell-group>

      <wd-cell-group title="合同与备注" insert>
        <LeaseContractEditor :files="form.contract_files || []" :disabled="saving" :organization-slug="appContextStore.organizationSlug" @update:files="form.contract_files = $event" @uploading="uploadingContract = $event" />
        <wd-cell title="备注" layout="vertical">
          <wd-textarea v-model="form.notes" placeholder="补充履约说明" :maxlength="3000" show-word-limit />
        </wd-cell>
      </wd-cell-group>
    </template>

    <template #overlay>
      <AppEntityPickerSheet
        v-model:visible="houseVisible"
        v-model:keyword="houseKeyword"
        title="选择房源"
        search-placeholder="搜索房号、小区或楼栋"
        :items="houses"
        item-key="id"
        :selected="form.house_id ? [form.house_id] : []"
        :loading="houseLoading"
        empty-text="未找到房源"
        @search="loadHouses"
        @select="selectHouse"
      >
        <template #item="{ item, selected }">
          <HouseCard :house="item" variant="compact" selectable :selected="selected" />
        </template>
      </AppEntityPickerSheet>

      <AppEntityPickerSheet
        v-model:visible="tenantVisible"
        v-model:keyword="tenantKeyword"
        title="选择租客"
        search-placeholder="搜索租客姓名或手机号"
        :items="tenants"
        item-key="id"
        :selected="form.tenant_id ? [form.tenant_id] : []"
        :loading="tenantLoading"
        empty-text="未找到有效租客联系人"
        @search="loadTenants"
        @select="selectTenant"
      >
        <template #item="{ item, selected }">
          <AppEntityPickerOption :title="item.name" :description="item.phone" :selected="selected" />
        </template>
      </AppEntityPickerSheet>

      <wd-datetime-picker v-model="signedDateValue" v-model:visible="signedDateVisible" type="date" title="修正实际签约日期" @confirm="confirmSignedDate" />
      <wd-picker v-model="teamSelection" v-model:visible="teamVisible" :columns="teamOptions" title="修正成交团队" @confirm="confirmDealTeam" />
      <wd-picker v-model="statusSelection" v-model:visible="statusVisible" :columns="statusOptions" title="选择租约状态" @confirm="changeStatus" />
    </template>
  </AppFormPage>
</template>
