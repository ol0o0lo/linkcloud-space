import { PlusOutlined } from '@ant-design/icons';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Col,
  Input,
  Modal,
  message,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useRef, useState } from 'react';
import {
  adminTableScroll,
  fixedPagePagination,
  ResponsiveActions,
  SectionHeader,
  toolbarControlStyle,
  toolbarSelectPopupWidth,
  toolbarShortSelectStyle,
} from '@/pages/_shared/adminLayout';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/tenant/shared';
import {
  enumMapping,
  enumOptionMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import {
  type BuildingOut,
  type EstateOut,
  type HouseOut,
  houseApi,
} from '@/services/manual/house';
import {
  buildingLabel,
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
} from '../constants';
import {
  getLoadingAwareEmptyState,
  getLoadingSafeCount,
  isAnyInitialQueryPending,
  isInitialQueryPending,
} from '../loading';

const PAGE_SIZE = 20;
type HouseTask =
  | 'blocked'
  | 'ready'
  | 'published'
  | 'unpublished'
  | 'landlord'
  | 'rent'
  | 'cover'
  | 'images'
  | 'floor_plan'
  | 'video';
type HouseIssueTask = Extract<
  HouseTask,
  'landlord' | 'rent' | 'cover' | 'images' | 'floor_plan' | 'video'
>;

const TASK_TEXT: Record<HouseTask, string> = {
  blocked: '待补资料',
  ready: '可发布',
  published: '已发布',
  unpublished: '已下架',
  landlord: '待补房东',
  rent: '待补租金',
  cover: '待补封面',
  images: '图片少于 3 张',
  floor_plan: '缺户型图',
  video: '待补视频',
};

const HOUSE_ISSUE_TASKS: HouseIssueTask[] = [
  'landlord',
  'rent',
  'cover',
  'images',
  'floor_plan',
  'video',
];

type HouseScopeFilters = {
  task?: HouseTask;
  estateId?: number;
  buildingId?: number;
  status?: string;
  publishStatus?: string;
  q?: string;
};

function parseHouseTask(value?: string | null): HouseTask | undefined {
  if (!value) return undefined;
  if (
    value === 'blocked' ||
    value === 'ready' ||
    value === 'published' ||
    value === 'unpublished' ||
    value === 'landlord' ||
    value === 'rent' ||
    value === 'cover' ||
    value === 'images' ||
    value === 'floor_plan' ||
    value === 'video'
  ) {
    return value;
  }
  return undefined;
}

function isHouseIssueTask(task?: HouseTask): task is HouseIssueTask {
  return Boolean(task && HOUSE_ISSUE_TASKS.includes(task as HouseIssueTask));
}

function getHouseTaskQuery(task?: HouseTask) {
  if (task === 'blocked') return { publish_blocked: true };
  if (task === 'ready') return { publish_ready: true };
  if (task === 'published') return { publish_status: 'published' };
  if (task === 'unpublished') return { publish_status: 'unpublished' };
  if (isHouseIssueTask(task)) return { publish_issue: task };
  return {};
}

function getHousePriorityIssueTask(
  record: HouseOut,
): HouseIssueTask | undefined {
  const issues = getTrackedHousePublishIssues(record);
  if (issues.includes('缺房东')) return 'landlord';
  if (issues.includes('缺租金')) return 'rent';
  if (issues.includes('缺封面')) return 'cover';
  if (issues.includes('图片不足')) return 'images';
  if (issues.includes('缺户型图')) return 'floor_plan';
  if (issues.includes('视频不足')) return 'video';
  return undefined;
}

function getHouseReadinessSummary(record: HouseOut) {
  const blockingIssues = getHouseBlockingIssues(record);
  const warningIssues = getHouseWarningIssues(record);
  const mediaText = houseMediaReadinessText(record);
  if (!blockingIssues.length && !warningIssues.length) {
    return {
      text: '资料完整',
      description: `${mediaText} · ${record.publish_status === 'published' ? '已上架承接带看' : '资料完整，可直接发布'}`,
      color: 'green' as const,
    };
  }
  if (canHousePublish(record)) {
    return {
      text: '可发布',
      description: `${mediaText} · ${warningIssues[0]}${warningIssues.length > 1 ? ` 等 ${warningIssues.length} 项仅提醒，不阻断发布` : ' 仅作提醒，不阻断发布'}`,
      color: 'blue' as const,
    };
  }
  return {
    text: '阻断发布',
    description: `${mediaText} · 待补 ${blockingIssues[0]}${blockingIssues.length > 1 ? ` 等 ${blockingIssues.length} 项阻断` : ''}`,
    color: 'orange' as const,
  };
}

function getHouseListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page') || '1');
  const estateIdValue = Number(params.get('estate_id') || '');
  const buildingIdValue = Number(params.get('building_id') || '');
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    task: parseHouseTask(params.get('task')),
    estateId:
      Number.isFinite(estateIdValue) && estateIdValue > 0
        ? estateIdValue
        : undefined,
    buildingId:
      Number.isFinite(buildingIdValue) && buildingIdValue > 0
        ? buildingIdValue
        : undefined,
    status: params.get('status') || undefined,
    publishStatus: params.get('publish_status') || undefined,
    q: params.get('keyword') || undefined,
  };
}

