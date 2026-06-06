<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Checkbox, Empty, Input, message, Modal, Select, Space, Table, Tag } from 'antdv-next';

import {
  createInviteApi,
  createMemberApi,
  deleteInviteApi,
  deleteMemberApi,
  getOrganizationProfileApi,
  type InviteRow,
  listInvitesApi,
  listMembersApi,
  listOrganizationsApi,
  listOrganizationUsageApi,
  type MemberRow,
  type MemberSearchRow,
  type OrganizationRow,
  patchMemberApi,
  resendInviteApi,
  searchMembersApi,
  selectOrganizationApi,
  updateOrganizationProfileApi,
} from '#/api/django/resources';

const loading = ref(false);
const organizations = ref<OrganizationRow[]>([]);
const members = ref<MemberRow[]>([]);
const invites = ref<InviteRow[]>([]);
const searchableMembers = ref<MemberSearchRow[]>([]);
const selectedUserId = ref<number>();
const selectedUserIsOwner = ref(false);
const inviteEmail = ref('');
const inviteOwner = ref(false);
const billingEmail = ref('');
const usage = ref<null | {
  member_count: number;
  member_limit: null | number;
  team_count: number;
  team_limit: null | number;
}>(null);

const currentOrganization = computed(
  () => organizations.value.find((item) => item.is_current) ?? null,
);
const orgStats = computed(() => [
  { label: '可切换租户', value: organizations.value.length },
  { label: '当前成员', value: usage.value?.member_count ?? members.value.length },
  { label: '当前团队', value: usage.value?.team_count ?? 0 },
  { label: '待处理邀请', value: invites.value.length },
]);

async function loadData() {
  loading.value = true;
  try {
    const [orgRows, profile] = await Promise.all([
      listOrganizationsApi(),
      getOrganizationProfileApi().catch(() => ({ billing_email: '' })),
    ]);
    organizations.value = orgRows;
    billingEmail.value = profile.billing_email || '';

    const current = orgRows.find((item) => item.is_current);
    if (!current) {
      members.value = [];
      invites.value = [];
      usage.value = null;
      return;
    }

    const [memberRows, inviteRows, usageRow] = await Promise.allSettled([
      listMembersApi(),
      listInvitesApi(),
      listOrganizationUsageApi(current.slug),
    ]);
    members.value = memberRows.status === 'fulfilled' ? memberRows.value : [];
    invites.value = inviteRows.status === 'fulfilled' ? inviteRows.value : [];
    usage.value = usageRow.status === 'fulfilled' ? usageRow.value : null;
  } finally {
    loading.value = false;
  }
}

async function selectOrg(record: OrganizationRow) {
  await selectOrganizationApi(record.slug);
  message.success(`已切换到 ${record.name}`);
  await loadData();
}

async function searchAvailableMembers(keyword: string) {
  const q = keyword.trim();
  searchableMembers.value = q.length >= 3 ? await searchMembersApi(q) : [];
}

async function addMember() {
  if (!selectedUserId.value) return;
  await createMemberApi(selectedUserId.value, selectedUserIsOwner.value);
  selectedUserId.value = undefined;
  selectedUserIsOwner.value = false;
  searchableMembers.value = [];
  message.success('成员已添加');
  await loadData();
}

async function toggleOwner(member: MemberRow) {
  await patchMemberApi(member.pk, !member.is_owner);
  message.success(member.is_owner ? '已取消 owner' : '已设为 owner');
  await loadData();
}

async function removeMember(member: MemberRow) {
  await deleteMemberApi(member.pk);
  message.success('成员已移除');
  await loadData();
}

async function createInvite() {
  const email = inviteEmail.value.trim();
  if (!email) return;
  await createInviteApi({ invitee_email: email, is_owner: inviteOwner.value });
  inviteEmail.value = '';
  inviteOwner.value = false;
  message.success('邀请已发送');
  await loadData();
}

async function resendInvite(record: InviteRow) {
  await resendInviteApi(record.pk);
  message.success('邀请已重新发送');
}

