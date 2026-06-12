<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Empty, Input, message, Modal, Select, Space, Table, Tag } from 'antdv-next';

import { getAppContextApi } from '#/api/django/context';
import {
  type AccessRoleRow,
  createOrgBindingApi,
  createOrgRoleApi,
  createTeamBindingApi,
  createTeamRoleApi,
  deleteOrgBindingApi,
  deleteOrgRoleApi,
  deleteTeamBindingApi,
  deleteTeamRoleApi,
  listMembersApi,
  listOrgBindingsApi,
  listOrgRolesApi,
  listPermissionsApi,
  listTeamBindingsApi,
  listTeamRolesApi,
  listTeamsApi,
  type MemberRow,
  type OrgBindingRow,
  type PermissionRow,
  type TeamBindingRow,
  type TeamRow,
  updateOrgRoleApi,
  updateTeamRoleApi,
} from '#/api/django/resources';

const loading = ref(false);
const hasActiveOrganization = ref(false);

// -- 数据 --
const permissions = ref<PermissionRow[]>([]);
const members = ref<MemberRow[]>([]);
const teams = ref<TeamRow[]>([]);

// -- Org 角色 --
const orgRoles = ref<AccessRoleRow[]>([]);
const orgBindings = ref<OrgBindingRow[]>([]);

// -- Team 角色（按选中 team 切换）--
const selectedTeamId = ref<null | number>(null);
const teamRoles = ref<AccessRoleRow[]>([]);
const teamBindings = ref<TeamBindingRow[]>([]);
const teamRolesLoading = ref(false);

// -- 新建/编辑角色 Modal --
const roleModalVisible = ref(false);
const roleModalScope = ref<'org' | 'team'>('org');
const roleModalEditing = ref<AccessRoleRow | null>(null);
const roleForm = reactive({ code: '', name: '', permission_keys: [] as string[] });

// -- 分配绑定 --
const bindingUserIdOrg = ref<null | number>(null);
const bindingRoleIdOrg = ref<null | number>(null);
const bindingUserIdTeam = ref<null | number>(null);
const bindingRoleIdTeam = ref<null | number>(null);

// -- 统计 --
const stats = computed(() => [
  { label: 'Org 级角色', value: orgRoles.value.length },
  { label: 'Org 授权记录', value: orgBindings.value.length },
  { label: '团队数', value: teams.value.length },
  { label: 'Team 授权记录', value: teamBindings.value.length },
]);

function memberOptions(list: MemberRow[]) {
  return list.map((m) => ({
    label: `${m.user.first_name || m.user.username} (${m.user.email || m.user.username})`,
    value: m.user.id,
  }));
}

async function loadData() {
  loading.value = true;
  try {
    const context = await getAppContextApi().catch(() => null);
    hasActiveOrganization.value = !!context?.org;
    if (!hasActiveOrganization.value) return;

    const [perms, mems, tms, oRoles, oBindings] = await Promise.allSettled([
      listPermissionsApi(),
      listMembersApi(),
      listTeamsApi(),
      listOrgRolesApi(),
      listOrgBindingsApi(),
    ]);
    permissions.value = perms.status === 'fulfilled' ? perms.value : [];
    members.value = mems.status === 'fulfilled' ? mems.value : [];
    teams.value = tms.status === 'fulfilled' ? tms.value : [];
    orgRoles.value = oRoles.status === 'fulfilled' ? oRoles.value : [];
    orgBindings.value = oBindings.status === 'fulfilled' ? oBindings.value : [];

    if (selectedTeamId.value) await loadTeamData(selectedTeamId.value);
  } finally {
    loading.value = false;
  }
}

async function loadTeamData(teamId: number) {
  teamRolesLoading.value = true;
  try {
    const [roles, bindings] = await Promise.allSettled([
      listTeamRolesApi(teamId),
      listTeamBindingsApi(teamId),
    ]);
    teamRoles.value = roles.status === 'fulfilled' ? roles.value : [];
    teamBindings.value = bindings.status === 'fulfilled' ? bindings.value : [];
  } finally {
    teamRolesLoading.value = false;
  }
}

watch(selectedTeamId, (id) => {
  if (id) loadTeamData(id);
  else {
    teamRoles.value = [];
    teamBindings.value = [];
  }
});

// -- 角色 Modal --
function openCreateRoleModal(scope: 'org' | 'team') {
  roleModalScope.value = scope;
  roleModalEditing.value = null;
  roleForm.code = '';
  roleForm.name = '';
  roleForm.permission_keys = [];
  roleModalVisible.value = true;
}

