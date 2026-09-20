<script setup lang="ts">
import type { OrganizationViewingCreateInput } from '@/pages-org-rental/domain/organization-rental'
import type { ContactOut, HouseOut, WorkspaceMemberOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref } from 'vue'
import { buildOrganizationViewingCreatePayload, formatOrganizationDateTime } from '@/pages-org-rental/domain/organization-rental'
import {
  createOrganizationViewing,
  listOrganizationContacts,
  listOrganizationHouses,
  listOrganizationViewingAssignees,
} from '@/pages-org-rental/api/organization-rental'
import { getOrganizationViewingDetailRoute } from '@/modules/routes'
import AppEntityPickerOption from '@/components/app/AppEntityPickerOption.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import AppEntityPickerSheet from '@/pages-org-rental/components/AppEntityPickerSheet.vue'
import AppFormPage from '@/pages-org-rental/components/AppFormPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '新建带看' } })

function getNextWholeHour(): number {
  const value = new Date()
  value.setMinutes(0, 0, 0)
  value.setHours(value.getHours() + 1)
  return value.getTime()
}

function memberLabel(member: WorkspaceMemberOut): string {
  const fullName = [member.user.first_name, member.user.last_name].filter(Boolean).join('')
  return member.employee_name || fullName || member.user.username
}

function assigneeItemKey(member: WorkspaceMemberOut): number {
  return member.user.id
}

const toast = useToast()
const appContextStore = useAppContextStore()
const loading = ref(true)
const saving = ref(false)
const houseVisible = ref(false)
const contactVisible = ref(false)
const assigneeVisible = ref(false)
const scheduleVisible = ref(false)
const houseLoading = ref(false)
const contactLoading = ref(false)
const assigneeLoading = ref(false)
const houseKeyword = ref('')
const contactKeyword = ref('')
const assigneeKeyword = ref('')
const houses = ref<HouseOut[]>([])
const contacts = ref<ContactOut[]>([])
const assignees = ref<WorkspaceMemberOut[]>([])

const form = reactive<OrganizationViewingCreateInput>({
  house_id: 0,
  contact_id: null,
  customer_name: '',
  customer_phone: '',
  scheduled_at: getNextWholeHour(),
  assigned_to_id: null,
  notes: '',
})

const selectedHouse = computed(() => houses.value.find(item => item.id === form.house_id))
const selectedContact = computed(() => contacts.value.find(item => item.id === form.contact_id))
const selectedAssignee = computed(() => assignees.value.find(item => item.user.id === form.assigned_to_id))
const contactLabel = computed(() => selectedContact.value ? `${selectedContact.value.name} · ${selectedContact.value.phone}` : '不关联租客联系人')
const assigneeLabel = computed(() => selectedAssignee.value ? memberLabel(selectedAssignee.value) : '暂不指定')
const scheduleLabel = computed(() => formatOrganizationDateTime(new Date(form.scheduled_at).toISOString()))

async function loadHouses() {
  houseLoading.value = true
  try {
    const result = await listOrganizationHouses(appContextStore.organizationSlug, 1, 100, { keyword: houseKeyword.value.trim() || undefined })
    houses.value = result.items
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '房源加载失败')
  }
  finally {
    houseLoading.value = false
  }
}

async function loadContacts() {
  contactLoading.value = true
  try {
    const result = await listOrganizationContacts(appContextStore.organizationSlug, 1, 100, { role: 'tenant', task: 'active', keyword: contactKeyword.value.trim() || undefined })
    contacts.value = result.items
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '租客联系人加载失败')
  }
  finally {
    contactLoading.value = false
  }
}

async function loadAssignees() {
  assigneeLoading.value = true
  try {
    const result = await listOrganizationViewingAssignees(appContextStore.organizationSlug, 1, 100, { keyword: assigneeKeyword.value.trim() || undefined })
    assignees.value = result.items
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '负责人加载失败')
  }
  finally {
    assigneeLoading.value = false
  }
}

function selectHouse(item: HouseOut) {
  form.house_id = item.id
  houseVisible.value = false
}

function selectContact(item: ContactOut | null) {
  form.contact_id = item?.id || null
  if (item) {
    form.customer_name = item.name
    form.customer_phone = item.phone
  }
  contactVisible.value = false
}

function selectAssignee(item: WorkspaceMemberOut | null) {
  form.assigned_to_id = item?.user.id || null
  assigneeVisible.value = false
}

