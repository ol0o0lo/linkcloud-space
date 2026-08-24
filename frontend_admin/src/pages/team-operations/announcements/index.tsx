import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  drawerWidthMd,
  fixedPagePagination,
  fullWidthStyle,
  ResponsiveActions,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import {
  type AnnouncementInput,
  type AnnouncementStatus,
  acknowledgeTeamAnnouncement,
  createTeamAnnouncement,
  getTeamAnnouncement,
  getTeamOperationsCapabilities,
  listTeamAnnouncements,
  publishTeamAnnouncement,
  type TeamAnnouncement,
  withdrawTeamAnnouncement,
} from '@/services/manual/teamOperations';
import { appsTeamsApiListTeams } from '@/services/openapi/teams';
import {
  announcementStatusColor,
  invalidateTeamOperations,
  teamOperationsQueryKeys,
} from '../shared';
import { useStyles } from './styles';

const PAGE_SIZE = 10;
const announcementTableScroll = { x: 1040 };

type AnnouncementFilter = 'all' | AnnouncementStatus;
type AnnouncementScope = number | 'organization';
type AnnouncementFormValues = {
  team_id?: AnnouncementScope;
  title: string;
  body: string;
  require_acknowledgement?: boolean;
  expires_at?: Dayjs;
};

function requestedAnnouncementId() {
  if (typeof window === 'undefined') return undefined;
  const value = Number(
    new URLSearchParams(window.location.search).get('announcement_id'),
  );
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

const TeamAnnouncementsPage: React.FC = () => {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialAnnouncementId = useMemo(requestedAnnouncementId, []);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AnnouncementFilter>('all');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailAnnouncement, setDetailAnnouncement] =
    useState<TeamAnnouncement>();
  const [form] = Form.useForm<AnnouncementFormValues>();
  const enabled = Boolean(workspace.selectedOrgSlug);

  const announcementsQuery = useQuery({
    queryKey: teamOperationsQueryKeys.announcements(
      workspace.selectedOrgSlug,
      page,
      statusFilter,
      keyword,
    ),
    queryFn: () =>
      listTeamAnnouncements({
        page,
        page_size: PAGE_SIZE,
        status: statusFilter === 'all' ? undefined : statusFilter,
        keyword: keyword || undefined,
      }),
    enabled,
  });
  const teamsQuery = useQuery({
    queryKey: ['tenant', 'teams', workspace.selectedOrgSlug, 'announcements'],
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled,
  });
  const capabilitiesQuery = useQuery({
    queryKey: teamOperationsQueryKeys.capabilities(workspace.selectedOrgSlug),
    queryFn: () => getTeamOperationsCapabilities(),
    enabled,
  });
  const requestedAnnouncementQuery = useQuery({
    queryKey: [
      'team-operations',
      'requested-announcement',
      workspace.selectedOrgSlug,
      initialAnnouncementId,
    ],
    queryFn: () => {
      if (!initialAnnouncementId) throw new Error('缺少公告 ID');
      return getTeamAnnouncement(initialAnnouncementId);
    },
    enabled: enabled && Boolean(initialAnnouncementId),
  });

  useEffect(() => {
    if (requestedAnnouncementQuery.data) {
      setDetailAnnouncement(requestedAnnouncementQuery.data);
    }
  }, [requestedAnnouncementQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: AnnouncementInput) => createTeamAnnouncement(payload),
    onSuccess: async () => {
      message.success('公告草稿已创建');
      setCreateOpen(false);
      form.resetFields();
      await invalidateTeamOperations(queryClient);
    },
  });
  const publishMutation = useMutation({
    mutationFn: (announcementId: number) =>
      publishTeamAnnouncement(announcementId),
    onSuccess: async (announcement) => {
      message.success('公告已发布并发送站内信');
      if (detailAnnouncement?.id === announcement.id) {
        setDetailAnnouncement(announcement);
      }
      await invalidateTeamOperations(queryClient);
    },
  });
  const withdrawMutation = useMutation({
    mutationFn: (announcementId: number) =>
      withdrawTeamAnnouncement(announcementId),
    onSuccess: async (announcement) => {
      message.success('公告已撤回');
      if (detailAnnouncement?.id === announcement.id) {
        setDetailAnnouncement(announcement);
      }
      await invalidateTeamOperations(queryClient);
    },
  });
  const acknowledgeMutation = useMutation({
    mutationFn: (announcementId: number) =>
      acknowledgeTeamAnnouncement(announcementId),
    onSuccess: async (_receipt, announcementId) => {
      message.success('已确认公告');
      if (detailAnnouncement?.id === announcementId) {
        setDetailAnnouncement({
          ...detailAnnouncement,
          is_acknowledged: true,
          acknowledged_count: detailAnnouncement.acknowledged_count + 1,
        });
      }
      await invalidateTeamOperations(queryClient);
    },
  });

  const capabilities = capabilitiesQuery.data;
  const canManageAnnouncements = Boolean(
    capabilities?.announcement_organization_manage ||
      capabilities?.announcement_team_ids.length,
  );
  const teamOptions = useMemo(() => {
    const organizationManage = Boolean(
      capabilities?.announcement_organization_manage,
    );
    const manageableTeamIds = new Set(
      capabilities?.announcement_team_ids || [],
    );
    const options = (teamsQuery.data?.items || [])
      .filter((team) => organizationManage || manageableTeamIds.has(team.id))
      .map((team) => ({ label: team.name, value: team.id }));
    return organizationManage
      ? [
          {
            label: '全组织',
            value: 'organization' as AnnouncementScope,
          },
          ...options,
        ]
      : options;
  }, [capabilities, teamsQuery.data]);

  const columns: ColumnsType<TeamAnnouncement> = [
    {
      title: '公告',
      dataIndex: 'title',
      width: 340,
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text strong style={wrapTextStyle}>
            {record.title}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.team_name || '全组织'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      align: 'center',
      render: (_value, record) => (
        <Tag color={announcementStatusColor(record.status)}>
          {record.status__mapping}
        </Tag>
      ),
    },
    {
      title: '确认情况',
      dataIndex: 'acknowledged_count',
      width: 160,
      align: 'right',
      render: (_value, record) => {
        if (!record.require_acknowledgement) return '无需确认';
        if (record.status !== 'published') return '发布后统计';
        return `${record.acknowledged_count}/${record.recipient_count}`;
      },
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      width: 180,
      align: 'center',
      render: (value) =>
        value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '尚未发布',
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      width: 240,
      align: 'center',
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => setDetailAnnouncement(record)}>详情</a>
          {record.can_manage && record.status === 'draft' ? (
            <Popconfirm
              title="确认发布该公告？"
              description="发布后会向目标成员发送站内信。"
              onConfirm={() => void publishMutation.mutateAsync(record.id)}
            >
              <a>发布</a>
            </Popconfirm>
          ) : null}
          {record.can_manage && record.status === 'published' ? (
            <Popconfirm
              title="确认撤回该公告？"
              onConfirm={() => void withdrawMutation.mutateAsync(record.id)}
            >
              <a>撤回</a>
            </Popconfirm>
          ) : null}
          {record.status === 'published' &&
          record.is_recipient &&
          record.require_acknowledgement &&
          !record.is_acknowledged ? (
            <a onClick={() => void acknowledgeMutation.mutateAsync(record.id)}>
              确认已知
            </a>
          ) : null}
        </ResponsiveActions>
      ),
    },
  ];

  const submitCreate = async (values: AnnouncementFormValues) => {
    await createMutation.mutateAsync({
      team_id: values.team_id === 'organization' ? null : values.team_id,
      title: values.title.trim(),
      body: values.body.trim(),
      require_acknowledgement: Boolean(values.require_acknowledgement),
      expires_at: values.expires_at?.toISOString() || null,
    });
  };

  const openCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({ require_acknowledgement: false });
    setCreateOpen(true);
  };

  const resetFilters = () => {
    setPage(1);
    setStatusFilter('all');
    setKeywordInput('');
    setKeyword('');
  };

  const isFiltered = statusFilter !== 'all' || Boolean(keyword);
  const announcementEmptyText = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space direction="vertical" size={2}>
          <Typography.Text strong>
            {isFiltered ? '未找到符合条件的公告' : '还没有公告'}
          </Typography.Text>
          <Typography.Text type="secondary">
            {isFiltered
              ? '调整筛选条件，或清除筛选后再试。'
              : '创建一则公告，向空间成员同步重要信息。'}
          </Typography.Text>
        </Space>
      }
      className={styles.emptyState}
    >
      <Space>
        {isFiltered ? <Button onClick={resetFilters}>清除筛选</Button> : null}
        {canManageAnnouncements ? (
          <Button
            className={styles.primaryAction}
            type="primary"
            onClick={openCreateModal}
          >
            新建公告
          </Button>
        ) : null}
      </Space>
    </Empty>
  );

  return (
    <TenantSelectionGuard title="团队公告">
      <Card className={styles.announcementsCard}>
        <Flex
          align="center"
          className={styles.toolbar}
          gap="middle"
          justify="space-between"
          wrap
        >
          <Segmented
            options={[
              { label: '全部', value: 'all' },
              { label: '草稿', value: 'draft' },
              { label: '已发布', value: 'published' },
              { label: '已撤回', value: 'withdrawn' },
            ]}
            value={statusFilter}
            onChange={(value) => {
              setPage(1);
              setStatusFilter(value as AnnouncementFilter);
            }}
          />
          <Flex
            align="center"
            className={styles.toolbarActions}
            gap="small"
            justify="flex-end"
            wrap={false}
          >
            <Input.Search
              allowClear
              value={keywordInput}
              placeholder="搜索公告"
              onChange={(event) => setKeywordInput(event.target.value)}
              onSearch={(value) => {
                setPage(1);
                setKeyword(value.trim());
              }}
            />
            {canManageAnnouncements ? (
              <Button
                className={styles.primaryAction}
                type="primary"
                onClick={openCreateModal}
              >
                新建公告
              </Button>
            ) : null}
          </Flex>
        </Flex>
        <Table<TeamAnnouncement>
          rowKey="id"
          size="middle"
          loading={announcementsQuery.isLoading}
          columns={columns}
          dataSource={announcementsQuery.data?.items || []}
          locale={{ emptyText: announcementEmptyText }}
          pagination={fixedPagePagination(
            announcementsQuery.data?.page || page,
            announcementsQuery.data?.page_size || PAGE_SIZE,
            announcementsQuery.data?.total || 0,
            setPage,
          )}
          scroll={announcementTableScroll}
          className={styles.table}
          style={{ marginTop: 20 }}
        />
      </Card>

      <Modal
        title="新建团队公告"
        open={createOpen}
        okText="创建草稿"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
      >
        <Form<AnnouncementFormValues>
          form={form}
          layout="vertical"
          onFinish={(values) => void submitCreate(values)}
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[
              { required: true, whitespace: true, message: '请输入标题' },
            ]}
          >
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item
            label="正文"
            name="body"
            rules={[
              { required: true, whitespace: true, message: '请输入正文' },
            ]}
          >
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item
            label="发布范围"
            name="team_id"
            rules={[{ required: true, message: '请选择发布范围' }]}
            extra="全组织范围仅对具备组织级公告管理权限的用户开放。"
          >
            <Select
              loading={teamsQuery.isLoading}
              options={teamOptions}
              placeholder="选择团队或全组织"
            />
          </Form.Item>
          <Form.Item label="过期时间" name="expires_at">
            <DatePicker showTime style={fullWidthStyle} />
          </Form.Item>
          <Form.Item
            label="要求成员确认"
            name="require_acknowledgement"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="公告详情"
        open={Boolean(detailAnnouncement)}
        size={drawerWidthMd}
        onClose={() => setDetailAnnouncement(undefined)}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="标题">
            {detailAnnouncement?.title || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="范围">
            {detailAnnouncement?.team_name || '全组织'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {detailAnnouncement ? (
              <Tag color={announcementStatusColor(detailAnnouncement.status)}>
                {detailAnnouncement.status__mapping}
              </Tag>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="确认进度">
            {detailAnnouncement?.require_acknowledgement
              ? `${detailAnnouncement.acknowledged_count}/${detailAnnouncement.recipient_count}`
              : '无需确认'}
          </Descriptions.Item>
          <Descriptions.Item label="发布时间">
            {detailAnnouncement?.published_at
              ? dayjs(detailAnnouncement.published_at).format(
                  'YYYY-MM-DD HH:mm',
                )
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="过期时间">
            {detailAnnouncement?.expires_at
              ? dayjs(detailAnnouncement.expires_at).format('YYYY-MM-DD HH:mm')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="正文">
            <Typography.Paragraph style={wrapTextStyle}>
              {detailAnnouncement?.body || '-'}
            </Typography.Paragraph>
          </Descriptions.Item>
        </Descriptions>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default TeamAnnouncementsPage;
