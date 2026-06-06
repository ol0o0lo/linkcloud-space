<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Empty, Input, InputSearch, message, Modal, Select, Space, Table, Tag } from 'antdv-next';

import { getAppContextApi } from '#/api/django/context';
import {
  createTeamApi,
  deleteTeamApi,
  listMembersApi,
  listTeamsApi,
  type MemberRow,
  type TeamRow,
  updateTeamApi,
} from '#/api/django/resources';

const loading = ref(false);
const teams = ref<TeamRow[]>([]);
const members = ref<MemberRow[]>([]);
const keyword = ref('');
const newTeamName = ref('');
const selectedMemberIds = ref<number[]>([]);
const editingTeamId = ref<null | number>(null);
const editingTeamName = ref('');
const editingTeamMembers = ref<number[]>([]);
const hasActiveOrganization = ref(false);

const teamStats = computed(() => {
  const assignedMemberIds = new Set(
    teams.value.flatMap((team) => team.members),
  );
  return [
    {
      label: '团队数量',
      value: teams.value.length,
    },
    {
      label: '可选成员',
      value: members.value.length,
    },
    {
      label: '已分配成员',
      value: assignedMemberIds.size,
    },
  ];
});

async function loadData(q = keyword.value) {
  loading.value = true;
  try {
    const context = await getAppContextApi().catch(() => null);
    hasActiveOrganization.value = !!context?.org;
    if (!hasActiveOrganization.value) {
      teams.value = [];
      members.value = [];
      return;
    }
    const [teamRows, memberRows] = await Promise.allSettled([
      listTeamsApi(q),
      listMembersApi(),
    ]);
    teams.value = teamRows.status === 'fulfilled' ? teamRows.value : [];
    members.value = memberRows.status === 'fulfilled' ? memberRows.value : [];
  } finally {
    loading.value = false;
  }
}

async function createTeam() {
  const name = newTeamName.value.trim();
  if (!name || !hasActiveOrganization.value) return;
  await createTeamApi(name, selectedMemberIds.value);
  newTeamName.value = '';
  selectedMemberIds.value = [];
  message.success('团队已创建');
  await loadData();
}

function startEdit(team: TeamRow) {
  editingTeamId.value = team.id;
  editingTeamName.value = team.name;
  editingTeamMembers.value = [...team.members];
}

async function saveEdit() {
  if (!editingTeamId.value || !hasActiveOrganization.value) return;
  await updateTeamApi(editingTeamId.value, {
    members: editingTeamMembers.value,
    name: editingTeamName.value.trim(),
  });
  message.success('团队已更新');
  editingTeamId.value = null;
  editingTeamName.value = '';
  editingTeamMembers.value = [];
  await loadData();
}

async function removeTeam(team: TeamRow) {
  if (!hasActiveOrganization.value) return;
  await deleteTeamApi(team.id);
  message.success('团队已删除');
  await loadData();
}

function confirmAction(options: {
  content: string;
  okText?: string;
  onOk: () => Promise<void> | void;
  title: string;
}) {
  Modal.confirm({
    cancelText: '取消',
    okText: options.okText || '确认',
    onOk: options.onOk,
    title: options.title,
    content: options.content,
  });
}

onMounted(() => loadData());
</script>

