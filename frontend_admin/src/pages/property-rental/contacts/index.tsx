import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Button, Col, Drawer, Empty, Form, Input, Row, Select, Space, Statistic, Switch, Table, Tag, Typography, message, theme } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { AdminToolbar, ResponsiveActions, adminTableScroll, toolbarControlStyle } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type ContactOut } from '@/services/manual/house';
import { enumOptionMapping, enumSelectOptions, useEnums } from '@/services/manual/enums';
import { CONTACT_ROLE } from '../constants';
import { getLoadingAwareEmptyState, getLoadingSafeCount, getLoadingSafeText, isInitialQueryPending } from '../loading';

const CONTACT_TASK_OPTIONS = [
  { value: 'dual_role', label: '双角色待确认' },
  { value: 'inactive', label: '停用联系人' },
  { value: 'role_missing', label: '缺角色主体' },
];
const CONTACT_TASK_TEXT = Object.fromEntries(CONTACT_TASK_OPTIONS.map((item) => [item.value, item.label]));
const PAGE_SIZE = 20;

function hasRole(record: ContactOut, role: string) {
  return record.roles?.includes(role);
}

function hasMissingRole(record: ContactOut) {
  return !record.roles?.length;
}

function getContactStageText(record: ContactOut) {
  if (hasMissingRole(record)) return '待补角色';
  const isLandlord = hasRole(record, CONTACT_ROLE.LANDLORD);
  const isTenant = hasRole(record, CONTACT_ROLE.TENANT);
  if (isLandlord && isTenant) return '双向协同';
  if (isLandlord) return '房东资源';
  if (isTenant) return '租客线索';
  return '待补角色';
}

function getContactFollowUpHint(record: ContactOut) {
  if (hasMissingRole(record)) return '先补房东或租客角色，再进入房源、带看或签约流程';
  const isLandlord = hasRole(record, CONTACT_ROLE.LANDLORD);
  const isTenant = hasRole(record, CONTACT_ROLE.TENANT);
  if (record.is_active === false) return '已停用，不参与新业务流程';
  if (isLandlord && isTenant) return '同时承接房东供给和租客需求，录入业务时要明确当前身份';
  if (isLandlord) return '优先登记名下房源并补齐基础资料';
  if (isTenant) return '优先登记带看和成交意向进展';
  return '补充房东/租客角色，避免业务流转时无法定位主体';
}

function getContactBusinessInfo(record: ContactOut) {
  const secondaryParts = [record.email || undefined, record.notes || undefined].filter(Boolean);
  return {
    primary: `${record.name} / ${record.phone}`,
    secondary: secondaryParts.length ? secondaryParts.join(' · ') : '-',
  };
}

function getContactScopeText(roleLabel: (value?: string | null) => string, role?: string, q?: string, task?: string) {
  const parts: string[] = [];
  if (task) parts.push(`队列：${CONTACT_TASK_TEXT[task] || task}`);
  if (role) parts.push(`角色：${roleLabel(role)}`);
  if (q) parts.push(`搜索：${q}`);
  return parts.join(' / ');
}

