import { MoreOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Button,
  Card,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  message,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  ContactPreview,
  EntityPreviewDetailDrawer,
} from '@/components/EntityPreview';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/space/shared';
import {
  enumOptionMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import { type ContactOut, houseApi } from '@/services/manual/house';
import { getLoadingAwareEmptyState, isInitialQueryPending } from '../loading';

const PAGE_SIZE = 20;

type ContactRoleFilter = 'all' | 'landlord' | 'tenant';
type ContactStatusFilter = 'active' | 'inactive';

const CONTACT_ROLE_FILTER_OPTIONS: {
  label: string;
  value: ContactRoleFilter;
}[] = [
  { label: '全部', value: 'all' },
  { label: '房东', value: 'landlord' },
  { label: '租客', value: 'tenant' },
];

const CONTACT_STATUS_FILTER_OPTIONS: {
  label: string;
  value: ContactStatusFilter;
}[] = [
  { label: '在用', value: 'active' },
  { label: '已停用', value: 'inactive' },
];

const CONTACT_ROLE_COLORS: Record<string, string> = {
  landlord: 'blue',
  tenant: 'purple',
};

const CONTACT_ROLE_ORDER: Record<string, number> = {
  landlord: 0,
  tenant: 1,
};

type ContactDrawerState = {
  editContactId?: number;
};

function getContactDrawerStateFromSearch(search: string): ContactDrawerState {
  const params = new URLSearchParams(search);
  return { editContactId: Number(params.get('edit')) || undefined };
}

function syncContactDrawerSearch(drawerState: ContactDrawerState) {
  const params = new URLSearchParams(window.location.search);
  params.delete('edit');
  if (drawerState.editContactId) {
    params.set('edit', String(drawerState.editContactId));
  }
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function getContactPrimaryAction(record: ContactOut) {
  if (record.is_active === false) return undefined;
  if (record.roles?.includes('landlord')) {
    return {
      label: '登记房源',
      path: `/rental/properties/new?landlord_id=${record.id}`,
    };
  }
  if (record.roles?.includes('tenant')) {
    return {
      label: '登记带看',
      path: `/rental/viewings?contact_id=${record.id}`,
    };
  }
  return undefined;
}

function getContactListFilters(
  roleFilter: ContactRoleFilter,
  statusFilter: ContactStatusFilter,
) {
  return {
    role: roleFilter === 'all' ? undefined : roleFilter,
    task: statusFilter,
  };
}

function getContactRoleFilterFromSearchParams(
  params: URLSearchParams,
): ContactRoleFilter {
  const role = params.get('role');
  if (role === 'landlord' || role === 'tenant') return role;
  return 'all';
}

function getContactStatusFilterFromSearchParams(
  params: URLSearchParams,
): ContactStatusFilter {
  const task = params.get('task');
  return task === 'inactive' || task === 'role_missing_inactive'
    ? 'inactive'
    : 'active';
}

function getContactListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page') || '1');
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    q: params.get('keyword') || undefined,
    roleFilter: getContactRoleFilterFromSearchParams(params),
    statusFilter: getContactStatusFilterFromSearchParams(params),
  };
}

