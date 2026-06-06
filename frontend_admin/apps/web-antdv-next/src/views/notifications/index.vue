<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Badge, Button, Card, Drawer, Empty, message, Modal, Space, Table, Tag } from 'antdv-next';

import {
  bulkNotificationsApi,
  deleteNotificationApi,
  listNotificationsApi,
  markNotificationApi,
  type NotificationRow,
} from '#/api/django/resources';

type NotificationTaskFilter = 'all' | 'read' | 'unread';

const loading = ref(false);
const notifications = ref<NotificationRow[]>([]);
const selectedRowKeys = ref<number[]>([]);
const activeTaskFilter = ref<NotificationTaskFilter>('unread');
const detailVisible = ref(false);
const activeNotification = ref<null | NotificationRow>(null);
const loadRequestId = ref(0);

const apiReadFilter = computed(() => {
  if (activeTaskFilter.value === 'read') return 'true';
  if (activeTaskFilter.value === 'unread') return 'false';
  return undefined;
});

const notificationSummary = computed(() => {
  const total = notifications.value.length;
  const unread = notifications.value.filter((item) => !item.is_read).length;
  return {
    selected: selectedRowKeys.value.length,
    total,
    unread,
  };
});

function onSelectionChange(keys: Array<number | string>) {
  selectedRowKeys.value = keys.map((key) => Number(key)).filter((key) => !Number.isNaN(key));
}

function syncActiveNotification() {
  if (!activeNotification.value) return;
  const freshRecord = notifications.value.find((item) => item.id === activeNotification.value?.id);
  if (freshRecord) {
    activeNotification.value = freshRecord;
    return;
  }
  detailVisible.value = false;
  activeNotification.value = null;
}

async function loadData() {
  const requestId = loadRequestId.value + 1;
  loadRequestId.value = requestId;
  loading.value = true;
  try {
    const rows = await listNotificationsApi(apiReadFilter.value).catch(() => []);
    if (requestId !== loadRequestId.value) return;
    notifications.value = rows;
    syncActiveNotification();
  } finally {
    if (requestId === loadRequestId.value) {
      loading.value = false;
    }
  }
}

function openNotification(record: NotificationRow) {
  activeNotification.value = record;
  detailVisible.value = true;
}

async function changeTaskFilter(value: NotificationTaskFilter) {
  if (activeTaskFilter.value === value) return;
  activeTaskFilter.value = value;
  selectedRowKeys.value = [];
  await loadData();
}

function closeNotificationDetail() {
  detailVisible.value = false;
  activeNotification.value = null;
}

async function toggleRead(record: NotificationRow) {
  await markNotificationApi(record.id, !record.is_read);
  message.success(record.is_read ? '已标记为未读' : '已标记为已读');
  if (activeNotification.value?.id === record.id) {
    activeNotification.value = {
      ...activeNotification.value,
      is_read: !record.is_read,
    };
  }
  await loadData();
}

async function removeNotification(record: NotificationRow) {
  await deleteNotificationApi(record.id);
  message.success('通知已删除');
  if (activeNotification.value?.id === record.id) {
    detailVisible.value = false;
    activeNotification.value = null;
  }
  await loadData();
}

async function markSelected(isRead: boolean) {
  if (selectedRowKeys.value.length === 0) return;
  await bulkNotificationsApi({
    action: isRead ? 'mark_read' : 'mark_unread',
    ids: selectedRowKeys.value,
  });
  message.success(isRead ? '已批量标记为已读' : '已批量标记为未读');
  selectedRowKeys.value = [];
  await loadData();
}

async function deleteSelected() {
  if (selectedRowKeys.value.length === 0) return;
  const deletedIds = [...selectedRowKeys.value];
  await bulkNotificationsApi({
    action: 'delete',
    ids: deletedIds,
  });
  message.success('已批量删除通知');
  if (activeNotification.value && deletedIds.includes(activeNotification.value.id)) {
    closeNotificationDetail();
  }
  selectedRowKeys.value = [];
  await loadData();
}

