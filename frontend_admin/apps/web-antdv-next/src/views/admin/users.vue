<script lang="ts" setup>
import type { UserRow } from '#/api/django/resources';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  Form,
  FormItem,
  Input,
  InputPassword,
  InputSearch,
  message,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
} from 'antdv-next';

import {
  createAdminUserApi,
  forceLogoutUserApi,
  listAdminUsersApi,
  patchUserStatusApi,
  resetUserMfaApi,
  setAdminUserPasswordApi,
  unbindUserPhoneApi,
  unbindUserWechatApi,
  updateAdminUserApi,
} from '#/api/django/resources';

interface UserFormState {
  email: string;
  first_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  last_name: string;
  password: string;
  phone: string;
  phone_verified: boolean;
  timezone: string;
  username: string;
}

const loading = ref(false);
const users = ref<UserRow[]>([]);
const keyword = ref('');
const editVisible = ref(false);
const passwordVisible = ref(false);
const saving = ref(false);
const passwordSaving = ref(false);
const editingUser = ref<null | UserRow>(null);

const formState = reactive<UserFormState>({
  email: '',
  first_name: '',
  is_active: true,
  is_staff: false,
  is_superuser: false,
  last_name: '',
  password: '',
  phone: '',
  phone_verified: false,
  timezone: 'Asia/Shanghai',
  username: '',
});

const passwordState = reactive({
  password: '',
});

const isCreateMode = computed(() => !editingUser.value);
const modalTitle = computed(() => (isCreateMode.value ? '新建用户' : '编辑用户'));
const userStats = computed(() => {
  const total = users.value.length;
  const active = users.value.filter((item) => item.is_active).length;
  const admins = users.value.filter((item) => item.is_staff || item.is_superuser).length;
  const verifiedPhones = users.value.filter((item) => item.phone_verified).length;
  const verifiedRealNames = users.value.filter((item) => item.real_name_status === 'verified').length;
  return [
    { label: '当前结果', value: total },
    { label: '启用账号', value: active },
    { label: '管理账号', value: admins },
    { label: '已验手机号', value: verifiedPhones },
    { label: '已实名账号', value: verifiedRealNames },
  ];
});

function resetForm() {
  formState.username = '';
  formState.email = '';
  formState.first_name = '';
  formState.last_name = '';
  formState.password = '';
  formState.phone = '';
  formState.phone_verified = false;
  formState.timezone = 'Asia/Shanghai';
  formState.is_active = true;
  formState.is_staff = false;
  formState.is_superuser = false;
}

function fillForm(user: UserRow) {
  formState.username = user.username;
  formState.email = user.email || '';
  formState.first_name = user.first_name || '';
  formState.last_name = user.last_name || '';
  formState.password = '';
  formState.phone = user.phone || '';
  formState.phone_verified = !!user.phone_verified;
  formState.timezone = user.timezone || 'Asia/Shanghai';
  formState.is_active = !!user.is_active;
  formState.is_staff = !!user.is_staff;
  formState.is_superuser = !!user.is_superuser;
}

