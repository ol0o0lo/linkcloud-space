<script setup lang="ts">
import type { ContactOut } from '@/features/organization-rental/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { reactive, ref } from 'vue'
import { buildOrganizationContactPayload, isUniActionCanceled } from '@/domain/organization-rental'
import { createOrganizationContact, inviteOrganizationLandlord, listOrganizationContacts, patchOrganizationContact } from '@/features/organization-rental/service'
import AppListState from '@/shared/components/AppListState.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '联系人', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const toast = useToast()
const items = ref<ContactOut[]>([])
const keyword = ref('')
const page = ref(1)
const pageSize = 15
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')
let requestId = 0
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

async function loadContacts(reset = false) {
  if (!reset && loading.value)
    return
  if (!reset && finished.value)
    return
  const currentRequestId = reset ? ++requestId : requestId
  const targetPage = reset ? 1 : page.value
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  loadError.value = ''
  try {
    const result = await listOrganizationContacts(appContextStore.organizationSlug, targetPage, pageSize, { keyword: keyword.value.trim() || undefined })
    if (currentRequestId !== requestId)
      return
    items.value = reset ? result.items : [...items.value, ...result.items]
    finished.value = items.value.length >= result.total || result.items.length < pageSize
    if (!finished.value)
      page.value = targetPage + 1
  }
  catch {
    if (currentRequestId === requestId)
      loadError.value = '联系人加载失败，请稍后重试'
  }
  finally {
    if (currentRequestId === requestId) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

function callPhone(phone: string) {
  uni.makePhoneCall({ phoneNumber: phone })
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
    await loadContacts(true)
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
    await loadContacts(true)
  }
  catch (error) {
    if (!isUniActionCanceled(error))
      toast.error(error instanceof Error ? error.message : '房东邀请发送失败')
  }
}

onShow(() => void loadContacts(true))
onPullDownRefresh(() => loadContacts(true))
onReachBottom(() => void loadContacts())
</script>

<template>
  <view class="list-page">
    <wd-toast />
    <view class="toolbar-card">
      <view><strong>联系人</strong><text>维护房东、租客及账号绑定关系</text></view>
      <wd-button size="small" @click="openCreate">
        新建联系人
      </wd-button>
    </view>
    <wd-search v-model="keyword" placeholder="搜索姓名或手机号" hide-cancel @search="loadContacts(true)" @clear="loadContacts(true)" />
    <view v-if="items.length" class="card-list">
      <view v-for="item in items" :key="item.id" class="record-card">
        <view class="card-topline">
          <view>
            <view class="record-title">
              {{ item.name }}
            </view><view class="phone">
              {{ item.phone }}
            </view>
          </view><wd-tag :type="item.is_active ? 'success' : 'default'" variant="light" size="small">
            {{ item.is_active ? '正常' : '已停用' }}
          </wd-tag>
        </view>
        <view class="roles">
          <wd-tag v-for="(role, index) in item.roles__mapping" :key="`${role}-${index}`" size="small" variant="light">
            {{ role }}
          </wd-tag>
        </view>
        <view class="card-footer">
          <text>{{ item.landlord_binding_status === 'bound' ? '已绑定房东账号' : item.notes || '暂无备注' }}</text>
          <view class="card-actions">
            <wd-button v-if="canInviteLandlord(item)" size="mini" variant="soft" @click.stop="inviteLandlord(item)">
              邀请房东
            </wd-button>
            <wd-button size="mini" variant="plain" @click.stop="openEdit(item)">
              编辑
            </wd-button>
            <wd-button size="mini" variant="plain" @click.stop="callPhone(item.phone)">
              拨打
            </wd-button>
          </view>
        </view>
      </view>
    </view>
    <AppListState :loading="loading" :has-items="Boolean(items.length)" :finished="finished" :error-message="loadError" loading-text="正在加载联系人…" empty-text="当前组织暂无联系人" finished-text="没有更多联系人了" @retry="loadContacts(true)" />

    <wd-popup v-model="editorVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx; max-height: 82vh; overflow: auto;">
      <view class="popup-title">
        {{ editing ? '编辑联系人' : '新建联系人' }}
      </view>
      <wd-input v-model="contactForm.name" label="姓名" placeholder="请输入姓名" clearable />
      <wd-input v-model="contactForm.phone" label="手机号" type="tel" placeholder="请输入手机号" clearable />
      <wd-input v-model="contactForm.email" label="邮箱" placeholder="可不填" clearable />
      <view class="form-section">
        <view class="form-label">
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
      <view class="status-line">
        <view><strong>可用于新业务</strong><text>关闭后不能用于新建房源或带看</text></view>
        <wd-switch v-model="contactForm.is_active" />
      </view>
      <wd-button block size="large" :loading="saving" :disabled="saving" @click="saveContact">
        保存联系人
      </wd-button>
    </wd-popup>

    <wd-popup :model-value="Boolean(invitationUrl)" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx;" @close="invitationUrl = ''">
      <view class="popup-title">
        房东邀请链接
      </view>
      <view class="invitation-copy">
        链接已复制，可通过微信转发给对应房东。房东登录后需使用与联系人一致的已验证手机号认领。
      </view>
      <wd-textarea :model-value="invitationUrl" readonly auto-height />
      <wd-button block @click="invitationUrl = ''">
        完成
      </wd-button>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.list-page {
  min-height: 100vh;
  padding: 16rpx 24rpx 56rpx;
  background: var(--app-bg-page);
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 20rpx;
}
.toolbar-card,
.status-line,
.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}
.toolbar-card {
  margin-bottom: 14rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.toolbar-card strong,
.toolbar-card text,
.status-line strong,
.status-line text {
  display: block;
}
.toolbar-card strong,
.status-line strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.toolbar-card text,
.status-line text {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.record-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.card-topline,
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.record-title {
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 650;
}
.phone {
  margin-top: 7rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.roles {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 18rpx;
}
.card-footer {
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 1px solid var(--app-divider-color);
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.card-footer text {
  min-width: 0;
  flex: 1;
}
.card-actions {
  flex-shrink: 0;
}
.popup-title {
  margin-bottom: 18rpx;
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.form-section,
.status-line {
  padding: 24rpx 0;
  border-bottom: 1px solid var(--app-divider-color);
}
.form-label {
  margin-bottom: 18rpx;
  color: var(--app-text-secondary);
  font-size: 25rpx;
}
.status-line {
  margin-bottom: 24rpx;
}
.invitation-copy {
  margin-bottom: 18rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}
</style>
