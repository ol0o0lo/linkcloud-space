import { PlusOutlined } from '@ant-design/icons';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  message,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import React, { useEffect, useState } from 'react';
import {
  AdminToolbar,
  adminTableScroll,
  ResponsiveActions,
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
  type ContactOut,
  houseApi,
  type ViewingRecordOut,
} from '@/services/manual/house';
import {
  contactLabel,
  dateTimeInputValue,
  dateTimeText,
  houseLabel,
  STATUS_COLOR,
  VIEWING_STATUS,
  VIEWING_STATUS_FLOW_OPTIONS,
} from '../constants';
import {
  getLoadingAwareEmptyState,
  getLoadingSafeCount,
  getLoadingSafeText,
  isAnyInitialQueryPending,
  isInitialQueryPending,
} from '../loading';

const PAGE_SIZE = 20;
const VIEWING_STATUS_ACTION_TEXT: Record<string, string> = {
  viewed: '完成带看',
  converted: '标记成交',
  canceled: '取消',
  no_show: '标记爽约',
};

function needsContactCompletion(record: ViewingRecordOut) {
  return (
    record.status === VIEWING_STATUS.CONVERTED &&
    !record.signed_lease_id &&
    !record.contact_id
  );
}

function canCreateLease(record: ViewingRecordOut) {
  return (
    record.status === VIEWING_STATUS.CONVERTED &&
    !record.signed_lease_id &&
    Boolean(record.contact_id)
  );
}

function leaseCreatePath(record: ViewingRecordOut) {
  return `/dashboard/property-rental/leases?source_viewing_record_id=${record.id}`;
}

function leaseEditPath(record: ViewingRecordOut) {
  return `/dashboard/property-rental/leases?house_id=${record.house_id}&edit=${record.signed_lease_id}`;
}

function getViewingQueueHint(record: ViewingRecordOut) {
  if (needsContactCompletion(record))
    return '成交已确认，但尚未绑定租客联系人，签约前先补齐业务主体';
  if (record.status === VIEWING_STATUS.CONVERTED && !record.signed_lease_id)
    return '优先创建租约，避免成交记录停留在带看阶段';
  if (record.status === VIEWING_STATUS.CONVERTED && record.signed_lease_id)
    return '已转租约，后续跟进合同和起租安排';
  if (record.status === VIEWING_STATUS.VIEWED)
    return '带看已完成，尽快更新客户意向与是否成交';
  if (record.status === VIEWING_STATUS.SCHEDULED)
    return '预约已创建，待确认客户到访结果';
  if (record.status === VIEWING_STATUS.CANCELED)
    return '已取消，确认是否需要重新预约';
  if (record.status === VIEWING_STATUS.NO_SHOW)
    return '客户爽约，建议尽快安排回访';
  return '按当前进展继续跟进';
}

function getViewingNextActionText(record: ViewingRecordOut) {
  if (needsContactCompletion(record)) return '待补租客';
  if (record.status === VIEWING_STATUS.CONVERTED && !record.signed_lease_id)
    return '待转租约';
  if (record.status === VIEWING_STATUS.CONVERTED && record.signed_lease_id)
    return '已转租约';
  if (record.status === VIEWING_STATUS.VIEWED) return '待回访决策';
  if (record.status === VIEWING_STATUS.SCHEDULED) return '待确认到访';
  if (
    record.status === VIEWING_STATUS.CANCELED ||
    record.status === VIEWING_STATUS.NO_SHOW
  )
    return '异常待回访';
  return '持续跟进';
}