async function readAllUnread() {
  const activeWasUnread = activeNotification.value && !activeNotification.value.is_read;
  await bulkNotificationsApi({
    action: 'mark_read',
    all_unread: true,
  });
  message.success('全部未读通知已标记为已读');
  if (activeWasUnread && activeNotification.value) {
    activeNotification.value = {
      ...activeNotification.value,
      is_read: true,
    };
  }
  selectedRowKeys.value = [];
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
  <Page auto-content-height title="通知处理">
    <div class="space-y-4">
      <Card :bordered="false" class="shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-lg font-semibold text-zinc-950 dark:text-zinc-50">通知处理</div>
            <div class="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
              面向日常运营的消息处理台，和 Vben 顶栏未读提醒、顶栏通知入口保持同一批站内通知状态。
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <Badge :count="notificationSummary.unread" :overflow-count="99">
              <Tag color="blue">当前筛选未读</Tag>
            </Badge>
            <Button @click="loadData">刷新</Button>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap gap-2">
            <Button :type="activeTaskFilter === 'unread' ? 'primary' : 'default'" @click="changeTaskFilter('unread')">
              未读优先
            </Button>
            <Button :type="activeTaskFilter === 'all' ? 'primary' : 'default'" @click="changeTaskFilter('all')">
              全部通知
            </Button>
            <Button :type="activeTaskFilter === 'read' ? 'primary' : 'default'" @click="changeTaskFilter('read')">
              已读历史
            </Button>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span>当前 {{ notificationSummary.total }} 条</span>
            <span>已选 {{ notificationSummary.selected }} 条</span>
          </div>
        </div>
      </Card>

      <Card :bordered="false" class="shadow-sm">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/60">
          <div class="text-sm font-medium text-zinc-700 dark:text-zinc-200">批量处理</div>
          <div class="flex flex-wrap gap-2">
            <Button :disabled="selectedRowKeys.length === 0" size="small" @click="markSelected(true)">
              标记已读
            </Button>
            <Button :disabled="selectedRowKeys.length === 0" size="small" @click="markSelected(false)">
              标记未读
            </Button>
            <Button
              :disabled="selectedRowKeys.length === 0"
              danger
              size="small"
              @click="
                confirmAction({
                  title: '确认删除选中通知',
                  content: `这会删除当前选中的 ${selectedRowKeys.length} 条通知记录，处理台和后续人工追溯都不再显示这些消息。`,
                  okText: '确认删除',
                  onOk: () => deleteSelected(),
                })
              "
            >
              删除选中
            </Button>
            <Button
              size="small"
              type="primary"
              @click="
                confirmAction({
                  title: '确认全部未读设为已读',
                  content: '这会把所有未读通知统一标记为已读，并同步影响 Vben 顶栏未读提醒数量，适合确认当前未读都已处理后再执行。',
                  okText: '确认标记',
                  onOk: () => readAllUnread(),
                })
              "
            >
              全部未读设为已读
            </Button>
          </div>
        </div>

        <Table
          :columns="[
            { dataIndex: 'title', title: '通知', width: 260 },
            { dataIndex: 'body', title: '摘要' },
            { dataIndex: 'is_read', title: '状态', width: 120 },
            { dataIndex: 'created_at', title: '时间', width: 220 },
            { dataIndex: 'actions', title: '处理', width: 240 },
          ]"
          :data-source="notifications"
          :loading
          :pagination="{ pageSize: 10, showSizeChanger: false }"
          :row-selection="{
            onChange: onSelectionChange,
            selectedRowKeys,
          }"
          :scroll="{ x: 1100 }"
          row-key="id"
        >
          <template #emptyText>
            <Empty description="当前没有待处理通知，新的系统动态会从顶栏通知入口同步进入这里。" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'title'">
              <button
                class="text-left font-medium text-blue-600 transition hover:text-blue-500 dark:text-blue-400"
                type="button"
                @click="openNotification(record)"
              >
                {{ record.title }}
              </button>
            </template>
            <template v-else-if="column.dataIndex === 'body'">
              <div class="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{{ record.body || '-' }}</div>
            </template>
            <template v-else-if="column.dataIndex === 'is_read'">
              <Tag v-if="record.is_read">已读</Tag>
              <Badge v-else status="processing" text="未读" />
            </template>
            <template v-else-if="column.dataIndex === 'actions'">
              <Space>
                <Button size="small" @click="openNotification(record)">
                  查看
                </Button>
                <Button size="small" @click="toggleRead(record)">
                  {{ record.is_read ? '标未读' : '标已读' }}
                </Button>
                <Button
                  danger
                  size="small"
                  @click="
                    confirmAction({
                      title: '确认删除通知',
                      content: `删除后，通知「${record.title}」将不可恢复，也不会再出现在处理台历史中。`,
                      okText: '确认删除',
                      onOk: () => removeNotification(record),
                    })
                  "
                >
                  删除
                </Button>
              </Space>
            </template>
          </template>
        </Table>
      </Card>

      <Drawer
        v-model:open="detailVisible"
        :title="activeNotification?.title || '通知详情'"
        placement="right"
        width="min(520px, 100vw)"
        @close="closeNotificationDetail"
      >
        <div v-if="activeNotification" class="space-y-5">
          <div class="flex flex-wrap items-center gap-3">
            <Tag v-if="activeNotification.is_read">已读</Tag>
            <Badge v-else status="processing" text="未读" />
            <span class="text-sm text-zinc-500 dark:text-zinc-400">{{ activeNotification.created_at }}</span>
          </div>

          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">通知内容</div>
            <div class="whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm leading-6 text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
              {{ activeNotification.body || '这条通知暂时没有更多内容。' }}
            </div>
          </div>

          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">关联业务对象</div>
            <div class="rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              后续如果通知携带工单、租户、成员或其它关联对象，可在这里提供跳转入口，帮助管理员从消息直接进入处理对象。
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <Button @click="closeNotificationDetail">关闭</Button>
            <Button v-if="activeNotification" type="primary" @click="toggleRead(activeNotification)">
              {{ activeNotification.is_read ? '标记未读' : '标记已读' }}
            </Button>
          </div>
        </template>
      </Drawer>
    </div>
  </Page>
</template>
