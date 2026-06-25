import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Alert, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, Modal, Row, Select, Space, Statistic, Table, Tag, Typography, message, theme } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { AdminToolbar, ResponsiveActions, adminTableScroll, toolbarControlStyle } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type ContactOut, type LeaseOut } from '@/services/manual/house';
import MediaRefsUpload from '../components/MediaRefsUpload';
import { CONTACT_ROLE, contactLabel, houseLabel, HOUSE_MEDIA_RESOURCE_TYPE, HOUSE_MEDIA_TYPE, LEASE_STATUS_FLOW_OPTIONS, LEASE_STATUS_OPTIONS, moneyText, STATUS_COLOR, STATUS_TEXT } from '../constants';
import { getLoadingAwareEmptyState, getLoadingSafeCount, getLoadingSafeText, isAnyInitialQueryPending, isInitialQueryPending } from '../loading';

const PAGE_SIZE = 20;
type LeaseTask = 'contract';

const TASK_TEXT: Record<LeaseTask, string> = {
  contract: '合同缺失',
};
const LEASE_STATUS_ACTION_TEXT: Record<string, string> = {
  active: '生效',
  expired: '到期',
  terminated: '终止',
};

function dashboardHref(path: string) {
  return `/dashboard${path}`;
}

function leaseEditPath(record: LeaseOut, filters?: { task?: string; status?: string }) {
  const params = new URLSearchParams();
  params.set('house_id', String(record.house_id));
  if (filters?.task) params.set('task', filters.task);
  if (filters?.status) params.set('status', filters.status);
  params.set('edit', String(record.id));
  return `${dashboardHref('/property-rental/leases')}?${params.toString()}`;
}

function getLeaseNextActionText(record: LeaseOut) {
  if (record.status === 'expired') return '待退租归档';
  if (record.status === 'terminated') return '待结清归档';
  if (!record.contract_files?.length) return '待合同归档';
  if (record.status === 'pending') return '待生效确认';
  if (record.status === 'active') return '履约跟进';
  return '持续跟进';
}

function getLeaseWorkflowHint(record: LeaseOut) {
  if (record.status === 'expired') return '已到期，尽快确认退租、续租或腾退归档';
  if (record.status === 'terminated') return '已终止，尽快完成结清和资料归档';
  if (!record.contract_files?.length) return '合同未归档，优先补齐避免后续履约和结算无据可查';
  if (record.status === 'pending') return '起租前确认交付、付款日和押金安排';
  if (record.status === 'active') return '履约中，持续关注收租、续租和到期提醒';
  return '按当前状态继续跟进';
}

function getLeaseBusinessInfo(record: LeaseOut) {
  const primary = `${houseLabel(record)} / ${contactLabel(record)}`;
  const secondaryParts = [
    record.start_date && record.end_date ? `${record.start_date} 至 ${record.end_date}` : undefined,
    record.monthly_rent ? moneyText(record.monthly_rent) : undefined,
    record.contract_files?.length ? `${record.contract_files.length} 份合同` : '待补合同',
  ].filter(Boolean);
  return {
    primary,
    secondary: secondaryParts.join(' · '),
  };
}

function getLeasePageSuggestion(task?: string, status?: string, counts?: { pending: number; contractMissing: number; expired: number; terminated?: number }) {
  if (task === 'contract' && status === 'pending') return '待生效且缺合同的租约要优先补归档并确认交付节点，避免签约后无法落地。';
  if (task === 'contract' && status === 'active') return '生效中但缺合同的租约要尽快补归档，避免履约、收租和结算凭证缺失。';
  if (task === 'contract' && status === 'expired') return '已到期且缺合同的租约要尽快补齐归档，避免退租或续租资料断档。';
  if (task === 'contract' && status === 'terminated') return '已终止且缺合同的租约要尽快补齐归档，避免后续结清和追责缺少凭证。';
  if (task === 'contract') return '合同缺失的租约应尽快补归档，避免后续履约和结算无据可查。';
  if (status === 'pending') return '待生效租约要尽快确认合同、起租和交付节点，避免签约后无法落地。';
  if (status === 'active') return '生效中租约应持续关注履约、收租和续租安排。';
  if (status === 'expired') return '已到期租约要尽快处理退租或续租，不要让到期合同悬空。';
  if (status === 'terminated') return '已终止租约要尽快完成结清、钥匙回收和资料归档，避免形成尾账。';
  if ((counts?.contractMissing || 0) > 0 || (counts?.pending || 0) > 0) return '优先补齐合同缺失和待生效租约，避免签约后资料断档。';
  if ((counts?.terminated || 0) > 0) return '已终止租约要尽快做完结清归档，避免形成待处理尾账。';
  if ((counts?.expired || 0) > 0) return '已到期租约要尽快完成退租归档和房源释放。';
  return '先处理待生效和合同资料，再跟进已生效租约的履约质量。';
}

const LEASE_OVERVIEW_ITEMS = [
  { key: 'pending', title: '待生效', params: { status: 'pending' } },
  { key: 'active', title: '生效中', params: { status: 'active' } },
  { key: 'contract', title: '待补合同', params: { contract_missing: true } },
  { key: 'expired', title: '已到期', params: { status: 'expired' } },
  { key: 'terminated', title: '已终止', params: { status: 'terminated' } },
] as const;

type LeaseOverviewCard = {
  key: string;
  title: string;
  hint: string;
  params?: Record<string, unknown>;
  getValue?: (counts: Record<string, number>) => number;
};

type LeaseClosureSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  href: string;
};

