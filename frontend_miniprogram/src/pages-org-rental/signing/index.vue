<script setup lang="ts">
import LeaseContractEditor from '@/pages-org-rental/components/LeaseContractEditor.vue'
import RentalPageHeading from '../components/RentalPageHeading.vue'
import type { AllocationCapabilitiesOut, ContactOut, HouseOut, ViewingRecordOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatOrganizationLocalDate } from '@/pages-org-rental/domain/organization-rental'
import { getAllocationCapabilities, getOrganizationHouse, getOrganizationViewing, listOrganizationContacts, listOrganizationHouses } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationLeaseDetailRoute } from '@/modules/routes'
import { createRentalRequestId, getOrganizationInquiry, registerOrganizationSigning } from '@/services/manual/rental-closure'
import AppErrorView from '@/components/app/AppErrorView.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import AppEntityPickerOption from '@/components/app/AppEntityPickerOption.vue'
import AppEntityPickerSheet from '@/pages-org-rental/components/AppEntityPickerSheet.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '登记签约' } })

const appContextStore = useAppContextStore()
const allocationCapabilities = ref<AllocationCapabilitiesOut | null>(null)
const sourceViewing = ref<ViewingRecordOut | null>(null)
const selectedHouse = ref<HouseOut | null>(null)
const viewingId = ref(0)
const inquiryId = ref(0)
const inquiryContactId = ref<number | null>(null)
const requestId = createRentalRequestId()
const signedDate = ref(formatOrganizationLocalDate(new Date()))
const loading = ref(false)
const loadError = ref('')
const submitting = ref(false)
const houseId = ref('')
const customerName = ref('')
const customerPhone = ref('')
const defaultStartDate = new Date()
const defaultEndDate = new Date(defaultStartDate)
defaultEndDate.setDate(defaultEndDate.getDate() + 365)
const startDate = ref(formatOrganizationLocalDate(defaultStartDate))
const endDate = ref(formatOrganizationLocalDate(defaultEndDate))
const monthlyRent = ref('')
const deposit = ref('')
const paymentDay = ref('1')
const notes = ref('')
const notesExpanded = ref(false)
const contractFiles = ref<Record<string, unknown>[]>([])
const uploadingContract = ref(false)
const allowed = computed(() => (allocationCapabilities.value as (AllocationCapabilitiesOut & { register_signing?: boolean }) | null)?.register_signing === true)
const previewHouse = computed(() => selectedHouse.value || sourceViewing.value?.house || null)
const housePickerVisible = ref(false)
const contactPickerVisible = ref(false)
const houseKeyword = ref('')
const contactKeyword = ref('')
const houses = ref<HouseOut[]>([])
const contacts = ref<ContactOut[]>([])
const selectedContact = ref<ContactOut | null>(null)
const teams = ref<Array<{ id: number, name: string }>>([])
const teamId = ref<number>()
const teamSelection = ref<number[]>([])
const teamPickerVisible = ref(false)
const teamOptions = computed(() => teams.value.map(team => ({ label: team.name, value: team.id })))
const selectedTeamLabel = computed(() => teams.value.find(team => team.id === teamId.value)?.name || (teams.value.length ? '请选择归属团队' : '整个工作空间'))
const housePickerLoading = ref(false)
const contactPickerLoading = ref(false)
const housePickerError = ref('')
const contactPickerError = ref('')
const datePickerVisible = ref(false)
const dateField = ref<'start' | 'end' | 'sign'>('start')
const datePickerValue = ref(defaultStartDate.getTime())

function confirmTeam({ value }: { value: Array<string | number> }) {
  teamId.value = Number(value[0]) || undefined
}

async function loadHouses() {
  housePickerLoading.value = true
  housePickerError.value = ''
  try {
    const result = await listOrganizationHouses(appContextStore.organizationSlug, 1, 100, { keyword: houseKeyword.value.trim() || undefined, is_active: true })
    houses.value = result.items
  }
  catch (error) { housePickerError.value = error instanceof Error ? error.message : '房源加载失败' }
  finally { housePickerLoading.value = false }
}

async function loadContacts() {
  contactPickerLoading.value = true
  contactPickerError.value = ''
  try {
    const result = await listOrganizationContacts(appContextStore.organizationSlug, 1, 100, { role: 'tenant', task: 'active', keyword: contactKeyword.value.trim() || undefined })
    contacts.value = result.items
  }
  catch (error) { contactPickerError.value = error instanceof Error ? error.message : '联系人加载失败' }
  finally { contactPickerLoading.value = false }
}

