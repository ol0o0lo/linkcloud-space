import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Alert, Button, Card, Col, Modal, message, Row, Segmented, Space, Statistic, Tag, Typography } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { enumMapping } from '@/services/manual/enums';
import { type HouseOut, houseApi, type ViewingRecordOut } from '@/services/manual/house';
import {
  canHousePublish,
  contactLabel,
  getHouseBlockingIssues,
  getHouseIssueActionHint,
  getHouseWarningIssues,
  getTrackedHousePublishIssues,
  HOUSE_PUBLISH_STATUS_COLOR,
  houseLabel,
  houseMediaReadinessText,
  moneyText,
  STATUS_COLOR,
} from './constants';

const dashboardHref = (path: string) => `/dashboard${path}`;
const HOUSE_ISSUE_TO_TASK: Record<string, 'landlord' | 'rent' | 'cover' | 'images' | 'floor_plan' | 'video'> = {
  缺房东: 'landlord',
  缺租金: 'rent',
  缺封面: 'cover',
  图片不足: 'images',
  缺户型图: 'floor_plan',
  视频不足: 'video',
};
const HOUSE_TASK_PRIORITY: Record<'landlord' | 'rent' | 'cover' | 'images' | 'floor_plan' | 'video', number> = {
  landlord: 0,
  rent: 1,
  cover: 2,
  images: 3,
  floor_plan: 4,
  video: 5,
};

type PublishFilterValue = 'all' | 'blocked' | 'ready';
type WorkflowFilterValue = 'all' | 'contact-missing' | 'converted';
const WORKBENCH_PUBLISH_FILTER_LABELS: Record<Exclude<PublishFilterValue, 'all'>, string> = {
  blocked: '阻断发布',
  ready: '待发布',
};
const WORKBENCH_WORKFLOW_FILTER_LABELS: Record<Exclude<WorkflowFilterValue, 'all'>, string> = {
  'contact-missing': '待补租客',
  converted: '待签约',
};

function getWorkbenchFiltersFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const publishFilter = params.get('publish');
  const workflowFilter = params.get('workflow');

  return {
    publishFilter: publishFilter === 'blocked' || publishFilter === 'ready' ? publishFilter : 'all',
    workflowFilter: workflowFilter === 'contact-missing' || workflowFilter === 'converted' ? workflowFilter : 'all',
  } satisfies { publishFilter: PublishFilterValue; workflowFilter: WorkflowFilterValue };
}