function getScopedLeaseOverviewCards(task?: string, status?: string): LeaseOverviewCard[] {
  if (task === 'contract') {
    return [
      {
        key: 'current_contract_scope',
        title: status ? `当前${STATUS_TEXT[status] || status}` : '当前缺合同',
        hint: status ? '当前状态下仍缺合同归档的租约' : '当前筛选下仍缺合同归档的租约',
        params: { ...(status ? { status } : {}), contract_missing: true },
      },
      {
        key: 'pending_contract_scope',
        title: '待生效',
        hint: '缺合同且待确认起租与交付',
        params: { status: 'pending', contract_missing: true },
      },
      {
        key: 'active_contract_scope',
        title: '生效中',
        hint: '缺合同但已进入履约阶段',
        params: { status: 'active', contract_missing: true },
      },
      {
        key: 'expired_contract_scope',
        title: '已到期',
        hint: '缺合同且待退租或续租归档',
        params: { status: 'expired', contract_missing: true },
      },
    ];
  }

  if (status) {
    return [
      {
        key: 'current_status_scope',
        title: `当前${STATUS_TEXT[status] || status}`,
        hint: '当前筛选状态下的租约数',
        params: { status },
      },
      {
        key: 'current_status_contract_missing',
        title: '待补合同',
        hint: '当前状态下仍缺合同归档',
        params: { status, contract_missing: true },
      },
      {
        key: 'current_status_contract_ready',
        title: '资料完整',
        hint: '当前状态下合同已归档',
        getValue: (counts) => Math.max((counts.current_status_scope || 0) - (counts.current_status_contract_missing || 0), 0),
      },
      {
        key: 'all_leases_scope',
        title: '全部租约',
        hint: '当前房源范围内的全部租约数',
        params: {},
      },
    ];
  }

  return [];
}

function getLeaseScopeText(options: { task?: string; status?: string; houseLabelText?: string }) {
  const parts: string[] = [];
  if (options.houseLabelText) parts.push(`房源：${options.houseLabelText}`);
  if (options.task && TASK_TEXT[options.task as LeaseTask]) parts.push(TASK_TEXT[options.task as LeaseTask]);
  if (options.status) parts.push(STATUS_TEXT[options.status] || options.status);
  return parts.join(' / ');
}

function buildLeaseQueueHref(filters: { houseId?: number; task?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters.houseId) params.set('house_id', String(filters.houseId));
  if (filters.task) params.set('task', filters.task);
  if (filters.status) params.set('status', filters.status);
  const search = params.toString();
  return `/property-rental/leases${search ? `?${search}` : ''}`;
}

function getLeaseListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page') || '1');
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    status: params.get('status') || undefined,
  };
}

