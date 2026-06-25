import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Button, Col, Drawer, Empty, Form, Input, Row, Select, Space, Statistic, Switch, Table, Tag, Typography, message, theme } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { AdminToolbar, ResponsiveActions, adminTableScroll, toolbarControlStyle } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type ContactOut } from '@/services/manual/house';
import { CONTACT_ROLE, CONTACT_ROLE_OPTIONS } from '../constants';
import { getLoadingAwareEmptyState, getLoadingSafeCount, getLoadingSafeText, isInitialQueryPending } from '../loading';

const ROLE_TEXT = Object.fromEntries(CONTACT_ROLE_OPTIONS.map((item) => [item.value, item.label]));
const CONTACT_TASK_OPTIONS = [
  { value: 'dual_role', label: '双角色待确认' },
  { value: 'inactive', label: '停用联系人' },
  { value: 'role_missing', label: '缺角色主体' },
];
const CONTACT_TASK_TEXT = Object.fromEntries(CONTACT_TASK_OPTIONS.map((item) => [item.value, item.label]));
const PAGE_SIZE = 20;

type ContactClosureSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  href: string;
};

function dashboardHref(path: string) {
  return `/dashboard${path}`;
}

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

function getContactPageSuggestion(contacts: ContactOut[], filters: { role?: string; task?: string; q?: string }) {
  const { role, task, q } = filters;
  const inactiveCount = contacts.filter((item) => item.is_active === false).length;
  const dualRoleCount = contacts.filter((item) => hasRole(item, CONTACT_ROLE.LANDLORD) && hasRole(item, CONTACT_ROLE.TENANT)).length;
  const missingRoleCount = contacts.filter(hasMissingRole).length;
  const landlordCount = contacts.filter((item) => hasRole(item, CONTACT_ROLE.LANDLORD)).length;
  const tenantCount = contacts.filter((item) => hasRole(item, CONTACT_ROLE.TENANT)).length;
  if (task === 'dual_role') return '当前只看双角色主体，优先确认这次业务到底以房东还是租客身份流转。';
  if (task === 'inactive') return '当前只看停用联系人，恢复前先确认是否还会进入新的房源、带看或签约流程。';
  if (task === 'role_missing') return '当前只看缺角色主体，先补齐房东或租客身份，再推进业务录入。';
  if (role === CONTACT_ROLE.LANDLORD) {
    if (inactiveCount > 0 || dualRoleCount > 0) return '当前房东范围内仍有停用或双角色主体，录入房源前先确认应使用的业务身份。';
    return '当前只看房东档案，优先核对是否能直接关联房源主体。';
  }
  if (role === CONTACT_ROLE.TENANT) {
    if (inactiveCount > 0 || dualRoleCount > 0) return '当前租客范围内仍有停用或双角色主体，带看和签约前先确认应使用的业务身份。';
    return '当前只看租客档案，优先核对是否能直接承接带看与签约。';
  }
  if (q) return '当前结果用于快速核对联系人主体、角色和是否仍参与新业务流程。';
  if (missingRoleCount > 0) return '优先补齐缺角色主体，再清理停用联系人和双角色身份，避免后续业务挂错对象。';
  if (inactiveCount > 0 || dualRoleCount > 0) {
    return '优先清理停用联系人，并明确房东/租客角色，避免业务流转时找不到主体。';
  }
  if (!landlordCount) return '先补房东档案，避免房源登记后无法关联出租主体。';
  if (!tenantCount) return '先补租客档案，避免带看和签约线索只能落在临时记录里。';
  return '保持联系人主体清晰，房源、带看和签约才能稳定闭环。';
}

function getContactScopeText(role?: string, q?: string, task?: string) {
  const parts: string[] = [];
  if (task) parts.push(`队列：${CONTACT_TASK_TEXT[task] || task}`);
  if (role) parts.push(`角色：${ROLE_TEXT[role] || role}`);
  if (q) parts.push(`搜索：${q}`);
  return parts.join(' / ');
}

