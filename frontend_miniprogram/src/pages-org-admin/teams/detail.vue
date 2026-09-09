<script setup lang="ts">
import type { MemberOut, OrganizationAdminNavigationCapabilities, TeamOut } from '@/features/organization-admin/service'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { addOrganizationAdminTeamMember, getOrganizationAdminNavigationCapabilities, getOrganizationAdminTeam, listAllOrganizationTeamMemberCandidates, patchOrganizationAdminTeam, removeOrganizationAdminTeamMember } from '@/features/organization-admin/service'
import { APP_ROUTES } from '@/modules/routes'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '团队详情' } })

const toast = useToast()
const appContextStore = useAppContextStore()
const teamId = ref(0)
const team = ref<TeamOut | null>(null)
const adminCapabilities = ref<OrganizationAdminNavigationCapabilities | null>(null)
const memberCandidates = ref<MemberOut[]>([])
const memberVisible = ref(false)
const name = ref('')
const phone = ref('')
const wechat = ref('')
const address = ref('')
const businessHours = ref('')
const loading = ref(true)
const saving = ref(false)
const submitting = ref<number | null>(null)
const loadError = ref('')
const canUpdate = computed(() => adminCapabilities.value?.team_update_ids.includes(teamId.value) === true)
const canManageMembers = computed(() => adminCapabilities.value?.team_member_manage_ids.includes(teamId.value) === true)
const canViewRoles = computed(() => adminCapabilities.value?.team_role_view_ids.includes(teamId.value) === true || adminCapabilities.value?.team_role_manage_ids.includes(teamId.value) === true)
const canViewSettings = computed(() => Boolean(adminCapabilities.value?.team_settings_view_ids.includes(teamId.value)))
const availableMembers = computed(() => memberCandidates.value.filter(item => !team.value?.members.includes(item.user.id)))

function fillForm(value: TeamOut) {
  name.value = value.name
  phone.value = value.phone || ''
  wechat.value = value.wechat || ''
  address.value = value.address || ''
  businessHours.value = value.business_hours || ''
}

async function loadTeam() {
  loading.value = true
  loadError.value = ''
  try {
    const [nextTeam, nextAdminCapabilities] = await Promise.all([
      getOrganizationAdminTeam(appContextStore.organizationSlug, teamId.value),
      getOrganizationAdminNavigationCapabilities(appContextStore.organizationSlug),
    ])
    team.value = nextTeam
    adminCapabilities.value = nextAdminCapabilities
    fillForm(nextTeam)
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '团队详情加载失败' }
  finally { loading.value = false }
}

async function saveTeam() {
  if (saving.value || !team.value || !canUpdate.value || !name.value.trim())
    return
  saving.value = true
  try {
    team.value = await patchOrganizationAdminTeam(appContextStore.organizationSlug, team.value.id, {
      name: name.value.trim(),
      phone: phone.value.trim(),
      wechat: wechat.value.trim(),
      address: address.value.trim(),
      business_hours: businessHours.value.trim(),
    })
    fillForm(team.value)
    toast.success('团队资料已保存')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '团队资料保存失败') }
  finally { saving.value = false }
}

async function openMemberEditor() {
  if (!canManageMembers.value)
    return
  try {
    memberCandidates.value = await listAllOrganizationTeamMemberCandidates(appContextStore.organizationSlug, teamId.value)
    memberVisible.value = true
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '成员候选加载失败') }
}

async function addMember(item: MemberOut) {
  if (submitting.value || !team.value)
    return
  const confirmation = await uni.showModal({ title: '加入团队', content: `确定将 ${item.employee_name || item.user.username} 加入当前团队吗？`, confirmText: '确认加入' })
  if (!confirmation.confirm)
    return
  submitting.value = item.user.id
  try {
    await addOrganizationAdminTeamMember(appContextStore.organizationSlug, team.value.id, item.user.id)
    toast.success('成员已加入团队')
    await loadTeam()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '成员加入失败') }
  finally { submitting.value = null }
}