function getContactScopedOverviewCards(contacts: ContactOut[], filters: { role?: string; task?: string; q?: string }) {
  const total = contacts.length;
  const activeCount = contacts.filter((item) => item.is_active !== false).length;
  const inactiveCount = contacts.filter((item) => item.is_active === false).length;
  const landlordCount = contacts.filter((item) => hasRole(item, CONTACT_ROLE.LANDLORD)).length;
  const tenantCount = contacts.filter((item) => hasRole(item, CONTACT_ROLE.TENANT)).length;
  const dualRoleCount = contacts.filter((item) => hasRole(item, CONTACT_ROLE.LANDLORD) && hasRole(item, CONTACT_ROLE.TENANT)).length;
  const missingRoleCount = contacts.filter(hasMissingRole).length;

  if (filters.task === 'dual_role') {
    return [
      { key: 'dual_scope', title: '双角色主体', value: total, hint: '当前需要明确业务身份的联系人' },
      { key: 'dual_active', title: '仍在启用', value: activeCount, hint: '启用状态下更需要先确认本次流转身份' },
      { key: 'dual_inactive', title: '已停用', value: inactiveCount, hint: '已停用主体先确认是否还需继续使用' },
      { key: 'dual_landlord', title: '可挂房源', value: landlordCount, hint: '可从这里直接进入房源建档的双角色主体' },
    ];
  }

  if (filters.task === 'inactive') {
    return [
      { key: 'inactive_scope', title: '停用联系人', value: total, hint: '当前停用、需确认是否恢复的主体' },
      { key: 'inactive_landlord', title: '含房东身份', value: landlordCount, hint: '恢复前先确认是否仍会用于新房源' },
      { key: 'inactive_tenant', title: '含租客身份', value: tenantCount, hint: '恢复前先确认是否仍会用于带看与签约' },
      { key: 'inactive_dual', title: '双角色', value: dualRoleCount, hint: '同时有双角色时，恢复后仍需明确本次业务身份' },
    ];
  }

  if (filters.task === 'role_missing') {
    return [
      { key: 'role_missing_scope', title: '缺角色主体', value: total, hint: '当前还没标明房东或租客身份的联系人' },
      { key: 'role_missing_active', title: '仍在启用', value: activeCount, hint: '启用状态下更应尽快补齐角色' },
      { key: 'role_missing_notes', title: '有备注记录', value: contacts.filter((item) => Boolean(item.notes)).length, hint: '优先利用备注判断应补为哪类业务主体' },
      { key: 'role_missing_inactive', title: '已停用', value: inactiveCount, hint: '停用主体若无需恢复，可不再补角色' },
    ];
  }

  if (filters.role === CONTACT_ROLE.LANDLORD) {
    return [
      { key: 'current_landlord', title: '当前房东档案', value: total, hint: '当前筛选范围内的房东主体数' },
      { key: 'landlord_active', title: '可登记房源', value: activeCount, hint: '当前仍可直接承接房源建档的房东' },
      { key: 'landlord_dual', title: '双角色', value: dualRoleCount, hint: '录入房源前先确认当前使用的业务身份' },
      { key: 'landlord_inactive', title: '停用联系人', value: inactiveCount, hint: '停用主体不应再挂接新房源' },
    ];
  }

  if (filters.role === CONTACT_ROLE.TENANT) {
    return [
      { key: 'current_tenant', title: '当前租客档案', value: total, hint: '当前筛选范围内的租客主体数' },
      { key: 'tenant_active', title: '可登记带看', value: activeCount, hint: '当前仍可直接承接带看与签约的租客' },
      { key: 'tenant_dual', title: '双角色', value: dualRoleCount, hint: '带看和签约前先确认当前业务身份' },
      { key: 'tenant_inactive', title: '停用联系人', value: inactiveCount, hint: '停用主体不应再进入新业务流程' },
    ];
  }

  if (filters.q) {
    return [
      { key: 'current_scope', title: '当前搜索结果', value: total, hint: '当前关键字命中的联系人主体数' },
      { key: 'scope_landlord', title: '房东角色', value: landlordCount, hint: '结果里可直接关联房源的主体' },
      { key: 'scope_tenant', title: '租客角色', value: tenantCount, hint: '结果里可直接承接带看的主体' },
      { key: 'scope_risk', title: '治理风险', value: inactiveCount + dualRoleCount + missingRoleCount, hint: '结果里仍待清理的停用、双角色或缺角色主体' },
    ];
  }

  return [];
}

function getContactActionLinks(record: ContactOut) {
  if (record.is_active === false) return [];
  const actions: { label: string; path: string }[] = [];
  if (record.roles?.includes('landlord')) {
    actions.push({ label: '登记房源', path: `/property-rental/houses/new?landlord_id=${record.id}` });
  }
  if (record.roles?.includes('tenant')) {
    actions.push({ label: '登记带看', path: `/property-rental/viewings?contact_id=${record.id}` });
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
    task: params.get('task') || undefined,
  };
}

