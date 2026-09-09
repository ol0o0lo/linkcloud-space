<script setup lang="ts">
import type { AccessRoleOut, OrganizationBindingOut, PermissionOut, RoleManagementNavigationOut, RoleMemberOptionOut, TeamBindingOut } from '@/features/organization-admin/service'
import { onHide, onLoad, onUnload } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { getOrganizationRoleScopeOptions, resolveOrganizationRoleTeamId } from '@/domain/organization-admin'
import {
  createOrganizationAdminRole,
  createOrganizationAdminRoleBinding,
  createOrganizationTeamRole,
  createOrganizationTeamRoleBinding,
  getOrganizationRoleManagementNavigation,
  listAllOrganizationRoleMembers,
  listOrganizationAdminRoleBindings,
  listOrganizationAdminRoles,
  listOrganizationAssignablePermissions,
  listOrganizationTeamRoleBindings,
  listOrganizationTeamRoles,
  patchOrganizationAdminRole,
  patchOrganizationRoleMembers,
  patchOrganizationTeamRole,
  removeOrganizationAdminRole,
  removeOrganizationAdminRoleBinding,
  removeOrganizationTeamRole,
  removeOrganizationTeamRoleBinding,
} from '@/features/organization-admin/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { createLatestRequestGuard } from '@/shared/composables/useAsyncTask'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '角色与授权' } })

type Binding = OrganizationBindingOut | TeamBindingOut

const toast = useToast()
const appContextStore = useAppContextStore()
const teamId = ref(0)
const navigation = ref<RoleManagementNavigationOut | null>(null)
const roles = ref<AccessRoleOut[]>([])
const bindings = ref<Binding[]>([])
const permissions = ref<PermissionOut[]>([])
const roleMembers = ref<RoleMemberOptionOut[]>([])
const loading = ref(true)
const loadError = ref('')
const editorVisible = ref(false)
const bindingVisible = ref(false)
const membersVisible = ref(false)
const editingRole = ref<AccessRoleOut | null>(null)
const selectedRole = ref<AccessRoleOut | null>(null)
const roleName = ref('')
const roleDescription = ref('')
const permissionKeys = ref<string[]>([])
const bindingMemberCandidates = ref<RoleMemberOptionOut[]>([])
const bindingMemberSelection = ref<Array<string | number>>([])
const bindingRoleSelection = ref<Array<string | number>>([])
const bindingMemberPickerVisible = ref(false)
const bindingRolePickerVisible = ref(false)
const scopePickerVisible = ref(false)
const scopeSelection = ref<Array<string | number>>([])
const saving = ref(false)
const submitting = ref<number | null>(null)
const deleting = ref<number | null>(null)
const roleMembersRequestGuard = createLatestRequestGuard()
const isTeamScope = computed(() => teamId.value > 0)
const canManage = computed(() => navigation.value
  ? (isTeamScope.value ? navigation.value.capabilities.team_role_manage_ids.includes(teamId.value) : navigation.value.capabilities.role_manage)
  : false)
const roleScopeOptions = computed(() => navigation.value
  ? getOrganizationRoleScopeOptions({ teams: navigation.value.teams, capabilities: navigation.value.capabilities })
  : [])
const currentRoleScope = computed(() => roleScopeOptions.value.find(option => option.value === teamId.value) || null)
const bindingRoleOptions = computed(() => roles.value.map(role => ({ label: role.name, value: role.id })))
const bindingMemberOptions = computed(() => bindingMemberCandidates.value.map(item => ({
  label: `${((item.user.first_name || '') + (item.user.last_name || '')) || item.user.username}${item.assigned ? '（已授权）' : ''}`,
  value: item.user.id,
})))
const selectedBindingRole = computed(() => roles.value.find(role => role.id === Number(bindingRoleSelection.value[0])) || null)
const selectedBindingMember = computed(() => bindingMemberCandidates.value.find(item => item.user.id === Number(bindingMemberSelection.value[0])) || null)

async function loadRoles() {
  loading.value = true
  loadError.value = ''
  try {
    const nextNavigation = await getOrganizationRoleManagementNavigation(appContextStore.organizationSlug)
    navigation.value = nextNavigation
    teamId.value = resolveOrganizationRoleTeamId(nextNavigation.capabilities, teamId.value)
    scopeSelection.value = [teamId.value]
    const [nextRoles, nextBindings, nextPermissions] = await Promise.all([
      isTeamScope.value ? listOrganizationTeamRoles(appContextStore.organizationSlug, teamId.value) : listOrganizationAdminRoles(appContextStore.organizationSlug),
      isTeamScope.value ? listOrganizationTeamRoleBindings(appContextStore.organizationSlug, teamId.value) : listOrganizationAdminRoleBindings(appContextStore.organizationSlug),
      listOrganizationAssignablePermissions(appContextStore.organizationSlug),
    ])
    roles.value = nextRoles
    bindings.value = nextBindings
    permissions.value = nextPermissions
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '角色与授权加载失败' }
  finally { loading.value = false }
}

