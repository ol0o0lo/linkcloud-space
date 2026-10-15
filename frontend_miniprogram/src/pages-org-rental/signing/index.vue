<script setup lang="ts">
import LeaseContractEditor from '@/pages-org-rental/components/LeaseContractEditor.vue'
import type { AllocationCapabilitiesOut, ContactOut, HouseOut, ViewingRecordOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatOrganizationLocalDate } from '@/pages-org-rental/domain/organization-rental'
import { getAllocationCapabilities, getOrganizationHouse, getOrganizationViewing, listOrganizationContacts, listOrganizationHouses, registerOrganizationDeal } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationLeaseDetailRoute } from '@/modules/routes'
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
const contractFiles = ref<Record<string, unknown>[]>([])
const uploadingContract = ref(false)
const allowed = computed(() => allocationCapabilities.value?.submit === true)
const previewHouse = computed(() => selectedHouse.value || sourceViewing.value?.house || null)
const housePickerVisible = ref(false)
const contactPickerVisible = ref(false)
const houseKeyword = ref('')
const contactKeyword = ref('')
const houses = ref<HouseOut[]>([])
const contacts = ref<ContactOut[]>([])
const selectedContact = ref<ContactOut | null>(null)
const housePickerLoading = ref(false)
const contactPickerLoading = ref(false)
const housePickerError = ref('')
const contactPickerError = ref('')
const datePickerVisible = ref(false)
const dateField = ref<'start' | 'end'>('start')
const datePickerValue = ref(defaultStartDate.getTime())

async function loadHouses() {
  housePickerLoading.value = true
  housePickerError.value = ''
  try {
    const result = await listOrganizationHouses(appContextStore.organizationSlug, 1, 100, { keyword: houseKeyword.value.trim() || undefined })
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
  if (sourceViewing.value)
    return
  housePickerVisible.value = true
  void loadHouses()
}

function selectHouse(house: HouseOut) {
  selectedHouse.value = house
  houseId.value = String(house.id)
  monthlyRent.value = house.asking_rent || ''
  deposit.value = house.deposit_amount || ''
  housePickerVisible.value = false
}

function openContactPicker() {
  if (sourceViewing.value)
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

function openDatePicker(field: 'start' | 'end') {
  dateField.value = field
  datePickerValue.value = new Date(`${field === 'start' ? startDate.value : endDate.value}T00:00:00`).getTime()
  datePickerVisible.value = true
}

function confirmDate({ value }: { value: string | number | Array<string | number> }) {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp))
    return
  const formatted = formatOrganizationLocalDate(new Date(timestamp))
  if (dateField.value === 'start')
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
    const [capabilities, viewing] = await Promise.all([
      getAllocationCapabilities(appContextStore.organizationSlug),
      viewingId.value ? getOrganizationViewing(appContextStore.organizationSlug, viewingId.value) : Promise.resolve(null),
    ])
    allocationCapabilities.value = capabilities
    if (viewing)
      applyViewing(viewing)
    const resolvedHouseId = viewing?.house_id || Number(houseId.value)
    selectedHouse.value = resolvedHouseId
      ? await getOrganizationHouse(appContextStore.organizationSlug, resolvedHouseId)
      : null
    if (selectedHouse.value) {
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
    uni.showToast({ title: '当前账号没有签约提交权限', icon: 'none' })
    return
  }
  const beneficiaryUserId = appContextStore.user?.id
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
    const result = await registerOrganizationDeal(appContextStore.organizationSlug, {
      lease: {
        house_id: Number(houseId.value),
        tenant_identity: { name: customerName.value.trim(), phone: customerPhone.value.trim() },
        source_viewing_record_id: viewingId.value || undefined,
        sign_at: new Date().toISOString(),
        start_date: startDate.value,
        end_date: endDate.value,
        monthly_rent: monthlyRent.value,
        deposit: deposit.value || undefined,
        payment_day: Number(paymentDay.value) || 1,
        notes: notes.value.trim(),
        contract_files: contractFiles.value.map(file => ({ media_id: Number(file.media_id), media_type: 'file' })),
      },
      beneficiary_user_ids: [beneficiaryUserId],
    })
    uni.showToast({ title: '签约登记成功', icon: 'success' })
    setTimeout(() => uni.redirectTo({ url: getOrganizationLeaseDetailRoute(result.lease.id) }), 500)
  }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '签约登记失败', icon: 'none' }) }
  finally { submitting.value = false }
}

