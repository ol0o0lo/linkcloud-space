import { MoreOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
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
  Dropdown,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  message,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import React, { useEffect, useState } from 'react';
import {
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
} from '../constants';
import {
  getLoadingAwareEmptyState,
  isInitialQueryPending,
} from '../loading';

const PAGE_SIZE = 20;
const VIEWING_STATUS_ACTION_TEXT: Record<string, string> = {
  viewed: '完成带看',
  converted: '标记成交',
  canceled: '取消',
  no_show: '标记爽约',
};
const VIEWING_MORE_ACTIONS = [
  { key: 'contact', label: '补租客' },
  { key: VIEWING_STATUS.VIEWED, label: VIEWING_STATUS_ACTION_TEXT[VIEWING_STATUS.VIEWED] },
  { key: VIEWING_STATUS.CONVERTED, label: VIEWING_STATUS_ACTION_TEXT[VIEWING_STATUS.CONVERTED] },
  { key: VIEWING_STATUS.CANCELED, label: VIEWING_STATUS_ACTION_TEXT[VIEWING_STATUS.CANCELED] },
  { key: VIEWING_STATUS.NO_SHOW, label: VIEWING_STATUS_ACTION_TEXT[VIEWING_STATUS.NO_SHOW] },
];

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

function getViewingBusinessInfo(record: ViewingRecordOut) {
  const secondaryParts = [
    houseLabel(record),
    needsContactCompletion(record) ? '未绑定租客' : undefined,
    dateTimeText(record.scheduled_at),
  ].filter(Boolean);
  return {
    primary: `${record.customer_name} / ${record.customer_phone}`,
    secondary: secondaryParts.join(' · '),
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
    keyword: params.get('keyword') || undefined,
  };
}

function syncViewingListSearch(filters: {
  page: number;
  status?: string;
  pendingLease?: boolean;
  contactMissing?: boolean;
  keyword?: string;
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

type ViewingDrawerSearchState = {
  sourceHouseId?: number;
  sourceContactId?: number;
  editViewingId?: number;
  task?: string;
};

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
  const [keyword, setKeyword] = useState<string | undefined>(
    initialListState.keyword,
  );
  const [drawerState, setDrawerState] =
    useState<ViewingDrawerSearchState>(initialDrawerState);
  const [editing, setEditing] = useState<ViewingRecordOut | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [createdTenants, setCreatedTenants] = useState<ContactOut[]>([]);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseEnums = useEnums(['house.viewing_record_status']);
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
      keyword,
    ],
    queryFn: () =>
      houseApi.listViewingRecords({
        page,
        page_size: PAGE_SIZE,
        status,
        house_id: sourceHouseId,
        pending_lease: pendingLease,
        contact_missing: contactMissing,
        keyword,
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
  const missingContactQueueTotal =
    conversionSupportQueries[0]?.data?.total || 0;
  const readyLeaseQueueTotal = conversionSupportQueries[1]?.data?.total || 0;
  const rows = viewings.data?.items || [];
  const currentTotal = viewings.data?.total || 0;
  const listLoading = isInitialQueryPending(viewings);
  const missingContactQueueCount =
    contactMissing === true
      ? currentTotal
      : missingContactQueueTotal;
  const readyLeaseCount =
    contactMissing === false && pendingLease
      ? currentTotal
      : readyLeaseQueueTotal;
  const pendingLeaseCount =
    pendingLease && contactMissing === undefined
      ? currentTotal
      : readyLeaseCount + missingContactQueueCount;
  useEffect(() => {
    syncViewingListSearch({ page, status, pendingLease, contactMissing, keyword });
  }, [contactMissing, keyword, page, pendingLease, status]);
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
      const listState = getViewingListStateFromSearch(window.location.search);
      setPage(listState.page);
      setStatus(listState.status);
      setPendingLease(listState.pendingLease);
      setContactMissing(listState.contactMissing);
      setKeyword(listState.keyword);
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
  useEffect(() => {
    if (!drawerOpen || !editing) return;
    form.setFieldsValue({
      ...editing,
      scheduled_at: dateTimeInputValue(editing.scheduled_at),
    });
  }, [drawerOpen, editing?.id, form]);
  const tenantItems = [...createdTenants, ...(contacts.data?.items || [])];
  const columns: ProColumns<ViewingRecordOut>[] = [
    {
      title: '客户信息',
      dataIndex: 'customer_name',
      width: 320,
      render: (_value, record) => {
        const businessInfo = getViewingBusinessInfo(record);
        return (
          <Space orientation="vertical" size={2}>
            <Typography.Text strong>{businessInfo.primary}</Typography.Text>
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
      width: 120,
      render: (_value, record) => (
        <Tag color={STATUS_COLOR[record.status] || 'default'}>
          {enumMapping(record.status, record.status__mapping)}
        </Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      width: 220,
      render: (_value, record) => {
        return (
          <ResponsiveActions>
            <Button type="link" size="small" onClick={() => openEdit(record)}>
              编辑
            </Button>
            {record.signed_lease_id ? (
              <Button type="link" size="small" disabled>
                签约
              </Button>
            ) : canCreateLease(record) ? (
              <Button type="link" size="small" href={leaseCreatePath(record)}>
                签约
              </Button>
            ) : null}
            <Dropdown
              menu={{
                items: VIEWING_MORE_ACTIONS,
                onClick: ({ key }) => {
                  if (key === 'contact') {
                    openEdit(record);
                    return;
                  }
                  updateViewingStatus.mutate({ id: record.id, status: key });
                },
              }}
              trigger={['click']}
            >
              <Button aria-label="更多操作" type="text" size="small" icon={<MoreOutlined />} />
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
    <TenantSelectionGuard title="带看">
      <Card>
        <ProTable<ViewingRecordOut>
          rowKey="id"
          loading={listLoading}
          headerTitle="带看列表"
          columns={columns}
          dataSource={viewings.data?.items || []}
          search={false}
          options={{
            density: true,
            reload: false,
            search: {
              name: 'keyword',
              placeholder: '客户 / 手机 / 房源',
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
              style={toolbarShortSelectStyle}
              popupMatchSelectWidth={toolbarSelectPopupWidth}
              options={viewingStatusOptions}
              value={status}
              onChange={(value) => {
                setPage(1);
                setStatus(value || undefined);
                setPendingLease(undefined);
                setContactMissing(undefined);
              }}
            />,
            <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建带看
            </Button>,
          ]}
          ghost
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
            onChange: setPage,
          }}
          scroll={adminTableScroll}
        />
      </Card>
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
              <Col xs={24}>
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
