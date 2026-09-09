<script setup lang="ts">
import type { AccessRoleOut, InviteOut, MemberSearchOut } from '@/features/organization-admin/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { cancelOrganizationAdminInvite, createOrganizationAdminInvite, listOrganizationAdminInvites, listOrganizationAdminRoles, resendOrganizationAdminInvite, searchOrganizationAdminMemberCandidates } from '@/features/organization-admin/service'
import AppListState from '@/shared/components/AppListState.vue'
import { usePagedQuery } from '@/shared/composables/usePagedQuery'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '邀请管理', enablePullDownRefresh: true } })

const toast = useToast()
const appContextStore = useAppContextStore()
const createVisible = ref(false)
const inviteType = ref<'email' | 'phone' | 'user'>('phone')
const inviteTarget = ref('')
const candidateKeyword = ref('')
const inviteeCandidates = ref<MemberSearchOut[]>([])
const selectedInvitee = ref<MemberSearchOut | null>(null)
const roles = ref<AccessRoleOut[]>([])
const roleSelection = ref<Array<string | number>>([])
const rolePickerVisible = ref(false)
const searching = ref(false)
const creating = ref(false)
const submitting = ref<number | null>(null)
const roleOptions = computed(() => roles.value.map(role => ({ label: role.name, value: role.id })))
const selectedRole = computed(() => roles.value.find(role => role.id === Number(roleSelection.value[0])) || null)

const inviteQuery = usePagedQuery<InviteOut>(({ page, pageSize }) => listOrganizationAdminInvites(appContextStore.organizationSlug, page, pageSize), { pageSize: 15 })

async function refreshList() {
  try {
    await inviteQuery.refresh()
  }
  catch { /* 错误由分页状态展示 */ }
  finally { uni.stopPullDownRefresh() }
}

async function loadMore() {
  try {
    await inviteQuery.loadMore()
  }
  catch { /* 错误由分页状态展示 */ }
}

async function submitInvite() {
  if (creating.value)
    return
  const target = inviteType.value === 'user' ? selectedInvitee.value?.username || '' : inviteTarget.value.trim()
  if (!target || (inviteType.value === 'user' && !selectedInvitee.value)) {
    toast.warning(inviteType.value === 'user' ? '请选择站内用户' : inviteType.value === 'phone' ? '请输入手机号' : '请输入邮箱')
    return
  }
  const confirmation = await uni.showModal({ title: '发送组织邀请', content: `邀请将发送到 ${target}，确定继续吗？`, confirmText: '确认发送' })
  if (!confirmation.confirm)
    return
  creating.value = true
  try {
    await createOrganizationAdminInvite(appContextStore.organizationSlug, {
      ...(inviteType.value === 'user'
        ? { invitee: selectedInvitee.value.pk }
        : inviteType.value === 'phone' ? { invitee_phone: target } : { invitee_email: target }),
      access_role: Number(roleSelection.value[0]) || undefined,
    })
    toast.success('邀请已发送')
    createVisible.value = false
    inviteTarget.value = ''
    selectedInvitee.value = null
    roleSelection.value = []
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '邀请发送失败') }
  finally { creating.value = false }
}

async function openCreateInvite() {
  createVisible.value = true
  if (roles.value.length)
    return
  try {
    roles.value = await listOrganizationAdminRoles(appContextStore.organizationSlug)
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '预设角色加载失败') }
}

async function searchInvitees() {
  searching.value = true
  try {
    inviteeCandidates.value = await searchOrganizationAdminMemberCandidates(appContextStore.organizationSlug, candidateKeyword.value.trim())
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '站内用户搜索失败') }
  finally { searching.value = false }
}

function selectInvitee(candidate: MemberSearchOut) {
  selectedInvitee.value = candidate
}

async function resendInvite(item: InviteOut) {
  if (submitting.value)
    return
  const confirmation = await uni.showModal({ title: '重新发送邀请', content: '将刷新邀请有效期并再次发送，确定继续吗？', confirmText: '重新发送' })
  if (!confirmation.confirm)
    return
  submitting.value = item.pk
  try {
    await resendOrganizationAdminInvite(appContextStore.organizationSlug, item.pk)
    toast.success('邀请已重新发送')
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '邀请重发失败') }
  finally { submitting.value = null }
}

async function cancelInvite(item: InviteOut) {
  if (submitting.value)
    return
  const confirmation = await uni.showModal({ title: '取消邀请', content: '取消后原邀请链接将不能继续使用。', confirmText: '确认取消' })
  if (!confirmation.confirm)
    return
  submitting.value = item.pk
  try {
    await cancelOrganizationAdminInvite(appContextStore.organizationSlug, item.pk)
    toast.success('邀请已取消')
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '邀请取消失败') }
  finally { submitting.value = null }
}