function openHousePicker() {
  if (sourceViewing.value || inquiryId.value)
    return
  housePickerVisible.value = true
  void loadHouses()
}

function selectHouse(house: HouseOut) {
  if (!house.is_active)
    return
  selectedHouse.value = house
  houseId.value = String(house.id)
  monthlyRent.value = house.asking_rent || ''
  deposit.value = house.deposit_amount || ''
  housePickerVisible.value = false
}

function openContactPicker() {
  if (sourceViewing.value || inquiryId.value)
    return
  contactPickerVisible.value = true
  void loadContacts()
}

function selectContact(contact: ContactOut | null) {
  selectedContact.value = contact
  if (contact) {
    customerName.value = contact.name
    customerPhone.value = contact.phone
  }
  contactPickerVisible.value = false
}

function openDatePicker(field: 'start' | 'end' | 'sign') {
  dateField.value = field
  datePickerValue.value = new Date(`${field === 'sign' ? signedDate.value : field === 'start' ? startDate.value : endDate.value}T00:00:00`).getTime()
  datePickerVisible.value = true
}

function confirmDate({ value }: { value: string | number | Array<string | number> }) {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp))
    return
  const formatted = formatOrganizationLocalDate(new Date(timestamp))
  if (dateField.value === 'sign')
    signedDate.value = formatted
  else if (dateField.value === 'start')
    startDate.value = formatted
  else
    endDate.value = formatted
}

function applyViewing(viewing: ViewingRecordOut) {
  if (viewing.status !== 'converted')
    throw new Error('只有已成交带看可以登记签约')
  sourceViewing.value = viewing
  houseId.value = String(viewing.house_id)
  customerName.value = viewing.customer_name
  customerPhone.value = viewing.customer_phone
}

async function loadSigningContext() {
  loading.value = true
  loadError.value = ''
  try {
    const [capabilities, viewing, inquiry] = await Promise.all([
      getAllocationCapabilities(appContextStore.organizationSlug),
      viewingId.value ? getOrganizationViewing(appContextStore.organizationSlug, viewingId.value) : Promise.resolve(null),
      inquiryId.value ? getOrganizationInquiry(appContextStore.organizationSlug, inquiryId.value) : Promise.resolve(null),
    ])
    allocationCapabilities.value = capabilities
    teams.value = capabilities.signing_teams
    teamId.value = teams.value.length === 1 ? teams.value[0].id : undefined
    teamSelection.value = teamId.value ? [teamId.value] : []
    if (inquiry) {
      inquiryContactId.value = inquiry.contact_id
      houseId.value = String(inquiry.house_id)
      customerName.value = inquiry.customer_name
      customerPhone.value = inquiry.phone
    }
    if (viewing)
      applyViewing(viewing)
    const resolvedHouseId = viewing?.house_id || Number(houseId.value)
    selectedHouse.value = resolvedHouseId
      ? await getOrganizationHouse(appContextStore.organizationSlug, resolvedHouseId)
      : null
    if (selectedHouse.value) {
      if (!selectedHouse.value.is_active)
        throw new Error('房源已停用，请恢复后再登记签约')
      monthlyRent.value = selectedHouse.value.asking_rent || ''
      deposit.value = selectedHouse.value.deposit_amount || ''
    }
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '成交带看加载失败' }
  finally { loading.value = false }
}

