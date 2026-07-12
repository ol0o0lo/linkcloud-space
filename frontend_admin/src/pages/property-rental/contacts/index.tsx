import { PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Avatar,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  message,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  ContactPreview,
  EntityPreviewDetailDrawer,
} from '@/components/EntityPreview';
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
  enumOptionMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import { type ContactOut, houseApi } from '@/services/manual/house';
import {
  getLoadingAwareEmptyState,
  isInitialQueryPending,
} from '../loading';

const PAGE_SIZE = 20;

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

function getContactBusinessInfo(record: ContactOut) {
  const secondaryParts = [
    record.email || undefined,
    record.notes || undefined,
  ].filter(Boolean);
  return {
    primary: `${record.name} / ${record.phone}`,
    secondary: secondaryParts.length ? secondaryParts.join(' · ') : '-',
  };
}

function getContactActionLinks(record: ContactOut) {
  if (record.is_active === false) return [];
  const actions: { label: string; path: string }[] = [];
  if (record.roles?.includes('landlord')) {
    actions.push({
      label: '登记房源',
      path: `/property-rental/houses/new?landlord_id=${record.id}`,
    });
  }
  if (record.roles?.includes('tenant')) {
    actions.push({
      label: '登记带看',
      path: `/property-rental/viewings?contact_id=${record.id}`,
    });
  }
  return actions;
}

function getContactListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page') || '1');
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    q: params.get('keyword') || undefined,
    role: params.get('role') || undefined,
  };
}

function syncContactListSearch(filters: {
  page: number;
  q?: string;
  role?: string;
}) {
  const params = new URLSearchParams(window.location.search);
  params.delete('role');
  params.delete('keyword');
  params.delete('page');
  params.delete('task');
  if (filters.role) params.set('role', filters.role);
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
  roles?: string[];
  notes?: string;
  is_active?: boolean;
};

const ContactsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialListState = useRef(
    getContactListStateFromSearch(window.location.search),
  );
  const [page, setPage] = useState(initialListState.current.page);
  const [q, setQ] = useState<string | undefined>(initialListState.current.q);
  const [role, setRole] = useState<string | undefined>(
    initialListState.current.role,
  );
  const [editing, setEditing] = useState<ContactOut | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerState, setDrawerState] = useState<ContactDrawerState>(() =>
    getContactDrawerStateFromSearch(window.location.search),
  );
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseEnums = useEnums(['house.contact_role']);
  const contacts = useQuery({
    queryKey: [
      'house',
      'contacts',
      workspace.selectedOrgSlug,
      page,
      q,
      role,
    ],
    queryFn: () =>
      houseApi.listContacts({
        page,
        page_size: PAGE_SIZE,
        keyword: q,
        role,
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
  const saveContact = useMutation({
    mutationFn: (values: ContactFormValues) =>
      editing
        ? houseApi.patchContact(editing.id, values)
        : houseApi.createContact(values),
    onSuccess: async () => {
      message.success(editing ? '联系人已更新' : '联系人已创建');
      setDrawerOpen(false);
      setEditing(null);
      setDrawerState({});
      syncContactDrawerSearch({});
      await queryClient.invalidateQueries({ queryKey: ['house', 'contacts'] });
    },
  });
  const toggleContact = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      houseApi.patchContact(id, { is_active }),
    onSuccess: async () => {
      message.success('联系人状态已更新');
      await queryClient.invalidateQueries({ queryKey: ['house', 'contacts'] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDrawerState({});
    syncContactDrawerSearch({});
    setDrawerOpen(true);
  };

  const openEdit = (record: ContactOut) => {
    setEditing(record);
    setDrawerState({ editContactId: record.id });
    syncContactDrawerSearch({ editContactId: record.id });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
    setDrawerState({});
    syncContactDrawerSearch({});
  };

  const roleOptions = enumSelectOptions(houseEnums.data, 'house.contact_role');
  const roleLabel = (value?: string | null) =>
    enumOptionMapping(houseEnums.data, 'house.contact_role', value);
  const listLoading = isInitialQueryPending(contacts);

  useEffect(() => {
    syncContactListSearch({ page, q, role });
  }, [page, q, role]);

  useEffect(() => {
    setDrawerOpen(false);
    setEditing(null);
  }, [workspace.selectedOrgSlug]);

  useEffect(() => {
    if (!drawerState.editContactId || editing || drawerOpen || !contacts.isSuccess) {
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
      setRole(listState.role);
      setDrawerState(nextDrawerState);
      setDrawerOpen(false);
      setEditing(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const columns: ProColumns<ContactOut>[] = [
    {
      title: '主体信息',
      dataIndex: 'name',
      width: 320,
      render: (_value, record) => {
        const businessInfo = getContactBusinessInfo(record);
        return (
          <Space align="start" size={8}>
            <Avatar size={40}>
              <span data-testid="contact-avatar-initial">
                {record.name.trim().slice(0, 1) || '?'}
              </span>
            </Avatar>
            <Space orientation="vertical" size={2}>
              <ContactPreview id={record.id}><Typography.Text strong>{businessInfo.primary}</Typography.Text></ContactPreview>
              <Typography.Text type="secondary">
                {businessInfo.secondary}
              </Typography.Text>
            </Space>
          </Space>
        );
      },
    },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 180,
      render: (_roles, record) =>
        (record.roles || []).map((role: string, index: number) => (
          <Tag key={role}>{record.roles__mapping?.[index] || roleLabel(role)}</Tag>
        )),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 90,
      render: (value) =>
        value === false ? <Tag>停用</Tag> : <Tag color="green">启用</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      width: 220,
      render: (_value, record) => (
        <ResponsiveActions>
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          {getContactActionLinks(record).map((action) => (
            <a
              key={action.path}
              href={`/dashboard${action.path}`}
              onClick={(event) => {
                event.preventDefault();
                history.push(action.path);
              }}
            >
              {action.label}
            </a>
          ))}
          <Button
            type="link"
            size="small"
            onClick={() =>
              toggleContact.mutate({
                id: record.id,
                is_active: record.is_active === false,
              })
            }
          >
            {record.is_active === false ? '启用' : '停用'}
          </Button>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <TenantSelectionGuard title="联系人">
      <Card>
        <ProTable<ContactOut>
          rowKey="id"
          loading={listLoading}
          headerTitle="联系人列表"
          columns={columns}
          dataSource={contacts.data?.items || []}
          search={false}
          options={{
            density: true,
            reload: false,
            search: {
              name: 'keyword',
              placeholder: '姓名 / 手机',
              value: q,
              onSearch: (value) => {
                setPage(1);
                setQ(value.trim() || undefined);
              },
            },
            setting: true,
          }}
          toolBarRender={() => [
            <Select
              key="role"
              allowClear
              placeholder="角色"
              options={roleOptions}
              value={role}
              popupMatchSelectWidth={toolbarSelectPopupWidth}
              onChange={(value) => {
                setPage(1);
                setRole(value);
              }}
              style={toolbarShortSelectStyle}
            />,
            <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建联系人
            </Button>,
          ]}
          ghost
          locale={{
            emptyText: getLoadingAwareEmptyState({
              loading: listLoading,
              loadingTitle: '联系人数据加载中',
              loadingDescription: '正在同步房东、租客和客户主体资料。',
              emptyState: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无联系人"
                >
                  <Button type="primary" onClick={openCreate}>
                    新建联系人
                  </Button>
                </Empty>
              ),
            }),
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: contacts.data?.total || 0,
            onChange: setPage,
          }}
          scroll={adminTableScroll}
        />
      </Card>
      <EntityPreviewDetailDrawer
        searchParam="preview"
        title="联系人详情"
        type="contact"
      />
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
          key={editing?.id || 'new'}
          id="contact-form"
          layout="vertical"
          initialValues={
            editing || {
              roles: [],
              is_active: true,
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
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default ContactsPage;
