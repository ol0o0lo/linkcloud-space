<script setup lang="ts">
import type { AccessRoleOut, InviteOut, MemberSearchOut } from '@/features/organization-admin/service'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { cancelOrganizationAdminInvite, createOrganizationAdminInvite, listOrganizationAdminInvites, listOrganizationAdminRoles, resendOrganizationAdminInvite, searchOrganizationAdminMemberCandidates } from '@/features/organization-admin/service'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppEntityPickerOption from '@/components/app/AppEntityPickerOption.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'
import { formatPhoneDisplay } from '@/domain/phone'

definePage({ style: { navigationBarTitleText: '邀请管理', navigationStyle: 'custom', enablePullDownRefresh: true } })

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

const invitePage = usePagedPage<InviteOut>({
  loader: ({ page, pageSize }) => listOrganizationAdminInvites(appContextStore.organizationSlug, page, pageSize),
  pageSize: 15,
  keyOf: item => item.pk,
})

async function refreshList() {
  await invitePage.refresh()
}

async function submitInvite() {
  if (creating.value)
    return
  const target = inviteType.value === 'user' ? selectedInvitee.value?.username || '' : inviteTarget.value.trim()
  if (!target || (inviteType.value === 'user' && !selectedInvitee.value)) {
    toast.warning(inviteType.value === 'user' ? '请选择站内用户' : inviteType.value === 'phone' ? '请输入手机号' : '请输入邮箱')
    return
  }
  const confirmation = await uni.showModal({ title: '发送空间邀请', content: `邀请将发送到 ${target}，确定继续吗？`, confirmText: '确认发送' })
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
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="邀请管理" back scroll-mode="sticky" />
    </template>
    <wd-toast />
    <view class="app-row-between app-card-plain p-3">
      <text class="text-xs text-content-muted">支持站内用户、手机号或邮箱邀请</text><wd-button size="small" @click="openCreateInvite">
        发起邀请
      </wd-button>
    </view>
    <view class="mt-2.5">
      <AppPagedList
        :items="invitePage.items.value"
        item-key="pk"
        :loading="invitePage.loading.value"
        :refreshing="invitePage.refreshing.value"
        :loading-more="invitePage.loadingMore.value"
        :finished="invitePage.finished.value"
        :error="invitePage.error.value"
        loading-text="正在加载邀请…"
        empty-text="当前工作空间还没有邀请记录"
        empty-description="通过站内用户、手机号或邮箱发起邀请后，处理状态会显示在这里。"
        empty-icon="no-content"
        empty-action-text="发起邀请"
        finished-text="没有更多邀请了"
        @retry="refreshList"
        @empty-action="openCreateInvite"
      >
        <template #item="{ item }">
          <AppRecordCard>
            <template #title>
              {{ formatPhoneDisplay(item.invitee_phone) || item.invitee_email || (`用户 ${item.invitee}`) }}
            </template>
            <template #status>
              <wd-tag :type="item.is_expired ? 'danger' : 'success'" variant="light" size="small">
                {{ item.is_expired ? '已过期' : '有效' }}
              </wd-tag>
            </template>
            <template #meta>
              创建于 {{ new Date(item.created_at).toLocaleString('zh-CN', { hour12: false }) }}
            </template>
            <template #actions>
              <wd-button size="small" variant="plain" :loading="submitting === item.pk" :disabled="submitting !== null" @click="resendInvite(item)">
                重发
              </wd-button>
              <wd-button size="small" type="danger" variant="plain" :disabled="submitting !== null" @click="cancelInvite(item)">
                取消
              </wd-button>
            </template>
          </AppRecordCard>
        </template>
      </AppPagedList>
    </view>
    <AppBottomSheet v-model:visible="createVisible" title="发起空间邀请" height="tall">
      <view class="flex flex-col gap-2">
        <wd-segmented v-model:value="inviteType" :options="[{ label: '站内用户', value: 'user' }, { label: '手机号', value: 'phone' }, { label: '邮箱', value: 'email' }]" />
        <template v-if="inviteType === 'user'">
          <wd-search v-model="candidateKeyword" placeholder="搜索用户名、姓名或邮箱" hide-cancel @search="searchInvitees" />
          <view v-if="searching" class="py-2.5 text-center text-2xs text-content-muted">
            正在搜索站内用户…
          </view>
          <view class="flex flex-col gap-1.5">
            <view
              v-for="candidate in inviteeCandidates"
              :key="candidate.pk"
              class="app-touchable border border-app-border rounded-app-md border-solid p-2"
              :class="selectedInvitee?.pk === candidate.pk ? 'border-app-brand' : ''"
              @click="selectInvitee(candidate)"
            >
              <AppEntityPickerOption
                :title="((candidate.first_name || '') + (candidate.last_name || '')) || candidate.username"
                :description="candidate.email || candidate.username"
                :selected="selectedInvitee?.pk === candidate.pk"
              />
            </view>
          </view>
        </template>
        <wd-cell v-else :title="inviteType === 'phone' ? '手机号' : '邮箱'" center>
          <wd-input v-model="inviteTarget" :placeholder="inviteType === 'phone' ? '请输入被邀请人手机号' : '请输入被邀请人邮箱'" clearable compact align-right />
        </wd-cell>
        <wd-cell title="预设角色" :value="selectedRole?.name || '不预设角色'" is-link @click="rolePickerVisible = true" />
      </view>
      <template #footer>
        <wd-button block :loading="creating" :disabled="creating" @click="submitInvite">
          发送邀请
        </wd-button>
      </template>
    </AppBottomSheet>
    <wd-picker v-model="roleSelection" v-model:visible="rolePickerVisible" root-portal :z-index="1200" :columns="roleOptions" title="选择预设角色" />
  </AppPage>
</template>