async function submit() {
  if (submitting.value || uploadingContract.value)
    return
  if (!allowed.value) {
    uni.showToast({ title: '当前账号没有登记签约权限', icon: 'none' })
    return
  }
  if (selectedHouse.value?.is_active === false) {
    uni.showToast({ title: '房源已停用，请恢复后再登记签约', icon: 'none' })
    return
  }
  const beneficiaryUserId = appContextStore.user?.id
  if (teams.value.length > 1 && !teamId.value) {
    uni.showToast({ title: '请选择本次签约的归属团队', icon: 'none' })
    return
  }
  if (!beneficiaryUserId || !Number(houseId.value) || !customerName.value.trim() || !customerPhone.value.trim() || !startDate.value || !endDate.value || !Number(monthlyRent.value)) {
    uni.showToast({ title: '请完整填写房源、租客、租期和月租金', icon: 'none' })
    return
  }
  if (endDate.value <= startDate.value || !Number.isInteger(Number(paymentDay.value)) || Number(paymentDay.value) < 1 || Number(paymentDay.value) > 31) {
    uni.showToast({ title: '结束日期需晚于开始日期，付款日需为1至31', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const result = await registerOrganizationSigning(appContextStore.organizationSlug, {
      lease: {
        house_id: Number(houseId.value),
        ...((inquiryContactId.value || sourceViewing.value?.contact_id || selectedContact.value?.id)
          ? { tenant_id: inquiryContactId.value || sourceViewing.value?.contact_id || selectedContact.value!.id }
          : { tenant_identity: { name: customerName.value.trim(), phone: customerPhone.value.trim() } }),
        source_inquiry_id: inquiryId.value || undefined,
        source_viewing_record_id: viewingId.value || undefined,
        sign_at: new Date(`${signedDate.value}T12:00:00+08:00`).toISOString(),
        start_date: startDate.value,
        end_date: endDate.value,
        monthly_rent: monthlyRent.value,
        deposit: deposit.value || undefined,
        payment_day: Number(paymentDay.value) || 1,
        notes: notes.value.trim(),
        contract_files: contractFiles.value.map(file => ({ media_id: Number(file.media_id), media_type: 'file' })),
      },
      client_request_id: requestId,
      team_id: teamId.value,
    })
    uni.showToast({ title: '签约登记成功', icon: 'success' })
    setTimeout(() => uni.redirectTo({ url: getOrganizationLeaseDetailRoute(result.id) }), 500)
  }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '签约登记失败', icon: 'none' }) }
  finally { submitting.value = false }
}

onLoad((options) => {
  viewingId.value = Number(options?.viewingId || 0)
  inquiryId.value = Number(options?.inquiry_id || 0)
  houseId.value = String(Number(options?.houseId || 0) || '')
  void loadSigningContext()
})
</script>

