import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Alert, Button, Col, Input, Modal, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminToolbar, ResponsiveActions, adminTableScroll, toolbarControlStyle } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type BuildingOut, type EstateOut, type HouseOut } from '@/services/manual/house';
import { getLoadingAwareEmptyState, getLoadingSafeCount, getLoadingSafeText, isAnyInitialQueryPending, isInitialQueryPending } from '../loading';
import {
  buildingLabel,
  canHousePublish,
  contactLabel,
  getHouseBlockingIssues,
  getHouseIssueActionHint,
  getTrackedHousePublishIssues,
  getHouseWarningIssues,
  HOUSE_PUBLISH_STATUS_COLOR,
  HOUSE_PUBLISH_STATUS_OPTIONS,
  HOUSE_PUBLISH_STATUS_TEXT,
  HOUSE_STATUS_OPTIONS,
  houseMediaReadinessText,
  houseLabel,
  moneyText,
  STATUS_COLOR,
  STATUS_TEXT,
} from '../constants';

const PAGE_SIZE = 20;
type HouseTask = 'blocked' | 'ready' | 'published' | 'unpublished' | 'landlord' | 'rent' | 'cover' | 'images' | 'floor_plan' | 'video';
type HouseIssueTask = Extract<HouseTask, 'landlord' | 'rent' | 'cover' | 'images' | 'floor_plan' | 'video'>;

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

const HOUSE_WORKFLOW_TASKS: HouseTask[] = ['blocked', 'ready', 'published', 'unpublished'];
const HOUSE_ISSUE_TASKS: HouseIssueTask[] = ['landlord', 'rent', 'cover', 'images', 'floor_plan', 'video'];

type HouseClosureSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  href: string;
};

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
  if (value === 'blocked' || value === 'ready' || value === 'published' || value === 'unpublished' || value === 'landlord' || value === 'rent' || value === 'cover' || value === 'images' || value === 'floor_plan' || value === 'video') {
    return value;
  }
  return undefined;
}

function isHouseWorkflowTask(task?: HouseTask): task is Extract<HouseTask, 'blocked' | 'ready' | 'published' | 'unpublished'> {
  return Boolean(task && HOUSE_WORKFLOW_TASKS.includes(task));
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

function getHousePriorityIssueTask(record: HouseOut): HouseIssueTask | undefined {
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
    estateId: Number.isFinite(estateIdValue) && estateIdValue > 0 ? estateIdValue : undefined,
    buildingId: Number.isFinite(buildingIdValue) && buildingIdValue > 0 ? buildingIdValue : undefined,
    status: params.get('status') || undefined,
    publishStatus: params.get('publish_status') || undefined,
    q: params.get('q') || undefined,
  };
}

