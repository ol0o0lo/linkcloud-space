<script setup lang="ts">
import type { ContactOut } from '@/pages-org-rental/api/organization-rental'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, reactive, ref } from 'vue'
import { buildOrganizationContactPayload, isUniActionCanceled } from '@/pages-org-rental/domain/organization-rental'
import { createOrganizationContact, inviteOrganizationLandlord, listOrganizationContacts, patchOrganizationContact } from '@/pages-org-rental/api/organization-rental'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import RentalPageHeading from '../components/RentalPageHeading.vue'
import RentalFilterTabs from '../components/RentalFilterTabs.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'
import { APP_ROUTES } from '@/modules/routes'
import { formatPhoneDisplay } from '@/domain/phone'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '联系人', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const toast = useToast()
const keyword = ref('')
const activeRole = ref<'all' | 'landlord' | 'tenant'>('all')
const hasFilters = computed(() => Boolean(keyword.value.trim() || activeRole.value !== 'all'))
const summaryCounts = reactive({ all: 0, landlord: 0, tenant: 0 })
const editorVisible = ref(false)
const editing = ref<ContactOut | null>(null)
const saving = ref(false)
const invitationUrl = ref('')
const contactForm = reactive({
  name: '',
  phone: '',
  email: '',
  roles: [] as string[],
  notes: '',
  is_active: true,
})

const contactPage = usePagedPage<ContactOut>({
  loader: async ({ page, pageSize }) => {
    const result = await listOrganizationContacts(appContextStore.organizationSlug, page, pageSize, {
      keyword: keyword.value.trim() || undefined,
      role: activeRole.value === 'all' ? undefined : activeRole.value,
    })
    if (page === 1) {
      const [all, landlord, tenant] = await Promise.all([
        listOrganizationContacts(appContextStore.organizationSlug, 1, 1),
        listOrganizationContacts(appContextStore.organizationSlug, 1, 1, { role: 'landlord' }),
        listOrganizationContacts(appContextStore.organizationSlug, 1, 1, { role: 'tenant' }),
      ])
      Object.assign(summaryCounts, {
        all: all.total,
        landlord: landlord.total,
        tenant: tenant.total,
      })
    }
    return result
  },
  pageSize: 15,
  keyOf: item => item.id,
})

function changeRole(role: 'all' | 'landlord' | 'tenant') {
  if (activeRole.value === role)
    return
  activeRole.value = role
  void contactPage.refresh()
}

function callPhone(phone: string) {
  uni.makePhoneCall({ phoneNumber: phone })
}

function openCustomers() {
  uni.navigateTo({ url: APP_ROUTES.organizationCustomers })
}

function displayPhone(phone: string) {
  return formatPhoneDisplay(phone).replace(/(\d{3})\d{4}(\d{4})$/, '$1****$2')
}

function openCreate() {
  editing.value = null
  Object.assign(contactForm, { name: '', phone: '', email: '', roles: [], notes: '', is_active: true })
  editorVisible.value = true
}

function openEdit(item: ContactOut) {
  editing.value = item
  Object.assign(contactForm, {
    name: item.name,
    phone: item.phone,
    email: item.email,
    roles: [...item.roles],
    notes: item.notes,
    is_active: item.is_active,
  })
  editorVisible.value = true
}

function handleEmptyAction() {
  if (!hasFilters.value) {
    openCreate()
    return
  }
  keyword.value = ''
  activeRole.value = 'all'
  void contactPage.refresh()
}

async function saveContact() {
  if (saving.value)
    return
  if (!contactForm.name.trim() || !contactForm.phone.trim() || !contactForm.roles.length) {
    toast.warning('请填写姓名、手机号并至少选择一个角色')
    return
  }
  saving.value = true
  try {
    const payload = buildOrganizationContactPayload(contactForm)
    if (editing.value)
      await patchOrganizationContact(appContextStore.organizationSlug, editing.value.id, payload)
    else
      await createOrganizationContact(appContextStore.organizationSlug, payload)
    toast.success(editing.value ? '联系人已更新' : '联系人已创建')
    editorVisible.value = false
    editing.value = null
    await contactPage.refresh()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '联系人保存失败') }
  finally { saving.value = false }
}