function openEditRoleModal(role: AccessRoleRow, scope: 'org' | 'team') {
  roleModalScope.value = scope;
  roleModalEditing.value = role;
  roleForm.code = role.code;
  roleForm.name = role.name;
  roleForm.permission_keys = [...role.permission_keys];
  roleModalVisible.value = true;
}

async function saveRole() {
  const { code, name, permission_keys } = roleForm;
  if (!code.trim() || !name.trim()) {
    message.warning('编码和名称不能为空');
    return;
  }
  try {
    if (roleModalEditing.value) {
      const id = roleModalEditing.value.id;
      if (roleModalScope.value === 'org') {
        await updateOrgRoleApi(id, { code, name, permission_keys });
      } else {
        if (!selectedTeamId.value) return;
        await updateTeamRoleApi(selectedTeamId.value, id, { code, name, permission_keys });
      }
      message.success('角色已更新');
    } else {
      if (roleModalScope.value === 'org') {
        await createOrgRoleApi({ code, name, permission_keys });
      } else {
        if (!selectedTeamId.value) return;
        await createTeamRoleApi(selectedTeamId.value, { code, name, permission_keys });
      }
      message.success('角色已创建');
    }
    roleModalVisible.value = false;
    await loadData();
  } catch {
    message.error('操作失败，请检查输入或权限');
  }
}

function confirmDeleteRole(role: AccessRoleRow, scope: 'org' | 'team') {
  Modal.confirm({
    cancelText: '取消',
    content: `停用后，「${role.name}」将不再可用于新的绑定，历史记录不受影响。`,
    okText: '确认停用',
    okType: 'danger',
    title: '确认停用角色',
    onOk: async () => {
      if (scope === 'org') {
        await deleteOrgRoleApi(role.id);
      } else {
        if (!selectedTeamId.value) return;
        await deleteTeamRoleApi(selectedTeamId.value, role.id);
      }
      message.success('角色已停用');
      await loadData();
    },
  });
}

// -- 绑定 --
async function createOrgBinding() {
  if (!bindingUserIdOrg.value || !bindingRoleIdOrg.value) {
    message.warning('请选择用户和角色');
    return;
  }
  await createOrgBindingApi(bindingUserIdOrg.value, bindingRoleIdOrg.value);
  message.success('授权成功');
  bindingUserIdOrg.value = null;
  bindingRoleIdOrg.value = null;
  await loadData();
}

function confirmDeleteOrgBinding(binding: OrgBindingRow) {
  Modal.confirm({
    cancelText: '取消',
    content: `移除 ${binding.user.username} 的「${binding.role.name}」授权。`,
    okText: '确认移除',
    okType: 'danger',
    title: '确认移除授权',
    onOk: async () => {
      await deleteOrgBindingApi(binding.id);
      message.success('授权已移除');
      await loadData();
    },
  });
}

async function createTeamBinding() {
  if (!selectedTeamId.value || !bindingUserIdTeam.value || !bindingRoleIdTeam.value) {
    message.warning('请先选择团队、用户和角色');
    return;
  }
  await createTeamBindingApi(selectedTeamId.value, bindingUserIdTeam.value, bindingRoleIdTeam.value);
  message.success('授权成功');
  bindingUserIdTeam.value = null;
  bindingRoleIdTeam.value = null;
  await loadTeamData(selectedTeamId.value);
}

function confirmDeleteTeamBinding(binding: TeamBindingRow) {
  Modal.confirm({
    cancelText: '取消',
    content: `移除 ${binding.user.username} 的「${binding.role.name}」授权。`,
    okText: '确认移除',
    okType: 'danger',
    title: '确认移除授权',
    onOk: async () => {
      if (!selectedTeamId.value) return;
      await deleteTeamBindingApi(selectedTeamId.value, binding.id);
      message.success('授权已移除');
      await loadTeamData(selectedTeamId.value);
    },
  });
}

const permissionOptions = computed(() =>
  permissions.value.map((p) => ({ label: p.name, value: p.key })),
);

const orgRoleOptions = computed(() =>
  orgRoles.value.filter((r) => r.is_active).map((r) => ({ label: r.name, value: r.id })),
);

const teamRoleOptions = computed(() =>
  teamRoles.value.filter((r) => r.is_active).map((r) => ({ label: r.name, value: r.id })),
);

function teamMemberOptions() {
  if (!selectedTeamId.value) return [];
  const team = teams.value.find((t) => t.id === selectedTeamId.value);
  if (!team) return [];
  const memberSet = new Set(team.members);
  return members.value
    .filter((m) => memberSet.has(m.user.id))
    .map((m) => ({
      label: `${m.user.first_name || m.user.username} (${m.user.email || m.user.username})`,
      value: m.user.id,
    }));
}