onShow(() => void refreshList())
onPullDownRefresh(refreshList)
onReachBottom(() => void loadMore())
</script>

<template>
  <view class="page-shell">
    <wd-toast />
    <view class="toolbar">
      <view><strong>组织邀请</strong><text>支持站内用户、手机号或邮箱邀请</text></view><wd-button size="small" @click="openCreateInvite">
        发起邀请
      </wd-button>
    </view>
    <view v-if="inviteQuery.items.value.length" class="card-list">
      <view v-for="item in inviteQuery.items.value" :key="item.pk" class="record-card">
        <view class="card-main">
          <view class="title-line">
            <strong>{{ item.invitee_phone || item.invitee_email || (`用户 ${item.invitee}`) }}</strong><wd-tag :type="item.is_expired ? 'danger' : 'success'" variant="light" size="small">
              {{ item.is_expired ? '已过期' : '有效' }}
            </wd-tag>
          </view>
          <text>创建于 {{ new Date(item.created_at).toLocaleString('zh-CN', { hour12: false }) }}</text>
        </view>
        <view class="action-row">
          <wd-button size="small" variant="plain" :loading="submitting === item.pk" :disabled="submitting !== null" @click="resendInvite(item)">
            重发
          </wd-button>
          <wd-button size="small" type="danger" variant="plain" :disabled="submitting !== null" @click="cancelInvite(item)">
            取消
          </wd-button>
        </view>
      </view>
    </view>
    <AppListState :loading="inviteQuery.loading.value" :has-items="Boolean(inviteQuery.items.value.length)" :finished="inviteQuery.finished.value" :error-message="inviteQuery.error.value?.message || ''" loading-text="正在加载邀请…" empty-text="当前组织暂无邀请记录" finished-text="没有更多邀请了" @retry="refreshList" />
    <wd-popup v-model="createVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 34rpx 28rpx;">
      <view class="popup-title">
        发起组织邀请
      </view>
      <wd-segmented v-model:value="inviteType" :options="[{ label: '站内用户', value: 'user' }, { label: '手机号', value: 'phone' }, { label: '邮箱', value: 'email' }]" />
      <template v-if="inviteType === 'user'">
        <wd-search v-model="candidateKeyword" placeholder="搜索用户名、姓名或邮箱" hide-cancel @search="searchInvitees" />
        <view v-if="searching" class="search-tip">
          正在搜索站内用户…
        </view>
        <view v-for="candidate in inviteeCandidates" :key="candidate.pk" class="candidate-row" :class="[{ selected: selectedInvitee?.pk === candidate.pk }]" @click="selectInvitee(candidate)">
          <view><strong>{{ ((candidate.first_name || '') + (candidate.last_name || '')) || candidate.username }}</strong><text>{{ candidate.email || candidate.username }}</text></view>
          <view v-if="selectedInvitee?.pk === candidate.pk" class="i-carbon-checkmark" />
        </view>
      </template>
      <wd-input v-else v-model="inviteTarget" :label="inviteType === 'phone' ? '手机号' : '邮箱'" :placeholder="inviteType === 'phone' ? '请输入被邀请人手机号' : '请输入被邀请人邮箱'" clearable />
      <wd-cell title="预设角色" :value="selectedRole?.name || '不预设角色'" is-link @click="rolePickerVisible = true" />
      <wd-button block :loading="creating" :disabled="creating" @click="submitInvite">
        发送邀请
      </wd-button>
    </wd-popup>
    <wd-picker v-model="roleSelection" v-model:visible="rolePickerVisible" :columns="roleOptions" title="选择预设角色" />
  </view>
</template>

<style scoped lang="scss">
.page-shell {
  min-height: 100vh;
  padding: 20rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.toolbar,
.record-card,
.title-line,
.action-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.toolbar {
  justify-content: space-between;
  padding: 24rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.toolbar strong,
.toolbar text {
  display: block;
}
.toolbar strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.toolbar text {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}
.record-card {
  align-items: flex-start;
  padding: 25rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.card-main {
  min-width: 0;
  flex: 1;
}
.record-card strong {
  color: var(--app-text-primary);
  font-size: 26rpx;
}
.record-card text {
  display: block;
  margin-top: 8rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.action-row {
  flex-direction: column;
}
.popup-title {
  margin-bottom: 20rpx;
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.candidate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 12rpx;
  padding: 18rpx;
  border: 1px solid var(--app-border-color);
  border-radius: 16rpx;
}
.candidate-row.selected {
  border-color: var(--app-color-primary);
  color: var(--app-color-primary);
}
.candidate-row strong,
.candidate-row text {
  display: block;
}
.candidate-row text,
.search-tip {
  margin-top: 5rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
</style>