async function switchRoleScope(event: { value: Array<string | number> }) {
  const nextTeamId = Number(event.value[0] ?? 0)
  if (!roleScopeOptions.value.some(option => option.value === nextTeamId))
    return
  scopeSelection.value = [nextTeamId]
  if (nextTeamId === teamId.value)
    return
  roleMembersRequestGuard.invalidate()
  teamId.value = nextTeamId
  selectedRole.value = null
  roleMembers.value = []
  bindingMemberCandidates.value = []
  bindingMemberSelection.value = []
  bindingRoleSelection.value = []
  membersVisible.value = false
  bindingVisible.value = false
  await loadRoles()
}

function openCreateRole() {
  editingRole.value = null
  roleName.value = ''
  roleDescription.value = ''
  permissionKeys.value = []
  editorVisible.value = true
}

function openEditRole(role: AccessRoleOut) {
  if (role.is_system || !canManage.value)
    return
  editingRole.value = role
  roleName.value = role.name
  roleDescription.value = role.description || ''
  permissionKeys.value = [...role.permission_keys]
  editorVisible.value = true
}

async function saveRole() {
  if (saving.value || !canManage.value || !roleName.value.trim())
    return
  saving.value = true
  const payload = {
    name: roleName.value.trim(),
    description: roleDescription.value.trim(),
    permission_keys: permissionKeys.value,
  }
  try {
    if (editingRole.value) {
      if (isTeamScope.value)
        await patchOrganizationTeamRole(appContextStore.organizationSlug, teamId.value, editingRole.value.id, payload)
      else
        await patchOrganizationAdminRole(appContextStore.organizationSlug, editingRole.value.id, payload)
    }
    else if (isTeamScope.value) {
      await createOrganizationTeamRole(appContextStore.organizationSlug, teamId.value, payload)
    }
    else {
      await createOrganizationAdminRole(appContextStore.organizationSlug, payload)
    }
    toast.success(editingRole.value ? '角色已更新' : '角色已创建')
    editorVisible.value = false
    await loadRoles()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '角色保存失败') }
  finally { saving.value = false }
}

async function deleteRole(role: AccessRoleOut) {
  if (deleting.value || role.is_system || !canManage.value)
    return
  const confirmation = await uni.showModal({ title: '删除角色', content: `删除角色“${role.name}”前请确认已解除全部成员授权。`, confirmText: '确认删除' })
  if (!confirmation.confirm)
    return
  deleting.value = role.id
  try {
    if (isTeamScope.value)
      await removeOrganizationTeamRole(appContextStore.organizationSlug, teamId.value, role.id)
    else
      await removeOrganizationAdminRole(appContextStore.organizationSlug, role.id)
    toast.success('角色已删除')
    await loadRoles()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '角色删除失败') }
  finally { deleting.value = null }
}

async function saveBinding() {
  if (saving.value || !canManage.value)
    return
  const user = Number(bindingMemberSelection.value[0])
  const role = Number(bindingRoleSelection.value[0])
  if (!user || !role) {
    toast.warning('请选择成员和角色')
    return
  }
  saving.value = true
  try {
    if (isTeamScope.value)
      await createOrganizationTeamRoleBinding(appContextStore.organizationSlug, teamId.value, { user, role })
    else
      await createOrganizationAdminRoleBinding(appContextStore.organizationSlug, { user, role })
    toast.success('角色授权已保存')
    bindingVisible.value = false
    await loadRoles()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '角色授权失败') }
  finally { saving.value = false }
}

function openBindingEditor() {
  bindingRoleSelection.value = []
  bindingMemberSelection.value = []
  bindingMemberCandidates.value = []
  bindingVisible.value = true
}

async function selectBindingRole(event: { value: Array<string | number> }) {
  bindingRoleSelection.value = event.value
  bindingMemberSelection.value = []
  const roleId = Number(event.value[0])
  if (!roleId)
    return
  try {
    bindingMemberCandidates.value = await listAllOrganizationRoleMembers(appContextStore.organizationSlug, roleId, 'all', isTeamScope.value ? teamId.value : undefined)
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '授权成员候选加载失败') }
}