async function loadData(q = keyword.value) {
  loading.value = true;
  try {
    users.value = await listAdminUsersApi(q);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingUser.value = null;
  resetForm();
  editVisible.value = true;
}

function openEdit(user: UserRow) {
  editingUser.value = user;
  fillForm(user);
  editVisible.value = true;
}

function openPassword(user: UserRow) {
  editingUser.value = user;
  passwordState.password = '';
  passwordVisible.value = true;
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

function getSensitiveUserChanges(user: UserRow, payload: Partial<UserFormState>) {
  const changes: string[] = [];
  if (user.is_active && payload.is_active === false) {
    changes.push('禁用账号');
  }
  if (!!user.is_staff !== !!payload.is_staff) {
    changes.push(payload.is_staff ? '授予管理员权限' : '移除管理员权限');
  }
  if (!!user.is_superuser !== !!payload.is_superuser) {
    changes.push(payload.is_superuser ? '授予超级管理员权限' : '移除超级管理员权限');
  }
  return changes;
}

async function submitUserDirect() {
  saving.value = true;
  try {
    const payload = {
      email: formState.email.trim(),
      first_name: formState.first_name.trim(),
      is_active: formState.is_active,
      is_staff: formState.is_staff,
      is_superuser: formState.is_superuser,
      last_name: formState.last_name.trim(),
      phone: formState.phone?.trim() || null,
      phone_verified: formState.phone_verified,
      timezone: formState.timezone.trim() || 'Asia/Shanghai',
      username: formState.username.trim(),
    };

    if (isCreateMode.value) {
      await createAdminUserApi({
        ...payload,
        password: formState.password,
      });
      message.success('用户已创建');
    } else if (editingUser.value) {
      await updateAdminUserApi(editingUser.value.id, payload);
      message.success('用户已更新');
    }
    editVisible.value = false;
    await loadData();
  } finally {
    saving.value = false;
  }
}

function submitUser() {
  if (!editingUser.value) {
    void submitUserDirect();
    return;
  }

  const sensitiveChanges = getSensitiveUserChanges(editingUser.value, formState);
  if (sensitiveChanges.length === 0) {
    void submitUserDirect();
    return;
  }

  confirmAction({
    title: '确认保存高权限变更',
    content: `本次会对 ${editingUser.value.username} 执行：${sensitiveChanges.join('、')}。`,
    okText: '确认保存',
    onOk: submitUserDirect,
  });
}

async function submitPasswordDirect() {
  if (!editingUser.value) return;
  passwordSaving.value = true;
  try {
    await setAdminUserPasswordApi(editingUser.value.id, passwordState.password);
    message.success('密码已更新');
    passwordVisible.value = false;
  } finally {
    passwordSaving.value = false;
  }
}

function submitPassword() {
  if (!editingUser.value) return;
  confirmAction({
    title: '确认设置密码',
    content: `这会立即替换 ${editingUser.value.username} 的登录密码。`,
    okText: '确认设置',
    onOk: submitPasswordDirect,
  });
}

type UserMoreActionKey = 'force_logout' | 'open_password' | 'reset_mfa' | 'unbind_phone' | 'unbind_wechat';

const userMoreActionItems = [
  { key: 'open_password', label: '设置密码' },
  { key: 'force_logout', label: '强制退出' },
  { key: 'reset_mfa', label: '重置 MFA' },
  { key: 'unbind_phone', label: '解绑手机号' },
  { key: 'unbind_wechat', label: '解绑微信' },
];

function handleMoreAction(user: UserRow, key: UserMoreActionKey) {
  if (key === 'open_password') {
    openPassword(user);
    return;
  }
  if (key === 'force_logout') {
    confirmAction({
      title: '确认强制退出',
      content: `这会立即让 ${user.username} 的当前登录会话失效。`,
      okText: '确认强退',
      onOk: () => forceLogout(user),
    });
    return;
  }
  if (key === 'reset_mfa') {
    confirmAction({
      title: '确认重置 MFA',
      content: `重置后，${user.username} 需要重新配置多因素认证。`,
      okText: '确认重置',
      onOk: () => resetMfa(user),
    });
    return;
  }
  if (key === 'unbind_phone') {
    confirmAction({
      title: '确认解绑手机号',
      content: `解绑后，${user.username} 将失去当前手机号绑定关系。`,
      okText: '确认解绑',
      onOk: () => unbindPhone(user),
    });
    return;
  }
  confirmAction({
    title: '确认解绑微信',
    content: `解绑后，${user.username} 将失去当前微信绑定关系。`,
    okText: '确认解绑',
    onOk: () => unbindWechat(user),
  });
}

async function forceLogout(user: UserRow) {
  await forceLogoutUserApi(user.id);
  message.success('已强制退出该用户会话');
}

async function resetMfa(user: UserRow) {
  await resetUserMfaApi(user.id);
  message.success('已重置 MFA');
}

async function toggleStatus(user: UserRow) {
  await patchUserStatusApi(user.id, !user.is_active);
  message.success(user.is_active ? '用户已禁用' : '用户已启用');
  await loadData();
}

async function unbindPhone(user: UserRow) {
  await unbindUserPhoneApi(user.id);
  message.success('手机号已解绑');
  await loadData();
}

async function unbindWechat(user: UserRow) {
  await unbindUserWechatApi(user.id);
  message.success('微信账号已解绑');
  await loadData();
}

onMounted(() => loadData());
</script>

<template>
  <Page auto-content-height content-class="p-6" title="用户管理">
    <div class="space-y-8">
      <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <Card v-for="item in userStats" :key="item.label" class="shadow-sm" size="small" variant="borderless">
          <div class="text-xs text-zinc-500">{{ item.label }}</div>
          <div class="mt-2 text-2xl font-semibold text-zinc-950">{{ item.value }}</div>
        </Card>
      </div>
      <Card class="shadow-sm" variant="borderless">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950">账号列表</div>
            <div class="mt-1 text-sm text-zinc-500">集中处理账号启停、凭证和基础身份信息。</div>
          </div>
          <Space>
            <InputSearch
              v-model:value="keyword"
              allow-clear
              class="w-72"
              placeholder="搜索用户名、邮箱或姓名"
              @search="loadData"
            />
            <Button @click="loadData()">刷新</Button>
            <Button type="primary" @click="openCreate">新建用户</Button>
          </Space>
        </div>
        <Table
          :columns="[
            { dataIndex: 'identity', title: '账号', width: 260 },
            { dataIndex: 'phone', title: '手机号', width: 170 },
            { dataIndex: 'real_name', title: '实名信息', width: 210 },
            { dataIndex: 'status', title: '状态', width: 110 },
            { dataIndex: 'roles', title: '角色', width: 190 },
            { dataIndex: 'actions', title: '操作', width: 240, fixed: 'right' },
          ]"
          :data-source="users"
          :loading="loading"
          :locale="{ emptyText: '没有匹配的用户' }"
          :pagination="{ pageSize: 10, showSizeChanger: false }"
          :scroll="{ x: 1320 }"
          row-key="id"
        >
          <template #emptyText>
            <Empty description="还没有可展示的后台用户" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'identity'">
              <div class="flex items-center gap-3">
                <Avatar :src="record.avatar_url || undefined" class="shrink-0">
                  {{ (record.first_name || record.username || '?').slice(0, 1).toUpperCase() }}
                </Avatar>
                <div class="min-w-0">
                  <div class="truncate font-medium text-zinc-950">
                    {{ [record.first_name, record.last_name].filter(Boolean).join(' ') || record.username }}
                  </div>
                  <div class="truncate text-sm text-zinc-500">{{ record.email || record.username }}</div>
                  <div class="truncate text-xs text-zinc-400">@{{ record.username }}</div>
                </div>
              </div>
            </template>
            <template v-if="column.dataIndex === 'phone'">
              <div class="space-y-1">
                <div>{{ record.phone || '-' }}</div>
                <Tag v-if="record.phone_verified" color="green">已验证</Tag>
              </div>
            </template>
            <template v-if="column.dataIndex === 'real_name'">
              <div class="space-y-1">
                <div class="font-medium text-zinc-900">{{ record.real_name_masked || '-' }}</div>
                <div class="text-xs text-zinc-500">{{ record.id_number_masked || '未录入身份证号' }}</div>
                <Tag
                  :color="
                    record.real_name_status === 'verified'
                      ? 'green'
                      : record.real_name_status === 'manual_review'
                        ? 'orange'
                        : record.real_name_status === 'rejected'
                          ? 'red'
                          : 'default'
                  "
                >
                  {{
                    record.real_name_status === 'verified'
                      ? '已实名'
                      : record.real_name_status === 'manual_review'
                        ? '人工复核'
                        : record.real_name_status === 'rejected'
                          ? '已驳回'
                          : record.real_name_status === 'revoked'
                            ? '已撤销'
                            : '未实名'
                  }}
                </Tag>
              </div>
            </template>
            <template v-if="column.dataIndex === 'status'">
              <Tag :color="record.is_active ? 'green' : 'red'">
                {{ record.is_active ? '启用' : '禁用' }}
              </Tag>
            </template>
            <template v-if="column.dataIndex === 'roles'">
              <Space wrap>
                <Tag v-if="record.is_superuser" color="purple">超级管理员</Tag>
                <Tag v-if="record.is_staff" color="blue">管理员</Tag>
                <Tag v-if="!record.is_staff && !record.is_superuser">普通用户</Tag>
              </Space>
            </template>
            <template v-if="column.dataIndex === 'actions'">
              <Space>
                <Button size="small" type="primary" @click="openEdit(record)">编辑</Button>
                <Button
                  size="small"
                  @click="
                    record.is_active
                      ? confirmAction({
                          title: '确认禁用用户',
                          content: `禁用后，${record.username} 将无法继续登录后台。`,
                          okText: '确认禁用',
                          onOk: () => toggleStatus(record),
                        })
                      : toggleStatus(record)
                  "
                >
                  {{ record.is_active ? '禁用' : '启用' }}
                </Button>
                <Dropdown
                  :menu="{
                    items: userMoreActionItems,
                    onClick: ({ key }) => handleMoreAction(record, key as UserMoreActionKey),
                  }"
                >
                  <template #default>
                    <Button size="small">更多</Button>
                  </template>
                </Dropdown>
              </Space>
            </template>
          </template>
        </Table>
      </Card>
    </div>

    <Modal
      v-model:open="editVisible"
      :confirm-loading="saving"
      :title="modalTitle"
      :width="760"
      destroy-on-close
      @ok="submitUser"
    >
      <Form layout="vertical">
        <FormItem label="用户名" required>
          <Input v-model:value="formState.username" placeholder="用户名" />
        </FormItem>
        <FormItem label="邮箱" required>
          <Input v-model:value="formState.email" placeholder="邮箱" />
        </FormItem>
        <FormItem v-if="isCreateMode" label="初始密码" required>
          <InputPassword v-model:value="formState.password" placeholder="至少 8 位" />
        </FormItem>
        <div class="grid grid-cols-2 gap-3">
          <FormItem label="名字">
            <Input v-model:value="formState.first_name" placeholder="名字" />
          </FormItem>
          <FormItem label="姓氏">
            <Input v-model:value="formState.last_name" placeholder="姓氏" />
          </FormItem>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <FormItem label="手机号">
            <Input v-model:value="formState.phone" placeholder="+8613800000000" />
          </FormItem>
          <FormItem label="时区">
            <Input v-model:value="formState.timezone" placeholder="Asia/Shanghai" />
          </FormItem>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <FormItem label="启用">
            <Switch v-model:checked="formState.is_active" />
          </FormItem>
          <FormItem label="手机号已验证">
            <Switch v-model:checked="formState.phone_verified" />
          </FormItem>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <FormItem label="管理员">
            <Switch v-model:checked="formState.is_staff" />
          </FormItem>
          <FormItem label="超级管理员">
            <Switch v-model:checked="formState.is_superuser" />
          </FormItem>
        </div>
      </Form>
    </Modal>

    <Modal
      v-model:open="passwordVisible"
      :confirm-loading="passwordSaving"
      :width="520"
      destroy-on-close
      title="设置密码"
      @ok="submitPassword"
    >
      <Form layout="vertical">
        <FormItem label="新密码" required>
          <InputPassword v-model:value="passwordState.password" placeholder="至少 8 位" />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
