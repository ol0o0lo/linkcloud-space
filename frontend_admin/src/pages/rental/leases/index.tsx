import { MoreOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  message,
  Row,
  Select,
  Space,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppStatusTag } from '@/components/AppStatus';
import {
  ContactPreview,
  EntityPreviewDetailDrawer,
  HousePreview,
} from '@/components/EntityPreview';
import {
  adminTableScroll,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import type { AllocationCapabilities } from '@/services/manual/allocation';
import {
  enumMapping,
  enumOptionMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import {
  type ContactOut,
  houseApi,
  type LeaseOut,
} from '@/services/manual/house';
import DealSigningDrawer from '../components/DealSigningDrawer';
import EarningAttributionFields from '../components/EarningAttributionFields';
import MediaRefsUpload from '../components/MediaRefsUpload';
import {
  CONTACT_ROLE,
  contactLabel,
  HOUSE_MEDIA_RESOURCE_TYPE,
  HOUSE_MEDIA_TYPE,
  houseLabel,
  moneyText,
} from '../constants';
import { getLoadingAwareEmptyState, isInitialQueryPending } from '../loading';

const PAGE_SIZE = 20;
const SELECT_SEARCH_DEBOUNCE_MS = 300;

const LEASE_STATUS_ACTION_TEXT: Record<string, string> = {
  active: '生效',
  expired: '到期',
  terminated: '终止',
};
const LEASE_STATUS_ACTIONS = ['active', 'expired', 'terminated'];

function getLeaseHouseInfo(record: LeaseOut) {
  const houseText = houseLabel(record);
  const houseParts = houseText.split(' / ');
  const roomText = houseParts.at(-1) || houseText;
  const scopeText =
    houseParts.length > 1 ? houseParts.slice(0, -1).join(' / ') : undefined;
  return {
    roomText,
    scopeText,
  };
}

function useDebouncedText(value: string, delay = SELECT_SEARCH_DEBOUNCE_MS) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedValue(value.trim()),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debouncedValue;
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLeaseDefaultDates() {
  const startDate = new Date();
  const endDate = new Date(startDate);
  const startMonth = startDate.getMonth();
  endDate.setFullYear(endDate.getFullYear() + 1);
  if (endDate.getMonth() !== startMonth) endDate.setDate(0);

  return {
    start_date: formatDateInputValue(startDate),
    end_date: formatDateInputValue(endDate),
    payment_day: startDate.getDate(),
  };
}

function getLeaseTenantInfo(record: LeaseOut) {
  const tenant = record.tenant;
  return {
    name: tenant?.name || (tenant?.id ? `联系人 #${tenant.id}` : '-'),
    phone: tenant?.phone,
  };
}

function getLeaseListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page') || '1');
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    status: params.get('status') || undefined,
    keyword: params.get('keyword') || undefined,
  };
}

function syncLeaseListSearch(filters: {
  page: number;
  status?: string;
  keyword?: string;
}) {
  const params = new URLSearchParams(window.location.search);
  if (filters.status) {
    params.set('status', filters.status);
  } else {
    params.delete('status');
  }
  if (filters.keyword) {
    params.set('keyword', filters.keyword);
  } else {
    params.delete('keyword');
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
    sourceViewingRecordId:
      Number(params.get('source_viewing_record_id')) || undefined,
    editLeaseId: Number(params.get('edit')) || undefined,
  };
}