function syncHouseListSearch(filters: HouseScopeFilters & { page: number }) {
  const params = new URLSearchParams();
  if (filters.task) params.set('task', filters.task);
  if (filters.estateId) params.set('estate_id', String(filters.estateId));
  if (filters.buildingId) params.set('building_id', String(filters.buildingId));
  if (filters.status) params.set('status', filters.status);
  if (filters.publishStatus)
    params.set('publish_status', filters.publishStatus);
  if (filters.q) params.set('keyword', filters.q);
  if (filters.page > 1) params.set('page', String(filters.page));
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function buildHouseDetailHref(
  houseId: number,
  action?: 'edit' | 'media',
  task?: string,
) {
  const params = new URLSearchParams();
  if (action) params.set('action', action);
  if (task) params.set('task', task);
  const nextSearch = params.toString();
  return `/dashboard/property-rental/houses/${houseId}${nextSearch ? `?${nextSearch}` : ''}`;
}

function getHouseTaskLink(record: HouseOut, currentTask?: HouseTask) {
  const issues = getTrackedHousePublishIssues(record);
  const priorityTask = getHousePriorityIssueTask(record);
  if (isHouseIssueTask(currentTask)) {
    if (currentTask === 'landlord')
      return {
        label: '补房东',
        href: buildHouseDetailHref(record.id, 'edit', currentTask),
      };
    if (currentTask === 'rent')
      return {
        label: '补租金',
        href: buildHouseDetailHref(record.id, 'edit', currentTask),
      };
    return {
      label:
        currentTask === 'cover'
          ? '补封面'
          : currentTask === 'images'
            ? '补图片'
            : currentTask === 'floor_plan'
              ? '补户型图'
              : '补视频',
      href: buildHouseDetailHref(record.id, 'media', currentTask),
    };
  }
  if (currentTask === 'ready')
    return {
      label: record.publish_status === 'published' ? '详情' : '检查后发布',
      href: buildHouseDetailHref(record.id),
    };
  if (currentTask === 'published')
    return { label: '查看在线房源', href: buildHouseDetailHref(record.id) };
  if (currentTask === 'unpublished')
    return {
      label: issues.length ? '重新整理后发布' : '查看详情',
      href: buildHouseDetailHref(
        record.id,
        priorityTask && (priorityTask === 'landlord' || priorityTask === 'rent')
          ? 'edit'
          : priorityTask
            ? 'media'
            : undefined,
        priorityTask,
      ),
    };
  if (currentTask === 'blocked' && priorityTask) {
    if (priorityTask === 'landlord')
      return {
        label: '补房东',
        href: buildHouseDetailHref(record.id, 'edit', priorityTask),
      };
    if (priorityTask === 'rent')
      return {
        label: '补租金',
        href: buildHouseDetailHref(record.id, 'edit', priorityTask),
      };
    return {
      label:
        priorityTask === 'cover'
          ? '补封面'
          : priorityTask === 'images'
            ? '补图片'
            : priorityTask === 'floor_plan'
              ? '补户型图'
              : '补视频',
      href: buildHouseDetailHref(record.id, 'media', priorityTask),
    };
  }
  if (issues.length && priorityTask) {
    const action =
      priorityTask === 'landlord' || priorityTask === 'rent' ? 'edit' : 'media';
    const onlyMediaIssues = issues.every(
      (item) =>
        item === '缺封面' ||
        item === '图片不足' ||
        item === '缺户型图' ||
        item === '视频不足',
    );
    const onlyMetadataIssues = issues.every(
      (item) => item === '缺房东' || item === '缺租金',
    );
    return {
      label: onlyMediaIssues
        ? '维护相册'
        : onlyMetadataIssues
          ? '补资料'
          : issues.length > 1
            ? '处理发布问题'
            : action === 'edit'
              ? '补资料'
              : '维护相册',
      href: buildHouseDetailHref(record.id, action, priorityTask),
    };
  }
  if (
    !issues.length &&
    canHousePublish(record) &&
    record.publish_status !== 'published'
  ) {
    return { label: '检查后发布', href: buildHouseDetailHref(record.id) };
  }
  return { label: '详情', href: buildHouseDetailHref(record.id) };
}

function getHouseScopeText(
  filters: HouseScopeFilters,
  estates: EstateOut[],
  buildings: BuildingOut[],
  enumLabel: (key: string, value?: string | null) => string,
) {
  const scopes: string[] = [];
  if (filters.task && TASK_TEXT[filters.task])
    scopes.push(TASK_TEXT[filters.task]);
  if (filters.estateId) {
    const estate = estates.find((item) => item.id === filters.estateId);
    scopes.push(
      `项目：${estate?.display_name || estate?.name || `#${filters.estateId}`}`,
    );
  }
  if (filters.buildingId) {
    const building = buildings.find((item) => item.id === filters.buildingId);
    scopes.push(
      `楼栋：${buildingLabel(building || { id: filters.buildingId })}`,
    );
  }
  if (filters.status)
    scopes.push(`房态：${enumLabel('house.house_status', filters.status)}`);
  if (filters.publishStatus)
    scopes.push(
      `发布：${enumLabel('house.house_publish_status', filters.publishStatus)}`,
    );
  if (filters.q) scopes.push(`搜索：${filters.q}`);
  return scopes.join(' / ');
}

const HousesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialListState = useRef(
    getHouseListStateFromSearch(window.location.search),
  );
  const [task, setTask] = useState<HouseTask | undefined>(
    initialListState.current.task,
  );
  const [estateId, setEstateId] = useState<number | undefined>(
    initialListState.current.estateId,
  );
  const [buildingId, setBuildingId] = useState<number | undefined>(
    initialListState.current.buildingId,
  );
  const [status, setStatus] = useState<string | undefined>(
    initialListState.current.status,
  );
  const [publishStatus, setPublishStatus] = useState<string | undefined>(
    initialListState.current.publishStatus,
  );
  const [q, setQ] = useState<string | undefined>(initialListState.current.q);
  const [searchDraft, setSearchDraft] = useState(
    initialListState.current.q || '',
  );
  const [page, setPage] = useState(initialListState.current.page);
  const [publishConfirmHouseId, setPublishConfirmHouseId] = useState<
    number | null
  >(null);
  const [publishConfirmStatus, setPublishConfirmStatus] = useState<
    'published' | 'unpublished' | null
  >(null);
  const taskQuery = getHouseTaskQuery(task);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseEnums = useEnums([
    'house.house_status',
    'house.house_publish_status',
  ]);
  const estates = useQuery({
    queryKey: ['house', 'estates', 'house-filter', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listEstates({ page: 1, page_size: 100 }),
    enabled,
  });
  const buildings = useQuery({
    queryKey: [
      'house',
      'buildings',
      'house-filter',
      workspace.selectedOrgSlug,
      estateId,
    ],
    queryFn: () =>
      houseApi.listBuildings({ page: 1, page_size: 100, estate_id: estateId }),
    enabled,
  });
  const overviewQueries = useQueries({
    queries: [
      {
        queryKey: [
          'house',
          'houses',
          'overview',
          workspace.selectedOrgSlug,
          'total',
        ],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1 }),
        enabled,
      },
      {
        queryKey: [
          'house',
          'houses',
          'overview',
          workspace.selectedOrgSlug,
          'blocked',
        ],
        queryFn: () =>
          houseApi.listHouses({ page: 1, page_size: 1, publish_blocked: true }),
        enabled,
      },
      {
        queryKey: [
          'house',
          'houses',
          'overview',
          workspace.selectedOrgSlug,
          'ready',
        ],
        queryFn: () =>
          houseApi.listHouses({ page: 1, page_size: 1, publish_ready: true }),
        enabled,
      },
      {
        queryKey: [
          'house',
          'houses',
          'overview',
          workspace.selectedOrgSlug,
          'published',
        ],
        queryFn: () =>
          houseApi.listHouses({
            page: 1,
            page_size: 1,
            publish_status: 'published',
          }),
        enabled,
      },
    ],
  });
  const houses = useQuery({
    queryKey: [
      'house',
      'houses',
      workspace.selectedOrgSlug,
      page,
      estateId,
      buildingId,
      status,
      publishStatus,
      task,
      q,
    ],
    queryFn: () =>
      houseApi.listHouses({
        page,
        page_size: PAGE_SIZE,
        estate_id: estateId,
        building_id: buildingId,
        status,
        publish_status: publishStatus,
        keyword: q,
        ...taskQuery,
      }),
    enabled,
  });
  const scopedOverview = Boolean(
    estateId || buildingId || status || publishStatus || task || q,
  );
  const patchHouse = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: number;
      values: Record<string, unknown>;
    }) => houseApi.patchHouse(id, values),
    onSuccess: async () => {
      message.success('房源状态已更新');
      await queryClient.invalidateQueries({ queryKey: ['house', 'houses'] });
    },
  });
  const openPublishConfirm = (
    id: number,
    nextStatus: 'published' | 'unpublished',
  ) => {
    setPublishConfirmHouseId(id);
    setPublishConfirmStatus(nextStatus);
  };
  const rows = houses.data?.items || [];
  const totalCount = overviewQueries[0]?.data?.total || 0;
  const blockedCount = overviewQueries[1]?.data?.total || 0;
  const readyCount = overviewQueries[2]?.data?.total || 0;
  const publishedCount = overviewQueries[3]?.data?.total || 0;
  const scopedTotalCount = houses.data?.total || 0;
  const overviewLoading =
    isAnyInitialQueryPending(overviewQueries) ||
    (scopedOverview && isInitialQueryPending(houses));
  const listLoading = isInitialQueryPending(houses);
  const estateItems = (estates.data?.items || []) as EstateOut[];
  const buildingItems = (buildings.data?.items || []) as BuildingOut[];
  const enumLabel = (key: string, value?: string | null) =>
    enumOptionMapping(houseEnums.data, key, value);
  const houseStatusOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_status',
  );
  const housePublishStatusOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_publish_status',
  );
  const scopeText = getHouseScopeText(
    { task, estateId, buildingId, status, publishStatus, q },
    estateItems,
    buildingItems,
    enumLabel,
  );
  const estateOptions = estateItems.map((estate) => ({
    value: estate.id,
    label: estate.display_name || estate.name,
  }));
  const buildingOptions = buildingItems.map((building) => ({
    value: building.id,
    label: buildingLabel(building),
  }));
  const { token } = theme.useToken();
  const sectionStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
    padding: 16,
  } as const;
  const overviewTileStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorFillQuaternary,
    height: '100%',
    padding: 16,
  } as const;
  const overviewCards = [
    {
      key: 'total',
      title: scopedOverview ? '当前筛选结果' : '在管房源',
      count: scopedOverview ? scopedTotalCount : totalCount,
    },
    {
      key: 'blocked',
      title: '阻断发布',
      count: blockedCount,
    },
    {
      key: 'ready',
      title: '可发布',
      count: readyCount,
    },
    {
      key: 'published',
      title: '已发布',
      count: publishedCount,
    },
  ];

  useEffect(() => {
    syncHouseListSearch({
      page,
      task,
      estateId,
      buildingId,
      status,
      publishStatus,
      q,
    });
  }, [page, task, estateId, buildingId, status, publishStatus, q]);

  useEffect(() => {
    const handlePopState = () => {
      const listState = getHouseListStateFromSearch(window.location.search);
      setTask(listState.task);
      setEstateId(listState.estateId);
      setBuildingId(listState.buildingId);
      setStatus(listState.status);
      setPublishStatus(listState.publishStatus);
      setQ(listState.q);
      setSearchDraft(listState.q || '');
      setPage(listState.page);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const columns: ColumnsType<HouseOut> = [
    {
      title: '房源',
      dataIndex: 'house_label',
      width: 220,
      render: (_value, record) => houseLabel(record),
    },
    {
      title: '房东',
      dataIndex: 'landlord_name',
      width: 180,
      render: (_value, record) =>
        record.landlord_id ? contactLabel(record) : '待补房东',
    },
    {
      title: '挂牌租金',
      dataIndex: 'asking_rent',
      width: 100,
      render: (value) => moneyText(value),
    },
    {
      title: '可租日期',
      dataIndex: 'available_from',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: '发布准备',
      dataIndex: 'readiness',
      width: 180,
      render: (_value, record) => {
        const readiness = getHouseReadinessSummary(record);
        return (
          <Space orientation="vertical" size={2}>
            <Typography.Text
              strong
              type={
                readiness.color === 'green'
                  ? 'success'
                  : readiness.color === 'blue'
                    ? 'secondary'
                    : 'warning'
              }
            >
              {readiness.text}
            </Typography.Text>
            <Typography.Text type="secondary">
              {readiness.description}
            </Typography.Text>
          </Space>
        );
      },
    },
    {
      title: '当前动作',
      dataIndex: 'next_action',
      width: 220,
      render: (_value, record) => {
        if (record.publish_status === 'published')
          return (
            <Typography.Text type="secondary">
              保持在线，留意租金和可租日期变化
            </Typography.Text>
          );
        if (!getTrackedHousePublishIssues(record).length)
          return (
            <Typography.Text type="secondary">
              资料完整，可直接发布
            </Typography.Text>
          );
        return (
          <Typography.Text type="secondary">
            {getHouseIssueActionHint(record)}
          </Typography.Text>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 140,
      render: (_value, record) => (
        <Space size={4} wrap>
          {record.publish_status !== 'published' ? (
            <Tag color={canHousePublish(record) ? 'blue' : 'orange'}>
              {canHousePublish(record) ? '可发布' : '阻断发布'}
            </Tag>
          ) : null}
          <Tag color={STATUS_COLOR[record.status] || 'default'}>
            {enumMapping(record.status, record.status__mapping)}
          </Tag>
          <Tag
            color={
              HOUSE_PUBLISH_STATUS_COLOR[record.publish_status] || 'default'
            }
          >
            {enumMapping(record.publish_status, record.publish_status__mapping)}
          </Tag>
        </Space>
      ),
    },
    {
      title: '资料问题',
      dataIndex: 'issues',
      width: 240,
      render: (_value, record) => {
        const blockingIssues = getHouseBlockingIssues(record);
        const warningIssues = getHouseWarningIssues(record);
        if (!blockingIssues.length && !warningIssues.length)
          return <Typography.Text type="success">完整</Typography.Text>;
        return (
          <Space size={[4, 4]} wrap>
            {blockingIssues.map((item) => (
              <Tag color="orange" key={`blocking-${item}`}>
                {item}
              </Tag>
            ))}
            {warningIssues.map((item) => (
              <Tag color="blue" key={`warning-${item}`}>
                {item}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 100,
      render: (_value, record) => {
        const taskLink = getHouseTaskLink(record, task);
        return (
          <ResponsiveActions>
            <a href={taskLink.href}>{taskLink.label}</a>
            {record.publish_status === 'published' ? (
              <Button
                type="link"
                size="small"
                onClick={() => openPublishConfirm(record.id, 'unpublished')}
              >
                下架
              </Button>
            ) : !canHousePublish(record) ? (
              <Tooltip title="请先补齐资料问题">
                <Button type="link" size="small" disabled>
                  待补齐
                </Button>
              </Tooltip>
            ) : (
              <Button
                type="link"
                size="small"
                onClick={() => openPublishConfirm(record.id, 'published')}
              >
                发布
              </Button>
            )}
          </ResponsiveActions>
        );
      },
    },
  ];

  return (
    <TenantSelectionGuard
      title="房源"
    >
      <div style={sectionStyle}>
        <Typography.Text strong>房源概览</Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {overviewCards.map((item) => (
            <Col key={item.key} xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic
                  title={item.title}
                  value={getLoadingSafeCount(item.count, overviewLoading)}
                />
              </div>
            </Col>
          ))}
        </Row>
      </div>
      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <SectionHeader
          title="房源经营台账"
          actions={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => history.push('/property-rental/houses/new')}
            >
              新建房源
            </Button>
          }
        />
        {scopeText ? (
          <Alert
            type="info"
            showIcon
            title={`当前只看：${scopeText}`}
            action={
              <Button
                size="small"
                onClick={() => {
                  setPage(1);
                  setTask(undefined);
                  setEstateId(undefined);
                  setBuildingId(undefined);
                  setStatus(undefined);
                  setPublishStatus(undefined);
                  setSearchDraft('');
                  setQ(undefined);
                  history.push('/property-rental/houses');
                }}
              >
                查看全部
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="项目"
            options={estateOptions}
            value={estateId}
            loading={estates.isLoading}
            onChange={(value) => {
              setPage(1);
              setEstateId(value);
              setBuildingId(undefined);
            }}
            style={toolbarControlStyle}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="楼栋"
            options={buildingOptions}
            value={buildingId}
            loading={buildings.isLoading}
            onChange={(value) => {
              setPage(1);
              setBuildingId(value);
            }}
            style={toolbarControlStyle}
          />
          <Input.Search
            allowClear
            placeholder="房号搜索"
            value={searchDraft}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSearchDraft(nextValue);
              if (!nextValue) {
                setPage(1);
                setQ(undefined);
              }
            }}
            onSearch={(value) => {
              setPage(1);
              const nextValue = value || undefined;
              setSearchDraft(value);
              setQ(nextValue);
            }}
            style={toolbarControlStyle}
          />
          <Select
            allowClear
            placeholder="房态"
            options={houseStatusOptions}
            value={status}
            popupMatchSelectWidth={toolbarSelectPopupWidth}
            onChange={(value) => {
              setPage(1);
              setStatus(value);
            }}
            style={toolbarShortSelectStyle}
          />
          <Select
            allowClear
            placeholder="发布状态"
            options={housePublishStatusOptions}
            value={publishStatus}
            popupMatchSelectWidth={toolbarSelectPopupWidth}
            onChange={(value) => {
              setPage(1);
              setPublishStatus(value);
            }}
            style={toolbarShortSelectStyle}
          />
        </Space>
        <Table
          rowKey="id"
          loading={listLoading}
          columns={columns}
          dataSource={rows}
          locale={{
            emptyText: getLoadingAwareEmptyState({
              loading: listLoading,
              loadingTitle: '房源数据加载中',
              loadingDescription: '正在同步房源台账、发布状态和资料缺口。',
              emptyState: '暂无数据',
            }),
          }}
          pagination={fixedPagePagination(
            page,
            PAGE_SIZE,
            houses.data?.total || 0,
            setPage,
          )}
          scroll={adminTableScroll}
        />
      </div>
      <Modal
        open={publishConfirmStatus !== null}
        aria-label={
          publishConfirmStatus === 'published' ? '确认发布房源' : '确认下架房源'
        }
        title={
          publishConfirmStatus === 'published' ? '确认发布房源' : '确认下架房源'
        }
        okText={publishConfirmStatus === 'published' ? '确认发布' : '确认下架'}
        cancelText="先取消"
        transitionName=""
        maskTransitionName=""
        onCancel={() => {
          setPublishConfirmHouseId(null);
          setPublishConfirmStatus(null);
        }}
        onOk={async () => {
          const nextStatus = publishConfirmStatus;
          const nextId = publishConfirmHouseId;
          if (!nextStatus || !nextId) return;
          setPublishConfirmHouseId(null);
          setPublishConfirmStatus(null);
          await patchHouse.mutateAsync({
            id: nextId,
            values: { publish_status: nextStatus },
          });
        }}
      >
        <Typography.Text>
          {publishConfirmStatus === 'published'
            ? '确认后会把这套房源切换为已发布状态，继续承接带看。'
            : '确认后会把这套房源切换为已下架状态，前台将不再作为可发布房源展示。'}
        </Typography.Text>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default HousesPage;