function getViewingDrawerEntryText(options: {
  editing: boolean;
  sourceHouseId?: number;
  sourceContactId?: number;
  status?: string;
  statusLabel: (value?: string | null) => string;
}) {
  if (options.editing)
    return options.status
      ? `带看维护 / ${options.statusLabel(options.status)}`
      : '带看维护';
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
  const {
    houseId,
    customerName,
    customerPhone,
    scheduledAt,
    status,
    selectedContactId,
  } = options;
  if (!houseId) return '还未选择房源，保存前先确认客户要看的具体房源。';
  if (!customerName || !customerPhone)
    return '客户姓名和手机还未补齐，避免后续回访无法落到具体主体。';
  if (!scheduledAt) return '还未设置预约时间，当前记录还不能进入带看排期。';
  if (status === VIEWING_STATUS.CONVERTED && !selectedContactId)
    return '已成交记录还未绑定租客联系人，签约前先补齐业务主体。';
  if (status === VIEWING_STATUS.VIEWED)
    return '带看已完成，建议尽快补回访结果或是否成交。';
  if (status === VIEWING_STATUS.SCHEDULED)
    return '预约信息已完整，保存后可进入到访确认和带看排期。';
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
  const {
    pendingLease,
    contactMissing,
    pendingLeaseCount,
    missingContactQueueCount,
    readyLeaseCount,
    openCreate,
  } = options;

  if (pendingLease && contactMissing === true) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space orientation="vertical" size={4}>
            <Typography.Text strong>待补租客队列已处理完成</Typography.Text>
            <Typography.Text type="secondary">
              当前筛选下已没有缺租客主体的成交记录，继续处理可签约或全部待签约队列。
            </Typography.Text>
          </Space>
        }
      >
        <Space wrap>
          {readyLeaseCount > 0 ? (
            <Button
              type="primary"
              href="/dashboard/property-rental/viewings?pending_lease=true&contact_missing=false"
            >
              查看可签约
            </Button>
          ) : null}
          {pendingLeaseCount > 0 ? (
            <Button href="/dashboard/property-rental/viewings?pending_lease=true">
              查看待签约
            </Button>
          ) : null}
          <Button onClick={openCreate}>新建带看</Button>
        </Space>
      </Empty>
    );
  }

  if (pendingLease && contactMissing === false) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space orientation="vertical" size={4}>
            <Typography.Text strong>当前可签约队列为空</Typography.Text>
            <Typography.Text type="secondary">
              {missingContactQueueCount > 0
                ? '当前没有主体完整且可直接签约的成交记录，先回到待补租客补齐主体，再继续签约。'
                : '当前没有主体完整且可直接签约的成交记录，可先回到全部待签约队列继续排查。'}
            </Typography.Text>
          </Space>
        }
      >
        <Space wrap>
          {missingContactQueueCount > 0 ? (
            <Button
              type="primary"
              href="/dashboard/property-rental/viewings?pending_lease=true&contact_missing=true"
            >
              查看待补租客
            </Button>
          ) : null}
          {pendingLeaseCount > 0 ? (
            <Button href="/dashboard/property-rental/viewings?pending_lease=true">
              查看待签约
            </Button>
          ) : null}
          <Button onClick={openCreate}>新建带看</Button>
        </Space>
      </Empty>
    );
  }

  return (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无带看记录">
      <Button type="primary" onClick={openCreate}>
        新建带看
      </Button>
    </Empty>
  );
}

const STATUS_OVERVIEW_ITEMS = [
  {
    key: 'scheduled',
    title: '已预约',
    params: { status: VIEWING_STATUS.SCHEDULED },
  },
  { key: 'viewed', title: '待回访', params: { status: VIEWING_STATUS.VIEWED } },
  {
    key: 'converted',
    title: '已成交',
    params: { status: VIEWING_STATUS.CONVERTED },
  },
  { key: 'pending_lease', title: '待签约', params: { pending_lease: true } },
  {
    key: 'canceled',
    title: '已取消',
    params: { status: VIEWING_STATUS.CANCELED },
  },
  { key: 'no_show', title: '爽约', params: { status: VIEWING_STATUS.NO_SHOW } },
] as const;

function getViewingListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page') || '1');
  const contactMissingParam = params.get('contact_missing');
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    status: params.get('status') || undefined,
    pendingLease: params.get('pending_lease') === 'true' || undefined,
    contactMissing:
      contactMissingParam === null ? undefined : contactMissingParam === 'true',
  };
}