function syncLeaseDrawerSearch(drawerState: LeaseDrawerSearchState) {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  params.delete('source_viewing_record_id');
  params.delete('edit');
  if (drawerState.sourceViewingRecordId)
    params.set(
      'source_viewing_record_id',
      String(drawerState.sourceViewingRecordId),
    );
  if (drawerState.editLeaseId)
    params.set('edit', String(drawerState.editLeaseId));

  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function getLeaseEmptyState(options: { openCreate: () => void }) {
  const { openCreate } = options;
  return (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无租约">
      <Button type="primary" onClick={openCreate}>
        登记签约
      </Button>
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
  beneficiary_user_ids: number[];
  team_id?: number | null;
};

const LeasesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [form] = Form.useForm<LeaseFormValues>();
  const selectedSourceViewingRecordId = Form.useWatch(
    'source_viewing_record_id',
    form,
  );
  const [locationSearch, setLocationSearch] = useState(window.location.search);
  const initialListState = getLeaseListStateFromSearch(locationSearch);
  const initialDrawerState = getLeaseDrawerStateFromSearch(locationSearch);
  const [page, setPage] = useState(initialListState.page);
  const [status, setStatus] = useState<string | undefined>(
    initialListState.status,
  );
  const [keyword, setKeyword] = useState<string | undefined>(
    initialListState.keyword,
  );
  const queryParams = new URLSearchParams(locationSearch);
  const [drawerState, setDrawerState] =
    useState<LeaseDrawerSearchState>(initialDrawerState);
  const sourceViewingRecordId = drawerState.sourceViewingRecordId;
  const sourceHouseId = Number(queryParams.get('house_id')) || undefined;
  const dealSigningMode =
    queryParams.get('action') === 'deal-signing' && Boolean(sourceHouseId);
  const [dealSigningOpen, setDealSigningOpen] = useState(false);
  const editLeaseId = drawerState.editLeaseId;
  const [editing, setEditing] = useState<LeaseOut | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [createdTenants, setCreatedTenants] = useState<ContactOut[]>([]);
  const [_allocationCapabilities, setAllocationCapabilities] =
    useState<AllocationCapabilities>();
  const [openedSourceViewing, setOpenedSourceViewing] = useState(false);
  const [openedSourceHouse, setOpenedSourceHouse] = useState(false);
  const [openedEditLease, setOpenedEditLease] = useState(false);
  const [houseSearchText, setHouseSearchText] = useState('');
  const [tenantSearchText, setTenantSearchText] = useState('');
  const houseSearchKeyword = useDebouncedText(houseSearchText);
  const tenantSearchKeyword = useDebouncedText(tenantSearchText);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseEnums = useEnums(['house.lease_status']);
  const statusLabel = (value?: string | null) =>
    enumOptionMapping(houseEnums.data, 'house.lease_status', value);
  const leaseStatusOptions = enumSelectOptions(
    houseEnums.data,
    'house.lease_status',
  );
  const houses = useQuery({
    queryKey: [
      'house',
      'leases',
      'houses',
      workspace.selectedOrgSlug,
      houseSearchKeyword,
    ],
    queryFn: () =>
      houseApi.listHouses({
        page: 1,
        page_size: 20,
        keyword: houseSearchKeyword || undefined,
      }),
    enabled,
  });
  const tenants = useQuery({
    queryKey: [
      'house',
      'leases',
      'tenants',
      workspace.selectedOrgSlug,
      tenantSearchKeyword,
    ],
    queryFn: () =>
      houseApi.listContacts({
        page: 1,
        page_size: 20,
        role: 'tenant',
        task: 'active',
        keyword: tenantSearchKeyword || undefined,
      }),
    enabled,
  });
  const readySourceViewings = useQuery({
    queryKey: [
      'house',
      'leases',
      'ready-source-viewings',
      workspace.selectedOrgSlug,
    ],
    queryFn: () =>
      houseApi.listViewingRecords({
        page: 1,
        page_size: 100,
        pending_lease: true,
        contact_missing: false,
      }),
    enabled,
  });
  const sourceViewingLookup = useQuery({
    queryKey: [
      'house',
      'leases',
      'source-viewing-lookup',
      workspace.selectedOrgSlug,
      sourceViewingRecordId,
    ],
    queryFn: () =>
      houseApi.listViewingRecords({
        page: 1,
        page_size: 100,
        pending_lease: true,
      }),
    enabled: enabled && Boolean(sourceViewingRecordId),
  });
  const editLeaseLookup = useQuery({
    queryKey: [
      'house',
      'leases',
      'edit-lookup',
      workspace.selectedOrgSlug,
      editLeaseId,
    ],
    queryFn: () => houseApi.getLease(editLeaseId as number),
    enabled: enabled && Boolean(editLeaseId),
  });
  const leases = useQuery({
    queryKey: [
      'house',
      'leases',
      workspace.selectedOrgSlug,
      page,
      status,
      keyword,
      sourceHouseId,
    ],
    queryFn: () =>
      houseApi.listLeases({
        page,
        page_size: PAGE_SIZE,
        status,
        keyword,
        house_id: sourceHouseId,
      }),
    enabled,
  });
  const rows = leases.data?.items || [];
  const listLoading = isInitialQueryPending(leases);
  const sourceViewing = sourceViewingRecordId
    ? (sourceViewingLookup.data?.items || []).find(
        (item) => item.id === sourceViewingRecordId,
      )
    : undefined;
  const sourceViewingNeedsContact = Boolean(
    sourceViewingRecordId &&
      sourceViewingLookup.isSuccess &&
      sourceViewing &&
      !sourceViewing.contact_id,
  );
  const staleSourceViewing = Boolean(
    sourceViewingRecordId && sourceViewingLookup.isSuccess && !sourceViewing,
  );
  const houseItems = useMemo(() => {
    const items = new Map<number, any>();
    const add = (item: any) => {
      if (item?.id) items.set(item.id, item);
    };
    (houses.data?.items || []).forEach(add);
    add(editing?.house);
    add(sourceViewing?.house);
    return Array.from(items.values());
  }, [editing?.house, houses.data?.items, sourceViewing?.house]);
  const tenantItems = useMemo(() => {
    const items = new Map<number, any>();
    const add = (item: any) => {
      if (item?.id) items.set(item.id, item);
    };
    (tenants.data?.items || []).forEach(add);
    createdTenants.forEach(add);
    add(editing?.tenant);
    add((sourceViewing as any)?.contact);
    return Array.from(items.values());
  }, [createdTenants, editing?.tenant, sourceViewing, tenants.data?.items]);
  const sourceViewingOptions = useMemo(() => {
    const options = new Map<number, { value: number; label: string }>();
    (readySourceViewings.data?.items || []).forEach((item) => {
      options.set(item.id, {
        value: item.id,
        label: `${item.customer_name} / ${houseLabel(item)}`,
      });
    });
    if (
      editing?.source_viewing_record_id &&
      editing.source_viewing_record?.label
    ) {
      options.set(editing.source_viewing_record_id, {
        value: editing.source_viewing_record_id,
        label: editing.source_viewing_record.label,
      });
    }
    return Array.from(options.values());
  }, [editing, readySourceViewings.data?.items]);
  const selectedSourceViewing = selectedSourceViewingRecordId
    ? (readySourceViewings.data?.items || []).find(
        (item) => item.id === selectedSourceViewingRecordId,
      ) ||
      (sourceViewing?.id === selectedSourceViewingRecordId
        ? sourceViewing
        : undefined)
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
    if (
      !sourceViewingRecordId ||
      !sourceViewing?.contact_id ||
      openedSourceViewing ||
      editing ||
      dealSigningOpen ||
      !sourceViewingLookup.isSuccess
    )
      return;
    setDealSigningOpen(true);
    setOpenedSourceViewing(true);
  }, [
    dealSigningOpen,
    editing,
    openedSourceViewing,
    sourceViewing,
    sourceViewingLookup.isSuccess,
    sourceViewingRecordId,
  ]);

  useEffect(() => {
    syncLeaseListSearch({ page, status, keyword });
    setLocationSearch(window.location.search);
  }, [keyword, page, status]);

  useEffect(() => {
    const handlePopState = () => {
      const listState = getLeaseListStateFromSearch(window.location.search);
      setPage(listState.page);
      setStatus(listState.status);
      setKeyword(listState.keyword);
      setDrawerState(getLeaseDrawerStateFromSearch(window.location.search));
      setLocationSearch(window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (
      !sourceHouseId ||
      dealSigningMode ||
      sourceViewingRecordId ||
      editLeaseId ||
      openedSourceHouse ||
      editing ||
      dealSigningOpen
    )
      return;
    setDealSigningOpen(true);
    setOpenedSourceHouse(true);
  }, [
    dealSigningOpen,
    dealSigningMode,
    editLeaseId,
    editing,
    openedSourceHouse,
    sourceHouseId,
    sourceViewingRecordId,
  ]);

  useEffect(() => {
    if (
      !editLeaseId ||
      openedEditLease ||
      editing ||
      drawerOpen ||
      (!leases.isSuccess && !editLeaseLookup.isSuccess)
    )
      return;
    const targetLease =
      rows.find((item) => item.id === editLeaseId) || editLeaseLookup.data;
    if (!targetLease) return;
    setEditing(targetLease);
    setDrawerOpen(true);
    setOpenedEditLease(true);
  }, [
    drawerOpen,
    editLeaseId,
    editLeaseLookup.data,
    editLeaseLookup.isSuccess,
    editing,
    leases.isSuccess,
    openedEditLease,
    rows,
  ]);

  const saveLease = useMutation({
    mutationFn: (values: LeaseFormValues) => {
      if (editing) return houseApi.patchLease(editing.id, values);
      const {
        status: _status,
        beneficiary_user_ids,
        team_id,
        tenant_id,
        ...payload
      } = values;
      if (!tenant_id) throw new Error('请选择租客');
      const normalizedPayload = {
        ...payload,
        tenant_id,
        payment_day: Number(payload.payment_day || 1),
      };
      return houseApi
        .createDealSigning({
          lease: normalizedPayload,
          team_id: team_id ?? null,
          beneficiary_user_ids,
        })
        .then((result) => result.lease);
    },
    onSuccess: async () => {
      message.success(
        editing ? '租约已更新' : '签约已登记，收益分配申请正在等待审核',
      );
      closeDrawer();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['house', 'leases'] }),
        queryClient.invalidateQueries({ queryKey: ['house', 'houses'] }),
        queryClient.invalidateQueries({ queryKey: ['allocation'] }),
      ]);
    },
  });

  const handleCapabilitiesChange = useCallback(
    (capabilities?: AllocationCapabilities) =>
      setAllocationCapabilities(capabilities),
    [],
  );
  const updateLeaseStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      houseApi.patchLease(id, { status }),
    onSuccess: async () => {
      message.success('租约状态已更新');
      await queryClient.invalidateQueries({ queryKey: ['house', 'leases'] });
    },
  });
  const createTenant = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      houseApi.createContact({
        ...values,
        roles: [CONTACT_ROLE.TENANT],
        is_active: true,
      }),
    onSuccess: (contact) => {
      setCreatedTenants((items) => [contact, ...items]);
      form.setFieldValue('tenant_id', contact.id);
      setTenantOpen(false);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDealSigningOpen(true);
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

  const closeDealSigningDrawer = () => {
    setDealSigningOpen(false);
    const params = new URLSearchParams(window.location.search);
    const removeSourceHouse = params.get('action') === 'deal-signing';
    params.delete('action');
    params.delete('source_viewing_record_id');
    if (removeSourceHouse) params.delete('house_id');
    const nextSearch = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`,
    );
    setOpenedSourceViewing(false);
    setOpenedSourceHouse(false);
    setLocationSearch(window.location.search);
  };

  const fillLeaseFromViewing = (viewingId?: number | null) => {
    const viewing = (readySourceViewings.data?.items || []).find(
      (item) => item.id === viewingId,
    );
    if (!viewing) return;
    form.setFieldsValue({
      house_id: viewing.house_id,
      tenant_id: viewing.contact_id || null,
    });
  };

  const createInitialValues: Partial<LeaseFormValues> = {
    ...getLeaseDefaultDates(),
    ...(sourceHouseId ? { house_id: sourceHouseId } : {}),
    ...(sourceViewingRecordId
      ? { source_viewing_record_id: sourceViewingRecordId }
      : {}),
    ...(sourceViewing?.house_id ? { house_id: sourceViewing.house_id } : {}),
    ...(sourceViewing?.contact_id
      ? { tenant_id: sourceViewing.contact_id }
      : {}),
  };
  const formInitialValues: Partial<LeaseFormValues> =
    editing || createInitialValues;
  const columns: ProColumns<LeaseOut>[] = [
    {
      title: '房源',
      dataIndex: 'house',
      width: 190,
      render: (_value, record) => {
        const houseInfo = getLeaseHouseInfo(record);
        return (
          <Space orientation="vertical" size={2}>
            <HousePreview id={record.house_id}>
              <Typography.Text strong>{houseInfo.roomText}</Typography.Text>
            </HousePreview>
            {houseInfo.scopeText ? (
              <Typography.Text type="secondary">
                {houseInfo.scopeText}
              </Typography.Text>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: '租客',
      dataIndex: 'tenant',
      width: 160,
      render: (_value, record) => {
        const tenantInfo = getLeaseTenantInfo(record);
        return (
          <Tooltip
            title={tenantInfo.phone ? `手机号：${tenantInfo.phone}` : undefined}
          >
            <span>
              <ContactPreview id={record.tenant_id}>
                <Typography.Text>{tenantInfo.name}</Typography.Text>
              </ContactPreview>
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '租期',
      dataIndex: 'start_date',
      width: 190,
      align: 'center',
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text>{record.start_date || '-'}</Typography.Text>
          <Typography.Text type="secondary">
            {record.end_date ? `至 ${record.end_date}` : '-'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '月租',
      dataIndex: 'monthly_rent',
      width: 120,
      align: 'right',
      render: (_value, record) => moneyText(record.monthly_rent),
    },
    {
      title: '状态',
      dataIndex: 'status__mapping',
      width: 120,
      align: 'center',
      render: (_value, record) => (
        <AppStatusTag name="lease" state={record.status}>
          {enumMapping(record.status, record.status__mapping)}
        </AppStatusTag>
      ),
    },
    {
      title: '合同',
      dataIndex: 'contract_files',
      width: 120,
      align: 'center',
      render: (_value, record) =>
        record.contract_files?.length ? (
          <span>{`${record.contract_files.length} 份`}</span>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      width: 220,
      align: 'center',
      render: (_value, record) => {
        const statusItems = LEASE_STATUS_ACTIONS.map((nextStatus) => ({
          key: nextStatus,
          label:
            LEASE_STATUS_ACTION_TEXT[nextStatus] || statusLabel(nextStatus),
        }));
        return (
          <ResponsiveActions>
            <Button type="link" size="small" onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Dropdown
              menu={{
                items: statusItems,
                onClick: ({ key }) =>
                  updateLeaseStatus.mutate({
                    id: record.id,
                    status: key,
                  }),
              }}
              trigger={['click']}
            >
              <Button
                aria-label="更多操作"
                type="text"
                size="small"
                icon={<MoreOutlined />}
              />
            </Dropdown>
          </ResponsiveActions>
        );
      },
    },
  ];
  const sectionStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    background: token.colorBgContainer,
  } as const;

  return (
    <TenantSelectionGuard title="租约">
      <Card>
        {sourceViewingNeedsContact ? (
          <Alert
            type="warning"
            showIcon
            title="该成交带看未绑定租客联系人，请先回带看页补齐业务主体后再签约。"
            action={
              <Button
                size="small"
                href={`/dashboard/rental/viewings?pending_lease=true&contact_missing=true&edit=${sourceViewingRecordId}`}
              >
                去补租客
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        ) : null}
        {staleSourceViewing ? (
          <Alert
            type="warning"
            showIcon
            title="该成交带看已生成租约，不能重复签约。"
            action={
              <Button size="small" href="/dashboard/rental/leases">
                查看租约列表
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <ProTable<LeaseOut>
          rowKey="id"
          loading={listLoading}
          headerTitle="租约列表"
          columns={columns}
          dataSource={rows}
          search={false}
          options={{
            density: true,
            reload: false,
            search: {
              name: 'keyword',
              placeholder: '房源 / 租客 / 手机',
              value: keyword,
              onSearch: (value) => {
                setKeyword(value.trim() || undefined);
                setPage(1);
              },
            },
            setting: true,
          }}
          toolBarRender={() => [
            <Select
              key="status"
              allowClear
              placeholder="按状态筛选"
              style={{ width: 140 }}
              options={leaseStatusOptions}
              value={status}
              onChange={(value) => {
                setStatus(value || undefined);
                setPage(1);
              }}
            />,
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
            >
              登记签约
            </Button>,
          ]}
          ghost
          locale={{
            emptyText: getLoadingAwareEmptyState({
              loading: listLoading,
              loadingTitle: '租约数据加载中',
              loadingDescription: '正在同步签约和履约状态。',
              emptyState: getLeaseEmptyState({
                openCreate,
              }),
            }),
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: leases.data?.total || 0,
            onChange: setPage,
          }}
          scroll={adminTableScroll}
        />
      </Card>
      <EntityPreviewDetailDrawer
        searchParam="preview"
        title="租约详情"
        type="lease"
      />
      <DealSigningDrawer
        open={dealSigningMode || dealSigningOpen}
        houseId={sourceViewing?.house_id || sourceHouseId}
        sourceViewing={sourceViewing}
        onClose={closeDealSigningDrawer}
      />
      <Drawer
        title="编辑租约"
        open={drawerOpen && Boolean(editing)}
        size="large"
        onClose={closeDrawer}
        destroyOnHidden
        extra={
          <Button
            type="primary"
            htmlType="submit"
            form="lease-form"
            loading={saveLease.isPending}
            disabled={!editing}
          >
            保存
          </Button>
        }
      >
        <Form
          form={form}
          id="lease-form"
          layout="vertical"
          initialValues={formInitialValues}
          preserve={false}
          onFinish={(values) => saveLease.mutate(values)}
        >
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {sourceViewingRecordId && !editing && !sourceViewingNeedsContact ? (
              <Alert
                type="info"
                showIcon
                title="已带入成交带看，补齐租期和金额后保存。"
              />
            ) : null}
            {!sourceViewingRecordId && sourceHouseId && !editing ? (
              <Alert
                type="info"
                showIcon
                title="已带入房源，补齐租客、租期和金额后保存。"
              />
            ) : null}
            {selectedSourceViewing && !selectedSourceViewing.contact_id ? (
              <Alert
                type="warning"
                showIcon
                title="该成交带看未绑定租客联系人，请先新建或选择租客再保存。"
              />
            ) : null}

            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <div style={sectionStyle}>
                <Space
                  orientation="vertical"
                  size={12}
                  style={{ width: '100%' }}
                >
                  <div>
                    <Typography.Text strong>签约主体</Typography.Text>
                  </div>
                  <Row gutter={[16, 0]}>
                    <Col xs={24}>
                      <Form.Item
                        label="房源"
                        name="house_id"
                        rules={[{ required: true, message: '请选择房源' }]}
                      >
                        <Select
                          showSearch={{
                            filterOption: false,
                            onSearch: setHouseSearchText,
                          }}
                          loading={houses.isFetching}
                          notFoundContent={
                            houses.isFetching ? '搜索中…' : '未找到房源'
                          }
                          placeholder="按房号、小区或楼栋搜索"
                          options={houseItems.map((item) => ({
                            value: item.id,
                            label: houseLabel(item),
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item label="租客" required htmlFor="tenant_id">
                        <Space.Compact style={{ width: '100%' }}>
                          <Form.Item
                            name="tenant_id"
                            rules={[{ required: true, message: '请选择租客' }]}
                            noStyle
                          >
                            <Select
                              showSearch={{
                                filterOption: false,
                                onSearch: setTenantSearchText,
                              }}
                              loading={tenants.isFetching}
                              notFoundContent={
                                tenants.isFetching ? '搜索中…' : '未找到租客'
                              }
                              placeholder="按姓名或手机号搜索"
                              options={tenantItems.map((item) => ({
                                value: item.id,
                                label: contactLabel(item),
                              }))}
                            />
                          </Form.Item>
                          <Button onClick={() => setTenantOpen(true)}>
                            新建租客
                          </Button>
                        </Space.Compact>
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item
                        label="成交带看"
                        name="source_viewing_record_id"
                      >
                        <Select
                          allowClear
                          options={sourceViewingOptions}
                          onChange={fillLeaseFromViewing}
                        />
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
                    <Typography.Text strong>租期与金额</Typography.Text>
                  </div>
                  <Row gutter={[16, 0]}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="起租日期"
                        name="start_date"
                        rules={[{ required: true, message: '请选择起租日期' }]}
                      >
                        <Input type="date" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="到期日期"
                        name="end_date"
                        rules={[{ required: true, message: '请选择到期日期' }]}
                      >
                        <Input type="date" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="月租"
                        name="monthly_rent"
                        rules={[{ required: true, message: '请输入月租' }]}
                      >
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
                          <Select options={leaseStatusOptions} />
                        </Form.Item>
                      </Col>
                    ) : null}
                  </Row>
                </Space>
              </div>

              {!editing ? (
                <div style={sectionStyle}>
                  <Space
                    orientation="vertical"
                    size={12}
                    style={{ width: '100%' }}
                  >
                    <div>
                      <Typography.Text strong>收益归属</Typography.Text>
                      <br />
                      <Typography.Text type="secondary">
                        收益将在审核通过后计入员工流水。
                      </Typography.Text>
                    </div>
                    <EarningAttributionFields
                      enabled={drawerOpen && enabled}
                      form={form}
                      onCapabilitiesChange={handleCapabilitiesChange}
                    />
                  </Space>
                </div>
              ) : null}

              <div style={sectionStyle}>
                <Space
                  orientation="vertical"
                  size={12}
                  style={{ width: '100%' }}
                >
                  <div>
                    <Typography.Text strong>合同（可选）</Typography.Text>
                    <br />
                    <Typography.Text type="secondary">
                      如有合同可在此上传；没有合同也可以直接保存租约。
                    </Typography.Text>
                  </div>
                  <Form.Item name="contract_files" style={{ marginBottom: 0 }}>
                    <MediaRefsUpload
                      resourceType={HOUSE_MEDIA_RESOURCE_TYPE.LEASE_CONTRACT}
                      mediaType={HOUSE_MEDIA_TYPE.FILE}
                      maxCount={1}
                    />
                  </Form.Item>
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
            name: sourceViewing?.customer_name,
            phone: sourceViewing?.customer_phone,
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

export default LeasesPage;