async function submit() {
  if (saving.value)
    return
  if (!form.house_id || !form.customer_name.trim() || !form.customer_phone.trim()) {
    toast.warning('请完整填写房源、客户姓名和手机号')
    return
  }
  const scheduledAt = new Date(form.scheduled_at).getTime()
  if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
    toast.warning('预约时间必须晚于当前时间')
    return
  }

  saving.value = true
  try {
    const created = await createOrganizationViewing(appContextStore.organizationSlug, buildOrganizationViewingCreatePayload(form))
    toast.success('带看已创建')
    setTimeout(() => uni.redirectTo({ url: getOrganizationViewingDetailRoute(created.id) }), 350)
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '带看创建失败')
  }
  finally {
    saving.value = false
  }
}

onLoad((options) => {
  form.house_id = Number(options?.houseId || 0)
  void Promise.all([loadHouses(), loadContacts(), loadAssignees()]).finally(() => {
    loading.value = false
  })
})
</script>

<template>
  <AppFormPage
    :loading="loading"
    loading-text="正在加载带看资料…"
    :submitting="saving"
    :submit-disabled="saving"
    submit-text="创建带看"
    @submit="submit"
  >
    <template #navigation>
      <AppCustomNavigation title="新建带看" back scroll-mode="sticky" />
    </template>
    <template #feedback>
      <wd-toast />
    </template>

    <wd-cell-group title="预约信息" insert>
      <HouseCard v-if="selectedHouse" class="mx-3 mb-2.5" :house="selectedHouse" variant="compact" action-text="更换" @click="houseVisible = true" @action="houseVisible = true" />
      <wd-cell v-else title="房源" value="请选择房源" is-link @click="houseVisible = true" />
      <wd-cell title="预约时间" :value="scheduleLabel" is-link @click="scheduleVisible = true" />
      <wd-cell title="负责人" :value="assigneeLabel" is-link @click="assigneeVisible = true" />
    </wd-cell-group>

    <wd-cell-group title="客户信息" insert>
      <wd-cell title="租客联系人" :value="contactLabel" is-link @click="contactVisible = true" />
      <wd-input v-model="form.customer_name" label="客户姓名" placeholder="请输入客户姓名" clearable />
      <wd-input v-model="form.customer_phone" label="手机号" type="number" placeholder="请输入手机号" clearable />
      <wd-cell title="备注" layout="vertical">
        <wd-textarea v-model="form.notes" placeholder="补充会面地点或沟通事项" :maxlength="3000" show-word-limit />
      </wd-cell>
    </wd-cell-group>

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
        v-model:visible="contactVisible"
        v-model:keyword="contactKeyword"
        title="选择租客联系人"
        search-placeholder="搜索姓名或手机号"
        :items="contacts"
        item-key="id"
        :selected="form.contact_id ? [form.contact_id] : []"
        :loading="contactLoading"
        empty-text="未找到有效租客联系人"
        @search="loadContacts"
        @select="selectContact"
      >
        <template #before-list>
          <view class="app-touchable border-0 border-b border-app-divider border-solid py-2.5" @click="selectContact(null)">
            <AppEntityPickerOption title="不关联联系人" description="手动填写客户资料" :selected="form.contact_id == null" />
          </view>
        </template>
        <template #item="{ item, selected }">
          <AppEntityPickerOption :title="item.name" :description="item.phone" :selected="selected" />
        </template>
      </AppEntityPickerSheet>

      <AppEntityPickerSheet
        v-model:visible="assigneeVisible"
        v-model:keyword="assigneeKeyword"
        title="选择负责人"
        search-placeholder="搜索员工姓名或账号"
        :items="assignees"
        :item-key="assigneeItemKey"
        :selected="form.assigned_to_id ? [form.assigned_to_id] : []"
        :loading="assigneeLoading"
        empty-text="未找到组织成员"
        @search="loadAssignees"
        @select="selectAssignee"
      >
        <template #before-list>
          <view class="app-touchable border-0 border-b border-app-divider border-solid py-2.5" @click="selectAssignee(null)">
            <AppEntityPickerOption title="暂不指定" description="创建后再分配" :selected="form.assigned_to_id == null" />
          </view>
        </template>
        <template #item="{ item, selected }">
          <AppEntityPickerOption :title="memberLabel(item)" :description="item.job_title || item.user.username" :selected="selected" />
        </template>
      </AppEntityPickerSheet>

      <wd-datetime-picker
        v-model="form.scheduled_at"
        v-model:visible="scheduleVisible"
        title="选择预约时间"
        :min-date="Date.now()"
        :max-date="new Date().setFullYear(new Date().getFullYear() + 1)"
      />
    </template>
  </AppFormPage>
</template>
