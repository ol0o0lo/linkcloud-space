<script setup lang="ts">
import type { MemberOut, OrganizationNavigationOut, PropertyResponsibilityMemberOut, WorkspaceMemberOut } from '@/features/organization-admin/service'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { getOrganizationAdminMember, getOrganizationAdminNavigation, getOrganizationResponsibility, getOrganizationWorkspaceMember, listOrganizationAdminRoleBindings, patchOrganizationAdminMember, removeOrganizationAdminMember } from '@/features/organization-admin/service'
import { APP_ROUTES, getOrganizationAdminTeamDetailRoute } from '@/modules/routes'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '成员详情', navigationStyle: 'custom' } })

const toast = useToast()
const appContextStore = useAppContextStore()
const memberId = ref(0)
const member = ref<MemberOut | null>(null)
const employeeName = ref('')
const jobTitle = ref('')
const loading = ref(true)
const saving = ref(false)
const removing = ref(false)
const loadError = ref('')
const workspaceMember = ref<WorkspaceMemberOut | null>(null)
const responsibilities = ref<PropertyResponsibilityMemberOut | null>(null)
const navigation = ref<OrganizationNavigationOut | null>(null)
const roleNames = ref<string[]>([])
const rolesAvailable = ref(false)
const canManageTeams = computed(() => navigation.value?.capabilities.team_create === true || Boolean(navigation.value?.capabilities.team_member_manage_ids.length))
const canViewRoles = computed(() => navigation.value?.capabilities.role_view === true || Boolean(navigation.value?.capabilities.team_role_view_ids.length))
const responsibilitySummary = computed(() => {
  const item = responsibilities.value
  if (!item)
    return '暂时无法加载'
  if (!item.landlords.length && !item.buildings.length && !item.estates.length)
    return '未配置负责范围'
  return `${item.landlords.length} 位房东 · ${item.buildings.length} 栋楼 · ${item.estates.length} 个小区`
})

async function loadMember() {
  loading.value = true
  loadError.value = ''
  try {
    member.value = await getOrganizationAdminMember(appContextStore.organizationSlug, memberId.value)
    employeeName.value = member.value.employee_name || ''
    jobTitle.value = member.value.job_title || ''
    const [workspaceResult, responsibilityResult, navigationResult] = await Promise.allSettled([
      getOrganizationWorkspaceMember(appContextStore.organizationSlug, memberId.value),
      getOrganizationResponsibility(appContextStore.organizationSlug, memberId.value),
      getOrganizationAdminNavigation(appContextStore.organizationSlug),
    ])
    workspaceMember.value = workspaceResult.status === 'fulfilled' ? workspaceResult.value : null
    responsibilities.value = responsibilityResult.status === 'fulfilled' ? responsibilityResult.value : null
    navigation.value = navigationResult.status === 'fulfilled' ? navigationResult.value : null
    rolesAvailable.value = false
    roleNames.value = []
    if (navigation.value?.capabilities.role_view) {
      try {
        const bindings = await listOrganizationAdminRoleBindings(appContextStore.organizationSlug)
        roleNames.value = bindings.filter(binding => binding.user.id === member.value?.user.id).map(binding => binding.role.name)
        rolesAvailable.value = true
      }
      catch { /* 基本成员资料仍可正常维护，角色加载状态单独展示。 */ }
    }
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '成员详情加载失败' }
  finally { loading.value = false }
}

function openTeams() {
  if (!member.value)
    return
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminTeams}?userId=${member.value.user.id}&memberName=${encodeURIComponent(member.value.employee_name || member.value.user.username)}` })
}

function openTeam(teamId: number) {
  uni.navigateTo({ url: getOrganizationAdminTeamDetailRoute(teamId) })
}

function openRoles() {
  if (!member.value)
    return
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminRoles}?userId=${member.value.user.id}&memberName=${encodeURIComponent(member.value.employee_name || member.value.user.username)}` })
}

