import { ArrowRightOutlined, CheckOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history, useAccess, useLocation, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Empty,
  Grid,
  Pagination,
  Skeleton,
  Tabs,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserNotificationPermission } from '@/components/NotificationBell';
import { PageContainer } from '@/components/PageContainer';
import { BACKGROUND_REFRESH_INTERVAL } from '@/hooks/useBackgroundPolling';
import { fixedPagePagination } from '@/pages/_shared/adminLayout';
import {
  notificationQueryKeys,
  notificationRequestOptions,
} from '@/services/manual/notifications';
import {
  appsNotificationsApiBulkAction,
  appsNotificationsApiGetNotification,
  appsNotificationsApiListNotifications,
  appsNotificationsApiPatchNotification,
  appsNotificationsApiUnreadCount,
} from '@/services/openapi/notifications';
import { SPACE_PATHS } from '@/utils/adminRouting';
import { getNotificationUrl } from '@/utils/notificationRouting';
import { platformQueryKeys } from '../shared';
import { useStyles } from './styles';

const PAGE_SIZE = 10;
const backgroundRefresh = {
  refetchInterval: BACKGROUND_REFRESH_INTERVAL,
  refetchIntervalInBackground: true,
};

type ReadFilter = 'all' | 'unread' | 'read';
type NotificationSearchState = {
  detailId?: number;
  page: number;
  readFilter: ReadFilter;
};
type NotificationInsight = API.NotificationOut & {
  status_label: string;
  source_label: string;
  time_summary: string;
  category_label?: string;
  group_label: string;
};

function getFilterParam(filter: ReadFilter) {
  if (filter === 'unread') return 'false';
  if (filter === 'read') return 'true';
  return undefined;
}

function positiveNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function getNotificationSearchState(search: string): NotificationSearchState {
  const params = new URLSearchParams(search);
  const read = params.get('read');
  return {
    detailId: positiveNumber(params.get('notification_id')),
    page: positiveNumber(params.get('page')) || 1,
    readFilter: read === 'unread' || read === 'read' ? read : 'all',
  };
}

