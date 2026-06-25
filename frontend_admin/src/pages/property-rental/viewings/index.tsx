import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, Modal, Row, Select, Space, Statistic, Table, Tag, Typography, message, theme } from 'antd';
import React, { useEffect, useState } from 'react';
import { AdminToolbar, ResponsiveActions, adminTableScroll, toolbarControlStyle } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type ContactOut, type ViewingRecordOut } from '@/services/manual/house';
import { contactLabel, dateTimeInputValue, dateTimeText, houseLabel, STATUS_COLOR, STATUS_TEXT, VIEWING_STATUS, VIEWING_STATUS_FLOW_OPTIONS, VIEWING_STATUS_OPTIONS } from '../constants';
import { getLoadingAwareEmptyState, getLoadingSafeCount, getLoadingSafeText, isAnyInitialQueryPending, isInitialQueryPending } from '../loading';

const PAGE_SIZE = 20;
const VIEWING_STATUS_ACTION_TEXT: Record<string, string> = {
  viewed: '完成带看',
  converted: '标记成交',
  canceled: '取消',
  no_show: '标记爽约',
};

function needsContactCompletion(record: ViewingRecordOut) {
  return record.status === VIEWING_STATUS.CONVERTED && !record.signed_lease_id && !record.contact_id;
}

function canCreateLease(record: ViewingRecordOut) {
  return record.status === VIEWING_STATUS.CONVERTED && !record.signed_lease_id && Boolean(record.contact_id);
}

function leaseCreatePath(record: ViewingRecordOut) {
  return `/dashboard/property-rental/leases?source_viewing_record_id=${record.id}`;
}

function leaseEditPath(record: ViewingRecordOut) {
  return `/dashboard/property-rental/leases?house_id=${record.house_id}&edit=${record.signed_lease_id}`;
}

function getViewingQueueHint(record: ViewingRecordOut) {
  if (needsContactCompletion(record)) return '成交已确认，但尚未绑定租客联系人，签约前先补齐业务主体';
  if (record.status === VIEWING_STATUS.CONVERTED && !record.signed_lease_id) return '优先创建租约，避免成交记录停留在带看阶段';
  if (record.status === VIEWING_STATUS.CONVERTED && record.signed_lease_id) return '已转租约，后续跟进合同和起租安排';
  if (record.status === VIEWING_STATUS.VIEWED) return '带看已完成，尽快更新客户意向与是否成交';
  if (record.status === VIEWING_STATUS.SCHEDULED) return '预约已创建，待确认客户到访结果';
  if (record.status === VIEWING_STATUS.CANCELED) return '已取消，确认是否需要重新预约';
  if (record.status === VIEWING_STATUS.NO_SHOW) return '客户爽约，建议尽快安排回访';
  return '按当前进展继续跟进';
}

function getViewingNextActionText(record: ViewingRecordOut) {
  if (needsContactCompletion(record)) return '待补租客';
  if (record.status === VIEWING_STATUS.CONVERTED && !record.signed_lease_id) return '待转租约';
  if (record.status === VIEWING_STATUS.CONVERTED && record.signed_lease_id) return '已转租约';
  if (record.status === VIEWING_STATUS.VIEWED) return '待回访决策';
  if (record.status === VIEWING_STATUS.SCHEDULED) return '待确认到访';
  if (record.status === VIEWING_STATUS.CANCELED || record.status === VIEWING_STATUS.NO_SHOW) return '异常待回访';
  return '持续跟进';
}

function getViewingPageSuggestion(status?: string, pendingLease?: boolean, abnormalCount?: number, missingContactCount?: number) {
  if ((missingContactCount || 0) > 0) return '先补齐已成交记录的租客联系人，再创建租约，避免签约主体缺失。';
  if (pendingLease) return '优先补租约建档，避免成交记录长期停留在带看阶段。';
  if (status === VIEWING_STATUS.CONVERTED) return '已成交记录应尽快转租约，避免签约链路中断。';
  if (status === VIEWING_STATUS.VIEWED) return '已带看客户要尽快补回访结果，否则很难判断成交机会。';
  if (status === VIEWING_STATUS.SCHEDULED) return '预约中的客户要及时确认到访，避免带看排期失真。';
  if (status === VIEWING_STATUS.CANCELED || status === VIEWING_STATUS.NO_SHOW) return '异常记录需要及时回访，避免客户线索直接流失。';
  if ((abnormalCount || 0) > 0) return '优先清理爽约/取消记录，避免客户跟进悬空。';
  return '先处理待签约和待回访记录，再补全预约过程状态。';
}

function getViewingDrawerEntryText(options: { editing: boolean; sourceHouseId?: number; sourceContactId?: number; status?: string }) {
  if (options.editing) return options.status ? `带看维护 / ${STATUS_TEXT[options.status] || options.status}` : '带看维护';
  if (options.sourceContactId) return '联系人快速登记';
  if (options.sourceHouseId) return '房源快速登记';
  return '手动新建带看';
}

function getViewingDrawerWarning(options: {
  houseId?: number;
  customerName?: string;
  customerPhone?: string;
  scheduledAt?: string;
  status?: string;
  selectedContactId?: number | null;
}) {
  const { houseId, customerName, customerPhone, scheduledAt, status, selectedContactId } = options;
  if (!houseId) return '还未选择房源，保存前先确认客户要看的具体房源。';
  if (!customerName || !customerPhone) return '客户姓名和手机还未补齐，避免后续回访无法落到具体主体。';
  if (!scheduledAt) return '还未设置预约时间，当前记录还不能进入带看排期。';
  if (status === VIEWING_STATUS.CONVERTED && !selectedContactId) return '已成交记录还未绑定租客联系人，签约前先补齐业务主体。';
  if (status === VIEWING_STATUS.VIEWED) return '带看已完成，建议尽快补回访结果或是否成交。';
  if (status === VIEWING_STATUS.SCHEDULED) return '预约信息已完整，保存后可进入到访确认和带看排期。';
  return '当前主体和排期信息已完整，可继续保存并进入后续跟进。';
}

function getViewingBusinessInfo(record: ViewingRecordOut) {
  const contactText = record.contact_id
    ? contactLabel(record)
    : needsContactCompletion(record)
      ? '未绑定租客'
      : '未绑定联系人';
  return {
    primary: `${record.customer_name} / ${record.customer_phone}`,
    secondary: `${houseLabel(record)} · ${contactText} · ${dateTimeText(record.scheduled_at)}`,
  };
}