<template>
  <view class="signing-page min-h-screen bg-surface-page px-3 pb-7 pt-0">
    <AppCustomNavigation title="登记签约" back scroll-mode="sticky" />
    <AppLoading v-if="loading" text="正在核验签约权限…" />
    <AppErrorView v-else-if="loadError" title="签约信息不可用" :message="loadError" @retry="loadSigningContext" />
    <AppErrorView v-else-if="!allowed" title="无登记权限" message="当前账号没有登记成交的权限，请联系空间管理员" :retryable="false" />
    <view v-else class="signing-content">
      <RentalPageHeading title="登记签约" description="录入成交信息，建立房源租约档案" />
      <view class="signing-flow mb-3 flex items-center justify-between gap-1 rounded-2.5 bg-surface-brand-soft px-2.5 py-3 text-size-2xs text-app-brand-active">
        <text>01 房源与租客</text><view class="i-carbon-chevron-right" /><text>02 租期与费用</text><view class="i-carbon-chevron-right" /><text>03 合同与归属</text>
      </view>
      <view v-if="previewHouse" class="source-card px-3 pb-0 pt-2.5">
        <view class="source-label text-size-2xs text-content-muted">
          {{ sourceViewing ? '来源带看房源' : '签约房源' }}
        </view>
        <HouseCard class="source-house" :house="previewHouse" variant="compact" />
        <view v-if="sourceViewing" class="source-customer mt-1 text-size-2xs text-content-muted">
          {{ sourceViewing.customer_name }} · {{ sourceViewing.customer_phone }}
        </view>
      </view>
      <wd-cell-group title="01 · 房源与租客" border>
        <wd-cell title="签约房源" :value="previewHouse ? `${previewHouse.building.name} ${previewHouse.room_number}` : '请选择房源'" :is-link="!sourceViewing && !inquiryId" @click="openHousePicker" />
        <wd-cell v-if="!sourceViewing && !inquiryId" title="租客联系人" :value="selectedContact?.name || '选择租客（可选）'" is-link @click="openContactPicker" />
        <wd-cell title="租客姓名" center>
          <wd-input v-model="customerName" placeholder="请输入租客姓名" clearable compact align-right />
        </wd-cell>
        <wd-cell title="租客手机号" center>
          <wd-input v-model="customerPhone" type="tel" placeholder="请输入租客手机号" clearable compact align-right />
        </wd-cell>
      </wd-cell-group>
      <wd-cell-group title="02 · 租期与费用" border>
        <wd-cell title="实际签约日期" :value="signedDate" is-link @click="openDatePicker('sign')" />
        <wd-cell title="开始日期" :value="startDate" is-link @click="openDatePicker('start')" />
        <wd-cell title="结束日期" :value="endDate" is-link @click="openDatePicker('end')" />
        <wd-cell title="月租金（元/月）" center>
          <wd-input v-model="monthlyRent" type="digit" placeholder="请输入月租金" clearable compact align-right />
        </wd-cell>
        <wd-cell title="押金（元）" center>
          <wd-input v-model="deposit" type="digit" placeholder="可不填" clearable compact align-right />
        </wd-cell>
        <wd-cell title="每月付款日" center>
          <wd-input v-model="paymentDay" type="number" placeholder="1-31" clearable compact align-right />
        </wd-cell>
      </wd-cell-group>
      <wd-cell-group title="03 · 归属团队" border>
        <wd-cell title="签约团队" :value="selectedTeamLabel" :is-link="teams.length > 1" @click="teams.length > 1 && (teamPickerVisible = true)" />
      </wd-cell-group>
      <wd-cell-group title="合同与附加说明（选填）" border>
        <LeaseContractEditor v-model:files="contractFiles" :disabled="submitting" :organization-slug="appContextStore.organizationSlug" @uploading="uploadingContract = $event" />
        <wd-cell title="补充备注（选填）" :value="notesExpanded || notes ? '' : '展开'" :is-link="!notesExpanded && !notes" arrow-direction="down" @click="notesExpanded = true" />
        <view v-if="notesExpanded || notes" class="notes-editor px-3 pb-2 pt-0">
          <wd-textarea v-model="notes" placeholder="补充租约说明" :maxlength="1000" auto-height compact />
        </view>
      </wd-cell-group>
      <view class="submit-row px-0 pb-3 pt-0">
        <AppNotice title="登记真实成交" description="登记后更新房态，收益可在租约详情中另行申请。" compact />
        <wd-button block :loading="submitting" :disabled="uploadingContract" @click="submit">
          确认登记签约
        </wd-button>
      </view>
    </view>
    <AppEntityPickerSheet v-model:visible="housePickerVisible" v-model:keyword="houseKeyword" title="选择签约房源" search-placeholder="搜索房号、小区或楼栋" :items="houses" item-key="id" :selected="houseId ? [Number(houseId)] : []" :loading="housePickerLoading" :error="housePickerError" @search="loadHouses" @select="selectHouse">
      <template #item="{ item, selected }">
        <HouseCard :house="item" variant="compact" selectable :selected="selected" />
      </template>
    </AppEntityPickerSheet>
    <AppEntityPickerSheet v-model:visible="contactPickerVisible" v-model:keyword="contactKeyword" title="选择租客联系人" search-placeholder="搜索姓名或手机号" :items="contacts" item-key="id" :selected="selectedContact ? [selectedContact.id] : []" :loading="contactPickerLoading" :error="contactPickerError" @search="loadContacts" @select="selectContact">
      <template #before-list>
        <view class="py-3" @click="selectContact(null)">
          <AppEntityPickerOption title="手动填写" description="不选择已有联系人" :selected="!selectedContact" />
        </view>
      </template>
      <template #item="{ item, selected }">
        <AppEntityPickerOption :title="item.name" :description="item.phone" :selected="selected" />
      </template>
    </AppEntityPickerSheet>
    <wd-datetime-picker v-model="datePickerValue" v-model:visible="datePickerVisible" type="date" :title="dateField === 'sign' ? '选择实际签约日期' : dateField === 'start' ? '选择开始日期' : '选择结束日期'" @confirm="confirmDate" />
    <wd-picker v-model="teamSelection" v-model:visible="teamPickerVisible" title="选择签约归属团队" :columns="teamOptions" @confirm="confirmTeam" />
  </view>
</template>

<style scoped lang="scss">
.signing-page :deep(.app-custom-navigation) {
  @apply mt-0 -mx-3 mb-3;
}
.signing-content {
  --wot-cell-group-title-color: var(--app-text-primary);
  --wot-cell-group-title-fs: 28rpx;
}
.signing-content :deep(.wd-cell-group) {
  @apply overflow-hidden mb-3 rounded-3;
}
.source-house {
  @apply mt-1;
}
.notes-editor {
  --wot-textarea-inner-min-height: 80px;
}
</style>
