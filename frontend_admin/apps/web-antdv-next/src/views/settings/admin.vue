<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Empty, Input, InputNumber, Modal, Select, Switch, Table, Tag } from 'antdv-next';

import { getAppContextApi } from '#/api/django/context';
import {
  listNotificationPreferencesApi,
  listOrgSettingsApi,
  listUserSettingsApi,
  type NotificationPreferenceRow,
  resetOrgSettingApi,
  type SettingRow,
  updateNotificationPreferenceApi,
  updateOrgSettingApi,
  updateUserSettingApi,
} from '#/api/django/resources';

const loading = ref(false);
const orgSettings = ref<SettingRow[]>([]);
const userSettings = ref<SettingRow[]>([]);
const notificationPreferences = ref<NotificationPreferenceRow[]>([]);
const settingDrafts = ref<Record<string, string>>({});
const userDrafts = ref<Record<string, string>>({});
const hasActiveOrganization = ref(false);
const activeOrganizationName = ref('');

type SettingDomainKey = 'notifications' | 'org' | 'user';
type SettingValueKind = 'boolean' | 'json' | 'number' | 'text';
type SettingValueType = 'boolean' | 'integer' | 'json' | 'password' | 'text';
interface SettingDomainMeta {
  count: number;
  description: string;
  key: SettingDomainKey;
  label: string;
}

const activeDomain = ref<SettingDomainKey>('org');

const settingsSummary = computed(() => ({
  customizedOrgSettings: orgSettings.value.filter((item) => item.is_customized).length,
  notificationCategories: notificationPreferences.value.length,
  orgSettings: orgSettings.value.length,
  userSettings: userSettings.value.length,
}));

const maskedPasswordValue = '********';

const defaultDomainMeta: SettingDomainMeta = {
  count: 0,
  description: '管理当前租户共享生效的系统级配置，适合承载组织范围的默认规则。',
  key: 'org',
  label: '租户设置',
};

const settingDomains = computed<SettingDomainMeta[]>(() => [
  {
    count: settingsSummary.value.orgSettings,
    description: '管理当前租户共享生效的系统级配置，适合承载组织范围的默认规则。',
    key: 'org',
    label: '租户设置',
  },
  {
    count: settingsSummary.value.userSettings,
    description: '管理当前管理员自己的使用偏好，只改变个人工作台体验。',
    key: 'user',
    label: '个人设置',
  },
  {
    count: settingsSummary.value.notificationCategories,
    description: '管理通知分类触达渠道，配合 Vben 顶栏通知入口使用。',
    key: 'notifications',
    label: '通知偏好',
  },
]);

const activeDomainMeta = computed<SettingDomainMeta>(
  () => settingDomains.value.find((item) => item.key === activeDomain.value) ?? defaultDomainMeta,
);

function formatSettingValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function inferSettingValueKind(raw: string): SettingValueKind {
  const value = raw.trim();
  if (value === 'true' || value === 'false') return 'boolean';
  if (value !== '' && Number.isFinite(Number(value))) return 'number';
  if (
    (value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('[') && value.endsWith(']'))
  ) {
    try {
      JSON.parse(value);
      return 'json';
    } catch {
      return 'text';
    }
  }
  return 'text';
}

function settingValueKind(record: SettingRow): SettingValueKind {
  const valueType = record.value_type as SettingValueType | undefined;
  if (valueType === 'boolean') return 'boolean';
  if (valueType === 'integer') return 'number';
  if (valueType === 'json') return 'json';
  return 'text';
}

function userSettingValueKind(raw: string): SettingValueKind {
  return inferSettingValueKind(raw);
}

function settingImpactLabel(domain: SettingDomainKey) {
  const labels: Record<SettingDomainKey, string> = {
    notifications: '影响通知触达',
    org: '影响当前租户',
    user: '仅影响当前管理员',
  };
  return labels[domain];
}

function parseSettingValue(raw: string, valueType?: string) {
  const value = raw.trim();
  if (!value) return '';
  if (valueType === 'boolean') return value === 'true';
  if (valueType === 'integer') return Number(value);
  if (valueType === 'text' || valueType === 'password') return raw;
  try {
    return JSON.parse(value);
  } catch {
    return raw;
  }
}

async function loadData() {
  loading.value = true;
  try {
    const context = await getAppContextApi().catch(() => null);
    hasActiveOrganization.value = !!context?.org;
    activeOrganizationName.value = context?.org?.name || '';
    const [orgRows, userRows, notificationRows] = await Promise.allSettled([
      context?.org ? listOrgSettingsApi() : Promise.resolve([]),
      listUserSettingsApi(),
      listNotificationPreferencesApi(),
    ]);
    orgSettings.value = orgRows.status === 'fulfilled' ? orgRows.value : [];
    userSettings.value = userRows.status === 'fulfilled' ? userRows.value : [];
    notificationPreferences.value =
      notificationRows.status === 'fulfilled' ? notificationRows.value : [];
    settingDrafts.value = Object.fromEntries(
      orgSettings.value.map((item) => [item.key, formatSettingValue(item.value)]),
    );
    userDrafts.value = Object.fromEntries(
      userSettings.value.map((item) => [item.key, formatSettingValue(item.value)]),
    );
  } finally {
    loading.value = false;
  }
}