async function deleteBinding(binding: Binding) {
  if (deleting.value || !canManage.value)
    return
  const confirmation = await uni.showModal({ title: '解除角色授权', content: '解除后该成员将立即失去此角色带来的权限。', confirmText: '确认解除' })
  if (!confirmation.confirm)
    return
  deleting.value = binding.id
  try {
    if (isTeamScope.value)
      await removeOrganizationTeamRoleBinding(appContextStore.organizationSlug, teamId.value, binding.id)
    else
      await removeOrganizationAdminRoleBinding(appContextStore.organizationSlug, binding.id)
    toast.success('角色授权已解除')
    await loadRoles()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '解除授权失败') }
  finally { deleting.value = null }
}

async function openRoleMembers(role: AccessRoleOut) {
  const requestGeneration = roleMembersRequestGuard.begin()
  const organizationSlugSnapshot = appContextStore.organizationSlug
  const teamIdSnapshot = teamId.value
  selectedRole.value = role
  roleMembers.value = []
  try {
    const nextRoleMembers = await listAllOrganizationRoleMembers(organizationSlugSnapshot, role.id, 'all', teamIdSnapshot > 0 ? teamIdSnapshot : undefined)
    if (!roleMembersRequestGuard.isCurrent(requestGeneration) || appContextStore.organizationSlug !== organizationSlugSnapshot || teamId.value !== teamIdSnapshot || selectedRole.value?.id !== role.id)
      return
    roleMembers.value = nextRoleMembers
    membersVisible.value = true
  }
  catch (error) {
    if (roleMembersRequestGuard.isCurrent(requestGeneration) && appContextStore.organizationSlug === organizationSlugSnapshot && teamId.value === teamIdSnapshot && selectedRole.value?.id === role.id)
      toast.error(error instanceof Error ? error.message : '角色成员加载失败')
  }
}

function closeRoleMembers() {
  roleMembersRequestGuard.invalidate()
  selectedRole.value = null
  roleMembers.value = []
  membersVisible.value = false
}

async function toggleRoleMember(item: RoleMemberOptionOut) {
  if (submitting.value || !selectedRole.value || !canManage.value)
    return
  if (item.assigned) {
    const confirmation = await uni.showModal({ title: '移除角色成员', content: '确定解除该成员的角色授权吗？', confirmText: '确认移除' })
    if (!confirmation.confirm)
      return
  }
  submitting.value = item.user.id
  try {
    await patchOrganizationRoleMembers(appContextStore.organizationSlug, selectedRole.value.id, item.assigned ? { remove_user_ids: [item.user.id] } : { add_user_ids: [item.user.id] }, isTeamScope.value ? teamId.value : undefined)
    item.assigned = !item.assigned
    toast.success(item.assigned ? '成员已加入角色' : '成员已移出角色')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '角色成员更新失败') }
  finally { submitting.value = null }
}

onLoad((options) => {
  teamId.value = Number(options?.teamId || 0)
  void loadRoles()
})
onHide(closeRoleMembers)
onUnload(closeRoleMembers)
</script>