function getViewingEmptyState(options: {
  pendingLease?: boolean;
  contactMissing?: boolean;
  pendingLeaseCount: number;
  missingContactQueueCount: number;
  readyLeaseCount: number;
  openCreate: () => void;
}) {
  const { pendingLease, contactMissing, pendingLeaseCount, missingContactQueueCount, readyLeaseCount, openCreate } = options;

  if (pendingLease && contactMissing === true) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={(
          <Space orientation="vertical" size={4}>
            <Typography.Text strong>待补租客队列已处理完成</Typography.Text>
            <Typography.Text type="secondary">当前筛选下已没有缺租客主体的成交记录，继续处理可签约或全部待签约队列。</Typography.Text>
          </Space>
        )}
      >
        <Space wrap>
          {readyLeaseCount > 0 ? <Button type="primary" href="/dashboard/property-rental/viewings?pending_lease=true&contact_missing=false">查看可签约</Button> : null}
          {pendingLeaseCount > 0 ? <Button href="/dashboard/property-rental/viewings?pending_lease=true">查看待签约</Button> : null}
          <Button onClick={openCreate}>新建带看</Button>
        </Space>
      </Empty>
    );
  }

  if (pendingLease && contactMissing === false) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={(
          <Space orientation="vertical" size={4}>
            <Typography.Text strong>当前可签约队列为空</Typography.Text>
            <Typography.Text type="secondary">
              {missingContactQueueCount > 0
                ? '当前没有主体完整且可直接签约的成交记录，先回到待补租客补齐主体，再继续签约。'
                : '当前没有主体完整且可直接签约的成交记录，可先回到全部待签约队列继续排查。'}
            </Typography.Text>
          </Space>
        )}
      >
        <Space wrap>
          {missingContactQueueCount > 0 ? <Button type="primary" href="/dashboard/property-rental/viewings?pending_lease=true&contact_missing=true">查看待补租客</Button> : null}
          {pendingLeaseCount > 0 ? <Button href="/dashboard/property-rental/viewings?pending_lease=true">查看待签约</Button> : null}
          <Button onClick={openCreate}>新建带看</Button>
        </Space>
      </Empty>
    );
  }

  return (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无带看记录">
      <Button type="primary" onClick={openCreate}>新建带看</Button>
    </Empty>
  );
}

const STATUS_OVERVIEW_ITEMS = [
  { key: 'scheduled', title: '已预约', params: { status: VIEWING_STATUS.SCHEDULED } },
  { key: 'viewed', title: '待回访', params: { status: VIEWING_STATUS.VIEWED } },
  { key: 'converted', title: '已成交', params: { status: VIEWING_STATUS.CONVERTED } },
  { key: 'pending_lease', title: '待签约', params: { pending_lease: true } },
  { key: 'canceled', title: '已取消', params: { status: VIEWING_STATUS.CANCELED } },
  { key: 'no_show', title: '爽约', params: { status: VIEWING_STATUS.NO_SHOW } },
] as const;

type ViewingOverviewCard = {
  key: string;
  title: string;
  hint: string;
  params?: Record<string, unknown>;
  getValue?: (context: { counts: Record<string, number>; currentTotal: number }) => number;
};

type ViewingClosureSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  href: string;
};

function getScopedViewingOverviewCards(status?: string, pendingLease?: boolean, contactMissing?: boolean): ViewingOverviewCard[] {
  if (pendingLease) {
    if (contactMissing === true) {
      return [
        {
          key: 'current_pending_scope',
          title: '当前待补租客',
          hint: '当前筛选下仍缺租客主体的成交记录',
          getValue: ({ currentTotal }) => currentTotal,
        },
        {
          key: 'pending_lease_total',
          title: '全部待签约',
          hint: '当前房源范围内所有待签约成交记录',
          params: { pending_lease: true },
        },
        {
          key: 'pending_ready_lease',
          title: '可签约',
          hint: '主体完整，可直接转租约',
          getValue: ({ counts, currentTotal }) => Math.max((counts.pending_lease_total || 0) - currentTotal, 0),
        },
        {
          key: 'all_converted_scope',
          title: '已成交',
          hint: '当前房源范围内的全部成交记录',
          params: { status: VIEWING_STATUS.CONVERTED },
        },
      ];
    }

    if (contactMissing === false) {
      return [
        {
          key: 'current_pending_scope',
          title: '当前可签约',
          hint: '当前筛选下主体已完整的成交记录',
          getValue: ({ currentTotal }) => currentTotal,
        },
        {
          key: 'pending_lease_total',
          title: '全部待签约',
          hint: '当前房源范围内所有待签约成交记录',
          params: { pending_lease: true },
        },
        {
          key: 'pending_missing_contact',
          title: '待补租客',
          hint: '成交后待补租客主体',
          params: { pending_lease: true, contact_missing: true },
        },
        {
          key: 'all_converted_scope',
          title: '已成交',
          hint: '当前房源范围内的全部成交记录',
          params: { status: VIEWING_STATUS.CONVERTED },
        },
      ];
    }

    return [
      {
        key: 'current_pending_scope',
        title: '当前待签约',
        hint: '当前筛选下的成交记录数',
        getValue: ({ currentTotal }) => currentTotal,
      },
      {
        key: 'pending_missing_contact',
        title: '待补租客',
        hint: '成交后待补租客主体',
        params: { pending_lease: true, contact_missing: true },
      },
      {
        key: 'pending_ready_lease',
        title: '可签约',
        hint: '主体完整，可直接转租约',
        getValue: ({ counts, currentTotal }) => Math.max(currentTotal - (counts.pending_missing_contact || 0), 0),
      },
      {
        key: 'all_converted_scope',
        title: '已成交',
        hint: '当前房源范围内的全部成交记录',
        params: { status: VIEWING_STATUS.CONVERTED },
      },
    ];
  }

  if (status === VIEWING_STATUS.CONVERTED) {
    return [
      {
        key: 'current_converted_scope',
        title: '当前已成交',
        hint: '当前筛选下的成交记录数',
        getValue: ({ currentTotal }) => currentTotal,
      },
      {
        key: 'converted_pending_lease',
        title: '待签约',
        hint: '仍待转租约的成交记录',
        params: { pending_lease: true },
      },
      {
        key: 'converted_missing_contact',
        title: '待补租客',
        hint: '成交后还缺租客主体',
        params: { pending_lease: true, contact_missing: true },
      },
      {
        key: 'converted_signed',
        title: '已转租约',
        hint: '已完成签约转化',
        getValue: ({ counts, currentTotal }) => Math.max(currentTotal - (counts.converted_pending_lease || 0), 0),
      },
    ];
  }

  if (status) {
    return [
      {
        key: 'current_status_scope',
        title: `当前${STATUS_TEXT[status] || status}`,
        hint: '当前筛选状态下的记录数',
        getValue: ({ currentTotal }) => currentTotal,
      },
      {
        key: 'status_pending_lease',
        title: '待签约',
        hint: '当前房源范围内仍待转租约',
        params: { pending_lease: true },
      },
      {
        key: 'status_missing_contact',
        title: '待补租客',
        hint: '当前房源范围内已成交但缺主体',
        params: { pending_lease: true, contact_missing: true },
      },
      {
        key: 'status_abnormal',
        title: '异常记录',
        hint: '取消或爽约待回访',
        getValue: ({ counts }) => (counts.status_canceled_scope || 0) + (counts.status_no_show_scope || 0),
      },
      {
        key: 'status_canceled_scope',
        title: '已取消',
        hint: '取消待回访',
        params: { status: VIEWING_STATUS.CANCELED },
      },
      {
        key: 'status_no_show_scope',
        title: '爽约',
        hint: '爽约待回访',
        params: { status: VIEWING_STATUS.NO_SHOW },
      },
    ];
  }

  return [];
}

function getViewingListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page') || '1');
  const contactMissingParam = params.get('contact_missing');
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    status: params.get('status') || undefined,
    pendingLease: params.get('pending_lease') === 'true' || undefined,
    contactMissing: contactMissingParam === null ? undefined : contactMissingParam === 'true',
  };
}

function syncViewingListSearch(filters: { page: number; status?: string; pendingLease?: boolean; contactMissing?: boolean }) {
  const params = new URLSearchParams(window.location.search);
  if (filters.status) {
    params.set('status', filters.status);
  } else {
    params.delete('status');
  }
  if (filters.pendingLease) {
    params.set('pending_lease', 'true');
  } else {
    params.delete('pending_lease');
  }
  if (filters.contactMissing !== undefined) {
    params.set('contact_missing', String(filters.contactMissing));
  } else {
    params.delete('contact_missing');
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

type ViewingDrawerSearchState = {
  sourceHouseId?: number;
  sourceContactId?: number;
  editViewingId?: number;
  task?: string;
};

function dashboardHref(path: string) {
  return `/dashboard${path}`;
}

function getViewingDrawerStateFromSearch(search: string): ViewingDrawerSearchState {
  const params = new URLSearchParams(search);
  const sourceHouseId = Number(params.get('house_id')) || undefined;
  const sourceContactId = Number(params.get('contact_id')) || undefined;
  const editViewingId = Number(params.get('edit')) || undefined;
  return {
    sourceHouseId,
    sourceContactId,
    editViewingId,
    task: params.get('task') || undefined,
  };
}

function syncViewingDrawerSearch(drawerState: ViewingDrawerSearchState) {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  params.delete('house_id');
  params.delete('contact_id');
  params.delete('edit');
  params.delete('task');
  if (drawerState.sourceHouseId) params.set('house_id', String(drawerState.sourceHouseId));
  if (drawerState.sourceContactId) params.set('contact_id', String(drawerState.sourceContactId));
  if (drawerState.editViewingId) params.set('edit', String(drawerState.editViewingId));
  if (drawerState.task) params.set('task', drawerState.task);

  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function getViewingTaskCopy(task?: string) {
  if (task === 'contact') {
    return {
      title: '当前操作：补齐租客主体',
      description: '当前入口来自待补租客队列，先绑定租客联系人，再继续签约。',
    };
  }
  return {};
}

function getViewingListHref(filters: { page: number; status?: string; pendingLease?: boolean; contactMissing?: boolean }) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.pendingLease) params.set('pending_lease', 'true');
  if (filters.contactMissing !== undefined) params.set('contact_missing', String(filters.contactMissing));
  if (filters.page > 1) params.set('page', String(filters.page));
  const search = params.toString();
  return dashboardHref(`/property-rental/viewings${search ? `?${search}` : ''}`);
}

type ViewingFormValues = {
  house_id: number;
  contact_id?: number | null;
  customer_name: string;
  customer_phone: string;
  scheduled_at: string;
  status?: string;
  notes?: string;
};

const ViewingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [form] = Form.useForm<ViewingFormValues>();
  const formValues = Form.useWatch([], { form, preserve: true }) as Partial<ViewingFormValues> | undefined;
  const initialListState = getViewingListStateFromSearch(window.location.search);
  const initialDrawerState = getViewingDrawerStateFromSearch(window.location.search);
  const [page, setPage] = useState(initialListState.page);
  const [pendingLease, setPendingLease] = useState<boolean | undefined>(initialListState.pendingLease);
  const [contactMissing, setContactMissing] = useState<boolean | undefined>(initialListState.contactMissing);
  const [status, setStatus] = useState<string | undefined>(initialListState.status);
  const [drawerState, setDrawerState] = useState<ViewingDrawerSearchState>(initialDrawerState);
  const [editing, setEditing] = useState<ViewingRecordOut | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [createdTenants, setCreatedTenants] = useState<ContactOut[]>([]);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const sourceHouseId = drawerState.sourceHouseId;
  const sourceContactId = drawerState.sourceContactId;
  const editViewingId = drawerState.editViewingId;
  const updateDrawerState = (nextState: ViewingDrawerSearchState) => {
    syncViewingDrawerSearch(nextState);
    setDrawerState(nextState);
  };
  const clearDrawerState = () => updateDrawerState({});
  const statusText = contactMissing === true
    ? '已成交待补租客'
    : contactMissing === false && pendingLease
      ? '已成交可签约'
      : pendingLease
        ? '已成交待签约'
        : status
          ? STATUS_TEXT[status] || status
          : undefined;
  const scopedOverview = Boolean(statusText);
  const houses = useQuery({ queryKey: ['house', 'viewings', 'houses', workspace.selectedOrgSlug], queryFn: () => houseApi.listHouses({ page: 1, page_size: 100 }), enabled });
  const contacts = useQuery({ queryKey: ['house', 'viewings', 'contacts', workspace.selectedOrgSlug], queryFn: () => houseApi.listContacts({ page: 1, page_size: 100, role: 'tenant' }), enabled });
  const overviewQueries = useQueries({
    queries: STATUS_OVERVIEW_ITEMS.map((item) => ({
      queryKey: ['house', 'viewings', 'overview', workspace.selectedOrgSlug, sourceHouseId, item.key],
      queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 1, house_id: sourceHouseId, ...item.params }),
      enabled,
    })),
  });
  const viewings = useQuery({
    queryKey: ['house', 'viewings', workspace.selectedOrgSlug, page, status, sourceHouseId, pendingLease, contactMissing],
    queryFn: () => houseApi.listViewingRecords({ page, page_size: PAGE_SIZE, status, house_id: sourceHouseId, pending_lease: pendingLease, contact_missing: contactMissing }),
    enabled,
  });
  const scopedOverviewCards = getScopedViewingOverviewCards(status, pendingLease, contactMissing);
  const scopedOverviewQueries = useQueries({
    queries: scopedOverviewCards
      .filter((item) => item.params)
      .map((item) => ({
        queryKey: ['house', 'viewings', 'scoped-overview', workspace.selectedOrgSlug, sourceHouseId, item.key, status, pendingLease, contactMissing],
        queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 1, house_id: sourceHouseId, ...(item.params || {}) }),
        enabled: enabled && scopedOverview,
      })),
  });
  const conversionSupportQueries = useQueries({
    queries: [
      {
        queryKey: ['house', 'viewings', 'conversion-support', workspace.selectedOrgSlug, sourceHouseId, 'missing-contact'],
        queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 1, house_id: sourceHouseId, pending_lease: true, contact_missing: true }),
        enabled,
      },
      {
        queryKey: ['house', 'viewings', 'conversion-support', workspace.selectedOrgSlug, sourceHouseId, 'ready-lease'],
        queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 1, house_id: sourceHouseId, pending_lease: true, contact_missing: false }),
        enabled,
      },
    ],
  });
  const scheduledCount = overviewQueries[0]?.data?.total || 0;
  const viewedCount = overviewQueries[1]?.data?.total || 0;
  const convertedCount = overviewQueries[2]?.data?.total || 0;
  const pendingLeaseCount = overviewQueries[3]?.data?.total || 0;
  const canceledCount = overviewQueries[4]?.data?.total || 0;
  const noShowCount = overviewQueries[5]?.data?.total || 0;
  const allViewingCount = scheduledCount + viewedCount + convertedCount + canceledCount + noShowCount;
  const abnormalCount = canceledCount + noShowCount;
  const missingContactQueueTotal = conversionSupportQueries[0]?.data?.total || 0;
  const readyLeaseQueueTotal = conversionSupportQueries[1]?.data?.total || 0;
  const rows = viewings.data?.items || [];
  const currentScopedTotal = viewings.data?.total || 0;
  const missingContactCount = contactMissing === true ? currentScopedTotal : missingContactQueueTotal;
  const pendingLeaseOverviewTitle = contactMissing === true ? '待补租客' : contactMissing === false && pendingLease ? '可签约' : '待签约';
  const pendingLeaseOverviewValue = pendingLease && contactMissing !== undefined ? viewings.data?.total || 0 : pendingLeaseCount;
  const pendingLeaseOverviewHint = contactMissing === true ? '成交后待补租客主体' : contactMissing === false && pendingLease ? '主体完整，可直接转租约' : '成交后待转租约的记录';
  const overviewLoading = scopedOverview ? isAnyInitialQueryPending([viewings, ...scopedOverviewQueries]) : isAnyInitialQueryPending(overviewQueries);
  const listLoading = isInitialQueryPending(viewings);
  const pageSuggestion = overviewLoading ? '正在整理带看数据，请稍候再判断回访、签约和异常跟进优先级。' : getViewingPageSuggestion(status, pendingLease, abnormalCount, missingContactCount);
  const defaultOverviewCards = [
    {
      key: 'scheduled',
      title: '已预约',
      count: scheduledCount,
      hint: '待确认客户到访结果',
    },
    {
      key: 'viewed',
      title: '待回访',
      count: viewedCount,
      hint: '带看后待更新成交意向',
    },
    {
      key: 'pending_lease',
      title: pendingLeaseOverviewTitle,
      count: pendingLeaseOverviewValue,
      hint: pendingLeaseOverviewHint,
    },
    {
      key: 'abnormal',
      title: '异常记录',
      count: abnormalCount,
      hint: `${canceledCount} 条取消，${noShowCount} 条爽约`,
    },
  ] as const;
  const visibleDefaultOverviewCards = defaultOverviewCards.filter((item) => item.count > 0);
  const renderedDefaultOverviewCards = overviewLoading
    ? defaultOverviewCards
    : (visibleDefaultOverviewCards.length ? visibleDefaultOverviewCards : defaultOverviewCards.slice(0, 1));
  const hiddenDefaultOverviewCount = defaultOverviewCards.length - renderedDefaultOverviewCards.length;
  const defaultOverviewSummaryText = !overviewLoading && hiddenDefaultOverviewCount > 0 ? `已收起 ${hiddenDefaultOverviewCount} 个 0 项，避免把空指标铺满首屏。` : '';
  const scopedOverviewCounts = (() => {
    let queryIndex = 0;
    return scopedOverviewCards.reduce<Record<string, number>>((acc, item) => {
      if (item.params) {
        acc[item.key] = scopedOverviewQueries[queryIndex]?.data?.total || 0;
        queryIndex += 1;
      }
      return acc;
    }, {});
  })();
  const missingContactQueueCount = contactMissing === true ? currentScopedTotal : pendingLease ? scopedOverviewCounts.pending_missing_contact || 0 : missingContactQueueTotal;
  const readyLeaseCount = pendingLease
    ? contactMissing === false
      ? currentScopedTotal
      : Math.max(pendingLeaseCount - missingContactQueueCount, 0)
    : readyLeaseQueueTotal;
  const scopedOverviewCardsWithCount = scopedOverviewCards.map((item) => ({
    ...item,
    count: item.getValue ? item.getValue({ counts: scopedOverviewCounts, currentTotal: currentScopedTotal }) : scopedOverviewCounts[item.key] || 0,
  }));
  const renderedScopedOverviewCards = scopedOverviewCardsWithCount.filter((item, index) => item.count > 0 || index === 0);
  const visibleScopedOverviewCards = overviewLoading
    ? scopedOverviewCardsWithCount
    : (renderedScopedOverviewCards.length ? renderedScopedOverviewCards : scopedOverviewCardsWithCount.slice(0, 1));
  const hiddenScopedOverviewCount = scopedOverviewCards.length - visibleScopedOverviewCards.length;
  const scopedOverviewSummaryText = !overviewLoading && hiddenScopedOverviewCount > 0 ? `已收起 ${hiddenScopedOverviewCount} 个 0 项，避免把空指标铺满首屏。` : '';
  const applyQueue = (queue: 'all' | 'scheduled' | 'viewed' | 'converted' | 'pending_lease' | 'missing_contact' | 'ready_lease') => {
    setPage(1);
    if (queue === 'all') {
      setStatus(undefined);
      setPendingLease(undefined);
      setContactMissing(undefined);
      return;
    }
    if (queue === 'scheduled') {
      setStatus(VIEWING_STATUS.SCHEDULED);
      setPendingLease(undefined);
      setContactMissing(undefined);
      return;
    }
    if (queue === 'viewed') {
      setStatus(VIEWING_STATUS.VIEWED);
      setPendingLease(undefined);
      setContactMissing(undefined);
      return;
    }
    if (queue === 'converted') {
      setStatus(VIEWING_STATUS.CONVERTED);
      setPendingLease(undefined);
      setContactMissing(undefined);
      return;
    }
    setStatus(undefined);
    setPendingLease(true);
    if (queue === 'missing_contact') {
      setContactMissing(true);
      return;
    }
    if (queue === 'ready_lease') {
      setContactMissing(false);
      return;
    }
    setContactMissing(undefined);
  };
  const quickQueueLinks = [
    { key: 'all', label: '全部', count: allViewingCount, active: !statusText },
    {
      key: 'scheduled',
      label: '已预约',
      count: scheduledCount,
      active: status === VIEWING_STATUS.SCHEDULED && !pendingLease,
    },
    {
      key: 'viewed',
      label: '待回访',
      count: viewedCount,
      active: status === VIEWING_STATUS.VIEWED && !pendingLease,
    },
    {
      key: 'converted',
      label: '已成交',
      count: convertedCount,
      active: status === VIEWING_STATUS.CONVERTED && !pendingLease,
    },
    {
      key: 'pending_lease',
      label: '待签约',
      count: pendingLeaseCount,
      active: pendingLease === true && contactMissing === undefined,
    },
    {
      key: 'missing_contact',
      label: '待补租客',
      count: missingContactCount,
      active: pendingLease === true && contactMissing === true,
    },
    {
      key: 'ready_lease',
      label: '可签约',
      count: readyLeaseCount,
      active: pendingLease === true && contactMissing === false,
    },
  ] as const;
  const visibleQuickQueueLinks = quickQueueLinks.filter((item) => item.count > 0 || item.active);
  const hiddenQuickQueueLinkCount = quickQueueLinks.length - visibleQuickQueueLinks.length;
  const quickQueueSummaryItems = [
    { key: 'all', label: '全部', count: allViewingCount, active: !statusText },
    { key: 'scheduled', label: '已预约', count: scheduledCount, active: status === VIEWING_STATUS.SCHEDULED && !pendingLease },
    { key: 'viewed', label: '待回访', count: viewedCount, active: status === VIEWING_STATUS.VIEWED && !pendingLease },
    { key: 'converted', label: '已成交', count: convertedCount, active: status === VIEWING_STATUS.CONVERTED && !pendingLease },
    { key: 'pending_lease', label: '待签约', count: pendingLeaseCount, active: pendingLease === true && contactMissing === undefined },
    { key: 'missing_contact', label: '待补租客', count: missingContactCount, active: pendingLease === true && contactMissing === true },
    { key: 'ready_lease', label: '可签约', count: readyLeaseCount, active: pendingLease === true && contactMissing === false },
  ] as const;
  const activeQueueSummaryItems = quickQueueSummaryItems
    .filter((item) => item.count > 0 || item.active)
    .sort((left, right) => {
      if (left.active !== right.active) return left.active ? -1 : 1;
      if (left.key === 'all') return -1;
      if (right.key === 'all') return 1;
      if (left.count !== right.count) return right.count - left.count;
      return 0;
    });
  const quietQueueSummaryItems = quickQueueSummaryItems.filter((item) => item.count === 0 && !item.active);
  const quietQueueSummaryText = quietQueueSummaryItems.length
    ? quietQueueSummaryItems.map((item) => `${item.label} · ${item.key === 'scheduled'
      ? '预约中的带看'
      : item.key === 'viewed'
        ? '待回访记录'
        : item.key === 'converted'
          ? '已成交记录'
          : item.key === 'pending_lease'
            ? '待签约成交记录'
            : item.key === 'missing_contact'
              ? '已成交但缺租客主体'
              : item.key === 'ready_lease'
                ? '主体完整，可直接转租约'
                : '全部记录'}`).join('；')
    : '';
  useEffect(() => {
    syncViewingListSearch({ page, status, pendingLease, contactMissing });
  }, [contactMissing, page, pendingLease, status]);
  useEffect(() => {
    if (!editViewingId || editing || drawerOpen || !viewings.isSuccess) return;
    const targetViewing = rows.find((item) => item.id === editViewingId);
    if (!targetViewing) return;
    setEditing(targetViewing);
    setDrawerOpen(true);
  }, [drawerOpen, editViewingId, editing, rows, viewings.isSuccess]);
  useEffect(() => {
    if ((!sourceHouseId && !sourceContactId) || editing || drawerOpen || !houses.isSuccess) return;
    setDrawerOpen(true);
  }, [drawerOpen, editing, houses.isSuccess, sourceContactId, sourceHouseId]);
  useEffect(() => {
    if (!sourceContactId || editing || !contacts.isSuccess) return;
    if (form.getFieldValue('customer_name') || form.getFieldValue('customer_phone')) return;
    fillCustomerFromContact(sourceContactId);
  }, [contacts.isSuccess, editing, form, sourceContactId]);
  useEffect(() => {
    if (!editing || drawerState.task || !needsContactCompletion(editing)) return;
    updateDrawerState({ editViewingId: editing.id, task: 'contact' });
  }, [drawerState.task, editing]);
  useEffect(() => {
    const handlePopState = () => {
      setDrawerState(getViewingDrawerStateFromSearch(window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const saveViewing = useMutation({
    mutationFn: (values: ViewingFormValues) => {
      if (editing) return houseApi.patchViewingRecord(editing.id, values);
      const { status: _status, ...payload } = values;
      return houseApi.createViewingRecord(payload);
    },
    onSuccess: async () => {
      message.success(editing ? '带看记录已更新' : '带看记录已创建');
      setDrawerOpen(false);
      setEditing(null);
      clearDrawerState();
      await queryClient.invalidateQueries({ queryKey: ['house', 'viewings'] });
    },
  });
  const updateViewingStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => houseApi.patchViewingRecord(id, { status }),
    onSuccess: async () => {
      message.success('带看状态已更新');
      await queryClient.invalidateQueries({ queryKey: ['house', 'viewings'] });
    },
  });
  const createTenant = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.createContact({ ...values, roles: ['tenant'], is_active: true }),
    onSuccess: (contact) => {
      setCreatedTenants((items) => [contact, ...items]);
      form.setFieldsValue({
        contact_id: contact.id,
        customer_name: contact.name,
        customer_phone: contact.phone,
      });
      setTenantOpen(false);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (record: ViewingRecordOut) => {
    setEditing(record);
    setDrawerOpen(true);
    updateDrawerState({
      editViewingId: record.id,
      task: needsContactCompletion(record) ? 'contact' : undefined,
    });
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
    clearDrawerState();
  };

  const fillCustomerFromContact = (contactId?: number | null) => {
    const contact = [...createdTenants, ...(contacts.data?.items || [])].find((item) => item.id === contactId);
    if (!contact) return;
    form.setFieldsValue({ customer_name: contact.name, customer_phone: contact.phone });
  };

  const formInitialValues: Partial<ViewingFormValues> = editing
    ? { ...editing, scheduled_at: dateTimeInputValue(editing.scheduled_at) }
    : { house_id: sourceHouseId, contact_id: sourceContactId };
  const tenantItems = [...createdTenants, ...(contacts.data?.items || [])];
  const selectedHouseId = Number(formValues?.house_id || formInitialValues.house_id) || undefined;
  const selectedContactId = Number(formValues?.contact_id || formInitialValues.contact_id) || undefined;
  const selectedHouse = (houses.data?.items || []).find((item) => item.id === selectedHouseId);
  const selectedContact = tenantItems.find((item) => item.id === selectedContactId);
  const draftStatus = (formValues?.status || formInitialValues.status || editing?.status) as string | undefined;
  const activeTask = drawerState.task || (editing && needsContactCompletion(editing) ? 'contact' : undefined);
  const focusedAction = getViewingTaskCopy(activeTask);
  const drawerEntryText = getViewingDrawerEntryText({
    editing: Boolean(editing),
    sourceHouseId,
    sourceContactId,
    status: draftStatus,
  });
  const drawerWarningText = getViewingDrawerWarning({
    houseId: selectedHouseId,
    customerName: formValues?.customer_name || formInitialValues.customer_name,
    customerPhone: formValues?.customer_phone || formInitialValues.customer_phone,
    scheduledAt: formValues?.scheduled_at || formInitialValues.scheduled_at,
    status: draftStatus,
    selectedContactId,
  });
  const drawerReady = drawerWarningText.includes('当前主体和排期信息已完整') || drawerWarningText.includes('预约信息已完整');
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
  const queueSummaryTileStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 12,
    background: token.colorBgContainer,
    height: '100%',
  } as const;
  const signalTileStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    background: token.colorBgContainer,
    height: '100%',
  } as const;
  const closureSignals: ViewingClosureSignal[] = [
    {
      key: 'scheduled',
      title: '预约到访',
      emphasis: scheduledCount > 0 ? '先确认到访' : '排期平稳',
      summary: `${scheduledCount} 条已预约`,
      description: '先把预约中的客户确认到访结果，避免排期表和真实进展脱节。',
      actionLabel: '进入预约队列',
      href: '/dashboard/property-rental/viewings?status=scheduled',
    },
    {
      key: 'viewed',
      title: '回访决策',
      emphasis: viewedCount > 0 ? '先补回访' : abnormalCount > 0 ? '先清异常' : '回访平稳',
      summary: `${viewedCount} 条待回访 / ${abnormalCount} 条异常`,
      description: '已带看、取消和爽约记录都要尽快回访，不然客户线索会断掉。',
      actionLabel: '进入回访队列',
      href: '/dashboard/property-rental/viewings?status=viewed',
    },
    {
      key: 'contact',
      title: '主体补齐',
      emphasis: missingContactQueueCount > 0 ? '先补主体' : '主体已齐',
      summary: `${missingContactQueueCount} 条待补租客`,
      description: '成交记录如果没有租客主体，后面的签约、履约和合同归档都没法继续。',
      actionLabel: '进入补主体队列',
      href: '/dashboard/property-rental/viewings?pending_lease=true&contact_missing=true',
    },
    {
      key: 'lease',
      title: '转签承接',
      emphasis: readyLeaseCount > 0 ? '先转租约' : pendingLeaseCount > 0 ? '先清待签约' : '转签平稳',
      summary: `${readyLeaseCount} 条可签约 / ${pendingLeaseCount} 条待签约`,
      description: '主体完整的成交记录应尽快转成租约，别让成交长期停留在带看阶段。',
      actionLabel: '进入可签约队列',
      href: '/dashboard/property-rental/viewings?pending_lease=true&contact_missing=false',
    },
  ];

  return (
    <TenantSelectionGuard title="带看" subtitle="跟进预约、到访、取消和成交记录。">
      <div style={sectionStyle}>
        <Typography.Text strong>{scopedOverview ? '当前筛选概览' : '带看概览'}</Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {scopedOverview
            ? visibleScopedOverviewCards
                .filter((item) => !item.key.startsWith('status_canceled_scope') && !item.key.startsWith('status_no_show_scope'))
                .map((item) => (
                  <Col key={item.key} xs={24} sm={12} xl={6}>
                    <div style={overviewTileStyle}>
                      <Statistic title={item.title} value={getLoadingSafeCount(item.count, overviewLoading)} />
                      <Typography.Text type="secondary">{getLoadingSafeText(item.hint, '正在汇总当前带看范围...', overviewLoading)}</Typography.Text>
                    </div>
                  </Col>
                ))
            : (
                renderedDefaultOverviewCards.map((item) => (
                  <Col key={item.key} xs={24} sm={12} xl={6}>
                    <div style={overviewTileStyle}>
                      <Statistic title={item.title} value={getLoadingSafeCount(item.count, overviewLoading)} />
                      <Typography.Text type="secondary">{getLoadingSafeText(item.hint, '正在汇总预约、回访和待签约数据...', overviewLoading)}</Typography.Text>
                    </div>
                  </Col>
                ))
              )}
        </Row>
        {scopedOverview ? (
          scopedOverviewSummaryText ? <Alert type="info" showIcon title={scopedOverviewSummaryText} style={{ marginTop: 16 }} /> : null
        ) : defaultOverviewSummaryText ? (
          <Alert type="info" showIcon title={defaultOverviewSummaryText} style={{ marginTop: 16 }} />
        ) : null}
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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, width: '100%', marginBottom: 16 }}>
          <div>
            <Typography.Text strong>带看跟进队列</Typography.Text>
            <div>
              <Typography.Text type="secondary">围绕预约、回访、成交转签约和异常回访四类工作流推进。</Typography.Text>
            </div>
          </div>
          <AdminToolbar>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建带看</Button>
          </AdminToolbar>
        </div>

        <Space wrap style={{ marginBottom: 16 }}>
          {visibleQuickQueueLinks.map((item) => (
            <Button key={item.key} size="small" type={item.active ? 'primary' : 'default'} onClick={() => applyQueue(item.key)}>
              {`${item.label} ${getLoadingSafeCount(item.count, overviewLoading)}`}
            </Button>
          ))}
        </Space>
        {hiddenQuickQueueLinkCount > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary">已收起 {hiddenQuickQueueLinkCount} 个 0 项，避免把空队列和高优先级跟进入口放在同一层级。</Typography.Text>
          </div>
        ) : null}
        <Typography.Text type="secondary">队列摘要</Typography.Text>
        <Row gutter={[12, 12]} style={{ marginTop: 12, marginBottom: 16 }}>
          {activeQueueSummaryItems.map((item) => (
            <Col key={item.key} xs={12} sm={8} xl={6}>
              <div style={queueSummaryTileStyle}>
                <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>{item.label}</Typography.Text>
                    <Tag color={item.active ? 'blue' : 'default'}>{item.count}</Tag>
                  </Space>
                  <Typography.Text type="secondary">
                    {item.key === 'missing_contact'
                      ? '已成交但缺租客主体'
                      : item.key === 'ready_lease'
                        ? '主体完整，可直接转租约'
                        : item.key === 'pending_lease'
                          ? '待签约成交记录'
                          : item.key === 'converted'
                            ? '已成交记录'
                            : item.key === 'viewed'
                              ? '待回访记录'
                              : item.key === 'scheduled'
                                ? '预约中的带看'
                                : '全部记录'}
                  </Typography.Text>
                </Space>
              </div>
            </Col>
          ))}
        </Row>
        {quietQueueSummaryItems.length ? (
          <Alert
            type="info"
            showIcon
            title={`还有 ${quietQueueSummaryItems.length} 个低优先级队列已收起`}
            description={quietQueueSummaryText}
            style={{ marginBottom: 16 }}
          />
        ) : null}
        {statusText ? (
          <Alert
            type="info"
            showIcon
            title={`当前只看：${statusText}`}
            action={<Button size="small" href="/dashboard/property-rental/viewings">查看全部</Button>}
            style={{ marginBottom: 16 }}
          />
        ) : null}
        {focusedAction.title ? (
          <Alert
            type="info"
            showIcon
            title={focusedAction.title}
            description={focusedAction.description}
            action={<Button size="small" href={getViewingListHref({ page, status, pendingLease, contactMissing })}>返回队列</Button>}
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="状态"
            options={VIEWING_STATUS_OPTIONS}
            value={status}
            onChange={(value) => {
              setPage(1);
              setStatus(value);
              setPendingLease(undefined);
              setContactMissing(undefined);
            }}
            style={toolbarControlStyle}
          />
        </Space>
        <Table<ViewingRecordOut>
          rowKey="id"
          loading={listLoading}
          columns={[
            {
              title: '客户信息',
              dataIndex: 'customer_name',
              width: 320,
              render: (_value, record) => {
                const businessInfo = getViewingBusinessInfo(record);
                return (
                  <Space orientation="vertical" size={2}>
                    <Typography.Text strong>{businessInfo.primary}</Typography.Text>
                    <Typography.Text type="secondary">{businessInfo.secondary}</Typography.Text>
                  </Space>
                );
              },
            },
            { title: '状态', dataIndex: 'status', render: (value) => <Tag color={STATUS_COLOR[value] || 'default'}>{STATUS_TEXT[value] || value}</Tag> },
            {
              title: '下一步动作',
              dataIndex: 'next_action',
              width: 200,
              render: (_value, record) => (
                <Space orientation="vertical" size={2}>
                  <Typography.Text strong>{getViewingNextActionText(record)}</Typography.Text>
                  <Typography.Text type="secondary">{getViewingQueueHint(record)}</Typography.Text>
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
                  {needsContactCompletion(record) ? <Button type="link" size="small" onClick={() => openEdit(record)}>补租客</Button> : null}
                  {canCreateLease(record) ? <a href={leaseCreatePath(record)}>签约</a> : null}
                  {record.status === VIEWING_STATUS.CONVERTED && record.signed_lease_id ? <a href={leaseEditPath(record)}>查看租约</a> : null}
                  <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>
                  {(VIEWING_STATUS_FLOW_OPTIONS[record.status] || [])
                    .filter((item) => item.value !== record.status)
                    .map((item) => (
                      <Button
                        type="link"
                        size="small"
                        key={item.value}
                        onClick={() => {
                          updateViewingStatus.mutate({ id: record.id, status: item.value });
                        }}
                      >
                        {VIEWING_STATUS_ACTION_TEXT[item.value] || item.label}
                      </Button>
                    ))}
                </ResponsiveActions>
              ),
            },
          ]}
          dataSource={viewings.data?.items || []}
          locale={{
            emptyText: getLoadingAwareEmptyState({
              loading: listLoading,
              loadingTitle: '带看数据加载中',
              loadingDescription: '正在同步预约、回访和成交转签约记录。',
              emptyState: getViewingEmptyState({ pendingLease, contactMissing, pendingLeaseCount, missingContactQueueCount, readyLeaseCount, openCreate }),
            }),
          }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: viewings.data?.total || 0, showSizeChanger: false, onChange: setPage }}
          scroll={adminTableScroll}
          />
      </div>
      <Drawer
        title={editing ? '编辑带看' : '新建带看'}
        open={drawerOpen}
        size="large"
        onClose={closeDrawer}
        destroyOnHidden
        extra={<Button type="primary" htmlType="submit" form="viewing-form" loading={saveViewing.isPending}>保存</Button>}
      >
        <Form form={form} id="viewing-form" layout="vertical" initialValues={formInitialValues} preserve={false} onFinish={(values) => saveViewing.mutate(values)}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {sourceHouseId && !editing ? <Alert type="info" showIcon title="已带入房源，补齐客户和预约时间后保存。" /> : null}
            {!sourceHouseId && sourceContactId && !editing ? <Alert type="info" showIcon title="已带入联系人，补齐房源和预约时间后保存。" /> : null}
            {editing && needsContactCompletion(editing) ? <Alert type="warning" showIcon title="该成交记录尚未绑定租客联系人，签约前请先补齐业务主体。" /> : null}

            <Row gutter={[16, 16]} align="top">
              <Col xs={24} xl={15}>
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <div style={sectionStyle}>
                    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                      <div>
                        <Typography.Text strong>带看归属</Typography.Text>
                        <br />
                        <Typography.Text type="secondary">先确认客户要看的房源，以及是否已绑定到现有联系人主体。</Typography.Text>
                      </div>
                      <Form.Item label="房源" name="house_id" rules={[{ required: true, message: '请选择房源' }]}>
                        <Select options={(houses.data?.items || []).map((item) => ({ value: item.id, label: houseLabel(item) }))} />
                      </Form.Item>
                      <Form.Item label="关联联系人" required={false} htmlFor="contact_id" style={{ marginBottom: 0 }}>
                        <Space.Compact style={{ width: '100%' }}>
                          <Form.Item name="contact_id" noStyle>
                            <Select allowClear options={tenantItems.map((item) => ({ value: item.id, label: contactLabel(item) }))} onChange={fillCustomerFromContact} />
                          </Form.Item>
                          <Button onClick={() => setTenantOpen(true)}>新建租客</Button>
                        </Space.Compact>
                      </Form.Item>
                    </Space>
                  </div>

                  <div style={sectionStyle}>
                    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                      <div>
                        <Typography.Text strong>客户信息</Typography.Text>
                        <br />
                        <Typography.Text type="secondary">未绑定联系人时，也要保证姓名和手机完整，方便后续回访和成交转签约。</Typography.Text>
                      </div>
                      <Row gutter={[16, 0]}>
                        <Col xs={24} md={12}>
                          <Form.Item label="客户姓名" name="customer_name" rules={[{ required: true, message: '请输入客户姓名' }]}>
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="客户手机" name="customer_phone" rules={[{ required: true, message: '请输入客户手机' }]}>
                            <Input />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Space>
                  </div>

                  <div style={sectionStyle}>
                    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                      <div>
                        <Typography.Text strong>预约与结果</Typography.Text>
                        <br />
                        <Typography.Text type="secondary">这里决定当前带看是进入排期、已完成回访，还是已经成交需要继续转签约。</Typography.Text>
                      </div>
                      <Row gutter={[16, 0]}>
                        <Col xs={24} md={12}>
                          <Form.Item label="预约时间" name="scheduled_at" rules={[{ required: true, message: '请选择预约时间' }]}>
                            <Input type="datetime-local" />
                          </Form.Item>
                        </Col>
                        {editing ? (
                          <Col xs={24} md={12}>
                            <Form.Item label="状态" name="status">
                              <Select options={VIEWING_STATUS_OPTIONS} />
                            </Form.Item>
                          </Col>
                        ) : null}
                      </Row>
                    </Space>
                  </div>

                  <div style={sectionStyle}>
                    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                      <div>
                        <Typography.Text strong>补充说明</Typography.Text>
                        <br />
                        <Typography.Text type="secondary">记录预约备注、客户偏好、带看反馈或需要继续追踪的事项。</Typography.Text>
                      </div>
                      <Form.Item label="备注" name="notes" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={4} />
                      </Form.Item>
                    </Space>
                  </div>
                </Space>
              </Col>

              <Col xs={24} xl={9}>
                <Card size="small" title="带看摘要">
                  <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    <Space wrap>
                      <Tag color="blue">{drawerEntryText}</Tag>
                      {draftStatus ? <Tag color={STATUS_COLOR[draftStatus] || 'default'}>{STATUS_TEXT[draftStatus] || draftStatus}</Tag> : <Tag>待预约</Tag>}
                      {selectedContactId ? <Tag color="green">已绑定联系人</Tag> : <Tag color="orange">未绑联系人</Tag>}
                    </Space>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="房源">{selectedHouse ? houseLabel(selectedHouse) : '待选择'}</Descriptions.Item>
                      <Descriptions.Item label="联系人">{selectedContact ? contactLabel(selectedContact) : '未绑定'}</Descriptions.Item>
                      <Descriptions.Item label="客户">
                        {(formValues?.customer_name || formInitialValues.customer_name)
                          ? `${formValues?.customer_name || formInitialValues.customer_name} / ${formValues?.customer_phone || formInitialValues.customer_phone || '-'}`
                          : '待填写'}
                      </Descriptions.Item>
                      <Descriptions.Item label="预约时间">{formValues?.scheduled_at || formInitialValues.scheduled_at || '待填写'}</Descriptions.Item>
                      <Descriptions.Item label="下一步">
                        {draftStatus
                          ? STATUS_TEXT[draftStatus] || draftStatus
                          : '保存后进入预约排期'}
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
        <Form
          layout="vertical"
          initialValues={{
            name: formValues?.customer_name || formInitialValues.customer_name,
            phone: formValues?.customer_phone || formInitialValues.customer_phone,
          }}
          onFinish={(values) => createTenant.mutate(values)}
        >
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

export default ViewingsPage;