function syncHouseListSearch(filters: HouseScopeFilters & { page: number }) {
  const params = new URLSearchParams();
  if (filters.task) params.set('task', filters.task);
  if (filters.estateId) params.set('estate_id', String(filters.estateId));
  if (filters.buildingId) params.set('building_id', String(filters.buildingId));
  if (filters.status) params.set('status', filters.status);
  if (filters.publishStatus) params.set('publish_status', filters.publishStatus);
  if (filters.q) params.set('q', filters.q);
  if (filters.page > 1) params.set('page', String(filters.page));
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function buildHouseQueueHref(task?: string) {
  return task ? `/property-rental/houses?task=${task}` : '/property-rental/houses';
}

function dashboardHref(path: string) {
  return `/dashboard${path}`;
}

function buildHouseDetailHref(houseId: number, action?: 'edit' | 'media', task?: string) {
  const params = new URLSearchParams();
  if (action) params.set('action', action);
  if (task) params.set('task', task);
  const nextSearch = params.toString();
  return `/dashboard/property-rental/houses/${houseId}${nextSearch ? `?${nextSearch}` : ''}`;
}

function getHousePageSuggestion(task?: string, counts?: { blocked: number; ready: number; published: number; unpublished?: number; total: number }, filters?: HouseScopeFilters) {
  if ((filters?.q || filters?.estateId || filters?.buildingId || filters?.status || filters?.publishStatus || filters?.task) && (counts?.total || 0) === 0) {
    return '当前筛选结果为空，可以调整项目、楼栋、房态或发布条件后继续排查。';
  }
  if (task === 'blocked') return '先把阻塞房源清到可发布，再安排上架，避免房源库存停在“看起来已录入、实际上不能上线”的状态。';
  if (task === 'ready') return '这一批房源已经具备上线条件，建议按租金、空置期和图片完整度尽快发布。';
  if (task === 'published') return '当前重点检查在线库存的租金、可租日期和房态，避免已发布房源承接无效咨询。';
  if (task === 'unpublished') return '先确认下架房源是暂时关闭还是长期停租，再决定补资料重发还是直接封存。';
  if (task === 'landlord') return '优先补齐出租方主体，避免房源无法继续发布、签约或生成后续业务资料。';
  if (task === 'rent') return '先补租金和押金等成交基础字段，避免带看后无法快速报价和签约。';
  if (task === 'cover' || task === 'images' || task === 'floor_plan' || task === 'video') return '这些展示资料会继续统计；如果当前空间策略没有把它们设成阻断发布，可以先上线再按优先级持续补齐。';
  if ((counts?.blocked || 0) > 0) return '优先处理真正阻断发布的房源；媒体类缺口按当前空间策略决定是先清还是持续补齐。';
  if ((counts?.ready || 0) > 0) return '已有房源具备上线条件，尽快发布，避免库存停留在草稿阶段。';
  if ((counts?.published || 0) === 0 && (counts?.total || 0) > 0) return '当前没有已发布房源，建议先检查资料完整度和上架节奏。';
  return '继续维护房源资料、媒体和可租日期，保证房东供给和带看入口持续可用。';
}

function getHouseTaskLink(record: HouseOut, currentTask?: HouseTask) {
  const issues = getTrackedHousePublishIssues(record);
  const priorityTask = getHousePriorityIssueTask(record);
  if (isHouseIssueTask(currentTask)) {
    if (currentTask === 'landlord') return { label: '补房东', href: buildHouseDetailHref(record.id, 'edit', currentTask) };
    if (currentTask === 'rent') return { label: '补租金', href: buildHouseDetailHref(record.id, 'edit', currentTask) };
    return { label: currentTask === 'cover' ? '补封面' : currentTask === 'images' ? '补图片' : currentTask === 'floor_plan' ? '补户型图' : '补视频', href: buildHouseDetailHref(record.id, 'media', currentTask) };
  }
  if (currentTask === 'ready') return { label: record.publish_status === 'published' ? '详情' : '检查后发布', href: buildHouseDetailHref(record.id) };
  if (currentTask === 'published') return { label: '查看在线房源', href: buildHouseDetailHref(record.id) };
  if (currentTask === 'unpublished') return { label: issues.length ? '重新整理后发布' : '查看详情', href: buildHouseDetailHref(record.id, priorityTask && (priorityTask === 'landlord' || priorityTask === 'rent') ? 'edit' : priorityTask ? 'media' : undefined, priorityTask) };
  if (currentTask === 'blocked' && priorityTask) {
    if (priorityTask === 'landlord') return { label: '补房东', href: buildHouseDetailHref(record.id, 'edit', priorityTask) };
    if (priorityTask === 'rent') return { label: '补租金', href: buildHouseDetailHref(record.id, 'edit', priorityTask) };
    return { label: priorityTask === 'cover' ? '补封面' : priorityTask === 'images' ? '补图片' : priorityTask === 'floor_plan' ? '补户型图' : '补视频', href: buildHouseDetailHref(record.id, 'media', priorityTask) };
  }
  if (issues.length && priorityTask) {
    const action = priorityTask === 'landlord' || priorityTask === 'rent' ? 'edit' : 'media';
    const onlyMediaIssues = issues.every((item) => item === '缺封面' || item === '图片不足' || item === '缺户型图' || item === '视频不足');
    const onlyMetadataIssues = issues.every((item) => item === '缺房东' || item === '缺租金');
    return {
      label: onlyMediaIssues ? '维护相册' : onlyMetadataIssues ? '补资料' : issues.length > 1 ? '处理发布问题' : action === 'edit' ? '补资料' : '维护相册',
      href: buildHouseDetailHref(record.id, action, priorityTask),
    };
  }
  if (!issues.length && canHousePublish(record) && record.publish_status !== 'published') {
    return { label: '检查后发布', href: buildHouseDetailHref(record.id) };
  }
  return { label: '详情', href: buildHouseDetailHref(record.id) };
}

function getHouseScopedOverviewTitle(filters: HouseScopeFilters) {
  if (filters.task && TASK_TEXT[filters.task]) return `当前${TASK_TEXT[filters.task]}`;
  if (filters.publishStatus === 'published') return '当前已发布';
  if (filters.publishStatus === 'draft') return '当前草稿';
  if (filters.publishStatus === 'unpublished') return '当前已下架';
  if (filters.status) return `当前${STATUS_TEXT[filters.status] || filters.status}`;
  if (filters.buildingId) return '当前楼栋房源';
  if (filters.estateId) return '当前项目房源';
  if (filters.q) return '当前搜索结果';
  return '当前筛选结果';
}

function getHouseScopeText(filters: HouseScopeFilters, estates: EstateOut[], buildings: BuildingOut[]) {
  const scopes: string[] = [];
  if (filters.task && TASK_TEXT[filters.task]) scopes.push(TASK_TEXT[filters.task]);
  if (filters.estateId) {
    const estate = estates.find((item) => item.id === filters.estateId);
    scopes.push(`项目：${estate?.display_name || estate?.name || `#${filters.estateId}`}`);
  }
  if (filters.buildingId) {
    const building = buildings.find((item) => item.id === filters.buildingId);
    scopes.push(`楼栋：${buildingLabel(building || { id: filters.buildingId })}`);
  }
  if (filters.status) scopes.push(`房态：${STATUS_TEXT[filters.status] || filters.status}`);
  if (filters.publishStatus) scopes.push(`发布：${HOUSE_PUBLISH_STATUS_TEXT[filters.publishStatus] || filters.publishStatus}`);
  if (filters.q) scopes.push(`搜索：${filters.q}`);
  return scopes.join(' / ');
}

const HousesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialListState = useRef(getHouseListStateFromSearch(window.location.search));
  const [task, setTask] = useState<HouseTask | undefined>(initialListState.current.task);
  const [estateId, setEstateId] = useState<number | undefined>(initialListState.current.estateId);
  const [buildingId, setBuildingId] = useState<number | undefined>(initialListState.current.buildingId);
  const [status, setStatus] = useState<string | undefined>(initialListState.current.status);
  const [publishStatus, setPublishStatus] = useState<string | undefined>(initialListState.current.publishStatus);
  const [q, setQ] = useState<string | undefined>(initialListState.current.q);
  const [searchDraft, setSearchDraft] = useState(initialListState.current.q || '');
  const [page, setPage] = useState(initialListState.current.page);
  const [publishConfirmHouseId, setPublishConfirmHouseId] = useState<number | null>(null);
  const [publishConfirmStatus, setPublishConfirmStatus] = useState<'published' | 'unpublished' | null>(null);
  const taskQuery = getHouseTaskQuery(task);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const estates = useQuery({ queryKey: ['house', 'estates', 'house-filter', workspace.selectedOrgSlug], queryFn: () => houseApi.listEstates({ page: 1, page_size: 100 }), enabled });
  const buildings = useQuery({
    queryKey: ['house', 'buildings', 'house-filter', workspace.selectedOrgSlug, estateId],
    queryFn: () => houseApi.listBuildings({ page: 1, page_size: 100, estate_id: estateId }),
    enabled,
  });
  const overviewQueries = useQueries({
    queries: [
      {
        queryKey: ['house', 'houses', 'overview', workspace.selectedOrgSlug, 'total'],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1 }),
        enabled,
      },
      {
        queryKey: ['house', 'houses', 'overview', workspace.selectedOrgSlug, 'blocked'],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1, publish_blocked: true }),
        enabled,
      },
      {
        queryKey: ['house', 'houses', 'overview', workspace.selectedOrgSlug, 'ready'],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1, publish_ready: true }),
        enabled,
      },
      {
        queryKey: ['house', 'houses', 'overview', workspace.selectedOrgSlug, 'published'],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1, publish_status: 'published' }),
        enabled,
      },
      {
        queryKey: ['house', 'houses', 'overview', workspace.selectedOrgSlug, 'unpublished'],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1, publish_status: 'unpublished' }),
        enabled,
      },
    ],
  });
  const issueCountQueries = useQueries({
    queries: HOUSE_ISSUE_TASKS.map((item) => ({
      queryKey: ['house', 'houses', 'issue-count', workspace.selectedOrgSlug, item],
      queryFn: () => houseApi.listHouses({ page: 1, page_size: 1, publish_issue: item }),
      enabled,
    })),
  });
  const houses = useQuery({
    queryKey: ['house', 'houses', workspace.selectedOrgSlug, page, estateId, buildingId, status, publishStatus, task, q],
    queryFn: () => houseApi.listHouses({
      page,
      page_size: PAGE_SIZE,
      estate_id: estateId,
      building_id: buildingId,
      status,
      publish_status: publishStatus,
      q,
      ...taskQuery,
    }),
    enabled,
  });
  const scopedOverview = Boolean(estateId || buildingId || status || publishStatus || task || q);
  const scopedOverviewQueries = useQueries({
    queries: [
      {
        key: 'blocked',
        queryFn: () => houseApi.listHouses({
          page: 1,
          page_size: 1,
          estate_id: estateId,
          building_id: buildingId,
          status,
          publish_status: publishStatus,
          q,
          ...taskQuery,
          publish_blocked: true,
        }),
      },
      {
        key: 'ready',
        queryFn: () => houseApi.listHouses({
          page: 1,
          page_size: 1,
          estate_id: estateId,
          building_id: buildingId,
          status,
          publish_status: publishStatus,
          q,
          ...taskQuery,
          publish_ready: true,
        }),
      },
      {
        key: 'published',
        queryFn: () => houseApi.listHouses({
          page: 1,
          page_size: 1,
          estate_id: estateId,
          building_id: buildingId,
          status,
          q,
          ...taskQuery,
          publish_status: 'published',
        }),
      },
      {
        key: 'unpublished',
        queryFn: () => houseApi.listHouses({
          page: 1,
          page_size: 1,
          estate_id: estateId,
          building_id: buildingId,
          status,
          q,
          ...taskQuery,
          publish_status: 'unpublished',
        }),
      },
    ].map((item) => ({
      queryKey: ['house', 'houses', 'scoped-overview', workspace.selectedOrgSlug, item.key, estateId, buildingId, status, publishStatus, task, q],
      queryFn: item.queryFn,
      enabled: enabled && scopedOverview,
    })),
  });
  const patchHouse = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Record<string, unknown> }) => houseApi.patchHouse(id, values),
    onSuccess: async () => {
      message.success('房源状态已更新');
      await queryClient.invalidateQueries({ queryKey: ['house', 'houses'] });
    },
  });
  const openPublishConfirm = (id: number, nextStatus: 'published' | 'unpublished') => {
    setPublishConfirmHouseId(id);
    setPublishConfirmStatus(nextStatus);
  };
  const rows = houses.data?.items || [];
  const totalCount = overviewQueries[0]?.data?.total || 0;
  const blockedCount = overviewQueries[1]?.data?.total || 0;
  const readyCount = overviewQueries[2]?.data?.total || 0;
  const publishedCount = overviewQueries[3]?.data?.total || 0;
  const unpublishedCount = overviewQueries[4]?.data?.total || 0;
  const scopedTotalCount = houses.data?.total || 0;
  const scopedBlockedCount = scopedOverviewQueries[0]?.data?.total || 0;
  const scopedReadyCount = scopedOverviewQueries[1]?.data?.total || 0;
  const scopedPublishedCount = scopedOverviewQueries[2]?.data?.total || 0;
  const scopedUnpublishedCount = scopedOverviewQueries[3]?.data?.total || 0;
  const overviewLoading = scopedOverview ? isAnyInitialQueryPending([houses, ...scopedOverviewQueries]) : isAnyInitialQueryPending(overviewQueries);
  const issueCountLoading = isAnyInitialQueryPending(issueCountQueries);
  const listLoading = isInitialQueryPending(houses);
  const estateItems = (estates.data?.items || []) as EstateOut[];
  const buildingItems = (buildings.data?.items || []) as BuildingOut[];
  const scopeText = getHouseScopeText({ task, estateId, buildingId, status, publishStatus, q }, estateItems, buildingItems);
  const pageSuggestion = overviewLoading ? '正在汇总房源数据，请稍候再判断发布缺口和上架优先级。' : getHousePageSuggestion(task, {
    blocked: scopedOverview ? scopedBlockedCount : blockedCount,
    ready: scopedOverview ? scopedReadyCount : readyCount,
    published: scopedOverview ? scopedPublishedCount : publishedCount,
    unpublished: scopedOverview ? scopedUnpublishedCount : unpublishedCount,
    total: scopedOverview ? scopedTotalCount : totalCount,
  } as { blocked: number; ready: number; published: number; total: number }, { task, estateId, buildingId, status, publishStatus, q });
  const estateOptions = estateItems.map((estate) => ({ value: estate.id, label: estate.display_name || estate.name }));
  const buildingOptions = buildingItems.map((building) => ({ value: building.id, label: buildingLabel(building) }));
  const workflowQueueLinks = useMemo<{ key: string; label: string; task?: HouseTask }[]>(
    () => [
      { key: 'all', label: '全部', task: undefined },
      { key: 'blocked', label: '待补资料', task: 'blocked' as HouseTask },
      { key: 'ready', label: '可发布', task: 'ready' as HouseTask },
      { key: 'published', label: '已发布', task: 'published' as HouseTask },
      { key: 'unpublished', label: '已下架', task: 'unpublished' as HouseTask },
    ],
    [],
  );
  const issueQueueLinks = useMemo<{ key: string; label: string; task: HouseIssueTask }[]>(
    () => [
      { key: 'landlord', label: '待补房东', task: 'landlord' },
      { key: 'rent', label: '待补租金', task: 'rent' },
      { key: 'cover', label: '待补封面', task: 'cover' },
      { key: 'images', label: '图片少于 3 张', task: 'images' },
      { key: 'floor_plan', label: '缺户型图', task: 'floor_plan' },
      { key: 'video', label: '待补视频', task: 'video' },
    ],
    [],
  );
  const issueQueueCountItems = issueQueueLinks.map((item, index) => ({
    ...item,
    count: issueCountQueries[index]?.data?.total || 0,
  }));
  const visibleIssueQueueCountItems = issueQueueCountItems.filter((item) => item.count > 0);
  const hiddenIssueQueueCount = issueQueueCountItems.length - visibleIssueQueueCountItems.length;
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
  const signalTileStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
    height: '100%',
    padding: 16,
  } as const;
  const closureSignals: HouseClosureSignal[] = [
    {
      key: 'blocked',
      title: '发布阻断',
      emphasis: blockedCount > 0 ? '先清阻断' : '阻断已清',
      summary: `${blockedCount} 套阻断发布 / ${issueQueueCountItems.find((item) => item.task === 'rent')?.count || 0} 套待补租金`,
      description: '先清掉租金、房东和硬性资料缺口，房源才不会停在“录入了但发不出去”的状态。',
      actionLabel: '进入待补资料队列',
      href: dashboardHref(buildHouseQueueHref('blocked')),
    },
    {
      key: 'ready',
      title: '上架排期',
      emphasis: readyCount > 0 ? '尽快上架' : '待继续补货',
      summary: `${readyCount} 套可发布 / ${totalCount - publishedCount - blockedCount >= 0 ? totalCount - publishedCount - blockedCount : 0} 套待整理`,
      description: '资料已齐的房源要尽快转成在线库存，避免供给长期堆在草稿和待发布阶段。',
      actionLabel: '进入可发布队列',
      href: dashboardHref(buildHouseQueueHref('ready')),
    },
    {
      key: 'published',
      title: '在线承接',
      emphasis: publishedCount > 0 ? '保持在线' : '在线不足',
      summary: `${publishedCount} 套已发布 / ${readyCount} 套可补上架`,
      description: '在线库存要稳定承接带看和咨询，不能让可发布房源长时间停在后台未上架。',
      actionLabel: '进入在线库存台账',
      href: dashboardHref(buildHouseQueueHref('published')),
    },
    {
      key: 'unpublished',
      title: '下架复盘',
      emphasis: unpublishedCount > 0 ? '先做复盘' : '下架平稳',
      summary: `${unpublishedCount} 套已下架 / ${blockedCount} 套待重整`,
      description: '下架房源要区分暂时关闭和长期停租，决定是补资料重发，还是直接归档封存。',
      actionLabel: '进入下架复盘队列',
      href: dashboardHref(buildHouseQueueHref('unpublished')),
    },
  ];

  useEffect(() => {
    syncHouseListSearch({ page, task, estateId, buildingId, status, publishStatus, q });
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

  const applyTask = (nextTask?: HouseTask) => {
    setPage(1);
    setTask(nextTask);
    history.push(buildHouseQueueHref(nextTask));
  };

  const columns: ColumnsType<HouseOut> = [
    { title: '房源', dataIndex: 'house_label', width: 220, render: (_value, record) => houseLabel(record) },
    { title: '房东', dataIndex: 'landlord_name', width: 180, render: (_value, record) => (record.landlord_id ? contactLabel(record) : '待补房东') },
    { title: '挂牌租金', dataIndex: 'asking_rent', width: 100, render: (value) => moneyText(value) },
    { title: '可租日期', dataIndex: 'available_from', width: 120, render: (value) => value || '-' },
    {
      title: '发布准备',
      dataIndex: 'readiness',
      width: 180,
      render: (_value, record) => {
        const readiness = getHouseReadinessSummary(record);
        return (
          <Space orientation="vertical" size={2}>
            <Typography.Text strong type={readiness.color === 'green' ? 'success' : readiness.color === 'blue' ? 'secondary' : 'warning'}>
              {readiness.text}
            </Typography.Text>
            <Typography.Text type="secondary">{readiness.description}</Typography.Text>
          </Space>
        );
      },
    },
    {
      title: '当前动作',
      dataIndex: 'next_action',
      width: 220,
      render: (_value, record) => {
        if (record.publish_status === 'published') return <Typography.Text type="secondary">保持在线，留意租金和可租日期变化</Typography.Text>;
        if (!getTrackedHousePublishIssues(record).length) return <Typography.Text type="secondary">资料完整，可直接发布</Typography.Text>;
        return <Typography.Text type="secondary">{getHouseIssueActionHint(record)}</Typography.Text>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 140,
      render: (_value, record) => (
        <Space size={4} wrap>
          {record.publish_status !== 'published' ? (
            <Tag color={canHousePublish(record) ? 'blue' : 'orange'}>{canHousePublish(record) ? '可发布' : '阻断发布'}</Tag>
          ) : null}
          <Tag color={STATUS_COLOR[record.status] || 'default'}>{STATUS_TEXT[record.status] || record.status}</Tag>
          <Tag color={HOUSE_PUBLISH_STATUS_COLOR[record.publish_status] || 'default'}>{HOUSE_PUBLISH_STATUS_TEXT[record.publish_status] || record.publish_status}</Tag>
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
        if (!blockingIssues.length && !warningIssues.length) return <Typography.Text type="success">完整</Typography.Text>;
        return (
          <Space size={[4, 4]} wrap>
            {blockingIssues.map((item) => <Tag color="orange" key={`blocking-${item}`}>{item}</Tag>)}
            {warningIssues.map((item) => <Tag color="blue" key={`warning-${item}`}>{item}</Tag>)}
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
              <Button type="link" size="small" onClick={() => openPublishConfirm(record.id, 'unpublished')}>下架</Button>
            ) : !canHousePublish(record) ? (
              <Tooltip title="请先补齐资料问题">
                <Button type="link" size="small" disabled>待补齐</Button>
              </Tooltip>
            ) : (
              <Button type="link" size="small" onClick={() => openPublishConfirm(record.id, 'published')}>发布</Button>
            )}
          </ResponsiveActions>
        );
      },
    },
  ];

  return (
    <TenantSelectionGuard title="房源" subtitle="按房源发现资料、媒体、房态和发布问题。">
      <div style={sectionStyle}>
        <Typography.Text strong>{scopedOverview ? '当前筛选概览' : '房源概览'}</Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title={scopedOverview ? getHouseScopedOverviewTitle({ task, estateId, buildingId, status, publishStatus, q }) : '在管房源'} value={getLoadingSafeCount(scopedOverview ? scopedTotalCount : totalCount, overviewLoading)} />
              <Typography.Text type="secondary">
                {getLoadingSafeText(scopedOverview ? `${scopedTotalCount} 套房源落在当前筛选范围内` : `${totalCount} 套房源在当前组织内管理`, '正在汇总当前房源范围...', overviewLoading)}
              </Typography.Text>
            </div>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title="阻断发布" value={getLoadingSafeCount(scopedOverview ? scopedBlockedCount : blockedCount, overviewLoading)} />
              <Typography.Text type="secondary">{getLoadingSafeText(`${scopedOverview ? scopedBlockedCount : blockedCount} 套被当前阻断规则卡住`, '正在识别阻塞项...', overviewLoading)}</Typography.Text>
            </div>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title="可发布" value={getLoadingSafeCount(scopedOverview ? scopedReadyCount : readyCount, overviewLoading)} />
              <Typography.Text type="secondary">{getLoadingSafeText(`${scopedOverview ? scopedReadyCount : readyCount} 套已具备上线条件`, '正在识别可发布房源...', overviewLoading)}</Typography.Text>
            </div>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title="已发布" value={getLoadingSafeCount(scopedOverview ? scopedPublishedCount : publishedCount, overviewLoading)} />
              <Typography.Text type="secondary">{getLoadingSafeText(`${scopedOverview ? scopedPublishedCount : publishedCount} 套正在承接带看`, '正在汇总在线库存...', overviewLoading)}</Typography.Text>
            </div>
          </Col>
        </Row>
      </div>
      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <Typography.Text strong>当前建议</Typography.Text>
        <Typography.Paragraph style={{ marginBottom: 0, marginTop: 12 }}>{pageSuggestion}</Typography.Paragraph>
      </div>
      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <Typography.Text strong>闭环信号</Typography.Text>
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          {closureSignals.map((item) => (
            <Col key={item.key} xs={24} sm={12} xl={6}>
              <div style={signalTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>{item.title}</Typography.Text>
                    <Tag color="blue">{item.emphasis}</Tag>
                  </Space>
                  <Typography.Text>{item.summary}</Typography.Text>
                  <Typography.Text type="secondary">{item.description}</Typography.Text>
                  <a href={item.href}>{item.actionLabel}</a>
                </Space>
              </div>
            </Col>
          ))}
        </Row>
      </div>
      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong>经营队列</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary">先看阻断、再推上架、再守在线库存，把房源供给从资料录入一路推进到可成交状态。</Typography.Text>
          </div>
        </div>
        <Space wrap size={[8, 8]}>
          {workflowQueueLinks.map((item) => (
            <Button
              key={item.key}
              type={task === item.task || (!task && !item.task) ? 'primary' : 'default'}
              onClick={() => applyTask(item.task)}
            >
              {item.label}
            </Button>
          ))}
        </Space>
      </div>
      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong>发布缺口</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary">这里集中排查会影响上架效率的资料、媒体和主体缺口，优先处理当前真正在堵发布链路的项目。</Typography.Text>
          </div>
        </div>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap size={[8, 8]}>
            {visibleIssueQueueCountItems.map((item) => (
              <Button
                key={item.key}
                type={task === item.task ? 'primary' : 'default'}
                onClick={() => applyTask(item.task)}
              >
                {`${item.label} ${getLoadingSafeCount(item.count, issueCountLoading)}`}
              </Button>
            ))}
          </Space>
          {hiddenIssueQueueCount > 0 ? (
            <Typography.Text type="secondary">已收起 {hiddenIssueQueueCount} 个 0 项，缺口只突出当前需要处理的房源。</Typography.Text>
          ) : null}
        </Space>
      </div>
      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, width: '100%', marginBottom: 16 }}>
          <div>
            <Typography.Text strong>房源经营台账</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Typography.Text type="secondary">围绕项目、楼栋、房态和发布状态管理房源供给，直接承接上架、带看和签约前置动作。</Typography.Text>
            </div>
          </div>
          <AdminToolbar><Button type="primary" icon={<PlusOutlined />} onClick={() => history.push('/property-rental/houses/new')}>新建房源</Button></AdminToolbar>
        </div>
        {scopeText ? (
          <Alert
            type="info"
            showIcon
            title={`当前只看：${scopeText}`}
            action={(
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
            )}
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
          <Select allowClear placeholder="房态" options={HOUSE_STATUS_OPTIONS} value={status} onChange={(value) => { setPage(1); setStatus(value); }} style={toolbarControlStyle} />
          <Select allowClear placeholder="发布状态" options={HOUSE_PUBLISH_STATUS_OPTIONS} value={publishStatus} onChange={(value) => { setPage(1); setPublishStatus(value); }} style={toolbarControlStyle} />
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
          pagination={{ current: page, pageSize: PAGE_SIZE, total: houses.data?.total || 0, showSizeChanger: false, onChange: setPage }}
          scroll={adminTableScroll}
        />
      </div>
      <Modal
        open={publishConfirmStatus !== null}
        aria-label={publishConfirmStatus === 'published' ? '确认发布房源' : '确认下架房源'}
        title={publishConfirmStatus === 'published' ? '确认发布房源' : '确认下架房源'}
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
          await patchHouse.mutateAsync({ id: nextId, values: { publish_status: nextStatus } });
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