function syncViewingListSearch(filters: {
  page: number;
  status?: string;
  pendingLease?: boolean;
  contactMissing?: boolean;
}) {
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

function getViewingDrawerStateFromSearch(
  search: string,
): ViewingDrawerSearchState {
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
  if (drawerState.sourceHouseId)
    params.set('house_id', String(drawerState.sourceHouseId));
  if (drawerState.sourceContactId)
    params.set('contact_id', String(drawerState.sourceContactId));
  if (drawerState.editViewingId)
    params.set('edit', String(drawerState.editViewingId));
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

function getViewingListHref(filters: {
  page: number;
  status?: string;
  pendingLease?: boolean;
  contactMissing?: boolean;
}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.pendingLease) params.set('pending_lease', 'true');
  if (filters.contactMissing !== undefined)
    params.set('contact_missing', String(filters.contactMissing));
  if (filters.page > 1) params.set('page', String(filters.page));
  const search = params.toString();
  return dashboardHref(
    `/property-rental/viewings${search ? `?${search}` : ''}`,
  );
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
  const formValues = Form.useWatch([], { form, preserve: true }) as
    | Partial<ViewingFormValues>
    | undefined;
  const initialListState = getViewingListStateFromSearch(
    window.location.search,
  );
  const initialDrawerState = getViewingDrawerStateFromSearch(
    window.location.search,
  );
  const [page, setPage] = useState(initialListState.page);
  const [pendingLease, setPendingLease] = useState<boolean | undefined>(
    initialListState.pendingLease,
  );
  const [contactMissing, setContactMissing] = useState<boolean | undefined>(
    initialListState.contactMissing,
  );
  const [status, setStatus] = useState<string | undefined>(
    initialListState.status,
  );
  const [drawerState, setDrawerState] =
    useState<ViewingDrawerSearchState>(initialDrawerState);
  const [editing, setEditing] = useState<ViewingRecordOut | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [createdTenants, setCreatedTenants] = useState<ContactOut[]>([]);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseEnums = useEnums(['house.viewing_record_status']);
  const statusLabel = (value?: string | null) =>
    enumOptionMapping(houseEnums.data, 'house.viewing_record_status', value);
  const viewingStatusOptions = enumSelectOptions(
    houseEnums.data,
    'house.viewing_record_status',
  );
  const sourceHouseId = drawerState.sourceHouseId;
  const sourceContactId = drawerState.sourceContactId;
  const editViewingId = drawerState.editViewingId;
  const updateDrawerState = (nextState: ViewingDrawerSearchState) => {
    syncViewingDrawerSearch(nextState);
    setDrawerState(nextState);
  };
  const clearDrawerState = () => updateDrawerState({});
  const statusText =
    contactMissing === true
      ? '已成交待补租客'
      : contactMissing === false && pendingLease
        ? '已成交可签约'
        : pendingLease
          ? '已成交待签约'
          : status
            ? statusLabel(status)
            : undefined;
  const houses = useQuery({
    queryKey: ['house', 'viewings', 'houses', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listHouses({ page: 1, page_size: 100 }),
    enabled,
  });
  const contacts = useQuery({
    queryKey: ['house', 'viewings', 'contacts', workspace.selectedOrgSlug],
    queryFn: () =>
      houseApi.listContacts({ page: 1, page_size: 100, role: 'tenant' }),
    enabled,
  });
  const overviewQueries = useQueries({
    queries: STATUS_OVERVIEW_ITEMS.map((item) => ({
      queryKey: [
        'house',
        'viewings',
        'overview',
        workspace.selectedOrgSlug,
        sourceHouseId,
        item.key,
      ],
      queryFn: () =>
        houseApi.listViewingRecords({
          page: 1,
          page_size: 1,
          house_id: sourceHouseId,
          ...item.params,
        }),
      enabled,
    })),
  });
  const viewings = useQuery({
    queryKey: [
      'house',
      'viewings',
      workspace.selectedOrgSlug,
      page,
      status,
      sourceHouseId,
      pendingLease,
      contactMissing,
    ],
    queryFn: () =>
      houseApi.listViewingRecords({
        page,
        page_size: PAGE_SIZE,
        status,
        house_id: sourceHouseId,
        pending_lease: pendingLease,
        contact_missing: contactMissing,
      }),
    enabled,
  });
  const conversionSupportQueries = useQueries({
    queries: [
      {
        queryKey: [
          'house',
          'viewings',
          'conversion-support',
          workspace.selectedOrgSlug,
          sourceHouseId,
          'missing-contact',
        ],
        queryFn: () =>
          houseApi.listViewingRecords({
            page: 1,
            page_size: 1,
            house_id: sourceHouseId,
            pending_lease: true,
            contact_missing: true,
          }),
        enabled,
      },
      {
        queryKey: [
          'house',
          'viewings',
          'conversion-support',
          workspace.selectedOrgSlug,
          sourceHouseId,
          'ready-lease',
        ],
        queryFn: () =>
          houseApi.listViewingRecords({
            page: 1,
            page_size: 1,
            house_id: sourceHouseId,
            pending_lease: true,
            contact_missing: false,
          }),
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
  const abnormalCount = canceledCount + noShowCount;
  const missingContactQueueTotal =
    conversionSupportQueries[0]?.data?.total || 0;
  const readyLeaseQueueTotal = conversionSupportQueries[1]?.data?.total || 0;
  const rows = viewings.data?.items || [];
  const currentTotal = viewings.data?.total || 0;
  const pendingLeaseOverviewTitle =
    contactMissing === true
      ? '待补租客'
      : contactMissing === false && pendingLease
        ? '可签约'
        : '待签约';
  const pendingLeaseOverviewValue =
    pendingLease && contactMissing !== undefined
      ? viewings.data?.total || 0
      : pendingLeaseCount;
  const pendingLeaseOverviewHint =
    contactMissing === true
      ? '成交后待补租客主体'
      : contactMissing === false && pendingLease
        ? '主体完整，可直接转租约'
        : '成交后待转租约的记录';
  const overviewLoading = isAnyInitialQueryPending(overviewQueries);
  const listLoading = isInitialQueryPending(viewings);
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
  const visibleDefaultOverviewCards = defaultOverviewCards.filter(
    (item) => item.count > 0,
  );
  const renderedDefaultOverviewCards = overviewLoading
    ? defaultOverviewCards
    : visibleDefaultOverviewCards.length
      ? visibleDefaultOverviewCards
      : defaultOverviewCards.slice(0, 1);
  const missingContactQueueCount =
    contactMissing === true
      ? currentTotal
      : missingContactQueueTotal;
  const readyLeaseCount =
    contactMissing === false && pendingLease
      ? currentTotal
      : readyLeaseQueueTotal;
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
    if (
      (!sourceHouseId && !sourceContactId) ||
      editing ||
      drawerOpen ||
      !houses.isSuccess
    )
      return;
    setDrawerOpen(true);
  }, [drawerOpen, editing, houses.isSuccess, sourceContactId, sourceHouseId]);
  useEffect(() => {
    if (!sourceContactId || editing || !contacts.isSuccess) return;
    if (
      form.getFieldValue('customer_name') ||
      form.getFieldValue('customer_phone')
    )
      return;
    fillCustomerFromContact(sourceContactId);
  }, [contacts.isSuccess, editing, form, sourceContactId]);
  useEffect(() => {
    if (!editing || drawerState.task || !needsContactCompletion(editing))
      return;
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
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      houseApi.patchViewingRecord(id, { status }),
    onSuccess: async () => {
      message.success('带看状态已更新');
      await queryClient.invalidateQueries({ queryKey: ['house', 'viewings'] });
    },
  });
  const createTenant = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      houseApi.createContact({ ...values, roles: ['tenant'], is_active: true }),
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
    const contact = [...createdTenants, ...(contacts.data?.items || [])].find(
      (item) => item.id === contactId,
    );
    if (!contact) return;
    form.setFieldsValue({
      customer_name: contact.name,
      customer_phone: contact.phone,
    });
  };

  const formInitialValues: Partial<ViewingFormValues> = editing
    ? { ...editing, scheduled_at: dateTimeInputValue(editing.scheduled_at) }
    : { house_id: sourceHouseId, contact_id: sourceContactId };
  const tenantItems = [...createdTenants, ...(contacts.data?.items || [])];
  const selectedHouseId =
    Number(formValues?.house_id || formInitialValues.house_id) || undefined;
  const selectedContactId =
    Number(formValues?.contact_id || formInitialValues.contact_id) || undefined;
  const selectedHouse = (houses.data?.items || []).find(
    (item) => item.id === selectedHouseId,
  );
  const selectedContact = tenantItems.find(
    (item) => item.id === selectedContactId,
  );
  const draftStatus = (formValues?.status ||
    formInitialValues.status ||
    editing?.status) as string | undefined;
  const activeTask =
    drawerState.task ||
    (editing && needsContactCompletion(editing) ? 'contact' : undefined);
  const focusedAction = getViewingTaskCopy(activeTask);
  const drawerEntryText = getViewingDrawerEntryText({
    editing: Boolean(editing),
    sourceHouseId,
    sourceContactId,
    status: draftStatus,
    statusLabel,
  });
  const drawerWarningText = getViewingDrawerWarning({
    houseId: selectedHouseId,
    customerName: formValues?.customer_name || formInitialValues.customer_name,
    customerPhone:
      formValues?.customer_phone || formInitialValues.customer_phone,
    scheduledAt: formValues?.scheduled_at || formInitialValues.scheduled_at,
    status: draftStatus,
    selectedContactId,
  });
  const drawerReady =
    drawerWarningText.includes('当前主体和排期信息已完整') ||
    drawerWarningText.includes('预约信息已完整');
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

  return (
    <TenantSelectionGuard
      title="带看"
      subtitle="跟进预约、到访、取消和成交记录。"
    >
      <div style={sectionStyle}>
        <Typography.Text strong>带看概览</Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {renderedDefaultOverviewCards.map((item) => (
            <Col key={item.key} xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic
                  title={item.title}
                  value={getLoadingSafeCount(item.count, overviewLoading)}
                />
                <Typography.Text type="secondary">
                  {getLoadingSafeText(
                    item.hint,
                    '正在汇总预约、回访和待签约数据...',
                    overviewLoading,
                  )}
                </Typography.Text>
              </div>
            </Col>
          ))}
        </Row>
      </div>

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            width: '100%',
            marginBottom: 16,
          }}
        >
          <div>
            <Typography.Text strong>带看列表</Typography.Text>
          </div>
          <AdminToolbar>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建带看
            </Button>
          </AdminToolbar>
        </div>

        {statusText ? (
          <Alert
            type="info"
            showIcon
            title={`当前只看：${statusText}`}
            action={
              <Button size="small" href="/dashboard/property-rental/viewings">
                查看全部
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        ) : null}
        {focusedAction.title ? (
          <Alert
            type="info"
            showIcon
            title={focusedAction.title}
            description={focusedAction.description}
            action={
              <Button
                size="small"
                href={getViewingListHref({
                  page,
                  status,
                  pendingLease,
                  contactMissing,
                })}
              >
                返回队列
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="状态"
            options={viewingStatusOptions}
            value={status}
            popupMatchSelectWidth={toolbarSelectPopupWidth}
            onChange={(value) => {
              setPage(1);
              setStatus(value);
              setPendingLease(undefined);
              setContactMissing(undefined);
            }}
            style={toolbarShortSelectStyle}
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
                    <Typography.Text strong>
                      {businessInfo.primary}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {businessInfo.secondary}
                    </Typography.Text>
                  </Space>
                );
              },
            },
            {
              title: '状态',
              dataIndex: 'status__mapping',
              render: (_value, record) => (
                <Tag color={STATUS_COLOR[record.status] || 'default'}>
                  {enumMapping(record.status, record.status__mapping)}
                </Tag>
              ),
            },
            {
              title: '下一步动作',
              dataIndex: 'next_action',
              width: 200,
              render: (_value, record) => (
                <Space orientation="vertical" size={2}>
                  <Typography.Text strong>
                    {getViewingNextActionText(record)}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {getViewingQueueHint(record)}
                  </Typography.Text>
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
                  {needsContactCompletion(record) ? (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => openEdit(record)}
                    >
                      补租客
                    </Button>
                  ) : null}
                  {canCreateLease(record) ? (
                    <a href={leaseCreatePath(record)}>签约</a>
                  ) : null}
                  {record.status === VIEWING_STATUS.CONVERTED &&
                  record.signed_lease_id ? (
                    <a href={leaseEditPath(record)}>查看租约</a>
                  ) : null}
                  <Button
                    type="link"
                    size="small"
                    onClick={() => openEdit(record)}
                  >
                    编辑
                  </Button>
                  {(VIEWING_STATUS_FLOW_OPTIONS[record.status] || [])
                    .filter((nextStatus) => nextStatus !== record.status)
                    .map((nextStatus) => (
                      <Button
                        type="link"
                        size="small"
                        key={nextStatus}
                        onClick={() => {
                          updateViewingStatus.mutate({
                            id: record.id,
                            status: nextStatus,
                          });
                        }}
                      >
                        {VIEWING_STATUS_ACTION_TEXT[nextStatus] ||
                          statusLabel(nextStatus)}
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
              emptyState: getViewingEmptyState({
                pendingLease,
                contactMissing,
                pendingLeaseCount,
                missingContactQueueCount,
                readyLeaseCount,
                openCreate,
              }),
            }),
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: viewings.data?.total || 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
          scroll={adminTableScroll}
        />
      </div>
      <Drawer
        title={editing ? '编辑带看' : '新建带看'}
        open={drawerOpen}
        size="large"
        onClose={closeDrawer}
        destroyOnHidden
        extra={
          <Button
            type="primary"
            htmlType="submit"
            form="viewing-form"
            loading={saveViewing.isPending}
          >
            保存
          </Button>
        }
      >
        <Form
          form={form}
          id="viewing-form"
          layout="vertical"
          initialValues={formInitialValues}
          preserve={false}
          onFinish={(values) => saveViewing.mutate(values)}
        >
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {sourceHouseId && !editing ? (
              <Alert
                type="info"
                showIcon
                title="已带入房源，补齐客户和预约时间后保存。"
              />
            ) : null}
            {!sourceHouseId && sourceContactId && !editing ? (
              <Alert
                type="info"
                showIcon
                title="已带入联系人，补齐房源和预约时间后保存。"
              />
            ) : null}
            {editing && needsContactCompletion(editing) ? (
              <Alert
                type="warning"
                showIcon
                title="该成交记录尚未绑定租客联系人，签约前请先补齐业务主体。"
              />
            ) : null}

            <Row gutter={[16, 16]} align="top">
              <Col xs={24} xl={15}>
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  <div style={sectionStyle}>
                    <Space
                      orientation="vertical"
                      size={12}
                      style={{ width: '100%' }}
                    >
                      <div>
                        <Typography.Text strong>带看归属</Typography.Text>
                        <br />
                        <Typography.Text type="secondary">
                          先确认客户要看的房源，以及是否已绑定到现有联系人主体。
                        </Typography.Text>
                      </div>
                      <Form.Item
                        label="房源"
                        name="house_id"
                        rules={[{ required: true, message: '请选择房源' }]}
                      >
                        <Select
                          options={(houses.data?.items || []).map((item) => ({
                            value: item.id,
                            label: houseLabel(item),
                          }))}
                        />
                      </Form.Item>
                      <Form.Item
                        label="关联联系人"
                        required={false}
                        htmlFor="contact_id"
                        style={{ marginBottom: 0 }}
                      >
                        <Space.Compact style={{ width: '100%' }}>
                          <Form.Item name="contact_id" noStyle>
                            <Select
                              allowClear
                              options={tenantItems.map((item) => ({
                                value: item.id,
                                label: contactLabel(item),
                              }))}
                              onChange={fillCustomerFromContact}
                            />
                          </Form.Item>
                          <Button onClick={() => setTenantOpen(true)}>
                            新建租客
                          </Button>
                        </Space.Compact>
                      </Form.Item>
                    </Space>
                  </div>

                  <div style={sectionStyle}>
                    <Space
                      orientation="vertical"
                      size={12}
                      style={{ width: '100%' }}
                    >
                      <div>
                        <Typography.Text strong>客户信息</Typography.Text>
                        <br />
                        <Typography.Text type="secondary">
                          未绑定联系人时，也要保证姓名和手机完整，方便后续回访和成交转签约。
                        </Typography.Text>
                      </div>
                      <Row gutter={[16, 0]}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label="客户姓名"
                            name="customer_name"
                            rules={[
                              { required: true, message: '请输入客户姓名' },
                            ]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label="客户手机"
                            name="customer_phone"
                            rules={[
                              { required: true, message: '请输入客户手机' },
                            ]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Space>
                  </div>

                  <div style={sectionStyle}>
                    <Space
                      orientation="vertical"
                      size={12}
                      style={{ width: '100%' }}
                    >
                      <div>
                        <Typography.Text strong>预约与结果</Typography.Text>
                        <br />
                        <Typography.Text type="secondary">
                          这里决定当前带看是进入排期、已完成回访，还是已经成交需要继续转签约。
                        </Typography.Text>
                      </div>
                      <Row gutter={[16, 0]}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label="预约时间"
                            name="scheduled_at"
                            rules={[
                              { required: true, message: '请选择预约时间' },
                            ]}
                          >
                            <Input type="datetime-local" />
                          </Form.Item>
                        </Col>
                        {editing ? (
                          <Col xs={24} md={12}>
                            <Form.Item label="状态" name="status">
                              <Select options={viewingStatusOptions} />
                            </Form.Item>
                          </Col>
                        ) : null}
                      </Row>
                    </Space>
                  </div>

                  <div style={sectionStyle}>
                    <Space
                      orientation="vertical"
                      size={12}
                      style={{ width: '100%' }}
                    >
                      <Form.Item
                        label="备注"
                        name="notes"
                        style={{ marginBottom: 0 }}
                      >
                        <Input.TextArea rows={4} />
                      </Form.Item>
                    </Space>
                  </div>
                </Space>
              </Col>

              <Col xs={24} xl={9}>
                <Card size="small" title="带看摘要">
                  <Space
                    orientation="vertical"
                    size={12}
                    style={{ width: '100%' }}
                  >
                    <Space wrap>
                      <Tag color="blue">{drawerEntryText}</Tag>
                      {draftStatus ? (
                        <Tag color={STATUS_COLOR[draftStatus] || 'default'}>
                          {statusLabel(draftStatus)}
                        </Tag>
                      ) : (
                        <Tag>待预约</Tag>
                      )}
                      {selectedContactId ? (
                        <Tag color="green">已绑定联系人</Tag>
                      ) : (
                        <Tag color="orange">未绑联系人</Tag>
                      )}
                    </Space>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="房源">
                        {selectedHouse ? houseLabel(selectedHouse) : '待选择'}
                      </Descriptions.Item>
                      <Descriptions.Item label="联系人">
                        {selectedContact
                          ? contactLabel(selectedContact)
                          : '未绑定'}
                      </Descriptions.Item>
                      <Descriptions.Item label="客户">
                        {formValues?.customer_name ||
                        formInitialValues.customer_name
                          ? `${formValues?.customer_name || formInitialValues.customer_name} / ${formValues?.customer_phone || formInitialValues.customer_phone || '-'}`
                          : '待填写'}
                      </Descriptions.Item>
                      <Descriptions.Item label="预约时间">
                        {formValues?.scheduled_at ||
                          formInitialValues.scheduled_at ||
                          '待填写'}
                      </Descriptions.Item>
                      <Descriptions.Item label="下一步">
                        {draftStatus
                          ? statusLabel(draftStatus)
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
            phone:
              formValues?.customer_phone || formInitialValues.customer_phone,
          }}
          onFinish={(values) => createTenant.mutate(values)}
        >
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="手机"
            name="phone"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={createTenant.isPending}
          >
            保存租客
          </Button>
        </Form>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default ViewingsPage;