function syncContactListSearch(filters: { page: number; q?: string; role?: string; task?: string }) {
  const params = new URLSearchParams();
  if (filters.task) params.set('task', filters.task);
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
  const initialListState = useRef(getContactListStateFromSearch(window.location.search));
  const [page, setPage] = useState(initialListState.current.page);
  const [q, setQ] = useState<string | undefined>(initialListState.current.q);
  const [searchText, setSearchText] = useState(initialListState.current.q || '');
  const [role, setRole] = useState<string | undefined>(initialListState.current.role);
  const [task, setTask] = useState<string | undefined>(initialListState.current.task);
  const [editing, setEditing] = useState<ContactOut | null>(null);
  const [createRolePreset, setCreateRolePreset] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseEnums = useEnums(['house.contact_role']);
  const baseContacts = useQuery({
    queryKey: ['house', 'contacts', 'base-overview', workspace.selectedOrgSlug, q],
    queryFn: () => houseApi.listContacts({ page: 1, page_size: 100, keyword: q }),
    enabled,
  });
  const overviewContacts = useQuery({
    queryKey: ['house', 'contacts', 'overview', workspace.selectedOrgSlug, q, role, task],
    queryFn: () => houseApi.listContacts({ page: 1, page_size: 100, keyword: q, role, task }),
    enabled,
  });
  const contacts = useQuery({
    queryKey: ['house', 'contacts', workspace.selectedOrgSlug, page, q, role, task],
    queryFn: () => houseApi.listContacts({ page, page_size: PAGE_SIZE, keyword: q, role, task }),
    enabled,
  });
  const saveContact = useMutation({
    mutationFn: (values: ContactFormValues) => (editing ? houseApi.patchContact(editing.id, values) : houseApi.createContact(values)),
    onSuccess: async () => {
      message.success(editing ? '联系人已更新' : '联系人已创建');
      setDrawerOpen(false);
      setEditing(null);
      setCreateRolePreset(undefined);
      await queryClient.invalidateQueries({ queryKey: ['house', 'contacts'] });
    },
  });
  const toggleContact = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => houseApi.patchContact(id, { is_active }),
    onSuccess: async () => {
      message.success('联系人状态已更新');
      await queryClient.invalidateQueries({ queryKey: ['house', 'contacts'] });
    },
  });

  const openCreate = (presetRole?: string) => {
    setEditing(null);
    setCreateRolePreset(presetRole);
    setDrawerOpen(true);
  };

  const openEdit = (record: ContactOut) => {
    setEditing(record);
    setCreateRolePreset(undefined);
    setDrawerOpen(true);
  };

  const baseContactRows = baseContacts.data?.items || [];
  const contactOverviewRows = overviewContacts.data?.items || [];
  const landlordCount = baseContactRows.filter((item) => hasRole(item, CONTACT_ROLE.LANDLORD)).length;
  const tenantCount = baseContactRows.filter((item) => hasRole(item, CONTACT_ROLE.TENANT)).length;
  const dualRoleCount = baseContactRows.filter((item) => hasRole(item, CONTACT_ROLE.LANDLORD) && hasRole(item, CONTACT_ROLE.TENANT)).length;
  const inactiveCount = baseContactRows.filter((item) => item.is_active === false).length;
  const roleMissingCount = baseContactRows.filter(hasMissingRole).length;
  const roleOptions = enumSelectOptions(houseEnums.data, 'house.contact_role');
  const roleLabel = (value?: string | null) => enumOptionMapping(houseEnums.data, 'house.contact_role', value);
  const scopeText = getContactScopeText(roleLabel, role, q, task);
  const scopedOverview = Boolean(scopeText);
  const scopedOverviewCards = getContactScopedOverviewCards(contactOverviewRows, { role, task, q });
  const overviewLoading = scopedOverview ? isInitialQueryPending(overviewContacts) : isInitialQueryPending(baseContacts);
  const listLoading = isInitialQueryPending(contacts);
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

  useEffect(() => {
    syncContactListSearch({ page, q, role, task });
  }, [page, q, role, task]);

  const createActions = [
    { key: 'landlord', label: '新建房东', role: CONTACT_ROLE.LANDLORD },
    { key: 'tenant', label: '新建租客', role: CONTACT_ROLE.TENANT },
    { key: 'all', label: '新建联系人', role: undefined },
  ];

  return (
    <TenantSelectionGuard title="联系人" subtitle="沉淀房东、租客和客户资料。">
      <div style={sectionStyle}>
        <Typography.Text strong>{scopedOverview ? '当前筛选概览' : '联系人概览'}</Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {scopedOverview
            ? scopedOverviewCards.map((item) => (
                <Col key={item.key} xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic title={item.title} value={getLoadingSafeCount(item.value, overviewLoading)} />
                    <Typography.Text type="secondary">{getLoadingSafeText(item.hint, '正在汇总当前联系人范围...', overviewLoading)}</Typography.Text>
                  </div>
                </Col>
              ))
            : (
                <>
                  <Col xs={24} sm={12} xl={6}>
                    <div style={overviewTileStyle}>
                      <Statistic title="房东档案" value={getLoadingSafeCount(landlordCount, overviewLoading)} />
                      <Typography.Text type="secondary">{getLoadingSafeText('可直接关联房源主体', '正在汇总房东主体...', overviewLoading)}</Typography.Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12} xl={6}>
                    <div style={overviewTileStyle}>
                      <Statistic title="租客档案" value={getLoadingSafeCount(tenantCount, overviewLoading)} />
                      <Typography.Text type="secondary">{getLoadingSafeText('可直接承接带看与签约线索', '正在汇总租客主体...', overviewLoading)}</Typography.Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12} xl={6}>
                    <div style={overviewTileStyle}>
                      <Statistic title="双角色" value={getLoadingSafeCount(dualRoleCount, overviewLoading)} />
                      <Typography.Text type="secondary">{getLoadingSafeText('同一主体兼具供给和需求身份', '正在识别双角色主体...', overviewLoading)}</Typography.Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12} xl={6}>
                    <div style={overviewTileStyle}>
                      <Statistic title="停用联系人" value={getLoadingSafeCount(inactiveCount, overviewLoading)} />
                      <Typography.Text type="secondary">{getLoadingSafeText('需要确认是否仍参与新业务流程', '正在识别停用联系人...', overviewLoading)}</Typography.Text>
                    </div>
                  </Col>
                </>
              )}
        </Row>
      </div>

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, width: '100%', marginBottom: 16 }}>
          <div>
            <Typography.Text strong>联系人业务台账</Typography.Text>
          </div>
          <AdminToolbar>
            <Space wrap>
              {createActions.map((item) => (
                <Button
                  key={item.key}
                  type={item.key === 'all' ? 'primary' : 'default'}
                  icon={<PlusOutlined />}
                  onClick={() => openCreate(item.role)}
                >
                  {item.label}
                </Button>
              ))}
            </Space>
          </AdminToolbar>
        </div>
        {scopeText ? (
          <Space wrap style={{ marginBottom: 16 }}>
            <Tag color="blue">{`当前只看：${scopeText}`}</Tag>
            <Button size="small" onClick={() => { setPage(1); setQ(undefined); setSearchText(''); setRole(undefined); setTask(undefined); }}>查看全部</Button>
          </Space>
        ) : null}
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            allowClear
            placeholder="姓名 / 手机"
            value={searchText}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSearchText(nextValue);
              if (!nextValue.trim() && q) {
                setPage(1);
                setQ(undefined);
              }
            }}
            onSearch={(value) => {
              const nextValue = value.trim();
              setSearchText(value);
              setPage(1);
              setQ(nextValue || undefined);
            }}
            style={toolbarControlStyle}
          />
          <Select
            allowClear
            placeholder="角色"
            options={roleOptions}
            value={role}
            onChange={(value) => {
              setPage(1);
              setRole(value);
              setTask(undefined);
            }}
            style={toolbarControlStyle}
          />
          <Select
            allowClear
            placeholder="任务"
            options={CONTACT_TASK_OPTIONS}
            value={task}
            onChange={(value) => {
              setPage(1);
              setTask(value);
              setRole(undefined);
            }}
            style={toolbarControlStyle}
          />
        </Space>
        <Table<ContactOut>
          rowKey="id"
          loading={listLoading}
          columns={[
            {
              title: '主体信息',
              dataIndex: 'name',
              width: 320,
              render: (_value, record) => {
                const businessInfo = getContactBusinessInfo(record);
                return (
                  <Space orientation="vertical" size={2}>
                    <Typography.Text strong>{businessInfo.primary}</Typography.Text>
                    <Typography.Text type="secondary">{businessInfo.secondary}</Typography.Text>
                  </Space>
                );
              },
            },
            { title: '角色', dataIndex: 'roles', width: 180, render: (_roles, record) => (record.roles || []).map((role: string, index: number) => <Tag key={role}>{record.roles__mapping?.[index] || roleLabel(role)}</Tag>) },
            { title: '业务阶段', dataIndex: 'stage', width: 180, render: (_value, record) => <Typography.Text strong>{getContactStageText(record)}</Typography.Text> },
            { title: '状态', dataIndex: 'is_active', width: 110, render: (value) => (value === false ? <Tag>停用</Tag> : <Tag color="green">启用</Tag>) },
            { title: '跟进建议', dataIndex: 'queue_hint', render: (_value, record) => <Typography.Text type="secondary">{getContactFollowUpHint(record)}</Typography.Text> },
            {
              title: '操作',
              dataIndex: 'actions',
              fixed: 'right',
              width: 220,
              render: (_value, record) => (
                <ResponsiveActions>
                  <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>
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
                    onClick={() => toggleContact.mutate({ id: record.id, is_active: record.is_active === false })}
                  >
                    {record.is_active === false ? '启用' : '停用'}
                  </Button>
                </ResponsiveActions>
              ),
            },
          ]}
          dataSource={contacts.data?.items || []}
          locale={{
            emptyText: getLoadingAwareEmptyState({
              loading: listLoading,
              loadingTitle: '联系人数据加载中',
              loadingDescription: '正在同步房东、租客和客户主体资料。',
              emptyState: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无联系人">
                  <Space wrap>
                    <Button onClick={() => openCreate(CONTACT_ROLE.LANDLORD)}>新建房东</Button>
                    <Button onClick={() => openCreate(CONTACT_ROLE.TENANT)}>新建租客</Button>
                    <Button type="primary" onClick={() => openCreate()}>
                      新建联系人
                    </Button>
                  </Space>
                </Empty>
              ),
            }),
          }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: contacts.data?.total || 0, showSizeChanger: false, onChange: setPage }}
          scroll={adminTableScroll}
        />
      </div>
      <Drawer
        title={editing ? '编辑联系人' : '新建联系人'}
        open={drawerOpen}
        size="large"
        onClose={() => {
          setDrawerOpen(false);
          setCreateRolePreset(undefined);
        }}
        destroyOnHidden
        extra={<Button type="primary" htmlType="submit" form="contact-form" loading={saveContact.isPending}>保存</Button>}
      >
        <Form
          key={editing?.id || createRolePreset || 'new'}
          id="contact-form"
          layout="vertical"
          initialValues={editing || { roles: createRolePreset ? [createRolePreset] : [], is_active: true }}
          onFinish={(values) => saveContact.mutate({ ...values, roles: values.roles || [] })}
        >
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="手机" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="角色" name="roles" rules={[{ required: true, message: '请选择角色' }]}>
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
