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
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '联系人', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const toast = useToast()
const keyword = ref('')
const activeRole = ref<'all' | 'landlord' | 'tenant'>('all')
const hasFilters = computed(() => Boolean(keyword.value.trim() || activeRole.value !== 'all'))
const summaryCounts = reactive({ all: 0, landlord: 0, tenant: 0, bound: 0, invited: 0 })
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
        listOrganizationContacts(appContextStore.organizationSlug, 1, 500),
        listOrganizationContacts(appContextStore.organizationSlug, 1, 1, { role: 'landlord' }),
        listOrganizationContacts(appContextStore.organizationSlug, 1, 1, { role: 'tenant' }),
      ])
      Object.assign(summaryCounts, {
        all: all.total,
        landlord: landlord.total,
        tenant: tenant.total,
        bound: all.items.filter(item => item.user_id !== null || item.landlord_binding_status === 'bound').length,
        invited: all.items.filter(item => item.landlord_binding_status === 'invited').length,
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

function displayPhone(phone: string) {
  return phone.replace(/^\+86/, '').replace(/(\d{3})\d{4}(\d{4})$/, '$1****$2')
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
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="联系人" back scroll-mode="sticky">
        <template #action>
          <button class="navigation-action" @click="openCreate">
            新建
          </button>
        </template>
      </AppCustomNavigation>
    </template>
    <wd-toast />
    <view class="role-tabs">
      <view v-for="role in ([['all', '全部'], ['landlord', '房东'], ['tenant', '租客']] as const)" :key="role[0]" :class="{ active: activeRole === role[0] }" @click="changeRole(role[0])">
        {{ role[1] }}
      </view>
    </view>
    <view class="contact-summary">
      <view
        v-for="item in [
          { label: '全部联系人', value: summaryCounts.all },
          { label: '房东', value: summaryCounts.landlord },
          { label: '租客', value: summaryCounts.tenant },
          { label: '已绑定账号', value: summaryCounts.bound },
          { label: '待处理邀请', value: summaryCounts.invited },
        ]" :key="item.label"
      >
        <text>{{ item.label }}</text><view><view class="progress-fill" :style="{ width: `${summaryCounts.all ? Math.max(item.value ? 8 : 0, item.value / summaryCounts.all * 100) : 0}%` }" /></view><strong>{{ item.value }} 人</strong>
      </view>
    </view>
    <wd-search v-model="keyword" placeholder="搜索姓名或手机号" hide-cancel @search="contactPage.refresh" @clear="contactPage.refresh" />
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
        :empty-text="hasFilters ? '没有符合条件的联系人' : '当前组织还没有联系人'"
        :empty-description="hasFilters ? '试试清空搜索内容或切换到全部角色。' : '先新增房东或租客联系人，再建立后续业务关系。'"
        empty-icon="no-result"
        :empty-action-text="hasFilters ? '清除筛选' : '新建联系人'"
        finished-text="没有更多联系人了"
        @retry="contactPage.refresh"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <AppRecordCard>
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
              <text class="text-xs text-content-muted">{{ item.landlord_binding_status === 'bound' ? '已绑定房东账号' : item.notes || '暂无备注' }}</text>
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

    <AppBottomSheet v-model:visible="editorVisible" :title="editing ? '编辑联系人' : '新建联系人'" height="tall">
      <view class="flex flex-col gap-1.5">
        <wd-input v-model="contactForm.name" label="姓名" placeholder="请输入姓名" clearable />
        <wd-input v-model="contactForm.phone" label="手机号" type="tel" placeholder="请输入手机号" clearable />
        <wd-input v-model="contactForm.email" label="邮箱" placeholder="可不填" clearable />
        <view class="border-b border-app-divider border-solid py-3">
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
        <view class="mb-3 app-row-between border-b border-app-divider border-solid py-3">
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
      description="链接已复制，可通过微信转发给对应房东。房东登录后需使用与联系人一致的已验证手机号认领。"
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
.navigation-action {
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--app-color-brand);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 56rpx;
  background: transparent;
}
.navigation-action::after {
  border: 0;
}
.role-tabs {
  display: flex;
  gap: 18rpx;
  margin: 44rpx 0 28rpx;
}
.role-tabs view {
  min-width: 128rpx;
  padding: 17rpx 24rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 18rpx;
  box-sizing: border-box;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  text-align: center;
  background: var(--app-bg-card);
}
.role-tabs view.active {
  border-color: var(--app-color-brand);
  color: #fff;
  background: var(--app-color-brand);
}
.contact-summary {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 30rpx;
}
.contact-summary > view {
  display: grid;
  grid-template-columns: 180rpx 1fr 72rpx;
  min-height: 82rpx;
  padding: 0 28rpx;
  align-items: center;
  gap: 18rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.contact-summary text {
  color: var(--app-text-primary);
  font-size: 24rpx;
  font-weight: 600;
}
.contact-summary strong {
  color: var(--app-color-brand);
  font-size: 23rpx;
  text-align: right;
}
.contact-summary > view > view {
  overflow: hidden;
  height: 14rpx;
  border-radius: 999rpx;
  background: var(--app-border-color);
}
.contact-summary .progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #8877ee, var(--app-color-brand));
}
</style>