async function removeMember(userId: number, username: string) {
  if (submitting.value || !team.value)
    return
  const confirmation = await uni.showModal({ title: '移出团队', content: `确定将 ${username} 移出当前团队吗？组织成员关系不会被移除。`, confirmText: '确认移出' })
  if (!confirmation.confirm)
    return
  submitting.value = userId
  try {
    await removeOrganizationAdminTeamMember(appContextStore.organizationSlug, team.value.id, userId)
    toast.success('成员已移出团队')
    await loadTeam()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '成员移出失败') }
  finally { submitting.value = null }
}

function openTeamRoles() {
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminRoles}?teamId=${teamId.value}` })
}

function openTeamSettings() {
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminSettings}?teamId=${teamId.value}` })
}

onLoad((options) => {
  teamId.value = Number(options?.id || 0)
  void loadTeam()
})
</script>

<template>
  <view class="page-shell">
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载团队详情…" />
    <AppErrorView v-else-if="loadError" title="团队详情加载失败" :message="loadError" @retry="loadTeam" />
    <template v-else-if="team">
      <view class="form-card">
        <wd-input v-model="name" label="团队名称" :readonly="!canUpdate" />
        <wd-input v-model="phone" label="联系电话" :readonly="!canUpdate" />
        <wd-input v-model="wechat" label="客服微信" :readonly="!canUpdate" />
        <wd-input v-model="address" label="地址" :readonly="!canUpdate" />
        <wd-input v-model="businessHours" label="营业时间" :readonly="!canUpdate" />
        <wd-button v-if="canUpdate" block :loading="saving" :disabled="saving" @click="saveTeam">
          保存团队资料
        </wd-button>
      </view>
      <view class="section-heading">
        <strong>团队成员</strong><wd-button v-if="canManageMembers" size="small" variant="plain" @click="openMemberEditor">
          添加成员
        </wd-button>
      </view>
      <view class="card-list">
        <view v-for="member in team.member_details" :key="member.id" class="member-card">
          <view><strong>{{ ((member.first_name || '') + (member.last_name || '')) || member.username }}</strong><text>{{ member.username }}</text></view>
          <wd-button v-if="canManageMembers" type="danger" variant="plain" size="small" :loading="submitting === member.id" :disabled="submitting !== null" @click="removeMember(member.id, member.username)">
            移出
          </wd-button>
        </view>
      </view>
      <view v-if="canViewRoles" class="link-card" @click="openTeamRoles">
        <view><strong>团队角色与授权</strong><text>维护团队级角色和成员绑定</text></view><view class="i-carbon-chevron-right" />
      </view>
      <view v-if="canViewSettings" class="link-card" @click="openTeamSettings">
        <view><strong>团队设置</strong><text>维护当前团队业务设置</text></view><view class="i-carbon-chevron-right" />
      </view>
    </template>
    <wd-popup v-model="memberVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx; max-height: 78vh; overflow: auto;">
      <view class="popup-title">
        添加团队成员
      </view>
      <view v-for="candidate in availableMembers" :key="candidate.pk" class="member-card candidate">
        <view><strong>{{ candidate.employee_name || candidate.user.username }}</strong><text>{{ candidate.job_title || candidate.user.email }}</text></view>
        <wd-button size="small" :loading="submitting === candidate.user.id" :disabled="submitting !== null" @click="addMember(candidate)">
          加入
        </wd-button>
      </view>
      <view v-if="!availableMembers.length" class="empty-tip">
        没有可加入的组织成员
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.page-shell {
  min-height: 100vh;
  padding: 24rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.form-card,
.member-card,
.link-card {
  padding: 26rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.form-card :deep(.wd-button) {
  margin-top: 24rpx;
}
.section-heading,
.member-card,
.link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.section-heading {
  margin: 28rpx 6rpx 14rpx;
}
.section-heading strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.member-card > view,
.link-card > view {
  min-width: 0;
  flex: 1;
}
.member-card strong,
.member-card text,
.link-card strong,
.link-card text {
  display: block;
}
.member-card strong,
.link-card strong {
  color: var(--app-text-primary);
  font-size: 26rpx;
}
.member-card text,
.link-card text {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.link-card {
  margin-top: 16rpx;
}
.candidate {
  margin-top: 12rpx;
  background: var(--app-bg-page);
}
.popup-title {
  margin-bottom: 16rpx;
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.empty-tip {
  padding: 36rpx;
  color: var(--app-text-muted);
  text-align: center;
}
</style>