function syncLeaseListSearch(filters: { page: number; status?: string }) {
  const params = new URLSearchParams(window.location.search);
  if (filters.status) {
    params.set('status', filters.status);
  } else {
    params.delete('status');
  }
  if (filters.page > 1) {
    params.set('page', String(filters.page));
  } else {
    params.delete('page');
  }
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

type LeaseDrawerSearchState = {
  sourceViewingRecordId?: number;
  editLeaseId?: number;
};

function getLeaseDrawerStateFromSearch(search: string): LeaseDrawerSearchState {
  const params = new URLSearchParams(search);
  return {
    sourceViewingRecordId: Number(params.get('source_viewing_record_id')) || undefined,
    editLeaseId: Number(params.get('edit')) || undefined,
  };
}

function syncLeaseDrawerSearch(drawerState: LeaseDrawerSearchState) {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  params.delete('source_viewing_record_id');
  params.delete('edit');
  if (drawerState.sourceViewingRecordId) params.set('source_viewing_record_id', String(drawerState.sourceViewingRecordId));
  if (drawerState.editLeaseId) params.set('edit', String(drawerState.editLeaseId));

  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function getLeaseDrawerEntryText(options: { editing: boolean; sourceViewingLabel?: string; sourceHouseId?: number }) {
  const { editing, sourceViewingLabel, sourceHouseId } = options;
  if (editing) return '租约维护';
  if (sourceViewingLabel) return '成交带看转签约';
  if (sourceHouseId) return '房源直建租约';
  return '手动新建租约';
}

function getLeaseDrawerWarning(options: {
  selectedSourceViewing?: { contact_id?: number | null };
  houseId?: number;
  tenantId?: number | null;
  startDate?: string;
  endDate?: string;
  monthlyRent?: string;
  contractCount: number;
}) {
  const { selectedSourceViewing, houseId, tenantId, startDate, endDate, monthlyRent, contractCount } = options;
  if (selectedSourceViewing && !selectedSourceViewing.contact_id) return '来源带看还未绑定租客联系人，请先补齐主体再保存签约。';
  if (!houseId) return '还未选择房源，保存前先确认本次签约归属。';
  if (!tenantId) return '还未选择租客，避免把签约记录落成匿名主体。';
  if (!startDate || !endDate || !monthlyRent) return '租期和金额还未补齐，保存前先确认起租、到期和月租。';
  if (!contractCount) return '本次保存后仍会处于待补合同状态，建议同步归档合同文件。';
  return '主体、租期和合同资料已完整，可直接保存并进入后续履约跟进。';
}

function getLeaseEmptyState(options: {
  task?: string;
  status?: string;
  sourceHouseId?: number;
  pendingCount: number;
  activeCount: number;
  openCreate: () => void;
}) {
  const { task, sourceHouseId, pendingCount, activeCount, openCreate } = options;

  if (task === 'contract') {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={(
          <Space orientation="vertical" size={4}>
            <Typography.Text strong>合同缺失队列已处理完成</Typography.Text>
            <Typography.Text type="secondary">当前筛选下已没有待补合同租约，可返回全部租约继续检查待生效或履约中的记录。</Typography.Text>
          </Space>
        )}
      >
        <Space wrap>
          {pendingCount > 0 ? <Button href={dashboardHref(buildLeaseQueueHref({ houseId: sourceHouseId, status: 'pending' }))}>查看待生效</Button> : null}
          {activeCount > 0 ? <Button href={dashboardHref(buildLeaseQueueHref({ houseId: sourceHouseId, status: 'active' }))}>查看生效中</Button> : null}
          <Button href={dashboardHref(buildLeaseQueueHref({ houseId: sourceHouseId }))}>查看全部租约</Button>
          <Button type="primary" onClick={openCreate}>新建租约</Button>
        </Space>
      </Empty>
    );
  }

  return (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无租约">
      <Button type="primary" onClick={openCreate}>新建租约</Button>
    </Empty>
  );
}

type LeaseFormValues = {
  house_id: number;
  tenant_id: number | null;
  source_viewing_record_id?: number | null;
  start_date: string;
  end_date: string;
  monthly_rent: string;
  deposit?: string | null;
  payment_day?: number;
  status?: string;
  contract_files?: Record<string, unknown>[];
  notes?: string;
};

const LeasesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [form] = Form.useForm<LeaseFormValues>();
  const selectedSourceViewingRecordId = Form.useWatch('source_viewing_record_id', form);
  const formValues = Form.useWatch([], { form, preserve: true }) as Partial<LeaseFormValues> | undefined;
  const [locationSearch, setLocationSearch] = useState(window.location.search);
  const initialListState = getLeaseListStateFromSearch(locationSearch);
  const initialDrawerState = getLeaseDrawerStateFromSearch(locationSearch);
  const [page, setPage] = useState(initialListState.page);
  const queryParams = new URLSearchParams(locationSearch);
  const task = (queryParams.get('task') as LeaseTask | null) || undefined;
  const [drawerState, setDrawerState] = useState<LeaseDrawerSearchState>(initialDrawerState);
  const sourceViewingRecordId = drawerState.sourceViewingRecordId;
  const sourceHouseId = Number(queryParams.get('house_id')) || undefined;
  const editLeaseId = drawerState.editLeaseId;
  const contractMissing = task === 'contract' || undefined;
  const [status, setStatus] = useState<string | undefined>(initialListState.status);
  const scopedOverview = Boolean(task || status);
  const [editing, setEditing] = useState<LeaseOut | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [createdTenants, setCreatedTenants] = useState<ContactOut[]>([]);
  const [openedSourceViewing, setOpenedSourceViewing] = useState(false);
  const [openedSourceHouse, setOpenedSourceHouse] = useState(false);
  const [openedEditLease, setOpenedEditLease] = useState(false);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houses = useQuery({ queryKey: ['house', 'leases', 'houses', workspace.selectedOrgSlug], queryFn: () => houseApi.listHouses({ page: 1, page_size: 100 }), enabled });
  const tenants = useQuery({ queryKey: ['house', 'leases', 'tenants', workspace.selectedOrgSlug], queryFn: () => houseApi.listContacts({ page: 1, page_size: 100, role: 'tenant' }), enabled });
  const overviewQueries = useQueries({
    queries: LEASE_OVERVIEW_ITEMS.map((item) => ({
      queryKey: ['house', 'leases', 'overview', workspace.selectedOrgSlug, sourceHouseId, item.key],
      queryFn: () => houseApi.listLeases({ page: 1, page_size: 1, house_id: sourceHouseId, ...item.params }),
      enabled,
    })),
  });
  const scopedOverviewCards = useMemo(() => getScopedLeaseOverviewCards(task, status), [status, task]);
  const scopedOverviewQueries = useQueries({
    queries: scopedOverviewCards
      .filter((item) => item.params)
      .map((item) => ({
        queryKey: ['house', 'leases', 'scoped-overview', workspace.selectedOrgSlug, sourceHouseId, item.key, task, status],
        queryFn: () => houseApi.listLeases({ page: 1, page_size: 1, house_id: sourceHouseId, ...(item.params || {}) }),
        enabled: enabled && scopedOverview,
      })),
  });
  const readySourceViewings = useQuery({
    queryKey: ['house', 'leases', 'ready-source-viewings', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 100, pending_lease: true, contact_missing: false }),
    enabled,
  });
  const sourceViewingLookup = useQuery({
    queryKey: ['house', 'leases', 'source-viewing-lookup', workspace.selectedOrgSlug, sourceViewingRecordId],
    queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 100, pending_lease: true }),
    enabled: enabled && Boolean(sourceViewingRecordId),
  });
  const editLeaseLookup = useQuery({
    queryKey: ['house', 'leases', 'edit-lookup', workspace.selectedOrgSlug, editLeaseId],
    queryFn: () => houseApi.getLease(editLeaseId as number),
    enabled: enabled && Boolean(editLeaseId),
  });
  const leases = useQuery({
    queryKey: ['house', 'leases', workspace.selectedOrgSlug, page, status, sourceHouseId, contractMissing],
    queryFn: () => houseApi.listLeases({ page, page_size: PAGE_SIZE, status, house_id: sourceHouseId, contract_missing: contractMissing }),
    enabled,
  });
  const rows = leases.data?.items || [];
  const pendingCount = overviewQueries[0]?.data?.total || 0;
  const activeCount = overviewQueries[1]?.data?.total || 0;
  const contractMissingCount = overviewQueries[2]?.data?.total || 0;
  const expiredCount = overviewQueries[3]?.data?.total || 0;
  const terminatedCount = overviewQueries[4]?.data?.total || 0;
  const allLeaseCount = pendingCount + activeCount + expiredCount + terminatedCount;
  const readySourceViewingCount = readySourceViewings.data?.total || readySourceViewings.data?.items?.length || 0;
  const selectedScopedHouse = (houses.data?.items || []).find((item) => item.id === sourceHouseId);
  const overviewLoading = scopedOverview ? isAnyInitialQueryPending(scopedOverviewQueries) : isAnyInitialQueryPending(overviewQueries);
  const listLoading = isInitialQueryPending(leases);
  const pageSuggestion = overviewLoading ? '正在整理租约台账，请稍候再判断签约、归档和履约优先级。' : getLeasePageSuggestion(task, status, { pending: pendingCount, contractMissing: contractMissingCount, expired: expiredCount, terminated: terminatedCount });
  const scopeText = getLeaseScopeText({ task, status, houseLabelText: selectedScopedHouse ? houseLabel(selectedScopedHouse) : undefined });
  const focusedActionTitle = task === 'contract' && editLeaseId ? '当前操作：补归档合同' : undefined;
  const focusedActionDescription = task === 'contract' && editLeaseId ? '当前入口来自合同缺失队列，优先上传主合同文件，再继续确认租约状态和履约节点。' : undefined;
  const focusedActionReturnHref = task === 'contract' && editLeaseId ? dashboardHref(buildLeaseQueueHref({ houseId: sourceHouseId, task, status })) : undefined;
  const workflowQueueLinks = [
    { key: 'all', label: '全部', count: allLeaseCount, href: buildLeaseQueueHref({ houseId: sourceHouseId }), active: !task && !status },
    { key: 'pending', label: '待生效', count: pendingCount, href: buildLeaseQueueHref({ houseId: sourceHouseId, status: 'pending' }), active: !task && status === 'pending' },
    { key: 'active', label: '生效中', count: activeCount, href: buildLeaseQueueHref({ houseId: sourceHouseId, status: 'active' }), active: !task && status === 'active' },
    { key: 'expired', label: '已到期', count: expiredCount, href: buildLeaseQueueHref({ houseId: sourceHouseId, status: 'expired' }), active: !task && status === 'expired' },
    { key: 'terminated', label: '已终止', count: terminatedCount, href: buildLeaseQueueHref({ houseId: sourceHouseId, status: 'terminated' }), active: !task && status === 'terminated' },
  ] as const;
  const documentQueueLinks = [
    { key: 'contract', label: '待补合同', count: contractMissingCount, href: buildLeaseQueueHref({ houseId: sourceHouseId, task: 'contract' }), active: task === 'contract' && !status },
  ] as const;
  const leaseEntryLinks = [
    { key: 'ready_viewings', label: '去待签约带看', href: '/dashboard/property-rental/viewings?pending_lease=true&contact_missing=false', description: '从已成交且主体完整的带看记录进入签约。' },
    { key: 'missing_contact_viewings', label: '去待补租客', href: '/dashboard/property-rental/viewings?pending_lease=true&contact_missing=true', description: '先补齐租客主体，再继续签约。' },
  ] as const;
  const scopedOverviewCounts = useMemo(() => {
    let queryIndex = 0;
    return scopedOverviewCards.reduce<Record<string, number>>((acc, item) => {
      if (item.params) {
        acc[item.key] = scopedOverviewQueries[queryIndex]?.data?.total || 0;
        queryIndex += 1;
      }
      return acc;
    }, {});
  }, [scopedOverviewCards, scopedOverviewQueries]);
  const tenantItems = useMemo(() => [...createdTenants, ...(tenants.data?.items || [])], [createdTenants, tenants.data]);
  const sourceViewing = sourceViewingRecordId ? (sourceViewingLookup.data?.items || []).find((item) => item.id === sourceViewingRecordId) : undefined;
  const sourceViewingNeedsContact = Boolean(sourceViewingRecordId && sourceViewingLookup.isSuccess && sourceViewing && !sourceViewing.contact_id);
  const staleSourceViewing = Boolean(sourceViewingRecordId && sourceViewingLookup.isSuccess && !sourceViewing);
  const sourceViewingOptions = useMemo(() => {
    const options = new Map<number, { value: number; label: string }>();
    (readySourceViewings.data?.items || []).forEach((item) => {
      options.set(item.id, { value: item.id, label: `${item.customer_name} / ${houseLabel(item)}` });
    });
    if (editing?.source_viewing_record_id && editing.source_viewing_record_label) {
      options.set(editing.source_viewing_record_id, { value: editing.source_viewing_record_id, label: editing.source_viewing_record_label });
    }
    return Array.from(options.values());
  }, [editing, readySourceViewings.data?.items]);
  const selectedSourceViewing = selectedSourceViewingRecordId
    ? (readySourceViewings.data?.items || []).find((item) => item.id === selectedSourceViewingRecordId) || (sourceViewing?.id === selectedSourceViewingRecordId ? sourceViewing : undefined)
    : sourceViewing?.contact_id
      ? sourceViewing
      : undefined;
  const updateDrawerState = (nextState: LeaseDrawerSearchState) => {
    syncLeaseDrawerSearch(nextState);
    setDrawerState(nextState);
    setLocationSearch(window.location.search);
  };
  const clearDrawerState = () => updateDrawerState({});

  useEffect(() => {
    if (!sourceViewingRecordId || !sourceViewing || !sourceViewing.contact_id || openedSourceViewing || editing || drawerOpen || !sourceViewingLookup.isSuccess) return;
    setDrawerOpen(true);
    setOpenedSourceViewing(true);
  }, [drawerOpen, editing, openedSourceViewing, sourceViewing, sourceViewingLookup.isSuccess, sourceViewingRecordId]);

  useEffect(() => {
    syncLeaseListSearch({ page, status });
    setLocationSearch(window.location.search);
  }, [page, status]);

  useEffect(() => {
    const handlePopState = () => {
      const listState = getLeaseListStateFromSearch(window.location.search);
      setPage(listState.page);
      setStatus(listState.status);
      setDrawerState(getLeaseDrawerStateFromSearch(window.location.search));
      setLocationSearch(window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openLeaseQueue = (href: string) => {
    const nextSearch = new URL(href, 'http://localhost').search;
    const nextState = getLeaseListStateFromSearch(nextSearch);
    setPage(nextState.page);
    setStatus(nextState.status);
    setDrawerState(getLeaseDrawerStateFromSearch(nextSearch));
    setLocationSearch(nextSearch);
    history.push(href);
  };

  useEffect(() => {
    if (!sourceHouseId || sourceViewingRecordId || openedSourceHouse || editing || drawerOpen || !houses.isSuccess) return;
    setDrawerOpen(true);
    setOpenedSourceHouse(true);
  }, [drawerOpen, editing, houses.isSuccess, openedSourceHouse, sourceHouseId, sourceViewingRecordId]);

  useEffect(() => {
    if (!editLeaseId || openedEditLease || editing || drawerOpen || (!leases.isSuccess && !editLeaseLookup.isSuccess)) return;
    const targetLease = rows.find((item) => item.id === editLeaseId) || editLeaseLookup.data;
    if (!targetLease) return;
    setEditing(targetLease);
    setDrawerOpen(true);
    setOpenedEditLease(true);
  }, [drawerOpen, editLeaseId, editLeaseLookup.data, editLeaseLookup.isSuccess, editing, leases.isSuccess, openedEditLease, rows]);

  const saveLease = useMutation({
    mutationFn: (values: LeaseFormValues) => {
      if (editing) return houseApi.patchLease(editing.id, values);
      const { status: _status, ...payload } = values;
      return houseApi.createLease({ ...payload, payment_day: Number(payload.payment_day || 1) });
    },
    onSuccess: async () => {
      message.success(editing ? '租约已更新' : '租约已创建');
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['house', 'leases'] });
    },
  });
  const updateLeaseStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => houseApi.patchLease(id, { status }),
    onSuccess: async () => {
      message.success('租约状态已更新');
      await queryClient.invalidateQueries({ queryKey: ['house', 'leases'] });
    },
  });
  const createTenant = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.createContact({ ...values, roles: [CONTACT_ROLE.TENANT], is_active: true }),
    onSuccess: (contact) => {
      setCreatedTenants((items) => [contact, ...items]);
      form.setFieldValue('tenant_id', contact.id);
      setTenantOpen(false);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (record: LeaseOut) => {
    setEditing(record);
    setDrawerOpen(true);
    updateDrawerState({ editLeaseId: record.id });
    setOpenedEditLease(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
    setOpenedSourceViewing(false);
    setOpenedEditLease(false);
    if (drawerState.sourceViewingRecordId || drawerState.editLeaseId) {
      clearDrawerState();
    }
  };

  const fillLeaseFromViewing = (viewingId?: number | null) => {
    const viewing = (readySourceViewings.data?.items || []).find((item) => item.id === viewingId);
    if (!viewing) return;
    form.setFieldsValue({
      house_id: viewing.house_id,
      tenant_id: viewing.contact_id || null,
    });
  };

  const createInitialValues: Partial<LeaseFormValues> = {
    payment_day: 1,
    ...(sourceHouseId ? { house_id: sourceHouseId } : {}),
    ...(sourceViewingRecordId ? { source_viewing_record_id: sourceViewingRecordId } : {}),
    ...(sourceViewing?.house_id ? { house_id: sourceViewing.house_id } : {}),
    ...(sourceViewing?.contact_id ? { tenant_id: sourceViewing.contact_id } : {}),
  };
  const formInitialValues: Partial<LeaseFormValues> = editing || createInitialValues;
  const selectedHouseId = Number(formValues?.house_id || formInitialValues.house_id) || undefined;
  const selectedTenantId = Number(formValues?.tenant_id || formInitialValues.tenant_id) || undefined;
  const selectedHouse = (houses.data?.items || []).find((item) => item.id === selectedHouseId);
  const selectedTenant = tenantItems.find((item) => item.id === selectedTenantId);
  const draftContractFiles = ((formValues?.contract_files || formInitialValues.contract_files) as Record<string, unknown>[] | undefined) || [];
  const drawerEntryText = getLeaseDrawerEntryText({
    editing: Boolean(editing),
    sourceViewingLabel: selectedSourceViewing ? `${selectedSourceViewing.customer_name} / ${houseLabel(selectedSourceViewing)}` : undefined,
    sourceHouseId,
  });
  const drawerWarningText = getLeaseDrawerWarning({
    selectedSourceViewing,
    houseId: selectedHouseId,
    tenantId: selectedTenantId,
    startDate: formValues?.start_date || formInitialValues.start_date,
    endDate: formValues?.end_date || formInitialValues.end_date,
    monthlyRent: formValues?.monthly_rent || formInitialValues.monthly_rent,
    contractCount: draftContractFiles.length,
  });
  const drawerReady = !drawerWarningText.includes('还未') && !drawerWarningText.includes('待补合同') && !drawerWarningText.includes('未绑定');
  const sectionStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    background: token.colorBgContainer,
  } as const;
  const overviewTileStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    background: token.colorFillQuaternary,
    height: '100%',
  } as const;
  const signalTileStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    background: token.colorBgContainer,
    height: '100%',
  } as const;
  const closureSignals: LeaseClosureSignal[] = [
    {
      key: 'signing',
      title: '签约落地',
      emphasis: pendingCount > 0 ? '先落签约' : readySourceViewingCount > 0 ? '先转租约' : '签约平稳',
      summary: `${pendingCount} 份待生效 / ${readySourceViewingCount} 条可签约带看`,
      description: '先把成交记录转成租约并确认起租交付，避免签约停在半路。',
      actionLabel: '查看待生效',
      href: dashboardHref(buildLeaseQueueHref({ houseId: sourceHouseId, status: 'pending' })),
    },
    {
      key: 'contract',
      title: '合同归档',
      emphasis: contractMissingCount > 0 ? '先补合同' : '合同已齐',
      summary: `${contractMissingCount} 份待补合同`,
      description: '租约已创建但合同缺失，履约、收租和结算都会缺凭证。',
      actionLabel: '查看待补合同',
      href: dashboardHref(buildLeaseQueueHref({ houseId: sourceHouseId, task: 'contract' })),
    },
    {
      key: 'active',
      title: '履约运行',
      emphasis: activeCount > 0 ? '持续跟进' : '当前平稳',
      summary: `${activeCount} 份生效中`,
      description: '生效中的租约要持续看收租、续租和合同补档。',
      actionLabel: '查看生效中',
      href: dashboardHref(buildLeaseQueueHref({ houseId: sourceHouseId, status: 'active' })),
    },
    {
      key: 'closure',
      title: '到期收口',
      emphasis: expiredCount + terminatedCount > 0 ? '先做退租收口' : '收口已完成',
      summary: `${expiredCount} 份已到期 / ${terminatedCount} 份已终止`,
      description: '到期和终止租约要尽快完成退租、结清和资料归档，避免尾账悬空。',
      actionLabel: '查看待收口',
      href: dashboardHref(buildLeaseQueueHref({ houseId: sourceHouseId, status: 'expired' })),
    },
  ];

  return (
    <TenantSelectionGuard title="租约" subtitle="查看签约、履约和合同资料状态。">
      {focusedActionTitle ? (
        <Alert
          type="info"
          showIcon
          title={focusedActionTitle}
          description={focusedActionDescription}
          action={focusedActionReturnHref ? <Button size="small" href={focusedActionReturnHref}>返回队列</Button> : undefined}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <div style={sectionStyle}>
        <Typography.Text strong>{scopedOverview ? '当前筛选概览' : '签约概览'}</Typography.Text>
        <Row gutter={[16, 16]}>
          {scopedOverview
            ? scopedOverviewCards.map((item) => (
                <Col key={item.key} xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic title={item.title} value={getLoadingSafeCount(item.getValue ? item.getValue(scopedOverviewCounts) : scopedOverviewCounts[item.key] || 0, overviewLoading)} />
                    <Typography.Text type="secondary">{getLoadingSafeText(item.hint, '正在汇总当前租约范围...', overviewLoading)}</Typography.Text>
                  </div>
                </Col>
              ))
            : (
                <>
                  <Col xs={24} sm={12} xl={6}>
                    <div style={overviewTileStyle}>
                      <Statistic title="待生效" value={getLoadingSafeCount(pendingCount, overviewLoading)} />
                      <Typography.Text type="secondary">{getLoadingSafeText('待确认起租与交付安排', '正在汇总待生效租约...', overviewLoading)}</Typography.Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12} xl={6}>
                    <div style={overviewTileStyle}>
                      <Statistic title="生效中" value={getLoadingSafeCount(activeCount, overviewLoading)} />
                      <Typography.Text type="secondary">{getLoadingSafeText('履约中的租约需要持续跟进', '正在汇总履约租约...', overviewLoading)}</Typography.Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12} xl={6}>
                    <div style={overviewTileStyle}>
                      <Statistic title="待补合同" value={getLoadingSafeCount(contractMissingCount, overviewLoading)} />
                      <Typography.Text type="secondary">{getLoadingSafeText('合同资料未归档的租约', '正在识别合同缺口...', overviewLoading)}</Typography.Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12} xl={6}>
                    <div style={overviewTileStyle}>
                      <Statistic title="已到期" value={getLoadingSafeCount(expiredCount, overviewLoading)} />
                      <Typography.Text type="secondary">{getLoadingSafeText('待退租或续租处理的合同', '正在汇总到期租约...', overviewLoading)}</Typography.Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12} xl={6}>
                    <div style={overviewTileStyle}>
                      <Statistic title="已终止" value={getLoadingSafeCount(terminatedCount, overviewLoading)} />
                      <Typography.Text type="secondary">{getLoadingSafeText('待结清和终止归档的租约', '正在汇总终止租约...', overviewLoading)}</Typography.Text>
                    </div>
                  </Col>
                </>
              )}
        </Row>
      </div>

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <Typography.Text strong>当前建议</Typography.Text>
        <div style={{ marginTop: 12 }}>
          <Typography.Text>{pageSuggestion}</Typography.Text>
        </div>
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
        <Typography.Text strong>履约队列</Typography.Text>
        <Space wrap style={{ marginTop: 12 }}>
          {workflowQueueLinks.map((item) => (
            <Button key={item.key} size="small" type={item.active ? 'primary' : 'default'} onClick={() => openLeaseQueue(item.href)}>
              {`${item.label} ${item.count}`}
            </Button>
          ))}
        </Space>
      </div>

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, width: '100%', marginBottom: 16 }}>
          <div>
            <Typography.Text strong>资料队列</Typography.Text>
            <div>
              <Typography.Text type="secondary">签约通常从带看转入；如果租客主体还没补齐，先去待补租客队列处理，再回到这里创建租约。</Typography.Text>
            </div>
          </div>
          <AdminToolbar>
            <Space wrap>
              {leaseEntryLinks.map((item) => (
                <Button key={item.key} href={item.href}>
                  {item.label}
                </Button>
              ))}
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                新建租约
              </Button>
            </Space>
          </AdminToolbar>
        </div>
        <Space wrap style={{ marginBottom: 16 }}>
          {documentQueueLinks.map((item) => (
            <Button key={item.key} size="small" type={item.active ? 'primary' : 'default'} onClick={() => openLeaseQueue(item.href)}>
              {`${item.label} ${item.count}`}
            </Button>
          ))}
        </Space>
        {scopeText ? (
          <Alert
            type="info"
            showIcon
            title={`当前只看：${scopeText}`}
            action={<Button size="small" href={dashboardHref(buildLeaseQueueHref({ houseId: sourceHouseId }))}>查看全部</Button>}
            style={{ marginBottom: 16 }}
          />
        ) : null}
        {sourceViewingNeedsContact ? (
          <Alert
            type="warning"
            showIcon
            title="该成交带看未绑定租客联系人，请先回带看页补齐业务主体后再签约。"
            action={<Button size="small" href={`/dashboard/property-rental/viewings?pending_lease=true&contact_missing=true&edit=${sourceViewingRecordId}`}>去补租客</Button>}
            style={{ marginBottom: 16 }}
          />
        ) : null}
        {staleSourceViewing ? (
          <Alert
            type="warning"
            showIcon
            title="该成交带看已生成租约，不能重复签约。"
            action={<Button size="small" href="/dashboard/property-rental/leases">查看租约列表</Button>}
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <Space wrap style={{ marginBottom: 16 }}>
          <Select allowClear placeholder="状态" options={LEASE_STATUS_OPTIONS} value={status} onChange={(value) => { setPage(1); setStatus(value); }} style={toolbarControlStyle} />
        </Space>
        <Table<LeaseOut>
          rowKey="id"
          loading={listLoading}
          columns={[
            {
              title: '租约信息',
              dataIndex: 'house_label',
              width: 360,
              render: (_value, record) => {
                const businessInfo = getLeaseBusinessInfo(record);
                return (
                  <Space orientation="vertical" size={2}>
                    <Typography.Text strong>{businessInfo.primary}</Typography.Text>
                    <Typography.Text type="secondary">{businessInfo.secondary}</Typography.Text>
                  </Space>
                );
              },
            },
            { title: '状态', dataIndex: 'status', width: 120, render: (value) => <Tag color={STATUS_COLOR[value] || 'default'}>{STATUS_TEXT[value] || value}</Tag> },
            {
              title: '当前动作',
              dataIndex: 'next_action',
              width: 220,
              render: (_value, record) => (
                <Space orientation="vertical" size={2}>
                  <Typography.Text strong>{getLeaseNextActionText(record)}</Typography.Text>
                  <Typography.Text type="secondary">{getLeaseWorkflowHint(record)}</Typography.Text>
                </Space>
              ),
            },
            {
              title: '合同',
              dataIndex: 'contract_files',
              width: 120,
              render: (value) => (
                <Space size={8}>
                  <span>{`${value?.length || 0} 份`}</span>
                  {!value?.length ? <Tag color="orange">待补合同</Tag> : null}
                </Space>
              ),
            },
            {
              title: '操作',
              dataIndex: 'actions',
              fixed: 'right',
              width: 220,
              render: (_value, record) => (
                <ResponsiveActions>
                  {!record.contract_files?.length ? (
                    <a href={leaseEditPath(record, { task, status })}>补合同</a>
                  ) : (
                    <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>
                  )}
                  {record.contract_files?.length
                    ? (LEASE_STATUS_FLOW_OPTIONS[record.status] || [])
                        .filter((item) => item.value !== record.status)
                        .map((item) => (
                          <Button
                            type="link"
                            size="small"
                            key={item.value}
                            onClick={() => {
                              updateLeaseStatus.mutate({ id: record.id, status: item.value });
                            }}
                          >
                            {LEASE_STATUS_ACTION_TEXT[item.value] || item.label}
                          </Button>
                        ))
                    : null}
                </ResponsiveActions>
              ),
            },
          ]}
          dataSource={rows}
          locale={{
            emptyText: getLoadingAwareEmptyState({
              loading: listLoading,
              loadingTitle: '租约数据加载中',
              loadingDescription: '正在同步签约、合同归档和履约状态。',
              emptyState: getLeaseEmptyState({ task, status, sourceHouseId, pendingCount, activeCount, openCreate }),
            }),
          }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: leases.data?.total || 0, showSizeChanger: false, onChange: setPage }}
          scroll={adminTableScroll}
        />
      </div>
      <Drawer
        title={editing ? '编辑租约' : '新建租约'}
        open={drawerOpen}
        size="large"
        onClose={closeDrawer}
        destroyOnHidden
        extra={<Button type="primary" htmlType="submit" form="lease-form" loading={saveLease.isPending}>保存</Button>}
      >
        <Form form={form} id="lease-form" layout="vertical" initialValues={formInitialValues} preserve={false} onFinish={(values) => saveLease.mutate(values)}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {sourceViewingRecordId && !editing && !sourceViewingNeedsContact ? <Alert type="info" showIcon title="已带入成交带看，补齐租期和金额后保存。" /> : null}
            {!sourceViewingRecordId && sourceHouseId && !editing ? <Alert type="info" showIcon title="已带入房源，补齐租客、租期和金额后保存。" /> : null}
            {selectedSourceViewing && !selectedSourceViewing.contact_id ? (
              <Alert type="warning" showIcon title="该成交带看未绑定租客联系人，请先新建或选择租客再保存。" />
            ) : null}

            <Row gutter={[16, 16]} align="top">
              <Col xs={24} xl={15}>
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <div style={sectionStyle}>
                    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                      <div>
                        <Typography.Text strong>签约主体</Typography.Text>
                        <br />
                        <Typography.Text type="secondary">确认房源、租客和来源带看，避免合同主体和成交来源错配。</Typography.Text>
                      </div>
                      <Row gutter={[16, 0]}>
                        <Col xs={24}>
                          <Form.Item label="房源" name="house_id" rules={[{ required: true, message: '请选择房源' }]}>
                            <Select options={(houses.data?.items || []).map((item) => ({ value: item.id, label: houseLabel(item) }))} />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item label="租客" required htmlFor="tenant_id">
                            <Space.Compact style={{ width: '100%' }}>
                              <Form.Item name="tenant_id" rules={[{ required: true, message: '请选择租客' }]} noStyle>
                                <Select options={tenantItems.map((item) => ({ value: item.id, label: contactLabel(item) }))} />
                              </Form.Item>
                              <Button onClick={() => setTenantOpen(true)}>新建租客</Button>
                            </Space.Compact>
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item label="成交带看" name="source_viewing_record_id">
                            <Select allowClear options={sourceViewingOptions} onChange={fillLeaseFromViewing} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Space>
                  </div>

                  <div style={sectionStyle}>
                    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                      <div>
                        <Typography.Text strong>租期与金额</Typography.Text>
                        <br />
                        <Typography.Text type="secondary">起租、到期、月租和押金是后续履约、收租和结算的基础字段。</Typography.Text>
                      </div>
                      <Row gutter={[16, 0]}>
                        <Col xs={24} md={12}>
                          <Form.Item label="起租日期" name="start_date" rules={[{ required: true, message: '请选择起租日期' }]}>
                            <Input type="date" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="到期日期" name="end_date" rules={[{ required: true, message: '请选择到期日期' }]}>
                            <Input type="date" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="月租" name="monthly_rent" rules={[{ required: true, message: '请输入月租' }]}>
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="押金" name="deposit">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="付款日" name="payment_day">
                            <Input type="number" min={1} max={31} />
                          </Form.Item>
                        </Col>
                        {editing ? (
                          <Col xs={24} md={12}>
                            <Form.Item label="状态" name="status">
                              <Select options={LEASE_STATUS_OPTIONS} />
                            </Form.Item>
                          </Col>
                        ) : null}
                      </Row>
                    </Space>
                  </div>

                  <div style={sectionStyle}>
                    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                      <div>
                        <Typography.Text strong>合同归档</Typography.Text>
                        <br />
                        <Typography.Text type="secondary">签约时同步补合同，后续履约、收租和结算才能有完整凭证。</Typography.Text>
                      </div>
                      <Form.Item label="合同文件" name="contract_files" style={{ marginBottom: 0 }}>
                        <MediaRefsUpload
                          title="合同文件"
                          description="支持上传 1 份主合同文件，保存后可继续在租约页维护状态。"
                          resourceType={HOUSE_MEDIA_RESOURCE_TYPE.LEASE_CONTRACT}
                          mediaType={HOUSE_MEDIA_TYPE.FILE}
                          maxCount={1}
                        />
                      </Form.Item>
                    </Space>
                  </div>

                  <div style={sectionStyle}>
                    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                      <div>
                        <Typography.Text strong>补充说明</Typography.Text>
                        <br />
                        <Typography.Text type="secondary">记录特殊交付安排、付款约定或需要继续跟进的说明。</Typography.Text>
                      </div>
                      <Form.Item label="备注" name="notes" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={4} />
                      </Form.Item>
                    </Space>
                  </div>
                </Space>
              </Col>

              <Col xs={24} xl={9}>
                <Card size="small" title="签约摘要">
                  <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    <Space wrap>
                      <Tag color="blue">{drawerEntryText}</Tag>
                      {editing?.status ? <Tag color={STATUS_COLOR[editing.status] || 'default'}>{STATUS_TEXT[editing.status] || editing.status}</Tag> : null}
                      {!draftContractFiles.length ? <Tag color="orange">待补合同</Tag> : <Tag color="green">合同已上传</Tag>}
                    </Space>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="房源">{selectedHouse ? houseLabel(selectedHouse) : '待选择'}</Descriptions.Item>
                      <Descriptions.Item label="租客">
                        {selectedTenant
                          ? contactLabel(selectedTenant)
                          : selectedSourceViewing?.customer_name
                            ? `${selectedSourceViewing.customer_name} / ${selectedSourceViewing.customer_phone || '-'}`
                            : '待选择'}
                      </Descriptions.Item>
                      <Descriptions.Item label="来源">
                        {selectedSourceViewing
                          ? `${selectedSourceViewing.customer_name} / ${houseLabel(selectedSourceViewing)}`
                          : sourceHouseId && !editing
                            ? '房源直建'
                            : '手动录入'}
                      </Descriptions.Item>
                      <Descriptions.Item label="租期">
                        {formValues?.start_date || formInitialValues.start_date
                          ? `${formValues?.start_date || formInitialValues.start_date} 至 ${formValues?.end_date || formInitialValues.end_date || '待填'}`
                          : '待填写'}
                      </Descriptions.Item>
                      <Descriptions.Item label="月租">
                        {(formValues?.monthly_rent || formInitialValues.monthly_rent)
                          ? moneyText(formValues?.monthly_rent || formInitialValues.monthly_rent)
                          : '待填写'}
                      </Descriptions.Item>
                    </Descriptions>
                    <Alert
                      type={drawerReady ? 'success' : 'warning'}
                      showIcon
                      title={drawerReady ? '当前可直接保存' : '当前仍有待补项'}
                      description={drawerWarningText}
                    />
                  </Space>
                </Card>
              </Col>
            </Row>
          </Space>
        </Form>
      </Drawer>
      <Modal
        title="新建租客"
        open={tenantOpen}
        onCancel={() => setTenantOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form layout="vertical" initialValues={{ name: sourceViewing?.customer_name, phone: sourceViewing?.customer_phone }} onFinish={(values) => createTenant.mutate(values)}>
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="手机" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createTenant.isPending}>
            保存租客
          </Button>
        </Form>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default LeasesPage;