async function removeInvite(record: InviteRow) {
  await deleteInviteApi(record.pk);
  message.success('邀请已取消');
  await loadData();
}

async function saveBillingEmail() {
  await updateOrganizationProfileApi({ billing_email: billingEmail.value.trim() || null });
  message.success('租户资料已保存');
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

onMounted(loadData);
</script>

<template>
  <Page auto-content-height content-class="p-6" title="租户管理">
    <div class="flex flex-col gap-8">
      <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="item in orgStats" :key="item.label" :bordered="false" class="shadow-sm">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{{ item.label }}</div>
          <div class="mt-3 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">{{ item.value }}</div>
        </Card>
      </div>

      <Card :bordered="false" class="shadow-sm">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">当前租户资料</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">查看当前上下文、容量和基础资料，作为后续管理动作的入口。</div>
          </div>
        </div>

        <div class="mb-4 grid gap-4 md:grid-cols-3">
          <div>
            <div class="text-sm text-zinc-500 dark:text-zinc-400">当前租户</div>
            <div class="mt-3 text-base font-medium text-zinc-900 dark:text-zinc-100">
              {{ currentOrganization?.name || '未选择租户' }}
            </div>
          </div>
          <div>
            <div class="text-sm text-zinc-500 dark:text-zinc-400">成员 / 上限</div>
            <div class="mt-3 text-base font-medium text-zinc-900 dark:text-zinc-100">
              {{ usage?.member_count ?? 0 }} / {{ usage?.member_limit ?? '不限' }}
            </div>
          </div>
          <div>
            <div class="text-sm text-zinc-500 dark:text-zinc-400">团队 / 上限</div>
            <div class="mt-3 text-base font-medium text-zinc-900 dark:text-zinc-100">
              {{ usage?.team_count ?? 0 }} / {{ usage?.team_limit ?? '不限' }}
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <Input
            v-model:value="billingEmail"
            class="w-full max-w-md"
            placeholder="账单邮箱"
          />
          <Button type="primary" @click="saveBillingEmail">保存资料</Button>
        </div>
      </Card>

      <Card :bordered="false" class="shadow-sm">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">租户列表</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">切换当前操作上下文，决定下方成员、邀请和容量数据。</div>
          </div>
        </div>

        <Table
          :columns="[
            { dataIndex: 'name', title: '名称' },
            { dataIndex: 'slug', title: 'Slug' },
            { dataIndex: 'state', title: '状态' },
            { dataIndex: 'actions', title: '操作', width: 120 },
          ]"
          :data-source="organizations"
          :loading
          :locale="{ emptyText: '没有可切换的租户' }"
          row-key="id"
        >
          <template #emptyText>
            <Empty description="还没有可切换的租户" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'state'">
              <Space>
                <Tag v-if="record.is_current" color="blue">当前</Tag>
                <Tag v-if="record.is_primary" color="green">主租户</Tag>
              </Space>
            </template>
            <template v-if="column.dataIndex === 'actions'">
              <Button
                :disabled="record.is_current"
                size="small"
                type="primary"
                @click="selectOrg(record)"
              >
                切换
              </Button>
            </template>
          </template>
        </Table>
      </Card>

      <Card :bordered="false" class="shadow-sm">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">当前租户成员</div>
            <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">维护成员和 owner 关系，决定后台可见范围和租户控制权。</div>
          </div>
        </div>

        <div class="mb-4 flex flex-wrap items-center gap-3">
          <Select
            v-model:value="selectedUserId"
            show-search
            class="min-w-80 flex-1"
            placeholder="搜索并添加成员（至少 3 个字符）"
            :filter-option="false"
            :options="
              searchableMembers.map((item) => ({
                label: `${item.first_name || item.username} (${item.email || item.username})`,
                value: item.pk,
              }))
            "
            @search="searchAvailableMembers"
          />
          <Checkbox v-model:checked="selectedUserIsOwner">设为 owner</Checkbox>
          <Button type="primary" @click="addMember">添加成员</Button>
        </div>

        <Table
          :columns="[
            { dataIndex: ['user', 'username'], title: '用户名' },
            { dataIndex: 'email', title: '邮箱' },
            { dataIndex: 'is_owner', title: 'Owner' },
            { dataIndex: 'actions', title: '操作', width: 180 },
          ]"
          :data-source="members"
          :loading
          :locale="{ emptyText: currentOrganization ? '当前租户还没有成员' : '请先选择租户' }"
          row-key="pk"
        >
          <template #emptyText>
            <Empty :description="currentOrganization ? '当前租户还没有成员' : '请先选择租户'" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'email'">
              {{ record.user?.email || '-' }}
            </template>
            <template v-if="column.dataIndex === 'is_owner'">
              <Tag :color="record.is_owner ? 'green' : 'default'">
                {{ record.is_owner ? '是' : '否' }}
              </Tag>
            </template>
            <template v-if="column.dataIndex === 'actions'">
              <Space>
                <Button
                  size="small"
                  @click="
                    confirmAction({
                      title: record.is_owner ? '确认取消 Owner' : '确认设为 Owner',
                      content: record.is_owner
                        ? `${record.user?.username || '该成员'} 将失去当前租户的 owner 权限。`
                        : `${record.user?.username || '该成员'} 将获得当前租户的 owner 权限。`,
                      okText: record.is_owner ? '确认取消' : '确认设为 Owner',
                      onOk: () => toggleOwner(record),
                    })
                  "
                >
                  {{ record.is_owner ? '取消 Owner' : '设为 Owner' }}
                </Button>
                <Button
                  danger
                  size="small"
                  @click="
                    confirmAction({
                      title: '确认移除成员',
                      content: `移除后，${record.user?.username || '该成员'} 将失去当前租户访问权限。`,
                      okText: '确认移除',
                      onOk: () => removeMember(record),
                    })
                  "
                >
                  移除
                </Button>
              </Space>
            </template>
          </template>
        </Table>
      </Card>

      <Card :bordered="false" class="shadow-sm">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">邀请记录</div>
            <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">通过邀请补充新成员，并在加入时直接指定 owner 身份。</div>
          </div>
        </div>

        <div class="mb-4 flex flex-wrap items-center gap-3">
          <Input
            v-model:value="inviteEmail"
            class="w-full max-w-md"
            placeholder="邀请邮箱"
            @press-enter="createInvite"
          />
          <Checkbox v-model:checked="inviteOwner">加入后设为 owner</Checkbox>
          <Button type="primary" @click="createInvite">发送邀请</Button>
        </div>

        <Table
          :columns="[
            { dataIndex: 'invitee_email', title: '邮箱' },
            { dataIndex: 'is_owner', title: 'Owner' },
            { dataIndex: 'created_at', title: '创建时间' },
            { dataIndex: 'actions', title: '操作', width: 180 },
          ]"
          :data-source="invites"
          :loading
          :locale="{ emptyText: currentOrganization ? '当前没有待处理邀请' : '请先选择租户' }"
          row-key="pk"
        >
          <template #emptyText>
            <Empty :description="currentOrganization ? '当前没有待处理邀请' : '请先选择租户'" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'is_owner'">
              <Tag :color="record.is_owner ? 'green' : 'default'">
                {{ record.is_owner ? '是' : '否' }}
              </Tag>
            </template>
            <template v-if="column.dataIndex === 'actions'">
              <Space>
                <Button size="small" @click="resendInvite(record)">重发</Button>
                <Button
                  danger
                  size="small"
                  @click="
                    confirmAction({
                      title: '确认取消邀请',
                      content: `取消后，发往 ${record.invitee_email} 的邀请将失效。`,
                      okText: '确认取消',
                      onOk: () => removeInvite(record),
                    })
                  "
                >
                  取消
                </Button>
              </Space>
            </template>
          </template>
        </Table>
      </Card>
    </div>
  </Page>
</template>