function syncNotificationSearch(state: NotificationSearchState) {
  const params = new URLSearchParams(window.location.search);
  params.delete('notification_id');
  params.delete('page');
  params.delete('read');
  if (state.detailId) {
    params.set('notification_id', String(state.detailId));
  }
  if (state.page > 1) params.set('page', String(state.page));
  if (state.readFilter !== 'all') params.set('read', state.readFilter);
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function buildNotificationInsight(
  notification: API.NotificationOut,
): NotificationInsight {
  const item = { ...notification, url: getNotificationUrl(notification) };
  const actorName = item.actor?.full_name || item.actor?.username;
  const sourceLabel = actorName ? `来自 ${actorName}` : '系统通知';
  const createdAt = dayjs(item.created_at);
  const category = item.category || '';
  const categoryLabel = category.startsWith('team.task')
    ? '团队任务'
    : category === 'team.announcement'
      ? '团队公告'
      : category === 'messaging.message'
        ? '聊天消息'
        : undefined;
  const today = dayjs();
  const isToday = createdAt.isSame(today, 'day');
  const isYesterday = createdAt.isSame(today.subtract(1, 'day'), 'day');

  return {
    ...item,
    status_label: item.is_read ? '已读' : '未读',
    source_label: sourceLabel,
    category_label: categoryLabel,
    group_label: isToday ? '今天' : isYesterday ? '昨天' : '更早',
    time_summary:
      isToday || isYesterday
        ? createdAt.format('HH:mm')
        : createdAt.format('YYYY-MM-DD HH:mm'),
  };
}

const NotificationsAdminPage: React.FC = () => {
  const { styles, cx } = useStyles();
  const screens = Grid.useBreakpoint();
  const isNarrow = screens.md === false;
  const queryClient = useQueryClient();
  const location = useLocation();
  const lastNavigationKey = useRef(location.key);
  const { initialState } = useModel('@@initialState');
  const userId = initialState?.currentUser?.id;
  const slug = initialState?.selectedOrgSlug;
  const { canManageNotificationDispatches } = useAccess();
  const detailQueryPrefix = [
    'platform-management',
    'notification-detail',
    userId,
    slug,
  ] as const;
  const getDetailQueryKey = (id?: number) => [...detailQueryPrefix, id];
  const initialSearchState = useMemo(
    () => getNotificationSearchState(window.location.search),
    [],
  );
  const [page, setPage] = useState(initialSearchState.page);
  const [readFilter, setReadFilter] = useState<ReadFilter>(
    initialSearchState.readFilter,
  );
  const [detailId, setDetailId] = useState<number | undefined>(
    initialSearchState.detailId,
  );
  useEffect(() => {
    if (lastNavigationKey.current === location.key) return;
    lastNavigationKey.current = location.key;
    const next = getNotificationSearchState(location.search);
    setDetailId(next.detailId);
    setPage(next.page);
    setReadFilter(next.readFilter);
  }, [location.key, location.search]);

  const updateSearchState = (next: Partial<NotificationSearchState>) => {
    syncNotificationSearch({
      detailId,
      page,
      readFilter,
      ...next,
    });
  };

  const openDetail = (record: API.NotificationOut) => {
    queryClient.setQueryData<API.NotificationOut>(
      getDetailQueryKey(record.id),
      (previous) => previous ?? record,
    );
    setDetailId(record.id);
    updateSearchState({ detailId: record.id });
  };

  const closeDetail = () => {
    setDetailId(undefined);
    updateSearchState({ detailId: undefined });
  };

  const notificationsQuery = useQuery({
    queryKey: [
      ...platformQueryKeys.notifications(page, getFilterParam(readFilter)),
      userId,
      slug,
    ],
    queryFn: ({ signal }) =>
      appsNotificationsApiListNotifications(
        {
          page,
          page_size: PAGE_SIZE,
          is_read: getFilterParam(readFilter),
        },
        notificationRequestOptions(slug, signal),
      ),
    ...backgroundRefresh,
  });
  const unreadCountQuery = useQuery({
    queryKey: notificationQueryKeys.count(userId, slug),
    queryFn: ({ signal }) =>
      appsNotificationsApiUnreadCount(notificationRequestOptions(slug, signal)),
    ...backgroundRefresh,
  });
  const detailQuery = useQuery({
    queryKey: getDetailQueryKey(detailId),
    queryFn: ({ signal }) => {
      if (!detailId) throw new Error('缺少通知 ID');
      return appsNotificationsApiGetNotification(
        { notification_id: detailId },
        notificationRequestOptions(slug, signal),
      );
    },
    enabled: Boolean(detailId),
    ...backgroundRefresh,
  });
  const refreshNotifications = async () => {
    await Promise.all([
      notificationsQuery.refetch(),
      unreadCountQuery.refetch(),
      queryClient.invalidateQueries({
        queryKey: ['notification-bell', userId, slug],
      }),
      queryClient.invalidateQueries({ queryKey: detailQueryPrefix }),
    ]);
  };
  const patchMutation = useMutation({
    mutationFn: ({ id, isRead }: { id: number; isRead: boolean }) =>
      appsNotificationsApiPatchNotification(
        { notification_id: id },
        { is_read: isRead },
        { ...notificationRequestOptions(slug), skipErrorHandler: false },
      ),
    onSuccess: async (_data, { id, isRead }) => {
      queryClient.setQueryData<API.NotificationOut>(
        getDetailQueryKey(id),
        (previous) => (previous ? { ...previous, is_read: isRead } : previous),
      );
      await refreshNotifications();
    },
  });
  const bulkMutation = useMutation({
    mutationFn: (body: API.BulkActionIn) =>
      appsNotificationsApiBulkAction(body, {
        ...notificationRequestOptions(slug),
        skipErrorHandler: false,
      }),
    onSuccess: refreshNotifications,
  });

  const insights = useMemo(
    () => (notificationsQuery.data?.items || []).map(buildNotificationInsight),
    [notificationsQuery.data?.items],
  );
  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const changeReadFilter = (nextReadFilter: ReadFilter) => {
    setPage(1);
    setReadFilter(nextReadFilter);
    setDetailId(undefined);
    updateSearchState({
      page: 1,
      readFilter: nextReadFilter,
      detailId: undefined,
    });
  };

  const detailData = detailQuery.data
    ? buildNotificationInsight(detailQuery.data)
    : undefined;

  const groups = useMemo(() => {
    const grouped = new Map<string, NotificationInsight[]>();
    for (const record of insights) {
      const group = grouped.get(record.group_label);
      if (group) group.push(record);
      else grouped.set(record.group_label, [record]);
    }
    return Array.from(grouped);
  }, [insights]);
  const selectedInList = insights.some((record) => record.id === detailId);
  const mutationPending = patchMutation.isPending || bulkMutation.isPending;

  const renderDetail = (inline = false) => {
    if (!detailId) {
      return (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择一条通知">
          <Typography.Text type="secondary">
            在这里查看完整内容和相关操作
          </Typography.Text>
        </Empty>
      );
    }
    if (detailQuery.isError) {
      return (
        <Alert
          type="error"
          showIcon
          title="通知详情加载失败"
          description="暂时无法取得通知内容，请重新加载。"
          action={
            <Button size="small" onClick={() => void detailQuery.refetch()}>
              重新加载详情
            </Button>
          }
        />
      );
    }
    if (!detailData) return <Skeleton active paragraph={{ rows: 4 }} />;
    const actionLabel =
      detailData.category === 'messaging.message'
        ? '查看会话'
        : detailData.category?.startsWith('team.task')
          ? '查看任务'
          : detailData.category === 'team.announcement'
            ? '查看公告'
            : detailData.url?.includes(SPACE_PATHS.subscription)
              ? '查看订阅'
              : '打开相关页面';
    return (
      <section className={styles.detailContent} aria-label="通知正文">
        {!inline && (
          <Typography.Title level={4} className={styles.detailTitle}>
            {detailData.title || '无标题'}
          </Typography.Title>
        )}
        {!inline && (
          <div className={styles.detailMeta}>
            <Typography.Text type="secondary">
              {detailData.source_label}
            </Typography.Text>
            {detailData.category_label && (
              <Typography.Text type="secondary">
                {detailData.category_label}
              </Typography.Text>
            )}
            <Typography.Text type="secondary">
              <time dateTime={detailData.created_at}>
                {dayjs(detailData.created_at).format('YYYY-MM-DD HH:mm')}
              </time>
            </Typography.Text>
          </div>
        )}
        <Typography.Text type="secondary" className={styles.detailReadState}>
          {detailData.is_read && <CheckOutlined />} {detailData.status_label}
        </Typography.Text>
        <Typography.Paragraph className={styles.detailBody}>
          {detailData.body || '此通知暂无正文。'}
        </Typography.Paragraph>
        <div className="flex flex-wrap items-center gap-3">
          {detailData.url && (
            <Button
              type="primary"
              href={detailData.url}
              target="_blank"
              rel="noopener noreferrer"
              icon={<ArrowRightOutlined />}
            >
              {actionLabel}
            </Button>
          )}
          <Button
            type="link"
            className="px-0!"
            disabled={mutationPending}
            loading={
              patchMutation.isPending &&
              patchMutation.variables?.id === detailData.id
            }
            onClick={() =>
              patchMutation.mutate({
                id: detailData.id,
                isRead: !detailData.is_read,
              })
            }
          >
            {detailData.is_read ? '标记未读' : '标记已读'}
          </Button>
          {isNarrow && (
            <Button type="text" onClick={closeDetail}>
              收起详情
            </Button>
          )}
        </div>
      </section>
    );
  };

  return (
    <PageContainer title="通知中心">
      <Card styles={{ body: { padding: 0 } }}>
        <div className={styles.toolbar}>
          <Tabs
            activeKey={readFilter}
            className={styles.filters}
            tabBarGutter={24}
            items={[
              { key: 'all', label: '全部' },
              {
                key: 'unread',
                label: (
                  <span>
                    未读
                    {unreadCount > 0 && (
                      <span className={styles.unreadCount}>{unreadCount}</span>
                    )}
                  </span>
                ),
              },
              { key: 'read', label: '已读' },
            ]}
            onChange={(value) => changeReadFilter(value as ReadFilter)}
          />
          <Button
            type="text"
            icon={<CheckOutlined />}
            disabled={!unreadCount}
            loading={bulkMutation.isPending}
            onClick={() =>
              bulkMutation.mutate({ action: 'mark_read', all_unread: true })
            }
          >
            全部已读
          </Button>
        </div>
        <div className={styles.workspace}>
          <div className={styles.listPane}>
            <section aria-label="通知列表" className={styles.listScroller}>
              {isNarrow && detailId && !selectedInList && (
                <section
                  aria-label="当前查看的通知"
                  className={styles.pinnedDetail}
                >
                  <Typography.Text
                    type="secondary"
                    className={styles.currentLabel}
                  >
                    当前查看
                  </Typography.Text>
                  {renderDetail()}
                </section>
              )}
              {notificationsQuery.isError ? (
                <Alert
                  className="m-4"
                  type="error"
                  showIcon
                  title="通知加载失败"
                  description="暂时无法取得通知列表，请检查网络后重新加载。"
                  action={
                    <Button
                      size="small"
                      onClick={() => void notificationsQuery.refetch()}
                    >
                      重新加载
                    </Button>
                  }
                />
              ) : notificationsQuery.isLoading ? (
                <div className="p-6">
                  <Skeleton active paragraph={{ rows: 5 }} />
                </div>
              ) : insights.length === 0 ? (
                <Empty
                  className="py-12"
                  description={
                    readFilter === 'unread'
                      ? '暂无未读通知'
                      : readFilter === 'read'
                        ? '暂无已读通知'
                        : '暂无通知'
                  }
                >
                  {readFilter !== 'all' && (
                    <Button onClick={() => changeReadFilter('all')}>
                      查看全部通知
                    </Button>
                  )}
                </Empty>
              ) : (
                groups.map(([label, records]) => (
                  <section key={label} aria-label={label}>
                    <div className={styles.groupHeading}>
                      <Typography.Text type="secondary">
                        {label}
                      </Typography.Text>
                      {label !== '更早' && (
                        <Typography.Text type="secondary">
                          {dayjs(records[0].created_at).format('M月D日')}
                        </Typography.Text>
                      )}
                    </div>
                    <ul className="m-0 list-none p-0">
                      {records.map((record) => (
                        <li
                          key={record.id}
                          className={
                            detailId === record.id
                              ? styles.selectedRow
                              : undefined
                          }
                        >
                          <button
                            type="button"
                            className={styles.notificationRow}
                            aria-label={
                              (record.title || '无标题') +
                              '，' +
                              record.status_label
                            }
                            aria-current={
                              detailId === record.id ? 'true' : undefined
                            }
                            aria-expanded={
                              isNarrow ? detailId === record.id : undefined
                            }
                            onClick={() => {
                              if (isNarrow && detailId === record.id) {
                                closeDetail();
                                return;
                              }
                              openDetail(record);
                              if (
                                !record.is_read &&
                                !(
                                  patchMutation.isPending &&
                                  patchMutation.variables?.id === record.id
                                )
                              ) {
                                patchMutation.mutate({
                                  id: record.id,
                                  isRead: true,
                                });
                              }
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className={cx(
                                styles.unreadDot,
                                record.is_read && styles.hiddenDot,
                              )}
                            />
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <Typography.Text
                                  strong={!record.is_read}
                                  className={styles.notificationTitle}
                                >
                                  {record.title || '无标题'}
                                </Typography.Text>
                                {!record.is_read ? (
                                  <span className={styles.unreadLabel}>
                                    未读
                                  </span>
                                ) : (
                                  <span className="sr-only">已读</span>
                                )}
                              </span>
                              {record.body && (
                                <span className={styles.preview}>
                                  {record.body}
                                </span>
                              )}
                              <span className={styles.rowMeta}>
                                <span>{record.source_label}</span>
                                {record.category_label && (
                                  <>
                                    <span aria-hidden="true">/</span>
                                    <span>{record.category_label}</span>
                                  </>
                                )}
                                <time
                                  className={styles.rowTime}
                                  dateTime={record.created_at}
                                  title={dayjs(record.created_at).format(
                                    'YYYY-MM-DD HH:mm',
                                  )}
                                >
                                  {record.time_summary}
                                </time>
                              </span>
                            </span>
                          </button>
                          {isNarrow && detailId === record.id && (
                            <div className={styles.inlineDetail}>
                              {renderDetail(true)}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </section>
            {notificationsQuery.data && !notificationsQuery.isError && (
              <div className={styles.pagination}>
                <Pagination
                  size="small"
                  responsive
                  {...fixedPagePagination(
                    notificationsQuery.data.page || page,
                    notificationsQuery.data.page_size || PAGE_SIZE,
                    notificationsQuery.data.total,
                    (nextPage) => {
                      setPage(nextPage);
                      setDetailId(undefined);
                      updateSearchState({
                        page: nextPage,
                        detailId: undefined,
                      });
                    },
                  )}
                  showTotal={(total) => `共 ${total} 条通知`}
                />
              </div>
            )}
          </div>
          {!isNarrow && (
            <aside
              aria-label="通知详情"
              className={cx(styles.detailPane, !detailId && styles.emptyDetail)}
            >
              {renderDetail()}
            </aside>
          )}
        </div>
      </Card>
      <div className={styles.secondaryToolbar}>
        <BrowserNotificationPermission />
        {canManageNotificationDispatches && (
          <Button
            type="link"
            className="px-0!"
            onClick={() => history.push(SPACE_PATHS.notificationDispatches)}
          >
            查看发送记录
          </Button>
        )}
      </div>
    </PageContainer>
  );
};

export default NotificationsAdminPage;