function buildContactQueueHref(filters: { role?: string; task?: string }) {
  const params = new URLSearchParams();
  if (filters.role) params.set('role', filters.role);
  if (filters.task) params.set('task', filters.task);
  const search = params.toString();
  return `/property-rental/contacts${search ? `?${search}` : ''}`;
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
    q: params.get('q') || undefined,
    role: params.get('role') || undefined,
    task: params.get('task') || undefined,
  };
}

function syncContactListSearch(filters: { page: number; q?: string; role?: string; task?: string }) {
  const params = new URLSearchParams();
  if (filters.task) params.set('task', filters.task);
  if (filters.role) params.set('role', filters.role);
  if (filters.q) params.set('q', filters.q);
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
  const baseContacts = useQuery({
    queryKey: ['house', 'contacts', 'base-overview', workspace.selectedOrgSlug, q],
    queryFn: () => houseApi.listContacts({ page: 1, page_size: 100, q }),
    enabled,
  });
  const overviewContacts = useQuery({
    queryKey: ['house', 'contacts', 'overview', workspace.selectedOrgSlug, q, role, task],
    queryFn: () => houseApi.listContacts({ page: 1, page_size: 100, q, role, task }),
    enabled,
  });
  const contacts = useQuery({
    queryKey: ['house', 'contacts', workspace.selectedOrgSlug, page, q, role, task],
    queryFn: () => houseApi.listContacts({ page, page_size: PAGE_SIZE, q, role, task }),
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
  const activeLandlordCount = baseContactRows.filter((item) => item.is_active !== false && hasRole(item, CONTACT_ROLE.LANDLORD)).length;
  const activeTenantCount = baseContactRows.filter((item) => item.is_active !== false && hasRole(item, CONTACT_ROLE.TENANT)).length;
  const scopeText = getContactScopeText(role, q, task);
  const scopedOverview = Boolean(scopeText);
  const scopedOverviewCards = getContactScopedOverviewCards(contactOverviewRows, { role, task, q });
  const overviewLoading = scopedOverview ? isInitialQueryPending(overviewContacts) : isInitialQueryPending(baseContacts);
  const queueLoading = isInitialQueryPending(baseContacts);
  const listLoading = isInitialQueryPending(contacts);
  const pageSuggestion = overviewLoading ? '正在汇总联系人数据，请稍候再判断主体治理优先级。' : getContactPageSuggestion(contactOverviewRows, { role, task, q });
  const activeQueue = task || role || 'all';
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

  useEffect(() => {
    syncContactListSearch({ page, q, role, task });
  }, [page, q, role, task]);

  const applyQueue = (queue: string) => {
    setPage(1);
    if (queue === 'all') {
      setRole(undefined);
      setTask(undefined);
      return;
    }
    if (queue === CONTACT_ROLE.LANDLORD || queue === CONTACT_ROLE.TENANT) {
      setRole(queue);
      setTask(undefined);
      return;
    }
    setRole(undefined);
    setTask(queue);
  };

  const createActions = [
    { key: 'landlord', label: '新建房东', role: CONTACT_ROLE.LANDLORD },
    { key: 'tenant', label: '新建租客', role: CONTACT_ROLE.TENANT },
    { key: 'all', label: '新建联系人', role: undefined },
  ];
  const queueButtons = [
    { key: 'all', label: '全部', count: baseContactRows.length, active: activeQueue === 'all' },
    { key: CONTACT_ROLE.LANDLORD, label: '房东档案', count: landlordCount, active: activeQueue === CONTACT_ROLE.LANDLORD },
    { key: CONTACT_ROLE.TENANT, label: '租客档案', count: tenantCount, active: activeQueue === CONTACT_ROLE.TENANT },
    { key: 'dual_role', label: '双角色待确认', count: dualRoleCount, active: activeQueue === 'dual_role' },
    { key: 'inactive', label: '停用联系人', count: inactiveCount, active: activeQueue === 'inactive' },
    { key: 'role_missing', label: '缺角色主体', count: roleMissingCount, active: activeQueue === 'role_missing' },
  ] as const;
  const visibleQueueButtons = queueButtons.filter((item) => item.count > 0 || item.active);
  const hiddenQueueCount = queueButtons.length - visibleQueueButtons.length;
  const closureSignals: ContactClosureSignal[] = [
    {
      key: 'landlord',
      title: '房东供给',
      emphasis: activeLandlordCount > 0 ? '可承接建档' : landlordCount > 0 ? '先启用主体' : '先补房东',
      summary: `${landlordCount} 个房东档案 / ${activeLandlordCount} 个可登记房源`,
      description: '房东主体清楚，房源建档、资料补齐和发布挂接才不会断在第一步。',
      actionLabel: '进入房东供给台账',
      href: dashboardHref(buildContactQueueHref({ role: CONTACT_ROLE.LANDLORD })),
    },
    {
      key: 'tenant',
      title: '租客承接',
      emphasis: activeTenantCount > 0 ? '可承接带看' : tenantCount > 0 ? '先启用主体' : '先补租客',
      summary: `${tenantCount} 个租客档案 / ${activeTenantCount} 个可登记带看`,
      description: '租客主体稳定，带看转签约时才不会因为联系人不清楚而中途卡住。',
      actionLabel: '进入租客承接台账',
      href: dashboardHref(buildContactQueueHref({ role: CONTACT_ROLE.TENANT })),
    },
    {
      key: 'dual_role',
      title: '双角色治理',
      emphasis: dualRoleCount > 0 ? '先确认身份' : '身份清晰',
      summary: `${dualRoleCount} 个双角色待确认`,
      description: '同一主体兼具房东和租客身份时，推进业务前要先明确这次到底在用哪一个角色。',
      actionLabel: '进入双角色治理队列',
      href: dashboardHref(buildContactQueueHref({ task: 'dual_role' })),
    },
    ...(roleMissingCount > 0
      ? [{
          key: 'role_missing',
          title: '角色补齐',
          emphasis: '先补角色',
          summary: `${roleMissingCount} 个缺角色主体`,
          description: '联系人未标明房东或租客身份时，房源、带看和签约都无法稳定挂接到正确主体。',
          actionLabel: '进入角色补齐队列',
          href: dashboardHref(buildContactQueueHref({ task: 'role_missing' })),
        } satisfies ContactClosureSignal]
      : []),
    {
      key: 'inactive',
      title: '停用清理',
      emphasis: inactiveCount > 0 ? '先做清理' : '停用稳定',
      summary: `${inactiveCount} 个停用联系人`,
      description: '停用主体要尽早收口，避免新房源、带看和签约误挂到不可用对象上。',
      actionLabel: '进入停用清理队列',
      href: dashboardHref(buildContactQueueHref({ task: 'inactive' })),
    },
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
          <Typography.Text strong>联系人治理队列</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary">先处理双角色、停用和缺角色主体，再把房源、带看和签约挂到稳定可用的业务对象上。</Typography.Text>
          </div>
        </div>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            {visibleQueueButtons.map((item) => (
              <Button
                key={item.key}
                type={item.active ? 'primary' : 'default'}
                onClick={() => applyQueue(item.key)}
              >
                {`${item.label} ${getLoadingSafeCount(item.count, queueLoading)}`}
              </Button>
            ))}
          </Space>
          {hiddenQueueCount > 0 ? (
            <Typography.Text type="secondary">已收起 {hiddenQueueCount} 个 0 项，避免把空队列和关键治理项放在同一层级。</Typography.Text>
          ) : null}
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          {getLoadingSafeText('先把双角色、停用和缺角色主体处理干净，后续房源、带看和签约才不会挂错业务对象。', '正在整理联系人治理队列...', queueLoading)}
        </Typography.Paragraph>
      </div>

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, width: '100%', marginBottom: 16 }}>
          <div>
            <Typography.Text strong>联系人业务台账</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Typography.Text type="secondary">沉淀房东、租客和双角色主体，给房源、带看和租约提供可复用的业务对象。</Typography.Text>
            </div>
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
            options={CONTACT_ROLE_OPTIONS}
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
            placeholder="治理队列"
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
            { title: '角色', dataIndex: 'roles', width: 180, render: (roles = []) => roles.map((role: string) => <Tag key={role}>{ROLE_TEXT[role] || role}</Tag>) },
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
            <Select mode="multiple" options={CONTACT_ROLE_OPTIONS} />
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