function syncContactListSearch(filters: {
  page: number;
  q?: string;
  roleFilter: ContactRoleFilter;
  statusFilter: ContactStatusFilter;
}) {
  const params = new URLSearchParams(window.location.search);
  params.delete('role');
  params.delete('keyword');
  params.delete('page');
  params.delete('task');
  const listFilters = getContactListFilters(
    filters.roleFilter,
    filters.statusFilter,
  );
  if (listFilters.role) params.set('role', listFilters.role);
  if (filters.statusFilter === 'inactive') {
    params.set('task', 'inactive');
  }
  if (filters.q) params.set('keyword', filters.q);
  if (filters.page > 1) params.set('page', String(filters.page));
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

type ContactFormValues = {
  name: string;
  phone: string;
  email?: string;
  roles: string[];
  notes?: string;
};

const ContactsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialListState = useRef(
    getContactListStateFromSearch(window.location.search),
  );
  const [page, setPage] = useState(initialListState.current.page);
  const [q, setQ] = useState<string | undefined>(initialListState.current.q);
  const [searchDraft, setSearchDraft] = useState(
    initialListState.current.q || '',
  );
  const [roleFilter, setRoleFilter] = useState<ContactRoleFilter>(
    initialListState.current.roleFilter,
  );
  const [statusFilter, setStatusFilter] = useState<ContactStatusFilter>(
    initialListState.current.statusFilter,
  );
  const [editing, setEditing] = useState<ContactOut | null>(null);
  const [createRolePreset, setCreateRolePreset] = useState<
    string | undefined
  >();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusContact, setStatusContact] = useState<ContactOut | null>(null);
  const [drawerState, setDrawerState] = useState<ContactDrawerState>(() =>
    getContactDrawerStateFromSearch(window.location.search),
  );
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseEnums = useEnums(['house.contact_role']);
  const listFilters = getContactListFilters(roleFilter, statusFilter);
  const contacts = useQuery({
    queryKey: [
      'house',
      'contacts',
      workspace.selectedOrgSlug,
      page,
      q,
      roleFilter,
      statusFilter,
    ],
    queryFn: () =>
      houseApi.listContacts({
        page,
        page_size: PAGE_SIZE,
        keyword: q,
        role: listFilters.role,
        task: listFilters.task,
      }),
    enabled,
  });
  const listedEditingContact = contacts.data?.items.find(
    (item) => item.id === drawerState.editContactId,
  );
  const editContact = useQuery({
    queryKey: [
      'house',
      'contact',
      workspace.selectedOrgSlug,
      drawerState.editContactId,
    ],
    queryFn: () => houseApi.getContact(drawerState.editContactId as number),
    enabled:
      enabled &&
      Boolean(drawerState.editContactId) &&
      contacts.isSuccess &&
      !listedEditingContact,
  });
  const invalidateContactQueries = async () => {
    const orgSlug = workspace.selectedOrgSlug;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['house', 'contacts'] }),
      queryClient.invalidateQueries({
        queryKey: ['house', 'contact', orgSlug],
      }),
      queryClient.invalidateQueries({
        queryKey: ['entity-preview', orgSlug, 'contact'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['house', 'new', 'contacts', orgSlug],
      }),
      queryClient.invalidateQueries({
        queryKey: ['house', 'detail', 'landlords', orgSlug],
      }),
      queryClient.invalidateQueries({
        queryKey: ['house', 'viewings', 'contacts', orgSlug],
      }),
      queryClient.invalidateQueries({
        queryKey: ['house', 'leases', 'tenants', orgSlug],
      }),
    ]);
  };
  const saveContact = useMutation({
    mutationFn: (values: ContactFormValues) =>
      editing
        ? houseApi.patchContact(editing.id, values)
        : houseApi.createContact(values),
    onSuccess: async () => {
      message.success(editing ? '联系人已更新' : '联系人已创建');
      setDrawerOpen(false);
      setEditing(null);
      setCreateRolePreset(undefined);
      setDrawerState({});
      syncContactDrawerSearch({});
      await invalidateContactQueries();
    },
  });
  const toggleContact = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      houseApi.patchContact(id, { is_active }),
    onSuccess: async () => {
      message.success('联系人状态已更新');
      await invalidateContactQueries();
    },
  });

  const openCreate = (presetRole?: string) => {
    setEditing(null);
    setCreateRolePreset(presetRole);
    setDrawerState({});
    syncContactDrawerSearch({});
    setDrawerOpen(true);
  };

  const openEdit = (record: ContactOut) => {
    setEditing(record);
    setCreateRolePreset(undefined);
    setDrawerState({ editContactId: record.id });
    syncContactDrawerSearch({ editContactId: record.id });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
    setCreateRolePreset(undefined);
    setDrawerState({});
    syncContactDrawerSearch({});
  };

  const roleOptions = enumSelectOptions(houseEnums.data, 'house.contact_role');
  const roleLabel = (value?: string | null) =>
    enumOptionMapping(houseEnums.data, 'house.contact_role', value);
  const listLoading = isInitialQueryPending(contacts);
  const { token } = theme.useToken();
  const hasActiveFilters =
    roleFilter !== 'all' || statusFilter !== 'active' || Boolean(q);

  const clearFilters = () => {
    setPage(1);
    setQ(undefined);
    setSearchDraft('');
    setRoleFilter('all');
    setStatusFilter('active');
  };

  useEffect(() => {
    syncContactListSearch({ page, q, roleFilter, statusFilter });
  }, [page, q, roleFilter, statusFilter]);

  useEffect(() => {
    if (
      !contacts.data ||
      contacts.data.items.length > 0 ||
      contacts.data.total === 0 ||
      page <= 1
    ) {
      return;
    }
    const lastPage = Math.max(1, Math.ceil(contacts.data.total / PAGE_SIZE));
    if (page > lastPage) setPage(lastPage);
  }, [contacts.data, page]);

  useEffect(() => {
    setDrawerOpen(false);
    setEditing(null);
    setCreateRolePreset(undefined);
    setStatusContact(null);
  }, [workspace.selectedOrgSlug]);

  useEffect(() => {
    if (
      !drawerState.editContactId ||
      editing ||
      drawerOpen ||
      !contacts.isSuccess
    ) {
      return;
    }
    if (listedEditingContact) {
      setEditing(listedEditingContact);
      setDrawerOpen(true);
      return;
    }
    if (editContact.data) {
      setEditing(editContact.data);
      setDrawerOpen(true);
    }
  }, [
    contacts.isSuccess,
    drawerOpen,
    drawerState.editContactId,
    editContact.data,
    editing,
    listedEditingContact,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      const listState = getContactListStateFromSearch(window.location.search);
      const nextDrawerState = getContactDrawerStateFromSearch(
        window.location.search,
      );
      setPage(listState.page);
      setQ(listState.q);
      setSearchDraft(listState.q || '');
      setRoleFilter(listState.roleFilter);
      setStatusFilter(listState.statusFilter);
      setDrawerState(nextDrawerState);
      setDrawerOpen(false);
      setEditing(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const columns: ProColumns<ContactOut>[] = [
    {
      title: '联系人',
      dataIndex: 'name',
      width: 220,
      render: (_value, record) => (
        <Space align="center" size={10} style={{ minWidth: 0 }}>
          <Avatar
            size={36}
            style={{
              backgroundColor:
                record.is_active === false
                  ? token.colorFillSecondary
                  : token.colorPrimaryBg,
              color:
                record.is_active === false
                  ? token.colorTextDisabled
                  : token.colorPrimary,
              flex: '0 0 auto',
            }}
          >
            <span data-testid="contact-avatar-initial">
              {record.name.trim().slice(0, 1) || '?'}
            </span>
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <ContactPreview id={record.id}>
              <Typography.Text
                ellipsis
                strong
                style={{ display: 'block', maxWidth: 160 }}
              >
                {record.name}
              </Typography.Text>
            </ContactPreview>
          </div>
        </Space>
      ),
    },
    {
      title: '手机',
      dataIndex: 'phone',
      width: 170,
      render: (value) => {
        const phone = typeof value === 'string' ? value : '';
        return (
          <Typography.Text
            copyable={{
              text: phone,
              tooltips: ['复制手机号', '手机号已复制'],
            }}
          >
            {phone || '-'}
          </Typography.Text>
        );
      },
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 220,
      render: (value) => {
        const email = typeof value === 'string' ? value : '';
        return email ? (
          <Tooltip title={email}>
            <Typography.Text ellipsis style={{ display: 'block' }}>
              {email}
            </Typography.Text>
          </Tooltip>
        ) : (
          '-'
        );
      },
    },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 180,
      render: (_roles, record) => {
        const roles = (record.roles || [])
          .map((role: string, index: number) => ({
            label: record.roles__mapping?.[index] || roleLabel(role),
            role,
          }))
          .sort(
            (left, right) =>
              (CONTACT_ROLE_ORDER[left.role] ?? Number.MAX_SAFE_INTEGER) -
              (CONTACT_ROLE_ORDER[right.role] ?? Number.MAX_SAFE_INTEGER),
          );
        return roles.length ? (
          <Space size={[4, 4]} wrap>
            {roles.map(({ role, label }) => (
              <Tag color={CONTACT_ROLE_COLORS[role]} key={role}>
                {label}
              </Tag>
            ))}
          </Space>
        ) : (
          <Tag color="orange">待补角色</Tag>
        );
      },
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      width: 150,
      align: 'center',
      render: (_value, record) => {
        const primaryAction = getContactPrimaryAction(record);

        return (
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-start',
            }}
          >
            {primaryAction ? (
              <a href={`/dashboard${primaryAction.path}`}>
                {primaryAction.label}
              </a>
            ) : (
              <span />
            )}
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'edit', label: '编辑资料' },
                  record.is_active === false
                    ? { key: 'activate', label: '启用联系人' }
                    : {
                        key: 'deactivate',
                        danger: true,
                        label: '停用联系人',
                      },
                ],
                onClick: ({ key }) => {
                  if (key === 'edit') {
                    openEdit(record);
                    return;
                  }
                  setStatusContact(record);
                },
              }}
            >
              <Button
                aria-label="更多操作"
                title="更多操作"
                type="text"
                size="small"
                icon={<MoreOutlined />}
              />
            </Dropdown>
          </div>
        );
      },
    },
  ];

  const emptyState = contacts.isError ? (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space orientation="vertical" size={4}>
          <Typography.Text strong>联系人加载失败</Typography.Text>
          <Typography.Text type="secondary">
            请检查网络后重试，当前筛选条件已保留。
          </Typography.Text>
        </Space>
      }
    >
      <Button onClick={() => contacts.refetch()}>重新加载</Button>
    </Empty>
  ) : hasActiveFilters ? (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space orientation="vertical" size={4}>
          <Typography.Text strong>未找到匹配的联系人</Typography.Text>
          <Typography.Text type="secondary">
            可以调整关键词、角色或状态筛选后再试。
          </Typography.Text>
        </Space>
      }
    >
      <Button onClick={clearFilters}>清空筛选</Button>
    </Empty>
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无联系人">
      <Button type="primary" onClick={() => openCreate()}>
        新建联系人
      </Button>
    </Empty>
  );

  return (
    <TenantSelectionGuard title="客户与业主">
      <Card>
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Space size={8} wrap>
            <Typography.Text type="secondary">角色</Typography.Text>
            <Segmented<ContactRoleFilter>
              aria-label="联系人角色筛选"
              options={CONTACT_ROLE_FILTER_OPTIONS}
              value={roleFilter}
              onChange={(value) => {
                setPage(1);
                setRoleFilter(value);
              }}
            />
          </Space>
          <Space size={12} wrap>
            <Typography.Text type="secondary">状态</Typography.Text>
            <Select<ContactStatusFilter>
              aria-label="联系人状态筛选"
              options={CONTACT_STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(value) => {
                setPage(1);
                setStatusFilter(value);
              }}
              style={{ width: 112 }}
            />
            {contacts.data ? (
              <Typography.Text type="secondary">
                共 {contacts.data.total} 位
              </Typography.Text>
            ) : null}
            <Input.Search
              allowClear
              placeholder="搜索姓名 / 手机 / 邮箱"
              value={searchDraft}
              onChange={(event) => {
                const nextValue = event.target.value;
                setSearchDraft(nextValue);
                if (!nextValue && q) {
                  setPage(1);
                  setQ(undefined);
                }
              }}
              onSearch={(value) => {
                setPage(1);
                setSearchDraft(value);
                setQ(value.trim() || undefined);
              }}
              style={{ width: 280 }}
            />
            {enabled ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  openCreate(
                    roleFilter === 'landlord' || roleFilter === 'tenant'
                      ? roleFilter
                      : undefined,
                  )
                }
              >
                新建联系人
              </Button>
            ) : null}
          </Space>
        </div>
        <ProTable<ContactOut>
          rowKey="id"
          loading={listLoading}
          columns={columns}
          dataSource={contacts.data?.items || []}
          search={false}
          options={false}
          ghost
          locale={{
            emptyText: getLoadingAwareEmptyState({
              loading: listLoading,
              loadingTitle: '联系人数据加载中',
              loadingDescription: '正在同步房东、租客和客户主体资料。',
              emptyState,
            }),
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: contacts.data?.total || 0,
            onChange: setPage,
          }}
          scroll={adminTableScroll}
          sticky
        />
      </Card>
      <EntityPreviewDetailDrawer
        searchParam="preview"
        title="联系人详情"
        type="contact"
      />
      <Modal
        open={Boolean(statusContact)}
        title={
          statusContact?.is_active === false
            ? '确认启用联系人'
            : '确认停用联系人'
        }
        okText={statusContact?.is_active === false ? '确认启用' : '确认停用'}
        cancelText="取消"
        okButtonProps={{ danger: statusContact?.is_active !== false }}
        confirmLoading={toggleContact.isPending}
        onCancel={() => setStatusContact(null)}
        onOk={async () => {
          if (!statusContact) return;
          await toggleContact.mutateAsync({
            id: statusContact.id,
            is_active: statusContact.is_active === false,
          });
          setStatusContact(null);
        }}
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          {statusContact?.is_active === false
            ? '启用后可重新为该联系人登记房源或带看。'
            : '停用后将不再提供登记房源或带看入口，历史业务关联仍会保留。'}
        </Typography.Paragraph>
      </Modal>
      <Drawer
        title={editing ? '编辑联系人' : '新建联系人'}
        open={drawerOpen}
        size="large"
        onClose={closeDrawer}
        destroyOnHidden
        extra={
          <Button
            type="primary"
            htmlType="submit"
            form="contact-form"
            loading={saveContact.isPending}
          >
            保存
          </Button>
        }
      >
        <Form
          key={editing?.id || `new-${createRolePreset || 'contact'}`}
          id="contact-form"
          layout="vertical"
          initialValues={
            editing || {
              roles: createRolePreset ? [createRolePreset] : [],
            }
          }
          onFinish={(values) =>
            saveContact.mutate({ ...values, roles: values.roles || [] })
          }
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
          <Form.Item
            label="角色"
            name="roles"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select mode="multiple" options={roleOptions} />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default ContactsPage;