function canInviteLandlord(item: ContactOut) {
  return item.is_active && item.roles.includes('landlord') && item.landlord_binding_status !== 'bound'
}

async function inviteLandlord(item: ContactOut) {
  try {
    const selection = await uni.showActionSheet({ itemList: ['发送短信邀请', '生成邀请链接'] })
    const deliveryMethod = selection.tapIndex === 0 ? 'sms' : 'manual'
    const invitation = await inviteOrganizationLandlord(appContextStore.organizationSlug, item.id, deliveryMethod)
    if (deliveryMethod === 'manual' && invitation.action_url) {
      invitationUrl.value = invitation.action_url
      await uni.setClipboardData({ data: invitation.action_url })
      toast.success('邀请链接已复制')
    }
    else {
      toast.success('房东邀请短信已发送')
    }
    await contactPage.refresh()
  }
  catch (error) {
    if (!isUniActionCanceled(error))
      toast.error(error instanceof Error ? error.message : '房东邀请发送失败')
  }
}
</script>

<template>
  <AppPage class="rental-page" variant="list">
    <template #navigation>
      <AppCustomNavigation title="联系人" back scroll-mode="sticky" />
    </template>
    <wd-toast />
    <RentalPageHeading title="联系人" description="统一维护房东与租客的业务档案">
      <wd-button size="small" @click="openCreate">
        新增联系人
      </wd-button>
    </RentalPageHeading>
    <view class="rental-summary">
      <view class="rental-summary__item" role="button" @click="changeRole('all')">
        <strong>{{ contactPage.loaded.value ? summaryCounts.all : '—' }}</strong><text>全部联系人</text>
      </view>
      <view class="rental-summary__item" role="button" @click="changeRole('landlord')">
        <strong>{{ contactPage.loaded.value ? summaryCounts.landlord : '—' }}</strong><text>房东</text>
      </view>
      <view class="rental-summary__item" role="button" @click="changeRole('tenant')">
        <strong>{{ contactPage.loaded.value ? summaryCounts.tenant : '—' }}</strong><text>租客</text>
      </view>
    </view>
    <RentalFilterTabs :model-value="activeRole" :options="[{ value: 'all', label: '全部' }, { value: 'landlord', label: '房东' }, { value: 'tenant', label: '租客' }]" label="联系人角色" @change="changeRole($event as typeof activeRole)" />
    <view class="rental-search">
      <wd-search v-model="keyword" placeholder="搜索姓名或手机号" placeholder-left variant="filled" hide-cancel @search="contactPage.refresh" @clear="contactPage.refresh" />
    </view>
    <view class="rental-results">
      <strong>联系人档案</strong><text v-if="contactPage.loaded.value">{{ contactPage.total.value }} 人</text>
    </view>
    <view class="mt-2.5">
      <AppPagedList
        :items="contactPage.items.value"
        item-key="id"
        :loading="contactPage.loading.value"
        :refreshing="contactPage.refreshing.value"
        :loading-more="contactPage.loadingMore.value"
        :finished="contactPage.finished.value"
        :error="contactPage.error.value"
        loading-text="正在加载联系人…"
        :empty-text="hasFilters ? '没有符合条件的联系人' : '当前工作空间还没有联系人'"
        :empty-description="hasFilters ? '试试清空搜索内容或切换到全部角色。' : '先新增房东或租客联系人，再建立后续业务关系。'"
        empty-icon="no-result"
        :empty-action-text="hasFilters ? '清除筛选' : '新建联系人'"
        finished-text="没有更多联系人了"
        @retry="contactPage.refresh"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <AppRecordCard>
            <template #leading>
              <view class="contact-avatar h-8.5 w-8.5 flex flex-none basis-8.5 items-center justify-center rounded-2.5 bg-surface-brand-soft text-size-base text-app-brand-active">
                <view :class="item.roles.includes('landlord') ? 'i-carbon-home' : 'i-carbon-user'" />
              </view>
            </template>
            <template #title>
              {{ item.name }}
            </template>
            <template #status>
              <wd-tag :type="item.is_active ? 'success' : 'default'" variant="light" size="small">
                {{ item.is_active ? '正常' : '已停用' }}
              </wd-tag>
            </template>
            <view class="text-xs text-content-muted">
              {{ displayPhone(item.phone) }}
            </view>
            <view class="mt-2 flex flex-wrap gap-1.5">
              <wd-tag v-for="(role, index) in item.roles__mapping" :key="`${role}-${index}`" size="small" variant="light">
                {{ role }}
              </wd-tag>
            </view>
            <template #footer>
              <text class="text-xs text-content-muted">{{ item.landlord_binding_status === 'bound' ? '房东档案已关联' : item.notes || '暂无备注' }}</text>
            </template>
            <template #actions>
              <wd-button v-if="canInviteLandlord(item)" size="mini" variant="soft" @click.stop="inviteLandlord(item)">
                邀请房东
              </wd-button>
              <wd-button size="mini" variant="plain" @click.stop="openEdit(item)">
                编辑
              </wd-button>
              <wd-button size="mini" variant="plain" @click.stop="callPhone(item.phone)">
                拨打
              </wd-button>
            </template>
          </AppRecordCard>
        </template>
      </AppPagedList>
    </view>

    <view class="rental-note" role="button" @click="openCustomers">
      <view class="i-carbon-user-follow" /><text class="flex-1">跟进租客需求与咨询</text><view class="i-carbon-chevron-right" />
    </view>
    <AppBottomSheet v-model:visible="editorVisible" :title="editing ? '编辑联系人' : '新建联系人'" height="tall">
      <view class="flex flex-col gap-1.5">
        <wd-cell title="姓名" center>
          <wd-input v-model="contactForm.name" placeholder="请输入姓名" clearable compact align-right />
        </wd-cell>
        <wd-cell title="手机号" center>
          <wd-input v-model="contactForm.phone" type="tel" placeholder="请输入手机号" clearable compact align-right />
        </wd-cell>
        <wd-cell title="邮箱" center>
          <wd-input v-model="contactForm.email" placeholder="可不填" clearable compact align-right />
        </wd-cell>
        <view class="border-b border-app-divider border-b-solid py-3">
          <view class="mb-2 text-xs text-content-secondary">
            联系人角色
          </view>
          <wd-checkbox-group v-model="contactForm.roles" type="square">
            <wd-checkbox name="landlord">
              房东
            </wd-checkbox>
            <wd-checkbox name="tenant">
              租客
            </wd-checkbox>
          </wd-checkbox-group>
        </view>
        <wd-cell title="备注" layout="vertical">
          <wd-textarea v-model="contactForm.notes" placeholder="补充联系人说明" :maxlength="1000" show-word-limit />
        </wd-cell>
        <view class="mb-3 app-row-between border-b border-app-divider border-b-solid py-3">
          <view><strong class="block text-sm text-content-primary">可用于新业务</strong><text class="mt-1 block text-2xs text-content-muted">关闭后不能用于新建房源或带看</text></view>
          <wd-switch v-model="contactForm.is_active" />
        </view>
      </view>
      <template #footer>
        <wd-button block size="large" :loading="saving" :disabled="saving" @click="saveContact">
          保存联系人
        </wd-button>
      </template>
    </AppBottomSheet>

    <AppBottomSheet
      :visible="Boolean(invitationUrl)"
      title="房东邀请链接"
      description="链接已复制，可通过微信转发给对应房东。房东登录后需验证与档案一致的手机号，再接受邀请并关联档案。"
      height="compact"
      @update:visible="!$event && (invitationUrl = '')"
    >
      <wd-textarea :model-value="invitationUrl" readonly auto-height />
      <template #footer>
        <wd-button block @click="invitationUrl = ''">
          完成
        </wd-button>
      </template>
    </AppBottomSheet>
  </AppPage>
</template>

<style scoped lang="scss">
@use '../components/management';
</style>