<template>
  <view class="page-shell">
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载角色与授权…" />
    <AppErrorView v-else-if="loadError" title="角色与授权加载失败" :message="loadError" @retry="loadRoles" />
    <template v-else>
      <wd-cell title="角色适用范围" :value="currentRoleScope?.label || '请选择'" is-link @click="scopePickerVisible = true" />
      <view class="scope-card">
        <view><strong>{{ isTeamScope ? '团队级角色' : '组织级角色' }}</strong><text>{{ isTeamScope ? '权限仅在当前团队内生效' : '权限在整个组织内生效' }}</text></view><wd-button v-if="canManage" size="small" @click="openCreateRole">
          新建角色
        </wd-button>
      </view>
      <view class="section-heading">
        角色列表
      </view>
      <view class="card-list">
        <view v-for="role in roles" :key="role.id" class="record-card">
          <view class="record-main" @click="openRoleMembers(role)">
            <view class="title-line">
              <strong>{{ role.name }}</strong><wd-tag v-if="role.is_system" variant="light" size="small">
                系统角色
              </wd-tag>
            </view><text>{{ role.description || '暂无用途说明' }} · {{ role.permission_count }} 项权限 · {{ role.assigned_member_count || 0 }} 名成员</text>
          </view>
          <view v-if="canManage && !role.is_system" class="action-row">
            <wd-button size="small" variant="plain" @click="openEditRole(role)">
              编辑
            </wd-button><wd-button size="small" type="danger" variant="plain" :loading="deleting === role.id" @click="deleteRole(role)">
              删除
            </wd-button>
          </view>
        </view>
      </view>
      <view class="section-heading">
        授权绑定 <wd-button v-if="canManage" size="small" variant="plain" @click="openBindingEditor">
          新增授权
        </wd-button>
      </view>
      <view class="card-list">
        <view v-for="binding in bindings" :key="binding.id" class="record-card">
          <view class="record-main">
            <strong>{{ ((binding.user.first_name || '') + (binding.user.last_name || '')) || binding.user.username }}</strong><text>{{ binding.role.name }}</text>
          </view><wd-button v-if="canManage" size="small" type="danger" variant="plain" :loading="deleting === binding.id" @click="deleteBinding(binding)">
            解除
          </wd-button>
        </view>
      </view>
    </template>
    <wd-popup v-model="editorVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx;">
      <view class="popup-title">
        {{ editingRole ? '编辑角色' : '新建角色' }}
      </view>
      <wd-input v-model="roleName" label="角色名称" clearable />
      <wd-input v-model="roleDescription" label="用途说明" clearable />
      <scroll-view scroll-y class="permission-list">
        <wd-checkbox-group v-model="permissionKeys" shape="square">
          <wd-checkbox v-for="permission in permissions" :key="permission.key" :name="permission.key">
            {{ permission.name }}
          </wd-checkbox>
        </wd-checkbox-group>
      </scroll-view>
      <view class="permission-tip">
        当前可分配 {{ permissions.length }} 项权限
      </view>
      <wd-button block :loading="saving" :disabled="saving" @click="saveRole">
        保存角色
      </wd-button>
    </wd-popup>
    <wd-popup v-model="bindingVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx;">
      <view class="popup-title">
        新增角色授权
      </view>
      <wd-cell title="角色" :value="selectedBindingRole?.name || '请选择角色'" is-link @click="bindingRolePickerVisible = true" />
      <wd-cell title="成员" :value="selectedBindingMember ? (((selectedBindingMember.user.first_name || '') + (selectedBindingMember.user.last_name || '')) || selectedBindingMember.user.username) : '请先选择角色'" :is-link="Boolean(selectedBindingRole)" @click="selectedBindingRole && (bindingMemberPickerVisible = true)" />
      <wd-button block :loading="saving" :disabled="saving" @click="saveBinding">
        保存授权
      </wd-button>
    </wd-popup>
    <wd-picker v-model="bindingRoleSelection" v-model:visible="bindingRolePickerVisible" :columns="bindingRoleOptions" title="选择角色" @confirm="selectBindingRole" />
    <wd-picker v-model="bindingMemberSelection" v-model:visible="bindingMemberPickerVisible" :columns="bindingMemberOptions" title="选择成员" />
    <wd-picker v-model="scopeSelection" v-model:visible="scopePickerVisible" :columns="roleScopeOptions" title="选择角色适用范围" @confirm="switchRoleScope" />
    <wd-popup v-model="membersVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx; max-height: 80vh; overflow: auto;" @close="closeRoleMembers">
      <view class="popup-title">
        {{ selectedRole?.name }}的成员
      </view>
      <view v-for="item in roleMembers" :key="item.member_id" class="member-row">
        <view><strong>{{ ((item.user.first_name || '') + (item.user.last_name || '')) || item.user.username }}</strong><text>{{ item.user.email || item.user.username }}</text></view><wd-button size="small" :type="item.assigned ? 'danger' : 'primary'" :variant="item.assigned ? 'plain' : 'base'" :loading="submitting === item.user.id" :disabled="submitting !== null || !canManage" @click="toggleRoleMember(item)">
          {{ item.assigned ? '移出' : '加入' }}
        </wd-button>
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
.scope-card,
.record-card,
.title-line,
.action-row,
.section-heading,
.member-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.scope-card,
.record-card,
.member-row {
  padding: 25rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.scope-card {
  justify-content: space-between;
}
.scope-card strong,
.scope-card text,
.record-main strong,
.record-main text,
.member-row strong,
.member-row text {
  display: block;
}
.scope-card strong,
.record-main strong,
.member-row strong {
  color: var(--app-text-primary);
  font-size: 26rpx;
}
.scope-card text,
.record-main text,
.member-row text {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.section-heading {
  justify-content: space-between;
  margin: 28rpx 6rpx 14rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 650;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.record-main,
.member-row > view {
  min-width: 0;
  flex: 1;
}
.action-row {
  flex-direction: column;
}
.popup-title {
  margin-bottom: 18rpx;
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.permission-tip {
  margin: 16rpx 0;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.permission-list {
  max-height: 420rpx;
  margin-bottom: 18rpx;
}
.member-row {
  margin-top: 12rpx;
  background: var(--app-bg-page);
}
</style>
