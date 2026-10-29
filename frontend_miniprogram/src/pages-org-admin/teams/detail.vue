<script setup lang="ts">
import type { MemberOut, OrganizationAdminNavigationCapabilities, TeamOut } from '@/features/organization-admin/service'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { addOrganizationAdminTeamMember, getOrganizationAdminNavigationCapabilities, getOrganizationAdminTeam, listAllOrganizationTeamMemberCandidates, patchOrganizationAdminTeam, removeOrganizationAdminTeamMember } from '@/features/organization-admin/service'
import { APP_ROUTES } from '@/modules/routes'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppEntityPickerOption from '@/components/app/AppEntityPickerOption.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '团队详情', navigationStyle: 'custom' } })

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
const targetUserId = ref(0)
const targetMemberName = ref('')
const canUpdate = computed(() => adminCapabilities.value?.team_update_ids.includes(teamId.value) === true)
const canManageMembers = computed(() => adminCapabilities.value?.team_member_manage_ids.includes(teamId.value) === true)
const canViewRoles = computed(() => adminCapabilities.value?.team_role_view_ids.includes(teamId.value) === true || adminCapabilities.value?.team_role_manage_ids.includes(teamId.value) === true)
const canViewSettings = computed(() => Boolean(adminCapabilities.value?.team_settings_view_ids.includes(teamId.value)))
const availableMembers = computed(() => memberCandidates.value.filter(item => !team.value?.members.includes(item.user.id) && (!targetUserId.value || item.user.id === targetUserId.value)))

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
  const confirmation = await uni.showModal({ title: '移出团队', content: `确定将 ${username} 移出当前团队吗？空间成员关系不会被移除。`, confirmText: '确认移出' })
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
  const target = targetUserId.value ? `&userId=${targetUserId.value}&memberName=${encodeURIComponent(targetMemberName.value)}` : ''
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminRoles}?teamId=${teamId.value}${target}` })
}

function openTeamSettings() {
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminSettings}?teamId=${teamId.value}` })
}

onLoad((options) => {
  teamId.value = Number(options?.id || 0)
  targetUserId.value = Number(options?.userId || 0)
  targetMemberName.value = options?.memberName || ''
  void loadTeam()
})
</script>

<template>
  <view class="page-shell box-border min-h-screen bg-surface-page px-3 pb-7 pt-0">
    <AppCustomNavigation title="团队详情" back scroll-mode="sticky" />
    <wd-toast />
    <view v-if="targetUserId" class="my-3 text-xs text-content-secondary">
      当前配置成员：{{ targetMemberName || targetUserId }}
    </view>
    <AppLoading v-if="loading" text="正在加载团队详情…" />
    <AppErrorView v-else-if="loadError" title="团队详情加载失败" :message="loadError" @retry="loadTeam" />
    <template v-else-if="team">
      <view class="form-card rounded-3 bg-surface-card p-3.5">
        <wd-cell title="团队名称" center>
          <wd-input v-model="name" :readonly="!canUpdate" compact align-right />
        </wd-cell>
        <wd-cell title="联系电话" center>
          <wd-input v-model="phone" :readonly="!canUpdate" compact align-right />
        </wd-cell>
        <wd-cell title="客服微信" center>
          <wd-input v-model="wechat" :readonly="!canUpdate" compact align-right />
        </wd-cell>
        <wd-cell title="地址" center>
          <wd-input v-model="address" :readonly="!canUpdate" compact align-right />
        </wd-cell>
        <wd-cell title="营业时间" center>
          <wd-input v-model="businessHours" :readonly="!canUpdate" compact align-right />
        </wd-cell>
        <wd-button v-if="canUpdate" block :loading="saving" :disabled="saving" @click="saveTeam">
          保存团队资料
        </wd-button>
      </view>
      <view class="section-heading mx-1 mb-2 mt-3.5 flex items-center justify-between gap-2">
        <strong>团队成员</strong><wd-button v-if="canManageMembers" size="small" variant="plain" @click="openMemberEditor">
          添加成员
        </wd-button>
      </view>
      <view class="card-list flex flex-col gap-2">
        <view v-for="member in team.member_details" :key="member.id" class="member-card flex items-center justify-between gap-2 rounded-3 bg-surface-card p-3.5">
          <view><strong>{{ ((member.first_name || '') + (member.last_name || '')) || member.username }}</strong><text>{{ member.username }}</text></view>
          <wd-button v-if="canManageMembers" type="danger" variant="plain" size="small" :loading="submitting === member.id" :disabled="submitting !== null" @click="removeMember(member.id, member.username)">
            移出
          </wd-button>
        </view>
      </view>
      <view v-if="canViewRoles" class="link-card mt-2 flex items-center justify-between gap-2 rounded-3 bg-surface-card p-3.5" @click="openTeamRoles">
        <view><strong>团队角色与授权</strong><text>设置团队角色并为成员分配权限</text></view><view class="i-carbon-chevron-right" />
      </view>
      <view v-if="canViewSettings" class="link-card mt-2 flex items-center justify-between gap-2 rounded-3 bg-surface-card p-3.5" @click="openTeamSettings">
        <view><strong>团队设置</strong><text>维护当前团队业务设置</text></view><view class="i-carbon-chevron-right" />
      </view>
    </template>
    <AppBottomSheet v-model:visible="memberVisible" title="添加团队成员" height="tall">
      <view class="flex flex-col gap-1.5">
        <view v-for="candidate in availableMembers" :key="candidate.pk" class="rounded-app-md bg-surface-page p-2.5">
          <AppEntityPickerOption :title="candidate.employee_name || candidate.user.username" :description="candidate.job_title || candidate.user.email">
            <template #trailing>
              <wd-button size="small" :loading="submitting === candidate.user.id" :disabled="submitting !== null" @click="addMember(candidate)">
                加入
              </wd-button>
            </template>
          </AppEntityPickerOption>
        </view>
        <AppEmpty
          v-if="!availableMembers.length"
          title="没有可加入的空间成员"
          :description="targetUserId ? '当前成员已在团队中，或不在可添加成员范围内。' : '当前工作空间成员都已在团队中，或没有可管理的成员。'"
          icon="no-result"
          compact
        />
      </view>
    </AppBottomSheet>
  </view>
</template>

<style scoped lang="scss">
.page-shell :deep(.app-custom-navigation) {
  @apply mt-0 -mx-3 mb-3;
}
.form-card :deep(.wd-button) {
  @apply mt-3;
}
.section-heading strong {
  @apply text-content-primary text-size-sm;
}
.member-card > view,
.link-card > view {
  @apply min-w-0 flex-1;
}
.member-card strong,
.member-card text,
.link-card strong,
.link-card text {
  @apply block;
}
.member-card strong,
.link-card strong {
  @apply text-content-primary text-size-xs;
}
.member-card text,
.link-card text {
  @apply mt-1 text-content-muted text-size-2xs;
}
</style>