<template>
  <Page auto-content-height content-class="p-6" title="团队管理">
    <div class="space-y-8">
      <div class="grid gap-5 md:grid-cols-3">
        <Card v-for="item in teamStats" :key="item.label" :bordered="false" class="shadow-sm">
          <div class="text-xs uppercase tracking-wide text-zinc-500">{{ item.label }}</div>
          <div class="mt-3 text-3xl font-semibold text-zinc-900">{{ item.value }}</div>
        </Card>
      </div>

      <div class="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card :bordered="false" class="shadow-sm">
          <div class="mb-4">
            <div class="text-base font-semibold text-zinc-900">创建团队</div>
            <div class="mt-1 text-sm text-zinc-500">先确定团队名称，再为团队分配首批成员，后续仍可随时调整。</div>
          </div>
          <div class="flex flex-col gap-4">
            <Input
              v-model:value="newTeamName"
              :disabled="!hasActiveOrganization"
              placeholder="例如：运营支持组"
              @press-enter="createTeam"
            />
            <Select
              v-model:value="selectedMemberIds"
              :disabled="!hasActiveOrganization"
              class="w-full"
              mode="multiple"
              placeholder="选择初始成员"
              :options="
                members.map((member) => ({
                  label: `${member.user.first_name || member.user.username} (${member.user.email || member.user.username})`,
                  value: member.user.id,
                }))
              "
            />
            <div class="text-xs text-zinc-500">
              {{ hasActiveOrganization ? '当前成员会作为候选列表出现。' : '请先在租户管理里切换一个当前租户。' }}
            </div>
            <Button :disabled="!hasActiveOrganization" block type="primary" @click="createTeam">新建团队</Button>
          </div>
        </Card>

        <Card :bordered="false" class="shadow-sm">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-base font-semibold text-zinc-900">团队列表</div>
              <div class="mt-1 text-sm text-zinc-500">集中查看团队成员构成，常用操作保持在表格附近，减少跳转。</div>
            </div>
            <InputSearch
              v-model:value="keyword"
              allow-clear
              class="w-full max-w-sm"
              placeholder="搜索团队"
              @search="loadData"
            />
          </div>
          <Table
            :columns="[
              { dataIndex: 'name', title: '团队' },
              { dataIndex: 'member_details', title: '成员' },
              { dataIndex: 'updated_at', title: '更新时间', width: 180 },
              { dataIndex: 'actions', title: '操作', width: 140 },
            ]"
            :data-source="teams"
            :loading
            :pagination="{ pageSize: 8, showSizeChanger: false }"
            row-key="id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'name'">
                <div>
                  <div class="font-medium text-zinc-900">{{ record.name }}</div>
                  <div class="mt-1 text-xs text-zinc-500">成员 {{ record.member_details.length }} 人</div>
                </div>
              </template>
              <template v-else-if="column.dataIndex === 'member_details'">
                <Space wrap>
                  <Tag v-for="member in record.member_details.slice(0, 4)" :key="member.id">
                    {{ member.first_name || member.username }}
                  </Tag>
                  <Tag v-if="record.member_details.length > 4">+{{ record.member_details.length - 4 }}</Tag>
                  <span v-if="record.member_details.length === 0" class="text-zinc-400">暂无成员</span>
                </Space>
              </template>
              <template v-else-if="column.dataIndex === 'actions'">
                <Space>
                  <Button size="small" type="primary" ghost @click="startEdit(record)">编辑</Button>
                  <Button
                    danger
                    size="small"
                    @click="
                      confirmAction({
                        title: '确认删除团队',
                        content: `删除后，团队 ${record.name} 将从当前租户中移除。`,
                        okText: '确认删除',
                        onOk: () => removeTeam(record),
                      })
                    "
                  >
                    删除
                  </Button>
                </Space>
              </template>
            </template>
            <template #emptyText>
              <Empty :description="hasActiveOrganization ? '还没有团队，先从左侧创建一个团队。' : '请先切换当前租户，再进行团队管理。'" />
            </template>
          </Table>
        </Card>
      </div>

      <Card v-if="editingTeamId" :bordered="false" class="shadow-sm">
        <div class="mb-4">
          <div class="text-base font-semibold text-zinc-900">编辑团队</div>
          <div class="mt-1 text-sm text-zinc-500">你可以调整团队名称和成员范围，变更会立即影响当前团队协作视图。</div>
        </div>
        <div class="grid gap-4 rounded-lg bg-zinc-50 p-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <Input v-model:value="editingTeamName" placeholder="团队名称" />
          <Select
            v-model:value="editingTeamMembers"
            class="w-full"
            mode="multiple"
            placeholder="团队成员"
            :options="
              members.map((member) => ({
                label: `${member.user.first_name || member.user.username} (${member.user.email || member.user.username})`,
                value: member.user.id,
              }))
            "
          />
          <div class="xl:col-span-2">
            <Space>
              <Button type="primary" @click="saveEdit">保存变更</Button>
              <Button @click="editingTeamId = null">取消</Button>
            </Space>
          </div>
        </div>
      </Card>
    </div>
  </Page>
</template>
