<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Badge, Card, Empty, Table, Tag } from 'antdv-next';

import { getAppContextApi } from '#/api/django/context';
import {
  getUnreadCountApi,
  listNotificationsApi,
  listOrganizationsApi,
  listTeamsApi,
  listUsersApi,
} from '#/api/django/resources';

const loading = ref(false);
const context = ref<any>(null);
const users = ref<any[]>([]);
const organizations = ref<any[]>([]);
const teams = ref<any[]>([]);
const notifications = ref<any[]>([]);
const unreadCount = ref(0);

const activeOrg = computed(() => context.value?.org?.name || '未选择租户');
const overviewStats = computed(() => [
  { label: '当前租户', value: activeOrg.value },
  { label: '可见用户', value: users.value.length },
  { label: '租户数量', value: organizations.value.length },
  { label: '未读通知', value: unreadCount.value },
]);

async function loadData() {
  loading.value = true;
  try {
    const ctx = await getAppContextApi();
    context.value = ctx;

    const [userRows, orgRows, teamRows, notificationRows, unread] =
      await Promise.allSettled([
        listUsersApi(),
        listOrganizationsApi(),
        ctx.org ? listTeamsApi() : Promise.resolve([]),
        ctx.org ? listNotificationsApi() : Promise.resolve([]),
        ctx.org ? getUnreadCountApi() : Promise.resolve({ count: 0 }),
      ]);
    users.value = userRows.status === 'fulfilled' ? userRows.value : [];
    organizations.value = orgRows.status === 'fulfilled' ? orgRows.value : [];
    teams.value = teamRows.status === 'fulfilled' ? teamRows.value : [];
    notifications.value =
      notificationRows.status === 'fulfilled' ? notificationRows.value.slice(0, 5) : [];
    unreadCount.value = unread.status === 'fulfilled' ? unread.value.count : 0;
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <Page auto-content-height title="运营总览">
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="item in overviewStats" :key="item.label" size="small">
          <div class="text-xs text-zinc-500">{{ item.label }}</div>
          <div class="mt-2 truncate text-2xl font-semibold text-zinc-950">{{ item.value }}</div>
        </Card>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <Card>
          <div class="mb-4">
            <div class="text-base font-semibold text-zinc-950">团队概览</div>
            <div class="mt-1 text-sm text-zinc-500">快速确认当前租户下的团队规模，适合做权限和分工前的整体扫描。</div>
          </div>
          <Table
            :columns="[
              { dataIndex: 'name', title: '团队' },
              { dataIndex: 'members', title: '成员数' },
            ]"
            :data-source="
              teams.map((team) => ({
                ...team,
                members: team.members?.length ?? 0,
              }))
            "
            :loading
            :pagination="{ pageSize: 6, showSizeChanger: false }"
            row-key="id"
            size="small"
          >
            <template #emptyText>
              <Empty :description="context?.org ? '当前租户还没有团队。' : '请先选择当前租户，再查看团队概览。'" />
            </template>
          </Table>
        </Card>

        <Card>
          <div class="mb-4">
            <div class="text-base font-semibold text-zinc-950">最近通知</div>
            <div class="mt-1 text-sm text-zinc-500">保留最近几条动态，方便从总览页判断是否需要进入通知中心做进一步处理。</div>
          </div>
          <Table
            :columns="[
              { dataIndex: 'title', title: '标题' },
              { dataIndex: 'is_read', title: '状态' },
            ]"
            :data-source="notifications"
            :loading
            :pagination="{ pageSize: 6, showSizeChanger: false }"
            row-key="id"
            size="small"
          >
            <template #emptyText>
              <Empty :description="context?.org ? '当前没有通知。' : '请先选择当前租户，再查看通知摘要。'" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'is_read'">
                <Tag v-if="record.is_read">已读</Tag>
                <Badge v-else status="processing" text="未读" />
              </template>
            </template>
          </Table>
        </Card>
      </div>
    </div>
  </Page>
</template>