onLoad((options) => {
  viewingId.value = Number(options?.viewingId || 0)
  houseId.value = String(Number(options?.houseId || 0) || '')
  void loadSigningContext()
})
</script>

<template>
  <view class="signing-page">
    <AppCustomNavigation title="登记签约" back scroll-mode="sticky" />
    <AppLoading v-if="loading" text="正在核验签约权限…" />
    <AppErrorView v-else-if="loadError" title="签约信息不可用" :message="loadError" @retry="loadSigningContext" />
    <AppErrorView v-else-if="!allowed" title="无登记权限" message="当前账号可以查看收益模块，但没有提交签约收益申请的权限" :retryable="false" />
    <view v-else class="form-card">
      <view v-if="previewHouse" class="source-card">
        <view class="source-label">
          {{ sourceViewing ? '来源带看房源' : '签约房源' }}
        </view>
        <HouseCard class="source-house" :house="previewHouse" variant="compact" />
        <view v-if="sourceViewing" class="source-customer">
          {{ sourceViewing.customer_name }} · {{ sourceViewing.customer_phone }}
        </view>
      </view>
      <wd-cell title="签约房源" :value="previewHouse ? `${previewHouse.building.name} ${previewHouse.room_number}` : '请选择房源'" :is-link="!sourceViewing" @click="openHousePicker" />
      <wd-cell v-if="!sourceViewing" title="租客联系人" :value="selectedContact?.name || '选择租客（可选）'" is-link @click="openContactPicker" />
      <wd-cell title="租客姓名" center>
        <wd-input v-model="customerName" placeholder="请输入租客姓名" clearable compact align-right />
      </wd-cell>
      <wd-cell title="租客手机号" center>
        <wd-input v-model="customerPhone" type="tel" placeholder="请输入租客手机号" clearable compact align-right />
      </wd-cell>
      <wd-cell title="开始日期" :value="startDate" is-link @click="openDatePicker('start')" />
      <wd-cell title="结束日期" :value="endDate" is-link @click="openDatePicker('end')" />
      <wd-cell title="月租金" center>
        <wd-input v-model="monthlyRent" type="digit" placeholder="请输入月租金" clearable compact align-right />
      </wd-cell>
      <wd-cell title="押金" center>
        <wd-input v-model="deposit" type="digit" placeholder="可不填" clearable compact align-right />
      </wd-cell>
      <wd-cell title="付款日" center>
        <wd-input v-model="paymentDay" type="number" placeholder="1-31" clearable compact align-right />
      </wd-cell>
      <LeaseContractEditor v-model:files="contractFiles" :disabled="submitting" :organization-slug="appContextStore.organizationSlug" @uploading="uploadingContract = $event" />
      <wd-cell title="备注" layout="vertical">
        <wd-textarea v-model="notes" placeholder="补充成交说明" :maxlength="1000" />
      </wd-cell>
      <view class="submit-row">
        <AppNotice title="签约与收益分配" description="提交后会创建租约，并以本人作为受益人提交收益分配申请，等待审核。" compact />
        <wd-button block :loading="submitting" :disabled="uploadingContract" @click="submit">
          登记签约并提交收益分配
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
    <wd-datetime-picker v-model="datePickerValue" v-model:visible="datePickerVisible" type="date" :title="dateField === 'start' ? '选择开始日期' : '选择结束日期'" @confirm="confirmDate" />
  </view>
</template>

<style scoped lang="scss">
.signing-page {
  min-height: 100vh;
  padding: 0 24rpx 56rpx;
  background: var(--app-bg-page);
}
.signing-page :deep(.app-custom-navigation) {
  margin: 0 -24rpx 24rpx;
}
.form-card {
  overflow: hidden;
  padding: 12rpx 24rpx 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.source-card {
  margin: 12rpx 0 20rpx;
  padding: 20rpx;
  border-radius: 18rpx;
  background: var(--app-bg-subtle);
}
.source-label,
.source-customer {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.source-house {
  margin-top: 14rpx;
}
.source-customer {
  margin-top: 8rpx;
}
.submit-row {
  margin-top: 28rpx;
}
</style>