async function saveOrgSetting(record: SettingRow) {
  if (isMaskedPasswordDraft(record)) return;
  await updateOrgSettingApi(record.key, parseSettingValue(settingDrafts.value[record.key] || '', record.value_type));
  await loadData();
}

async function resetOrgSetting(record: SettingRow) {
  await resetOrgSettingApi(record.key);
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

async function saveUserSetting(record: SettingRow) {
  await updateUserSettingApi(record.key, parseSettingValue(userDrafts.value[record.key] || ''));
  await loadData();
}

async function togglePreference(record: NotificationPreferenceRow, field: 'email' | 'in_app', checked: boolean) {
  await updateNotificationPreferenceApi(record.key, { [field]: checked });
  record[field] = checked;
}

function updateNumberDraft(drafts: Record<string, string>, key: string, value: null | number | string) {
  drafts[key] = value === null || value === undefined ? '' : String(value);
}

function isMaskedPasswordDraft(record: SettingRow) {
  return record.value_type === 'password' && settingDrafts.value[record.key] === maskedPasswordValue;
}

onMounted(loadData);
</script>

<template>
  <Page auto-content-height content-class="p-6" title="系统设置">
    <div class="flex flex-col gap-8">
      <Card :bordered="false" class="shadow-sm">
        <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-lg font-semibold text-zinc-950 dark:text-zinc-50">配置中心</div>
            <div class="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
              按业务域维护后台配置，先选择配置范围，再调整具体值，避免租户级、个人级和通知触达规则混在同一张 Key/Value 表里。
            </div>
          </div>
          <Tag :color="hasActiveOrganization ? 'blue' : 'default'">
            {{ hasActiveOrganization ? `当前租户：${activeOrganizationName || '已加载'}` : '未选择租户' }}
          </Tag>
        </div>

        <div class="grid gap-3 md:grid-cols-3">
          <button
            v-for="domain in settingDomains"
            :key="domain.key"
            :aria-pressed="activeDomain === domain.key"
            class="rounded-md border px-4 py-3 text-left transition"
            :class="
              activeDomain === domain.key
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-blue-300 hover:text-blue-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-blue-700 dark:hover:text-blue-300'
            "
            type="button"
            @click="activeDomain = domain.key"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-semibold">{{ domain.label }}</span>
              <Tag :color="activeDomain === domain.key ? 'blue' : 'default'">{{ domain.count }} 项</Tag>
            </div>
            <div class="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{{ domain.description }}</div>
          </button>
        </div>
      </Card>

      <Card v-if="activeDomain === 'org'" :bordered="false" class="shadow-sm">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">租户设置</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{{ activeDomainMeta.description }}</div>
          </div>
          <Tag color="blue">已覆盖 {{ settingsSummary.customizedOrgSettings }} 项</Tag>
        </div>
        <Alert
          v-if="!hasActiveOrganization"
          class="mb-4"
          message="请先选择一个当前租户，再查看和维护租户级设置。"
          show-icon
          type="warning"
        />
        <Table
          :columns="[
            { dataIndex: 'key', title: '配置项', width: 180 },
            { dataIndex: 'value', title: '当前值' },
            { dataIndex: 'is_customized', title: '来源', width: 100 },
            { dataIndex: 'impact', title: '影响范围', width: 150 },
            { dataIndex: 'description', title: '说明' },
            { dataIndex: 'actions', title: '操作', width: 220 },
          ]"
          :data-source="orgSettings"
          :loading
          :pagination="{ pageSize: 8, showSizeChanger: false }"
          :scroll="{ x: 1100 }"
          row-key="key"
        >
          <template #emptyText>
            <Empty :description="hasActiveOrganization ? '当前租户没有可配置项。' : '请先选择一个当前租户，再查看租户级设置。'" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'value'">
              <Select
                v-if="settingValueKind(record) === 'boolean'"
                v-model:value="settingDrafts[record.key]"
                class="w-full"
                :options="[
                  { label: '开启', value: 'true' },
                  { label: '关闭', value: 'false' },
                ]"
              />
              <InputNumber
                v-else-if="settingValueKind(record) === 'number'"
                class="w-full"
                :value="Number(settingDrafts[record.key])"
                @change="(value: null | number | string) => updateNumberDraft(settingDrafts, record.key, value)"
              />
              <Input.TextArea
                v-else-if="settingValueKind(record) === 'json'"
                v-model:value="settingDrafts[record.key]"
                :auto-size="{ minRows: 2, maxRows: 5 }"
              />
              <Input.Password
                v-else-if="record.value_type === 'password'"
                v-model:value="settingDrafts[record.key]"
                autocomplete="new-password"
                placeholder="保持掩码不保存；输入新值后再保存"
              />
              <Input v-else v-model:value="settingDrafts[record.key]" />
            </template>
            <template v-else-if="column.dataIndex === 'is_customized'">
              <Tag :color="record.is_customized ? 'blue' : 'default'">
                {{ record.is_customized ? '已覆盖' : '默认' }}
              </Tag>
            </template>
            <template v-else-if="column.dataIndex === 'impact'">
              <Tag color="purple">{{ settingImpactLabel('org') }}</Tag>
            </template>
            <template v-else-if="column.dataIndex === 'actions'">
              <div class="flex gap-2">
                <Button
                  :disabled="isMaskedPasswordDraft(record)"
                  size="small"
                  type="primary"
                  @click="saveOrgSetting(record)"
                >
                  保存
                </Button>
                <Button
                  :disabled="!record.is_customized"
                  size="small"
                  @click="
                    confirmAction({
                      title: '确认恢复默认',
                      content: `恢复后，租户设置 ${record.key} 的自定义值会被移除，并重新使用默认配置。`,
                      okText: '确认恢复',
                      onOk: () => resetOrgSetting(record),
                    })
                  "
                >
                  恢复默认
                </Button>
              </div>
            </template>
          </template>
        </Table>
      </Card>

      <Card v-if="activeDomain === 'user'" :bordered="false" class="shadow-sm">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">个人设置</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{{ activeDomainMeta.description }}</div>
          </div>
          <Tag color="blue">{{ settingsSummary.userSettings }} 项</Tag>
        </div>
        <Table
          :columns="[
            { dataIndex: 'key', title: '配置项', width: 180 },
            { dataIndex: 'value', title: '当前值' },
            { dataIndex: 'impact', title: '影响范围', width: 160 },
            { dataIndex: 'actions', title: '操作', width: 120 },
          ]"
          :data-source="userSettings"
          :loading
          :pagination="{ pageSize: 8, showSizeChanger: false }"
          :scroll="{ x: 900 }"
          row-key="key"
        >
          <template #emptyText>
            <Empty description="当前没有个人设置项。" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'value'">
              <Select
                v-if="userSettingValueKind(userDrafts[record.key] || '') === 'boolean'"
                v-model:value="userDrafts[record.key]"
                class="w-full"
                :options="[
                  { label: '开启', value: 'true' },
                  { label: '关闭', value: 'false' },
                ]"
              />
              <InputNumber
                v-else-if="userSettingValueKind(userDrafts[record.key] || '') === 'number'"
                class="w-full"
                :value="Number(userDrafts[record.key])"
                @change="(value: null | number | string) => updateNumberDraft(userDrafts, record.key, value)"
              />
              <Input.TextArea
                v-else-if="userSettingValueKind(userDrafts[record.key] || '') === 'json'"
                v-model:value="userDrafts[record.key]"
                :auto-size="{ minRows: 2, maxRows: 5 }"
              />
              <Input v-else v-model:value="userDrafts[record.key]" />
            </template>
            <template v-else-if="column.dataIndex === 'impact'">
              <Tag color="green">{{ settingImpactLabel('user') }}</Tag>
            </template>
            <template v-else-if="column.dataIndex === 'actions'">
              <Button size="small" type="primary" @click="saveUserSetting(record)">
                保存
              </Button>
            </template>
          </template>
        </Table>
      </Card>

      <Card v-if="activeDomain === 'notifications'" :bordered="false" class="shadow-sm">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">通知偏好</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">配合 Vben 顶栏通知入口使用，决定分类消息是否进入站内提醒和邮件提醒。</div>
          </div>
          <Tag color="blue">{{ settingsSummary.notificationCategories }} 类</Tag>
        </div>
        <Table
          :columns="[
            { dataIndex: 'label', title: '分类', width: 180 },
            { dataIndex: 'in_app', title: '站内通知', width: 120 },
            { dataIndex: 'email', title: '邮件通知', width: 120 },
            { dataIndex: 'impact', title: '影响范围', width: 160 },
            { dataIndex: 'description', title: '说明' },
          ]"
          :data-source="notificationPreferences"
          :loading
          :pagination="{ pageSize: 8, showSizeChanger: false }"
          :scroll="{ x: 900 }"
          row-key="key"
        >
          <template #emptyText>
            <Empty description="当前没有通知分类配置。" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'in_app'">
              <Switch
                :checked="record.in_app"
                checked-children="开"
                un-checked-children="关"
                @change="(checked: boolean) => togglePreference(record, 'in_app', checked)"
              />
            </template>
            <template v-else-if="column.dataIndex === 'email'">
              <Switch
                :checked="record.email"
                checked-children="开"
                un-checked-children="关"
                @change="(checked: boolean) => togglePreference(record, 'email', checked)"
              />
            </template>
            <template v-else-if="column.dataIndex === 'impact'">
              <Tag color="orange">{{ settingImpactLabel('notifications') }}</Tag>
            </template>
          </template>
        </Table>
      </Card>
    </div>
  </Page>
</template>