onMounted(() => loadData());
</script>

<template>
  <Page
    content-class="flex flex-col gap-6"
    description="管理租户和团队的角色定义与成员授权。"
    title="访问控制"
  >
    <div v-if="!hasActiveOrganization" class="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
      请先切换到一个租户上下文。
    </div>

    <template v-else>
      <!-- 统计卡 -->
      <Card class="shadow-sm" variant="borderless">
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div v-for="stat in stats" :key="stat.label" class="text-center">
            <div class="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{{ stat.value }}</div>
            <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{{ stat.label }}</div>
          </div>
        </div>
      </Card>

      <!-- Org 角色 -->
      <Card class="shadow-sm" variant="borderless">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">租户级角色</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">系统预置角色和当前租户自定义角色，作用域为整个组织。</div>
          </div>
          <Button type="primary" @click="openCreateRoleModal('org')">新建角色</Button>
        </div>

        <Table
          :columns="[
            { dataIndex: 'name', title: '名称' },
            { dataIndex: 'code', title: '编码' },
            { dataIndex: 'is_system', title: '类型', width: 80 },
            { dataIndex: 'is_active', title: '状态', width: 80 },
            { dataIndex: 'permission_keys', title: '权限数', width: 80 },
            { dataIndex: 'actions', title: '操作', width: 140 },
          ]"
          :data-source="orgRoles"
          :loading
          row-key="id"
        >
          <template #emptyText>
            <Empty description="暂无租户级角色" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'is_system'">
              <Tag :color="record.is_system ? 'blue' : 'default'">{{ record.is_system ? '系统' : '自定义' }}</Tag>
            </template>
            <template v-if="column.dataIndex === 'is_active'">
              <Tag :color="record.is_active ? 'green' : 'red'">{{ record.is_active ? '启用' : '停用' }}</Tag>
            </template>
            <template v-if="column.dataIndex === 'permission_keys'">
              {{ record.permission_keys.length }}
            </template>
            <template v-if="column.dataIndex === 'actions'">
              <Space>
                <Button size="small" @click="openEditRoleModal(record, 'org')">编辑</Button>
                <Button
                  v-if="!record.is_system && record.is_active"
                  danger
                  size="small"
                  @click="confirmDeleteRole(record, 'org')"
                >
                  停用
                </Button>
              </Space>
            </template>
          </template>
        </Table>
      </Card>

      <!-- Org 授权 -->
      <Card class="shadow-sm" variant="borderless">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">租户级授权</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">为成员分配 Org 级角色，权限覆盖整个组织。</div>
          </div>
        </div>

        <div class="mb-4 flex flex-wrap items-center gap-3">
          <Select
            v-model:value="bindingUserIdOrg"
            class="min-w-60 flex-1"
            placeholder="选择成员"
            show-search
            :filter-option="(input: string, opt: any) => opt.label.toLowerCase().includes(input.toLowerCase())"
            :options="memberOptions(members)"
          />
          <Select
            v-model:value="bindingRoleIdOrg"
            class="min-w-52"
            placeholder="选择角色"
            :options="orgRoleOptions"
          />
          <Button type="primary" @click="createOrgBinding">授权</Button>
        </div>

        <Table
          :columns="[
            { dataIndex: ['user', 'username'], title: '用户名' },
            { dataIndex: ['role', 'name'], title: '角色' },
            { dataIndex: ['role', 'scope'], title: '作用域', width: 90 },
            { dataIndex: 'created_at', title: '授权时间' },
            { dataIndex: 'actions', title: '操作', width: 80 },
          ]"
          :data-source="orgBindings"
          :loading
          row-key="id"
        >
          <template #emptyText>
            <Empty description="暂无授权记录" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'created_at'">
              {{ new Date(record.created_at).toLocaleString('zh-CN') }}
            </template>
            <template v-if="column.dataIndex === 'actions'">
              <Button danger size="small" @click="confirmDeleteOrgBinding(record)">移除</Button>
            </template>
          </template>
        </Table>
      </Card>

      <!-- Team 角色 & 授权 -->
      <Card class="shadow-sm" variant="borderless">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">团队角色与授权</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">先选择团队，再管理该团队的角色定义和成员授权。</div>
          </div>
          <Space>
            <Select
              v-model:value="selectedTeamId"
              class="min-w-52"
              placeholder="选择团队"
              :options="teams.map((t) => ({ label: t.name, value: t.id }))"
            />
            <Button :disabled="!selectedTeamId" type="primary" @click="openCreateRoleModal('team')">新建 Team 角色</Button>
          </Space>
        </div>

        <div v-if="!selectedTeamId" class="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
          请先选择一个团队
        </div>

        <template v-else>
          <!-- Team 角色列表 -->
          <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">团队角色</div>
          <Table
            :columns="[
              { dataIndex: 'name', title: '名称' },
              { dataIndex: 'code', title: '编码' },
              { dataIndex: 'is_system', title: '类型', width: 80 },
              { dataIndex: 'is_active', title: '状态', width: 80 },
              { dataIndex: 'permission_keys', title: '权限数', width: 80 },
              { dataIndex: 'actions', title: '操作', width: 140 },
            ]"
            :data-source="teamRoles"
            :loading="teamRolesLoading"
            class="mb-6"
            row-key="id"
          >
            <template #emptyText>
              <Empty description="暂无团队角色" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'is_system'">
                <Tag :color="record.is_system ? 'blue' : 'default'">{{ record.is_system ? '系统' : '自定义' }}</Tag>
              </template>
              <template v-if="column.dataIndex === 'is_active'">
                <Tag :color="record.is_active ? 'green' : 'red'">{{ record.is_active ? '启用' : '停用' }}</Tag>
              </template>
              <template v-if="column.dataIndex === 'permission_keys'">
                {{ record.permission_keys.length }}
              </template>
              <template v-if="column.dataIndex === 'actions'">
                <Space>
                  <Button size="small" @click="openEditRoleModal(record, 'team')">编辑</Button>
                  <Button
                    v-if="!record.is_system && record.is_active"
                    danger
                    size="small"
                    @click="confirmDeleteRole(record, 'team')"
                  >
                    停用
                  </Button>
                </Space>
              </template>
            </template>
          </Table>

          <!-- Team 授权 -->
          <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">团队授权</div>
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <Select
              v-model:value="bindingUserIdTeam"
              class="min-w-60 flex-1"
              placeholder="选择团队成员"
              show-search
              :filter-option="(input: string, opt: any) => opt.label.toLowerCase().includes(input.toLowerCase())"
              :options="teamMemberOptions()"
            />
            <Select
              v-model:value="bindingRoleIdTeam"
              class="min-w-52"
              placeholder="选择团队角色"
              :options="teamRoleOptions"
            />
            <Button type="primary" @click="createTeamBinding">授权</Button>
          </div>

          <Table
            :columns="[
              { dataIndex: ['user', 'username'], title: '用户名' },
              { dataIndex: ['role', 'name'], title: '角色' },
              { dataIndex: 'created_at', title: '授权时间' },
              { dataIndex: 'actions', title: '操作', width: 80 },
            ]"
            :data-source="teamBindings"
            :loading="teamRolesLoading"
            row-key="id"
          >
            <template #emptyText>
              <Empty description="暂无团队授权记录" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'created_at'">
                {{ new Date(record.created_at).toLocaleString('zh-CN') }}
              </template>
              <template v-if="column.dataIndex === 'actions'">
                <Button danger size="small" @click="confirmDeleteTeamBinding(record)">移除</Button>
              </template>
            </template>
          </Table>
        </template>
      </Card>
    </template>

    <!-- 新建/编辑角色 Modal -->
    <Modal
      v-model:open="roleModalVisible"
      :title="roleModalEditing ? '编辑角色' : (roleModalScope === 'org' ? '新建租户角色' : '新建团队角色')"
      :ok-text="roleModalEditing ? '保存' : '创建'"
      cancel-text="取消"
      @ok="saveRole"
    >
      <div class="flex flex-col gap-4 py-2">
        <div>
          <div class="mb-1 text-sm font-medium">编码 <span class="text-red-500">*</span></div>
          <Input v-model:value="roleForm.code" :disabled="!!roleModalEditing?.is_system" placeholder="如 org_viewer" />
        </div>
        <div>
          <div class="mb-1 text-sm font-medium">名称 <span class="text-red-500">*</span></div>
          <Input v-model:value="roleForm.name" placeholder="如 查看者" />
        </div>
        <div>
          <div class="mb-1 text-sm font-medium">权限</div>
          <Select
            v-model:value="roleForm.permission_keys"
            class="w-full"
            mode="multiple"
            placeholder="选择权限（可多选）"
            :filter-option="(input: string, opt: any) => opt.label.toLowerCase().includes(input.toLowerCase())"
            :options="permissionOptions"
          />
        </div>
      </div>
    </Modal>
  </Page>
</template>