function openResponsibilities() {
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminResponsibilityEdit}?id=${memberId.value}` })
}

async function saveMember() {
  if (saving.value || !member.value)
    return
  saving.value = true
  try {
    member.value = await patchOrganizationAdminMember(appContextStore.organizationSlug, member.value.pk, {
      employee_name: employeeName.value.trim() || null,
      job_title: jobTitle.value.trim() || null,
    })
    toast.success('成员资料已保存')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '成员资料保存失败') }
  finally { saving.value = false }
}

async function removeMember() {
  if (!member.value || member.value.is_owner || removing.value)
    return
  const confirmation = await uni.showModal({ title: '移除空间成员', content: `确定移除 ${member.value.employee_name || member.value.user.username} 吗？移除后，该成员将无法访问当前工作空间，其平台账号仍保留。`, confirmText: '确认移除' })
  if (!confirmation.confirm)
    return
  removing.value = true
  try {
    await removeOrganizationAdminMember(appContextStore.organizationSlug, member.value.pk)
    toast.success('成员已移除')
    setTimeout(() => uni.navigateBack(), 350)
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '成员移除失败') }
  finally { removing.value = false }
}

onLoad((options) => {
  memberId.value = Number(options?.id || 0)
})
onShow(() => void loadMember())
</script>

<template>
  <view class="page-shell box-border min-h-screen bg-surface-page px-3 pb-7 pt-0">
    <AppCustomNavigation title="成员详情" back scroll-mode="sticky" />
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载成员详情…" />
    <AppErrorView v-else-if="loadError" title="成员详情加载失败" :message="loadError" @retry="loadMember" />
    <template v-else-if="member">
      <view class="hero-card flex items-center gap-2.5 rounded-3 bg-surface-card p-4">
        <view class="member-avatar h-9 w-9 flex flex-none basis-9 items-center justify-center rounded-3 bg-surface-brand-soft text-size-sm text-app-brand font-bold">
          {{ (member.employee_name || member.user.username).slice(0, 1) }}
        </view>
        <view class="member-main min-w-0 flex flex-1 flex-col gap-1">
          <strong>{{ member.employee_name || member.user.username }}</strong><text>{{ member.user.email || member.user.username }}</text>
        </view>
        <wd-tag :type="member.is_owner ? 'warning' : 'primary'" variant="light">
          {{ member.is_owner ? '所有者' : '成员' }}
        </wd-tag>
      </view>
      <wd-cell-group title="团队、角色与负责范围" title-width="80px" insert>
        <wd-cell title="所属团队" :value="workspaceMember ? workspaceMember.teams.map(team => team.name).join('、') || '尚未加入团队' : '暂时无法加载'" :is-link="canManageTeams" @click="canManageTeams && openTeams()" />
        <wd-cell v-for="team in workspaceMember?.teams || []" :key="team.id" :title="team.name" value="查看团队" is-link @click="openTeam(team.id)" />
        <wd-cell v-if="canViewRoles" title="角色与授权" :value="rolesAvailable ? roleNames.join('、') || '尚未授权空间角色' : navigation?.capabilities.role_view ? '暂时无法加载' : '查看团队角色'" is-link @click="openRoles" />
        <wd-cell title="房源分工" :value="responsibilitySummary" :is-link="navigation?.capabilities.responsibility_manage" @click="navigation?.capabilities.responsibility_manage && openResponsibilities()" />
      </wd-cell-group>
      <view class="section-title mx-1 mb-2 mt-4.5 text-size-sm text-content-primary font-bold">
        工作空间内资料
      </view>
      <view class="form-card flex flex-col gap-3 rounded-3 bg-surface-card p-4">
        <wd-cell title="员工姓名" center>
          <wd-input v-model="employeeName" placeholder="工作空间内展示姓名" clearable compact align-right />
        </wd-cell>
        <wd-cell title="职位" center>
          <wd-input v-model="jobTitle" placeholder="请输入职位" clearable compact align-right />
        </wd-cell>
        <AppNotice title="工作空间内资料" description="员工姓名和职位只用于当前工作空间内展示，不会修改账号的个人资料。" compact />
        <wd-button block :loading="saving" :disabled="saving" @click="saveMember">
          保存成员资料
        </wd-button>
        <view v-if="!member.is_owner" class="mt-4 text-center">
          <wd-button size="small" type="danger" variant="text" :loading="removing" :disabled="removing" @click="removeMember">
            移除空间成员
          </wd-button>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.page-shell :deep(.app-custom-navigation) {
  @apply mt-0 -mx-3 mb-3;
}
.hero-card strong {
  @apply text-content-primary text-size-sm;
}
.hero-card text {
  @apply text-content-muted text-size-xs;
}
.form-card :deep(.wd-button) {
  @apply mt-1;
}
</style>