function syncWorkbenchFiltersSearch(filters: { publishFilter: PublishFilterValue; workflowFilter: WorkflowFilterValue }) {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  if (filters.publishFilter === 'all') params.delete('publish');
  else params.set('publish', filters.publishFilter);

  if (filters.workflowFilter === 'all') params.delete('workflow');
  else params.set('workflow', filters.workflowFilter);

  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (currentUrl !== nextUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

type WorkflowTaskRow =
  { key: string; queueKey: 'contact-missing' | 'converted'; queue: string; title: string; house: string; status: string; nextStep: string; actionLabel: string; actionPath: string };

type PublishWorkbenchRow = {
  key: string;
  stage: 'blocked' | 'ready';
  house: HouseOut;
  issues: string[];
  actionLabel: string;
  actionPath: string;
  actionHint: string;
};

export function getHouseTaskLink(record: HouseOut) {
  const issues = getTrackedHousePublishIssues(record);
  const needsMetadata = issues.includes('缺房东') || issues.includes('缺租金');
  const needsMedia = issues.includes('缺封面') || issues.includes('图片不足') || issues.includes('缺户型图') || issues.includes('视频不足');
  const basePath = `/property-rental/houses/${record.id}`;
  const primaryTask = issues
    .map((issue) => HOUSE_ISSUE_TO_TASK[issue])
    .filter(Boolean)
    .sort((left, right) => HOUSE_TASK_PRIORITY[left] - HOUSE_TASK_PRIORITY[right])[0];
  const action = primaryTask === 'cover' || primaryTask === 'images' || primaryTask === 'floor_plan' || primaryTask === 'video' ? 'media' : primaryTask ? 'edit' : undefined;
  const nextSearch = action
    ? `?action=${action}${primaryTask ? `&task=${primaryTask}` : ''}`
    : '';
  if (needsMetadata && needsMedia) return { label: '处理发布问题', path: `${basePath}${nextSearch}` };
  if (needsMetadata) return { label: '补资料', path: `${basePath}${nextSearch}` };
  if (needsMedia) return { label: '维护相册', path: `${basePath}${nextSearch}` };
  if (!issues.length && canHousePublish(record) && record.publish_status !== 'published') return { label: '检查后发布', path: basePath };
  return { label: '详情', path: basePath };
}

export function buildPublishWorkbenchRows(blockedHouses: HouseOut[], readyHouses: HouseOut[]): PublishWorkbenchRow[] {
  return [
    ...blockedHouses.map((house) => {
      const action = getHouseTaskLink(house);
      return {
        key: `blocked-${house.id}`,
        stage: 'blocked' as const,
        house,
        issues: getTrackedHousePublishIssues(house),
        actionLabel: action.label,
        actionPath: action.path,
        actionHint: getHouseIssueActionHint(house),
      };
    }),
    ...readyHouses.map((house) => {
      const action = getHouseTaskLink(house);
      const warnings = getHouseWarningIssues(house);
      return {
        key: `ready-${house.id}`,
        stage: 'ready' as const,
        house,
        issues: warnings,
        actionLabel: action.label,
        actionPath: action.path,
        actionHint: warnings.length ? `允许先发布，当前仍有 ${warnings[0]}${warnings.length > 1 ? ` 等 ${warnings.length} 项提醒` : ' 提醒'}` : '资料已完整，可直接发布承接带看。',
      };
    }),
  ];
}

export function buildWorkflowTasks(
  pendingLeaseMissingContacts: ViewingRecordOut[],
  pendingLeaseReady: ViewingRecordOut[],
): WorkflowTaskRow[] {
  return [
    ...pendingLeaseMissingContacts.map((item) => ({
      key: `viewing-${item.id}`,
      queueKey: 'contact-missing' as const,
      queue: '成交待补主体',
      title: `${item.customer_name} 待补租客`,
      house: houseLabel(item),
      status: '待补租客',
      nextStep: '先绑定租客联系人，再创建租约',
      actionLabel: '补租客',
      actionPath: `/property-rental/viewings?pending_lease=true&contact_missing=true&edit=${item.id}`,
    })),
    ...pendingLeaseReady.map((item) => ({
      key: `viewing-${item.id}`,
      queueKey: 'converted' as const,
      queue: '成交待签约',
      title: `${item.customer_name} 待签约`,
      house: houseLabel(item),
      status: '已成交待签约',
      nextStep: '立即创建租约并同步合同资料',
      actionLabel: '去签约',
      actionPath: `/property-rental/leases?source_viewing_record_id=${item.id}`,
    })),
  ];
}

function openDashboardPath(path: string, event?: React.MouseEvent<HTMLElement>) {
  event?.preventDefault();
  history.push(path);
}

const WorkbenchPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialFilters = typeof window === 'undefined' ? { publishFilter: 'all' as const, workflowFilter: 'all' as const } : getWorkbenchFiltersFromSearch(window.location.search);
  const [publishFilter, setPublishFilter] = useState<PublishFilterValue>(initialFilters.publishFilter);
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilterValue>(initialFilters.workflowFilter);
  const [publishConfirmHouseId, setPublishConfirmHouseId] = useState<number | null>(null);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houses = useQuery({
    queryKey: ['house', 'workbench', 'houses', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listHouses({ page: 1, page_size: 100 }),
    enabled,
  });
  const pendingLeaseMissingContacts = useQuery({
    queryKey: ['house', 'workbench', 'pending-lease-missing-contacts', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 5, pending_lease: true, contact_missing: true }),
    enabled,
  });
  const pendingLeaseReady = useQuery({
    queryKey: ['house', 'workbench', 'pending-lease-ready', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 5, pending_lease: true, contact_missing: false }),
    enabled,
  });
  const patchHouse = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Record<string, unknown> }) => houseApi.patchHouse(id, values),
    onSuccess: async () => {
      message.success('房源已发布');
      await queryClient.invalidateQueries({ queryKey: ['house', 'workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['house', 'houses'] });
    },
  });

  const houseItems = houses.data?.items || [];
  const blockedHouseItems = houseItems.filter((house) => house.publish_status !== 'published' && !canHousePublish(house));
  const readyHouseItems = houseItems.filter((house) => house.publish_status !== 'published' && canHousePublish(house));
  const totalHouseCount = houses.data?.total || 0;
  const blockedCount = blockedHouseItems.length;
  const readyCount = readyHouseItems.length;
  const missingContactCount = pendingLeaseMissingContacts.data?.total || 0;
  const readyLeaseCount = pendingLeaseReady.data?.total || 0;
  const overviewItems = [
    { key: 'total', title: '在管房源', value: totalHouseCount },
    { key: 'blocked', title: '阻断发布', value: blockedCount },
    { key: 'ready', title: '可发布', value: readyCount },
    { key: 'contact-missing', title: '待补租客', value: missingContactCount },
    { key: 'lease', title: '待签约', value: readyLeaseCount },
  ];
  const visibleOverviewItems = overviewItems.filter((item, index) => index === 0 || item.value > 0);
  const publishWorkbenchRows = buildPublishWorkbenchRows(blockedHouseItems.slice(0, 5), readyHouseItems.slice(0, 5));
  const workflowTasks = buildWorkflowTasks(
    pendingLeaseMissingContacts.data?.items || [],
    pendingLeaseReady.data?.items || [],
  );
  const filteredPublishWorkbenchRows = useMemo(() => {
    if (publishFilter === 'blocked') return publishWorkbenchRows.filter((item) => item.stage === 'blocked');
    if (publishFilter === 'ready') return publishWorkbenchRows.filter((item) => item.stage === 'ready');
    return publishWorkbenchRows;
  }, [publishFilter, publishWorkbenchRows]);
  const filteredWorkflowTasks = useMemo(() => {
    if (workflowFilter === 'all') return workflowTasks;
    return workflowTasks.filter((item) => item.queueKey === workflowFilter);
  }, [workflowFilter, workflowTasks]);
  const activeFilterSummary = useMemo(() => {
    const labels: string[] = [];
    if (publishFilter !== 'all') labels.push(`发布工作区：${WORKBENCH_PUBLISH_FILTER_LABELS[publishFilter]}`);
    if (workflowFilter !== 'all') labels.push(`转签与合同：${WORKBENCH_WORKFLOW_FILTER_LABELS[workflowFilter]}`);
    return labels;
  }, [publishFilter, workflowFilter]);
  const sectionStyle = {
    border: '1px solid var(--ant-color-border-secondary)',
    borderRadius: 8,
    background: 'var(--ant-color-bg-container)',
    padding: 16,
  } as const;
  const overviewTileStyle = {
    border: '1px solid var(--ant-color-border-secondary)',
    borderRadius: 8,
    background: 'var(--ant-color-fill-quaternary)',
    height: '100%',
    padding: 16,
  } as const;

  useEffect(() => {
    syncWorkbenchFiltersSearch({ publishFilter, workflowFilter });
  }, [publishFilter, workflowFilter]);

  return (
    <TenantSelectionGuard title="房源工作台">
      <div style={sectionStyle}>
        <Typography.Text strong>经营总览</Typography.Text>
        <Row gutter={[16, 16]}>
          {visibleOverviewItems.map((item) => (
            <Col key={item.key} xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title={item.title} value={item.value} />
              </div>
            </Col>
          ))}
        </Row>
      </div>

      {activeFilterSummary.length ? (
        <Alert
          showIcon
          type="info"
          style={{ marginTop: 16 }}
          title={(
            <Space wrap size={[8, 8]}>
              <Typography.Text>{`当前只看：${activeFilterSummary.join(' / ')}`}</Typography.Text>
              <a
                href={dashboardHref('/property-rental/workbench')}
                onClick={(event) => {
                  event.preventDefault();
                  setPublishFilter('all');
                  setWorkflowFilter('all');
                }}
              >
                查看全部
              </a>
            </Space>
          )}
        />
      ) : null}

      <Card
        title="发布工作区"
        style={{ marginTop: 16 }}
        extra={(
          <Space wrap size={[8, 8]}>
            <Typography.Text type="secondary">{`显示 ${filteredPublishWorkbenchRows.length} / ${publishWorkbenchRows.length}`}</Typography.Text>
            <Segmented
              options={[
                { label: `全部 ${publishWorkbenchRows.length}`, value: 'all' },
                { label: `阻断发布 ${blockedCount}`, value: 'blocked' },
                { label: `待发布 ${readyCount}`, value: 'ready' },
              ]}
              value={publishFilter}
              onChange={(value) => setPublishFilter(value as PublishFilterValue)}
            />
          </Space>
        )}
      >
        <ProTable<PublishWorkbenchRow>
          rowKey="key"
          loading={houses.isLoading}
          search={false}
          options={false}
          ghost
          columns={[
            { title: '房源', dataIndex: 'house', render: (_value, record) => houseLabel(record.house) },
            {
              title: '当前阶段',
              dataIndex: 'stage',
              render: (_value, record) => (
                <Space size={4} wrap>
                  <Tag color={record.stage === 'blocked' ? 'orange' : 'blue'}>{record.stage === 'blocked' ? '阻断发布' : '待发布'}</Tag>
                  {record.stage === 'ready' && record.issues.length ? <Tag color="cyan">仅提醒</Tag> : null}
                  <Tag color={STATUS_COLOR[record.house.status] || 'default'}>{enumMapping(record.house.status, record.house.status__mapping)}</Tag>
                  <Tag color={HOUSE_PUBLISH_STATUS_COLOR[record.house.publish_status] || 'default'}>{enumMapping(record.house.publish_status, record.house.publish_status__mapping)}</Tag>
                </Space>
              ),
            },
            {
              title: '关键问题',
              dataIndex: 'issues',
              render: (_value, record) => {
                const blockingIssues = getHouseBlockingIssues(record.house);
                const warningIssues = record.stage === 'ready' ? record.issues : getHouseWarningIssues(record.house);
                if (blockingIssues.length || warningIssues.length) {
                  return (
                    <Space size={[4, 4]} wrap>
                      {blockingIssues.map((item) => <Tag color="orange" key={`blocking-${item}`}>{item}</Tag>)}
                      {warningIssues.map((item) => <Tag color="blue" key={`warning-${item}`}>{item}</Tag>)}
                    </Space>
                  );
                }
                return <Typography.Text type="success">资料完整，可直接上架</Typography.Text>;
              },
            },
            {
              title: '建议动作',
              dataIndex: 'action_hint',
              render: (_value, record) => (
                <Space orientation="vertical" size={0}>
                  <Typography.Text>{record.actionHint}</Typography.Text>
                  <Typography.Text type="secondary">
                    {record.stage === 'blocked'
                      ? `${record.house.landlord_id ? contactLabel(record.house) : '待补房东'} / ${moneyText(record.house.asking_rent)} / ${houseMediaReadinessText(record.house)}`
                      : `${contactLabel(record.house)} / ${moneyText(record.house.asking_rent)} / ${houseMediaReadinessText(record.house)}`}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: '操作',
              dataIndex: 'actions',
              fixed: 'right',
              width: 140,
              render: (_value, record) => {
                const actionHref = dashboardHref(record.actionPath);
                return (
                  <Space size={8} wrap={false} style={{ whiteSpace: 'nowrap' }}>
                    <a
                      href={actionHref}
                      onClick={(event) => openDashboardPath(record.actionPath, event)}
                    >
                      {record.actionLabel}
                    </a>
                    {record.stage === 'ready' ? (
                      <Button
                        type="link"
                        size="small"
                        loading={patchHouse.isPending}
                        onClick={() => setPublishConfirmHouseId(record.house.id)}
                      >
                        发布
                      </Button>
                    ) : null}
                  </Space>
                );
              },
            },
          ]}
          dataSource={filteredPublishWorkbenchRows}
          pagination={false}
          locale={{ emptyText: publishFilter === 'all' ? '暂无发布相关房源' : '当前筛选下暂无房源' }}
          scroll={adminTableScroll}
        />
      </Card>

      <Modal
        open={publishConfirmHouseId !== null}
        title="确认发布房源"
        okText="确认发布"
        cancelText="先取消"
        transitionName=""
        maskTransitionName=""
        onCancel={() => setPublishConfirmHouseId(null)}
        onOk={async () => {
          const nextId = publishConfirmHouseId;
          if (nextId === null) return;
          setPublishConfirmHouseId(null);
          await patchHouse.mutateAsync({ id: nextId, values: { publish_status: 'published' } });
        }}
      >
        <Typography.Text>这套房源已经具备发布条件，确认后会直接切换为已发布状态。</Typography.Text>
      </Modal>

      <Card
        title="成交转签"
        style={{ marginTop: 16 }}
        extra={(
          <Space wrap size={[8, 8]}>
            <Typography.Text type="secondary">{`显示 ${filteredWorkflowTasks.length} / ${workflowTasks.length}`}</Typography.Text>
            <Segmented
              options={[
                { label: `全部 ${workflowTasks.length}`, value: 'all' },
                { label: `待补租客 ${missingContactCount}`, value: 'contact-missing' },
                { label: `待签约 ${readyLeaseCount}`, value: 'converted' },
              ]}
              value={workflowFilter}
              onChange={(value) => setWorkflowFilter(value as WorkflowFilterValue)}
            />
          </Space>
        )}
      >
        <ProTable<WorkflowTaskRow>
          rowKey="key"
          search={false}
          options={false}
          ghost
          columns={[
            { title: '任务队列', dataIndex: 'queue' },
            { title: '任务', dataIndex: 'title' },
            { title: '房源', dataIndex: 'house' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value) => <Tag color={value === '待补租客' ? 'gold' : 'purple'}>{value}</Tag>,
            },
            { title: '下一步', dataIndex: 'nextStep', render: (value) => <Typography.Text type="secondary">{value}</Typography.Text> },
            {
              title: '操作',
              dataIndex: 'actions',
              fixed: 'right',
              width: 120,
              render: (_value, record) => (
                <Space size={8} wrap={false} style={{ whiteSpace: 'nowrap' }}>
                  <a
                    href={dashboardHref(record.actionPath)}
                    onClick={(event) => openDashboardPath(record.actionPath, event)}
                  >
                    {record.actionLabel}
                  </a>
                </Space>
              ),
            },
          ]}
          dataSource={filteredWorkflowTasks}
          pagination={false}
          locale={{ emptyText: workflowFilter === 'all' ? '暂无成交转签待办' : '当前筛选下暂无待办' }}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default WorkbenchPage;
