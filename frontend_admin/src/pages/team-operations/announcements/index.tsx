import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
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
type AnnouncementSearchState = {
  page: number;
  status: AnnouncementFilter;
  keyword: string;
  announcementId?: number;
};

function positiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readAnnouncementSearchState(): AnnouncementSearchState {
  if (typeof window === 'undefined') {
    return { page: 1, status: 'all', keyword: '' };
  }
  const search = new URLSearchParams(window.location.search);
  const status = search.get('status');
  return {
    page: positiveInteger(search.get('page')) || 1,
    status:
      status === 'draft' || status === 'published' || status === 'withdrawn'
        ? status
        : 'all',
    keyword: search.get('keyword')?.trim() || '',
    announcementId: positiveInteger(search.get('announcement_id')),
  };
}

function syncAnnouncementSearchState(state: AnnouncementSearchState) {
  if (typeof window === 'undefined') return;
  const search = new URLSearchParams(window.location.search);
  ['page', 'status', 'keyword', 'announcement_id'].forEach((name) => {
    search.delete(name);
  });
  if (state.page > 1) search.set('page', String(state.page));
  if (state.status !== 'all') search.set('status', state.status);
  if (state.keyword) search.set('keyword', state.keyword);
  if (state.announcementId) {
    search.set('announcement_id', String(state.announcementId));
  }
  const nextSearch = search.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', nextUrl);
}

const TeamAnnouncementsPage: React.FC = () => {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialSearchState = useMemo(readAnnouncementSearchState, []);
  const [page, setPage] = useState(initialSearchState.page);
  const [statusFilter, setStatusFilter] = useState<AnnouncementFilter>(
    initialSearchState.status,
  );
  const [keywordInput, setKeywordInput] = useState(initialSearchState.keyword);
  const [keyword, setKeyword] = useState(initialSearchState.keyword);
  const [requestedAnnouncementId, setRequestedAnnouncementId] = useState(
    initialSearchState.announcementId,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createDirty, setCreateDirty] = useState(false);
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
      requestedAnnouncementId,
    ],
    queryFn: () => {
      if (!requestedAnnouncementId) throw new Error('缺少公告 ID');
      return getTeamAnnouncement(requestedAnnouncementId);
    },
    enabled: enabled && Boolean(requestedAnnouncementId) && !detailAnnouncement,
  });

  useEffect(() => {
    syncAnnouncementSearchState({
      page,
      status: statusFilter,
      keyword,
      announcementId: requestedAnnouncementId,
    });
  }, [keyword, page, requestedAnnouncementId, statusFilter]);

  useEffect(() => {
    if (requestedAnnouncementQuery.data) {
      setDetailAnnouncement(requestedAnnouncementQuery.data);
    }
  }, [requestedAnnouncementQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: AnnouncementInput) => createTeamAnnouncement(payload),
    onSuccess: async () => {
      message.success('公告草稿已创建');
      setCreateDirty(false);
      setCreateOpen(false);
      form.resetFields();
      await invalidateTeamOperations(queryClient);
    },
    onError: () => message.error('公告创建失败，请稍后重试'),
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
    onError: () => message.error('公告发布失败，请稍后重试'),
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
    onError: () => message.error('公告撤回失败，请稍后重试'),
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
    onError: () => message.error('公告确认失败，请稍后重试'),
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
            label: '整个工作空间',
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
            {record.team_name || '整个工作空间'}
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
          <Button
            type="link"
            size="small"
            onClick={() => {
              setDetailAnnouncement(record);
              setRequestedAnnouncementId(record.id);
            }}
          >
            详情
          </Button>
          {record.can_manage && record.status === 'draft' ? (
            <Popconfirm
              title="确认发布该公告？"
              description="发布后会向目标成员发送站内信。"
              onConfirm={() => publishMutation.mutate(record.id)}
            >
              <Button
                type="link"
                size="small"
                loading={
                  publishMutation.isPending &&
                  publishMutation.variables === record.id
                }
                disabled={publishMutation.isPending}
              >
                发布
              </Button>
            </Popconfirm>
          ) : null}
          {record.can_manage && record.status === 'published' ? (
            <Popconfirm
              title="确认撤回该公告？"
              onConfirm={() => withdrawMutation.mutate(record.id)}
            >
              <Button
                danger
                type="link"
                size="small"
                loading={
                  withdrawMutation.isPending &&
                  withdrawMutation.variables === record.id
                }
                disabled={withdrawMutation.isPending}
              >
                撤回
              </Button>
            </Popconfirm>
          ) : null}
          {record.status === 'published' &&
          record.is_recipient &&
          record.require_acknowledgement &&
          !record.is_acknowledged ? (
            <Button
              type="link"
              size="small"
              loading={
                acknowledgeMutation.isPending &&
                acknowledgeMutation.variables === record.id
              }
              disabled={acknowledgeMutation.isPending}
              onClick={() => acknowledgeMutation.mutate(record.id)}
            >
              确认已知
            </Button>
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
    setCreateDirty(false);
    form.resetFields();
    form.setFieldsValue({ require_acknowledgement: false });
    setCreateOpen(true);
  };

  const closeCreateModal = () => {
    if (createMutation.isPending) return;
    if (!createDirty) {
      setCreateOpen(false);
      return;
    }
    Modal.confirm({
      title: '放弃未保存的公告？',
      content: '当前填写的内容不会保留。',
      okText: '放弃',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      onOk: () => {
        setCreateDirty(false);
        setCreateOpen(false);
        form.resetFields();
      },
    });
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
        <Space orientation="vertical" size={2}>
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
      {isFiltered ? <Button onClick={resetFilters}>清除筛选</Button> : null}
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
              onChange={(event) => {
                const value = event.target.value;
                setKeywordInput(value);
                if (!value) {
                  setPage(1);
                  setKeyword('');
                }
              }}
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
        {announcementsQuery.isError ? (
          <Alert
            showIcon
            type="error"
            title="公告列表加载失败"
            description="请检查网络连接后重试。"
            action={
              <Button
                size="small"
                autoInsertSpace={false}
                onClick={() => void announcementsQuery.refetch()}
              >
                重试
              </Button>
            }
            style={{ marginTop: 20 }}
          />
        ) : null}
        <Table<TeamAnnouncement>
          rowKey="id"
          size="middle"
          loading={announcementsQuery.isLoading}
          columns={columns}
          dataSource={announcementsQuery.data?.items || []}
          locale={{
            emptyText: announcementsQuery.isError
              ? '公告数据未加载'
              : announcementEmptyText,
          }}
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
        cancelButtonProps={{
          autoInsertSpace: false,
          disabled: createMutation.isPending,
        }}
        closable={!createMutation.isPending}
        keyboard={!createMutation.isPending}
        mask={{ closable: !createMutation.isPending }}
        onCancel={closeCreateModal}
        onOk={() => form.submit()}
      >
        <Form<AnnouncementFormValues>
          form={form}
          layout="vertical"
          onValuesChange={() => setCreateDirty(true)}
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
            extra="整个工作空间范围仅对具备空间级公告管理权限的用户开放。"
          >
            <Select
              loading={teamsQuery.isLoading}
              options={teamOptions}
              placeholder="选择团队或整个工作空间"
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
        onClose={() => {
          setDetailAnnouncement(undefined);
          setRequestedAnnouncementId(undefined);
        }}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="标题">
            {detailAnnouncement?.title || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="范围">
            {detailAnnouncement?.team_name || '整个工作空间'}
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
