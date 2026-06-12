<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Checkbox, Empty, Input, message, Modal, Select, Space, Table, Tag } from 'antdv-next';

import { getAppContextApi, type DjangoAppContext } from '#/api/django/context';

import {
  createOrganizationApi,
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
  setPrimaryOrganizationApi,
  signoutOrganizationApi,
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
const createOrgName = ref('');
const createOrgSlug = ref('');
const slugManuallyEdited = ref(false);
const createOrgSubmitting = ref(false);
const context = ref<DjangoAppContext | null>(null);
const usage = ref<null | {
  member_count: number;
  member_limit: null | number;
  team_count: number;
  team_limit: null | number;
}>(null);

watch(createOrgName, (value) => {
  if (slugManuallyEdited.value) return;
  createOrgSlug.value = value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
});

const currentOrganization = computed(
  () => organizations.value.find((item) => item.is_current) ?? null,
);
const currentOrgIsOwner = computed(() => !!context.value?.org?.is_owner);
const hasCurrentOrganization = computed(() => !!context.value?.org);
const orgStats = computed(() => [
  { label: '可切换租户', value: organizations.value.length },
  { label: '当前成员', value: hasCurrentOrganization.value ? (usage.value?.member_count ?? members.value.length) : 0 },
  { label: '当前团队', value: hasCurrentOrganization.value ? (usage.value?.team_count ?? 0) : 0 },
  { label: '待处理邀请', value: invites.value.length },
]);

async function loadData() {
  loading.value = true;
  try {
    const [appContext, orgRows, profile] = await Promise.all([
      getAppContextApi(),
      listOrganizationsApi(),
      getOrganizationProfileApi().catch(() => ({ billing_email: '' })),
    ]);
    context.value = appContext;
    organizations.value = orgRows;
    billingEmail.value = profile.billing_email || '';

    const current = appContext.org ?? orgRows.find((item) => item.is_current);
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

async function signoutOrg() {
  await signoutOrganizationApi();
  message.success('已切换到个人空间');
  await loadData();
}

async function togglePrimary(record: OrganizationRow) {
  const result = await setPrimaryOrganizationApi(record.slug);
  message.success(result.is_primary ? `已将 ${record.name} 设为主租户` : `已取消 ${record.name} 的主租户标记`);
  await loadData();
}

async function createOrganization() {
  const name = createOrgName.value.trim();
  const slug = createOrgSlug.value.trim();
  if (!name || !slug) return;

  createOrgSubmitting.value = true;
  try {
    const org = await createOrganizationApi({ name, slug });
    createOrgName.value = '';
    createOrgSlug.value = '';
    slugManuallyEdited.value = false;
    message.success(`${org.name} 已创建，并已切换为当前租户`);
    await loadData();
  } finally {
    createOrgSubmitting.value = false;
  }
}

async function searchAvailableMembers(keyword: string) {
  const q = keyword.trim();
  searchableMembers.value = q.length >= 3 ? await searchMembersApi(q) : [];
}

async function addMember() {
  if (!selectedUserId.value || !currentOrgIsOwner.value) return;
  await createMemberApi(selectedUserId.value, selectedUserIsOwner.value);
  selectedUserId.value = undefined;
  selectedUserIsOwner.value = false;
  searchableMembers.value = [];
  message.success('成员已添加');
  await loadData();
}

async function toggleOwner(member: MemberRow) {
  if (!currentOrgIsOwner.value) return;
  await patchMemberApi(member.pk, !member.is_owner);
  message.success(member.is_owner ? '已取消 owner' : '已设为 owner');
  await loadData();
}

async function removeMember(member: MemberRow) {
  if (!currentOrgIsOwner.value) return;
  await deleteMemberApi(member.pk);
  message.success('成员已移除');
  await loadData();
}

async function createInvite() {
  if (!currentOrgIsOwner.value) return;
  const email = inviteEmail.value.trim();
  if (!email) return;
  await createInviteApi({ invitee_email: email, is_owner: inviteOwner.value });
  inviteEmail.value = '';
  inviteOwner.value = false;
  message.success('邀请已发送');
  await loadData();
}

async function resendInvite(record: InviteRow) {
  if (!currentOrgIsOwner.value) return;
  await resendInviteApi(record.pk);
  message.success('邀请已重新发送');
}

async function removeInvite(record: InviteRow) {
  if (!currentOrgIsOwner.value) return;
  await deleteInviteApi(record.pk);
  message.success('邀请已取消');
  await loadData();
}

async function saveBillingEmail() {
  if (!currentOrgIsOwner.value) return;
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
  <Page auto-content-height content-class="p-4 sm:p-6" title="租户工作台">
    <div class="flex flex-col gap-6 sm:gap-8">
      <div class="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="item in orgStats" :key="item.label" class="shadow-sm" variant="borderless">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{{ item.label }}</div>
          <div class="mt-3 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">{{ item.value }}</div>
        </Card>
      </div>

      <Card class="shadow-sm" variant="borderless">
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">个人空间与租户入口</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              在这里切换个人空间与租户空间，也可以创建新的租户。
            </div>
            <div class="mt-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div class="text-sm text-zinc-500 dark:text-zinc-400">当前空间</div>
              <div class="mt-3 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                {{ currentOrganization?.name || '个人空间' }}
              </div>
              <div class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {{ hasCurrentOrganization ? '成员、团队和邀请管理都会基于当前租户执行。' : '当前处于个人空间，可随时切换或创建新的租户。' }}
              </div>
              <div class="mt-4 flex flex-wrap gap-3">
                <Button :disabled="!hasCurrentOrganization" @click="signoutOrg">切到个人空间</Button>
                <Tag v-if="currentOrgIsOwner" color="gold">当前身份：Owner</Tag>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700">
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">创建新租户</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">创建后会自动切换到新租户，并把你设为 owner 与主租户。</div>
            <div class="mt-5 space-y-4">
              <div>
                <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">租户名称</div>
                <Input v-model:value="createOrgName" placeholder="例如：LinkCloud Studio" />
              </div>
              <div>
                <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">租户标识</div>
                <Input v-model:value="createOrgSlug" placeholder="例如：linkcloud-studio" @input="slugManuallyEdited = true" />
              </div>
              <Button :loading="createOrgSubmitting" block type="primary" @click="createOrganization">创建并切换</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card class="shadow-sm" variant="borderless">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">当前租户资料</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">查看当前租户的基础资料与容量使用情况。</div>
          </div>
          <Tag :color="currentOrgIsOwner ? 'green' : 'default'">{{ currentOrgIsOwner ? '可管理当前租户' : '当前为成员视角' }}</Tag>
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
            :disabled="!currentOrgIsOwner"
            placeholder="账单邮箱"
          />
          <Button :disabled="!currentOrgIsOwner" type="primary" @click="saveBillingEmail">保存资料</Button>
        </div>
      </Card>

      <Card class="shadow-sm" variant="borderless">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">租户列表</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">切换当前操作的租户，查看对应的成员、邀请和容量数据。</div>
          </div>
        </div>

        <Table
          :columns="[
            { dataIndex: 'name', title: '名称' },
            { dataIndex: 'slug', title: 'Slug' },
            { dataIndex: 'state', title: '状态' },
            { dataIndex: 'actions', title: '操作', width: 220 },
          ]"
          :data-source="organizations"
          :loading
          :locale="{ emptyText: '没有可切换的租户' }"
          :scroll="{ x: 720 }"
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
              <Space>
                <Button
                  :disabled="record.is_current"
                  size="small"
                  type="primary"
                  @click="selectOrg(record)"
                >
                  切换
                </Button>
                <Button size="small" @click="togglePrimary(record)">
                  {{ record.is_primary ? '取消主租户' : '设为主租户' }}
                </Button>
              </Space>
            </template>
          </template>
        </Table>
      </Card>

      <Card class="shadow-sm" variant="borderless">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">当前租户成员</div>
            <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">维护成员和 owner 关系，决定后台可见范围和租户控制权。</div>
          </div>
          <Tag :color="currentOrgIsOwner ? 'green' : 'default'">{{ currentOrgIsOwner ? 'Owner 可编辑' : '仅 Owner 可编辑' }}</Tag>
        </div>

        <div class="mb-4 flex flex-wrap items-center gap-3">
          <Select
            v-model:value="selectedUserId"
            :disabled="!currentOrgIsOwner"
            show-search
            class="w-full sm:min-w-80 sm:flex-1"
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
          <Checkbox v-model:checked="selectedUserIsOwner" :disabled="!currentOrgIsOwner">设为 owner</Checkbox>
          <Button class="w-full sm:w-auto" :disabled="!currentOrgIsOwner" type="primary" @click="addMember">添加成员</Button>
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
          :scroll="{ x: 760 }"
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
                  :disabled="!currentOrgIsOwner"
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
                  :disabled="!currentOrgIsOwner"
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

      <Card class="shadow-sm" variant="borderless">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">邀请记录</div>
            <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">通过邀请补充新成员，并在加入时直接指定 owner 身份。</div>
          </div>
          <Tag :color="currentOrgIsOwner ? 'green' : 'default'">{{ currentOrgIsOwner ? 'Owner 可发送邀请' : '当前仅可查看' }}</Tag>
        </div>

        <div class="mb-4 flex flex-wrap items-center gap-3">
          <Input
            v-model:value="inviteEmail"
            :disabled="!currentOrgIsOwner"
            class="w-full sm:max-w-md"
            placeholder="邀请邮箱"
            @press-enter="createInvite"
          />
          <Checkbox v-model:checked="inviteOwner" :disabled="!currentOrgIsOwner">加入后设为 owner</Checkbox>
          <Button class="w-full sm:w-auto" :disabled="!currentOrgIsOwner" type="primary" @click="createInvite">发送邀请</Button>
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
          :scroll="{ x: 720 }"
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
                <Button :disabled="!currentOrgIsOwner" size="small" @click="resendInvite(record)">重发</Button>
                <Button
                  :disabled="!currentOrgIsOwner"
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
