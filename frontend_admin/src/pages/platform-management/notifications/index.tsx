import { CheckOutlined, LinkOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Drawer, Empty, Row, Segmented, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, drawerWidthMd, fullWidthStyle, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsNotificationsApiBulkAction,
  appsNotificationsApiGetNotification,
  appsNotificationsApiListNotifications,
  appsNotificationsApiPatchNotification,
  appsNotificationsApiUnreadCount,
} from '@/services/openapi/notifications';
import { platformQueryKeys } from '../shared';

dayjs.extend(isToday);

const PAGE_SIZE = 10;

type ReadFilter = 'all' | 'unread' | 'read';
type GovernanceSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

type NotificationInsight = API.NotificationOut & {
  status_label: string;
  status_color: string;
  status_summary: string;
  source_label: string;
  source_summary: string;
  action_summary: string;
  time_summary: string;
};

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};

const overviewTileStyle: React.CSSProperties = {
  height: '100%',
  padding: 16,
  borderRadius: 8,
  border: '1px solid var(--ant-color-border-secondary)',
  background: 'var(--ant-color-bg-container)',
};

const notificationPreviewStyle: React.CSSProperties = {
  ...wrapTextStyle,
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
};

function getFilterParam(filter: ReadFilter) {
  if (filter === 'unread') return 'false';
  if (filter === 'read') return 'true';
  return undefined;
}

function buildNotificationInsight(item: API.NotificationOut): NotificationInsight {
  const actorName = item.actor?.full_name || item.actor?.username;
  const sourceLabel = actorName ? `来自 ${actorName}` : '系统触达';
  const createdAt = dayjs(item.created_at);

  if (!item.is_read) {
    return {
      ...item,
      status_label: '待处理',
      status_color: 'blue',
      status_summary: item.url ? '通知仍未收口，且附带后续处理入口。' : '通知仍未确认，当前更多承担信息提醒作用。',
      source_label: sourceLabel,
      source_summary: actorName ? '这条通知由明确的业务执行人触发，更适合继续追溯来源。' : '系统类通知更适合作为经营提醒和平台广播入口。',
      action_summary: item.url ? '可继续跳转处理' : '暂无后续跳转',
      time_summary: createdAt.isToday() ? `今天 ${createdAt.format('HH:mm')} 到达` : `${createdAt.format('YYYY-MM-DD HH:mm')} 到达`,
    };
  }

  return {
    ...item,
    status_label: '已收口',
    status_color: 'default',
    status_summary: item.url ? '通知已读，后续如需继续处理可从详情中的跳转入口进入。' : '通知已经读过，目前主要保留为审计和回看依据。',
    source_label: sourceLabel,
    source_summary: actorName ? '来源链路清晰，后续需要时可以继续定位到具体执行人。' : '系统通知已经进入已读状态，可继续作为平台运营留痕。',
    action_summary: item.url ? '已读但可继续跳转' : '已读存档',
    time_summary: createdAt.isToday() ? `今天 ${createdAt.format('HH:mm')} 已确认` : `${createdAt.format('YYYY-MM-DD HH:mm')} 已确认`,
  };
}

const NotificationsAdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [detailId, setDetailId] = useState<number>();

  const notificationsQuery = useQuery({
    queryKey: platformQueryKeys.notifications(page, getFilterParam(readFilter)),
    queryFn: () => appsNotificationsApiListNotifications({ page, page_size: PAGE_SIZE, is_read: getFilterParam(readFilter) }),
  });
  const unreadCountQuery = useQuery({
    queryKey: ['platform-management', 'notifications', 'unread-count'],
    queryFn: () => appsNotificationsApiUnreadCount(),
  });
  const detailQuery = useQuery({
    queryKey: ['platform-management', 'notification-detail', detailId],
    queryFn: () => appsNotificationsApiGetNotification({ notification_id: detailId! }),
    enabled: Boolean(detailId),
  });
  const patchMutation = useMutation({
    mutationFn: ({ id, isRead }: { id: number; isRead: boolean }) => appsNotificationsApiPatchNotification({ notification_id: id }, { is_read: isRead }),
    onSuccess: async () => {
      await notificationsQuery.refetch();
      await unreadCountQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['notification-bell'] });
      if (detailId) {
        await detailQuery.refetch();
      }
    },
  });
  const bulkMutation = useMutation({
    mutationFn: (body: API.BulkActionIn) => appsNotificationsApiBulkAction(body),
    onSuccess: async () => {
      await notificationsQuery.refetch();
      await unreadCountQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['notification-bell'] });
    },
  });

  const insights = useMemo(() => (notificationsQuery.data?.items || []).map(buildNotificationInsight), [notificationsQuery.data?.items]);
  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const currentReadCount = insights.filter((item) => item.is_read).length;
  const linkedCount = insights.filter((item) => Boolean(item.url)).length;
  const todayCount = insights.filter((item) => dayjs(item.created_at).isToday()).length;

  const signals = useMemo<GovernanceSignal[]>(
    () => [
      {
        key: 'unread',
        title: '待确认通知',
        emphasis: unreadCount ? `${unreadCount} 条仍未读` : '当前已全部确认',
        summary: unreadCount ? '未读通知不一定都是高风险事项，但它们代表尚未完成确认的后台触达。' : '当前通知已基本完成确认，积压较少。',
        description: '通知页至少要让值班人员知道还有多少提醒没有被看见或没有被处理。',
        actionLabel: '继续处理通知',
        actionHref: '/dashboard/platform-management/notifications',
      },
      {
        key: 'linked',
        title: '可继续跳转',
        emphasis: linkedCount ? `${linkedCount} 条附带处理入口` : '当前少见跳转通知',
        summary: linkedCount ? '附带跳转入口的通知更适合当作待办承接，而不只是看过就算。' : '当前通知以普通提醒为主，跳转承接较少。',
        description: '如果通知里已经带了后续链接，页面应该把它当成执行入口而不是一段普通文本。',
        actionLabel: '查看通知分发',
        actionHref: '/dashboard/platform-management/notification-dispatches',
      },
      {
        key: 'today',
        title: '今日到达',
        emphasis: todayCount ? `今天新增 ${todayCount} 条` : '今天暂无新增',
        summary: todayCount ? '今天新增的通知更需要先确认是否和当前平台经营动作有关。' : '今天通知流量较小，值班压力不高。',
        description: '把今天到达的通知单独识别出来，更适合作为值班面板的第一层判断。',
        actionLabel: '联动用户治理',
        actionHref: '/dashboard/platform-management/users',
      },
      {
        key: 'history',
        title: '已读沉淀',
        emphasis: currentReadCount ? `${currentReadCount} 条当前页已读` : '当前页暂无已读',
        summary: currentReadCount ? '已读通知是回看和追责时的审计材料，不该混成一条普通消息流。' : '当前页主要是待确认通知。',
        description: '已读并不代表没价值，它决定了平台后续能不能讲清楚是谁看过、何时确认。',
        actionLabel: '回到通知治理',
        actionHref: '/dashboard/platform-management/notifications',
      },
    ],
    [currentReadCount, linkedCount, todayCount, unreadCount],
  );

  const columns: ColumnsType<NotificationInsight> = [
    {
      title: '通知主题',
      dataIndex: 'title',
      width: 280,
      render: (_value, record) => (
        <Space direction="vertical" size={4}>
          <Typography.Text style={wrapTextStyle}>{record.title || '无标题'}</Typography.Text>
          <Typography.Text type="secondary" style={notificationPreviewStyle}>
            {record.body || '无正文'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '触达状态',
      dataIndex: 'status_label',
      width: 260,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Tag color={record.status_color}>{record.status_label}</Tag>
          <Typography.Text type="secondary">{record.status_summary}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '来源与承接',
      dataIndex: 'source_label',
      width: 280,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Typography.Text>{record.source_label}</Typography.Text>
          <Typography.Text type="secondary">{record.source_summary}</Typography.Text>
          <Typography.Text type="secondary">{record.action_summary}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '到达时间',
      dataIndex: 'created_at',
      width: 220,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Typography.Text>{record.time_summary}</Typography.Text>
          <Typography.Text type="secondary">{dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 220,
      render: (_value, record) => (
        <ResponsiveActions>
          <a
            onClick={() => {
              setDetailId(record.id);
              if (!record.is_read) {
                void patchMutation.mutateAsync({ id: record.id, isRead: true });
              }
            }}
          >
            详情
          </a>
          <a onClick={() => void patchMutation.mutateAsync({ id: record.id, isRead: !record.is_read })}>{record.is_read ? '标记未读' : '标记已读'}</a>
        </ResponsiveActions>
      ),
    },
  ];

  const detailData = detailQuery.data ? buildNotificationInsight(detailQuery.data) : undefined;

  return (
    <>
      <Card
        title="通知治理"
        extra={(
          <AdminToolbar>
            <Segmented
              options={[
                { label: '全部', value: 'all' },
                { label: '未读', value: 'unread' },
                { label: '已读', value: 'read' },
              ]}
              value={readFilter}
              onChange={(value) => {
                setPage(1);
                setReadFilter(value as ReadFilter);
              }}
            />
            <Button href="/dashboard/platform-management/notification-dispatches">查看通知分发</Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              disabled={!unreadCount}
              onClick={() => void bulkMutation.mutateAsync({ action: 'mark_read', all_unread: true })}
            >
              全部标记已读
            </Button>
          </AdminToolbar>
        )}
      >
        <div style={sectionStyle}>
          <Typography.Text strong>通知治理概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="当前通知" value={insights.length} />
                <Typography.Text type="secondary">当前页纳入治理视角的通知总量。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="全局未读" value={unreadCount} />
                <Typography.Text type="secondary">这里代表当前值班账号仍未确认的通知总量。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="带跳转入口" value={linkedCount} />
                <Typography.Text type="secondary">附带入口的通知更适合作为后续执行承接。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="今日到达" value={todayCount} />
                <Typography.Text type="secondary">今日新增更适合作为值班确认的第一优先级。</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>当前处理面</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space direction="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>未读待确认</Typography.Text>
                    <Tag color={unreadCount ? 'blue' : 'green'}>{unreadCount ? `${unreadCount} 条待确认` : '已全部确认'}</Tag>
                  </Space>
                  <Typography.Text>未读通知不一定要立刻处理完，但至少要先完成确认，否则值班视角会失真。</Typography.Text>
                  <a href="/dashboard/platform-management/notifications">继续处理通知</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space direction="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>可继续执行</Typography.Text>
                    <Tag color={linkedCount ? 'gold' : 'default'}>{linkedCount ? `${linkedCount} 条可继续跳转` : '暂无跳转入口'}</Tag>
                  </Space>
                  <Typography.Text>带链接的通知应该被当成执行入口，适合直接串联到业务处理动作而不是只看一眼。</Typography.Text>
                  <a href="/dashboard/platform-management/notification-dispatches">查看通知分发</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space direction="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>今日值班面</Typography.Text>
                    <Tag color={todayCount ? 'blue' : 'default'}>{todayCount ? `${todayCount} 条今天到达` : '今日较平稳'}</Tag>
                  </Space>
                  <Typography.Text>今天刚到达的通知更适合作为值班第一层判断，先看是否关联当前经营与权限动作。</Typography.Text>
                  <a href="/dashboard/platform-management/users">联动用户治理</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space direction="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>已读沉淀</Typography.Text>
                    <Tag color={currentReadCount ? 'default' : 'green'}>{currentReadCount ? `${currentReadCount} 条已读沉淀` : '当前页暂无已读'}</Tag>
                  </Space>
                  <Typography.Text>已读通知不只是历史消息，它决定了平台后续能不能回看触达结果和确认责任。</Typography.Text>
                  <a href="/dashboard/platform-management/notifications">回看已读台账</a>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>闭环信号</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {signals.map((signal) => (
              <Col key={signal.key} xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Space direction="vertical" size={8}>
                    <Typography.Text strong>{signal.title}</Typography.Text>
                    <Tag color="blue">{signal.emphasis}</Tag>
                    <Typography.Text>{signal.summary}</Typography.Text>
                    <Typography.Text type="secondary">{signal.description}</Typography.Text>
                    <a href={signal.actionHref}>{signal.actionLabel}</a>
                  </Space>
                </div>
              </Col>
            ))}
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Space direction="vertical" size={12} style={fullWidthStyle}>
            <div>
              <Typography.Text strong>通知治理台账</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
                通知页不该只是收件箱，它至少要解释这条通知是否已经确认、能否继续承接动作，以及它来自哪条平台链路。
              </Typography.Paragraph>
            </div>
            {!notificationsQuery.isLoading && insights.length === 0 ? (
              <Empty description="当前筛选下暂无通知" />
            ) : (
              <Table
                rowKey="id"
                loading={notificationsQuery.isLoading}
                columns={columns}
                dataSource={insights}
                scroll={adminTableScroll}
                pagination={{
                  current: notificationsQuery.data?.page || page,
                  pageSize: notificationsQuery.data?.page_size || PAGE_SIZE,
                  total: notificationsQuery.data?.total || 0,
                  onChange: setPage,
                }}
              />
            )}
          </Space>
        </div>
      </Card>

      <Drawer title="通知详情" open={Boolean(detailId)} onClose={() => setDetailId(undefined)} width={drawerWidthMd}>
        <Space direction="vertical" size={12} style={fullWidthStyle}>
          <Alert type="info" showIcon title="通知详情不仅要看正文，还要一起判断这条提醒是否已经确认、是否还能继续承接动作。" />
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="通知标题">{detailData?.title || '-'}</Descriptions.Item>
            <Descriptions.Item label="触达状态">{detailData ? <Tag color={detailData.status_color}>{detailData.status_label}</Tag> : '-'}</Descriptions.Item>
            <Descriptions.Item label="通知来源">{detailData?.source_label || '-'}</Descriptions.Item>
            <Descriptions.Item label="来源说明">{detailData?.source_summary || '-'}</Descriptions.Item>
            <Descriptions.Item label="后续动作">{detailData?.action_summary || '-'}</Descriptions.Item>
            <Descriptions.Item label="到达时间">{detailData ? dayjs(detailData.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
            <Descriptions.Item label="正文">
              <span style={wrapTextStyle}>{detailData?.body || '-'}</span>
            </Descriptions.Item>
            <Descriptions.Item label="跳转入口">
              {detailData?.url ? (
                <Typography.Link href={detailData.url} target="_blank">
                  <LinkOutlined /> 打开通知链接
                </Typography.Link>
              ) : (
                '-'
              )}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Drawer>
    </>
  );
};

export default NotificationsAdminPage;
