import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Col, Drawer, Empty, Form, Input, Row, Segmented, Select, Space, Statistic, Switch, Table, Tag, Typography, message, theme } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveActions, SectionHeader, adminTableScroll, fixedPagePagination, toolbarControlStyle } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type BuildingOut, type EstateOut } from '@/services/manual/house';
import { enumMapping, enumSelectOptions, useEnums } from '@/services/manual/enums';
import { getLoadingAwareEmptyState, getLoadingSafeCount, isAnyInitialQueryPending, isInitialQueryPending } from '../loading';

const PAGE_SIZE = 20;
type EstateViewMode = 'all' | 'estates' | 'buildings';
type EstateTask = 'estate_address' | 'building_address' | 'no_building' | 'inactive';
type EstateDrawerState = {
  estateEditId?: number;
  buildingEditId?: number;
  buildingCreateEstateId?: number;
};

type EstateOverviewCard = {
  key: string;
  title: string;
  value: number;
};

function getEstateBuildings(buildings: BuildingOut[], estateId: number) {
  return buildings.filter((item) => item.estate_id === estateId);
}

function getEstateCoverageText(estate: EstateOut, buildings: BuildingOut[]) {
  const estateBuildings = getEstateBuildings(buildings, estate.id);
  if (!estateBuildings.length) return '0 栋 / 待补楼栋';
  const activeCount = estateBuildings.filter((item) => item.is_active !== false).length;
  return `${estateBuildings.length} 栋 / ${activeCount} 栋启用`;
}

function getEstateRegisterHint(estate: EstateOut, buildings: BuildingOut[]) {
  const estateBuildings = getEstateBuildings(buildings, estate.id);
  if (estate.is_active === false) return '停用中，暂停新增房源';
  if (!estate.address) return '缺项目地址，先补基础资料';
  if (!estateBuildings.length) return '先补楼栋，再开始建房源';
  if (estateBuildings.some((item) => item.is_active === false)) return '先清理停用楼栋，再安排新房源';
  return '基础资料齐全，可继续建房源';
}

function getBuildingSupplyText(building: BuildingOut) {
  if (building.elevator) return '有电梯，可优先承接高层房源';
  if ((building.floors || 0) >= 10) return '无电梯高楼层，建档时注意居住体验';
  return '无电梯，适合低楼层房源';
}

function getBuildingRegisterHint(building: BuildingOut) {
  if (!building.address) return '缺地址，先补楼栋资料';
  if (building.is_active === false) return '停用中，暂停新增房源';
  return '基础可用，可开始建房源';
}

function getEstateTaskLabel(task?: EstateTask) {
  if (task === 'estate_address') return '待补项目地址';
  if (task === 'building_address') return '待补楼栋地址';
  if (task === 'no_building') return '待补首栋楼';
  if (task === 'inactive') return '停用资产';
  return '';
}

function getEstateFocusedActionCopy(task: EstateTask | undefined, drawerState: EstateDrawerState) {
  if (task === 'estate_address' && drawerState.estateEditId) {
    return {
      title: '当前操作：补齐项目地址',
      description: '当前入口来自待补项目地址队列，先补项目底座地址，再继续维护楼栋和房源。',
    };
  }
  if (task === 'building_address' && drawerState.buildingEditId) {
    return {
      title: '当前操作：补齐楼栋地址',
      description: '当前入口来自待补楼栋地址队列，先补楼栋地址，再继续登记房源。',
    };
  }
  if (task === 'no_building' && drawerState.buildingCreateEstateId) {
    return {
      title: '当前操作：为项目补首栋楼',
      description: '当前入口来自待补首栋楼队列，先为项目补齐第一栋可用楼栋，再继续登记房源。',
    };
  }
  return {};
}

function getEstateScopeText(options: { q?: string; task?: EstateTask }) {
  if (options.task) return getEstateTaskLabel(options.task);
  return options.q ? `搜索：${options.q}` : '';
}

function getEstateDrawerStateFromSearch(search: string): EstateDrawerState {
  const params = new URLSearchParams(search);
  return {
    estateEditId: Number(params.get('estate_edit')) || undefined,
    buildingEditId: Number(params.get('building_edit')) || undefined,
    buildingCreateEstateId: Number(params.get('building_create')) || undefined,
  };
}

function syncEstateDrawerSearch(drawerState: EstateDrawerState) {
  const params = new URLSearchParams(window.location.search);
  params.delete('estate_edit');
  params.delete('building_edit');
  params.delete('building_create');
  if (drawerState.estateEditId) params.set('estate_edit', String(drawerState.estateEditId));
  if (drawerState.buildingEditId) params.set('building_edit', String(drawerState.buildingEditId));
  if (drawerState.buildingCreateEstateId) params.set('building_create', String(drawerState.buildingCreateEstateId));
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function getEstateListHref(filters: { estatePage: number; buildingPage: number; q?: string; view: EstateViewMode; task?: EstateTask }) {
  const params = new URLSearchParams();
  if (filters.q) params.set('keyword', filters.q);
  if (filters.task) params.set('task', filters.task);
  const taskView = getTaskViewMode(filters.task, 'all');
  if (filters.view !== 'all' && filters.view !== taskView) params.set('view', filters.view);
  if (filters.estatePage > 1) params.set('estate_page', String(filters.estatePage));
  if (filters.buildingPage > 1) params.set('building_page', String(filters.buildingPage));
  const nextSearch = params.toString();
  return `/dashboard/property-rental/estates${nextSearch ? `?${nextSearch}` : ''}`;
}

function estateMatchesTask(estate: EstateOut, buildings: BuildingOut[], task?: EstateTask) {
  if (task === 'estate_address') return !estate.address;
  if (task === 'no_building') return getEstateBuildings(buildings, estate.id).length === 0;
  if (task === 'inactive') return estate.is_active === false;
  return true;
}

function buildingMatchesTask(building: BuildingOut, task?: EstateTask) {
  if (task === 'building_address') return !building.address;
  if (task === 'inactive') return building.is_active === false;
  return true;
}

function getTaskViewMode(task: EstateTask | undefined, fallback: EstateViewMode) {
  if (task === 'estate_address' || task === 'no_building') return 'estates';
  if (task === 'building_address') return 'buildings';
  return fallback;
}

function getEstateScopedOverviewCards(options: {
  estateRows: EstateOut[];
  buildingRows: BuildingOut[];
  task?: EstateTask;
  q?: string;
}) {
  const { estateRows, buildingRows, q, task } = options;
  const inactiveEstateCount = estateRows.filter((item) => item.is_active === false).length;
  const inactiveBuildingCount = buildingRows.filter((item) => item.is_active === false).length;
  const estateAddressMissingCount = estateRows.filter((item) => !item.address).length;
  const buildingAddressMissingCount = buildingRows.filter((item) => !item.address).length;
  const noBuildingCount = estateRows.filter((item) => getEstateBuildings(buildingRows, item.id).length === 0).length;

  if (task === 'estate_address') {
    return [
      { key: 'estate_address_scope', title: '当前待补项目地址', value: estateRows.length },
      { key: 'estate_address_has_building', title: '已有楼栋覆盖', value: estateRows.filter((item) => getEstateBuildings(buildingRows, item.id).length > 0).length },
      { key: 'estate_address_no_building', title: '待补首栋楼', value: noBuildingCount },
      { key: 'estate_address_active', title: '仍在启用', value: estateRows.filter((item) => item.is_active !== false).length },
    ] satisfies EstateOverviewCard[];
  }

  if (task === 'building_address') {
    return [
      { key: 'building_address_scope', title: '当前待补楼栋地址', value: buildingRows.length },
      { key: 'building_address_estates', title: '涉及项目', value: new Set(buildingRows.map((item) => item.estate_id)).size },
      { key: 'building_address_active', title: '仍在启用', value: buildingRows.filter((item) => item.is_active !== false).length },
      { key: 'building_address_inactive', title: '已停用', value: inactiveBuildingCount },
    ] satisfies EstateOverviewCard[];
  }

  if (task === 'no_building') {
    return [
      { key: 'no_building_scope', title: '当前待补首栋楼', value: estateRows.length },
      { key: 'no_building_ready_address', title: '项目地址已齐', value: estateRows.filter((item) => Boolean(item.address)).length },
      { key: 'no_building_missing_address', title: '待补项目地址', value: estateAddressMissingCount },
      { key: 'no_building_active', title: '仍在启用', value: estateRows.filter((item) => item.is_active !== false).length },
    ] satisfies EstateOverviewCard[];
  }

  if (task === 'inactive') {
    return [
      { key: 'inactive_estates', title: '停用项目', value: inactiveEstateCount },
      { key: 'inactive_buildings', title: '停用楼栋', value: inactiveBuildingCount },
      { key: 'inactive_estate_address', title: '待补项目地址', value: estateAddressMissingCount },
      { key: 'inactive_building_address', title: '待补楼栋地址', value: buildingAddressMissingCount },
    ] satisfies EstateOverviewCard[];
  }

  if (q) {
    return [
      { key: 'search_estates', title: '当前项目', value: estateRows.length },
      { key: 'search_buildings', title: '当前楼栋', value: buildingRows.length },
      { key: 'search_missing', title: '资料缺口', value: estateAddressMissingCount + buildingAddressMissingCount + noBuildingCount },
      { key: 'search_inactive', title: '停用资产', value: inactiveEstateCount + inactiveBuildingCount },
    ] satisfies EstateOverviewCard[];
  }

  return [
    { key: 'estate_address', title: '待补项目地址', value: estateAddressMissingCount },
    { key: 'building_address', title: '待补楼栋地址', value: buildingAddressMissingCount },
    { key: 'no_building', title: '待补首栋楼', value: noBuildingCount },
    { key: 'inactive_assets', title: '停用资产', value: inactiveEstateCount + inactiveBuildingCount },
  ] satisfies EstateOverviewCard[];
}

function getEstateListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const estatePageValue = Number(params.get('estate_page') || '1');
  const buildingPageValue = Number(params.get('building_page') || '1');
  const view = params.get('view');
  const task = params.get('task');
  return {
    estatePage: Number.isFinite(estatePageValue) && estatePageValue > 0 ? estatePageValue : 1,
    buildingPage: Number.isFinite(buildingPageValue) && buildingPageValue > 0 ? buildingPageValue : 1,
    q: params.get('keyword') || undefined,
    view: view === 'estates' || view === 'buildings' ? view : 'all',
    task: task === 'estate_address' || task === 'building_address' || task === 'no_building' || task === 'inactive' ? task : undefined,
  } satisfies { estatePage: number; buildingPage: number; q?: string; view: EstateViewMode; task?: EstateTask };
}

function syncEstateListSearch(filters: { estatePage: number; buildingPage: number; q?: string; view: EstateViewMode; task?: EstateTask }) {
  const params = new URLSearchParams(window.location.search);
  params.delete('keyword');
  params.delete('task');
  params.delete('view');
  params.delete('estate_page');
  params.delete('building_page');
  if (filters.q) params.set('keyword', filters.q);
  if (filters.task) params.set('task', filters.task);
  const taskView = getTaskViewMode(filters.task, 'all');
  if (filters.view !== 'all' && filters.view !== taskView) params.set('view', filters.view);
  if (filters.estatePage > 1) params.set('estate_page', String(filters.estatePage));
  if (filters.buildingPage > 1) params.set('building_page', String(filters.buildingPage));
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

type EstateFormValues = {
  name: string;
  display_name: string;
  property_type: string;
  province: string;
  city: string;
  district: string;
  address?: string;
  is_active?: boolean;
};

type BuildingFormValues = {
  estate_id: number;
  name: string;
  floors: number;
  elevator?: boolean;
  address?: string;
  is_active?: boolean;
};

const EstatesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialListState = useRef(getEstateListStateFromSearch(window.location.search));
  const initialDrawerState = useRef(getEstateDrawerStateFromSearch(window.location.search));
  const [estatePage, setEstatePage] = useState(initialListState.current.estatePage);
  const [buildingPage, setBuildingPage] = useState(initialListState.current.buildingPage);
  const [q, setQ] = useState<string | undefined>(initialListState.current.q);
  const [searchDraft, setSearchDraft] = useState(initialListState.current.q || '');
  const [viewMode, setViewMode] = useState<EstateViewMode>(initialListState.current.view);
  const [task, setTask] = useState<EstateTask | undefined>(initialListState.current.task);
  const [drawerState, setDrawerState] = useState<EstateDrawerState>(initialDrawerState.current);
  const [editingEstate, setEditingEstate] = useState<EstateOut | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<BuildingOut | null>(null);
  const [draftBuildingEstateId, setDraftBuildingEstateId] = useState<number>();
  const [estateOpen, setEstateOpen] = useState(false);
  const [buildingOpen, setBuildingOpen] = useState(false);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseEnums = useEnums(['house.estate_property_type']);
  const estates = useQuery({ queryKey: ['house', 'estates', workspace.selectedOrgSlug, estatePage, q], queryFn: () => houseApi.listEstates({ page: estatePage, page_size: PAGE_SIZE, keyword: q }), enabled });
  const allEstates = useQuery({
    queryKey: ['house', 'estates', 'all', workspace.selectedOrgSlug, q],
    queryFn: () => houseApi.listEstates({ page: 1, page_size: 100, keyword: q }),
    enabled,
  });
  const buildings = useQuery({ queryKey: ['house', 'buildings', workspace.selectedOrgSlug, buildingPage, q], queryFn: () => houseApi.listBuildings({ page: buildingPage, page_size: PAGE_SIZE, keyword: q }), enabled });
  const allBuildings = useQuery({
    queryKey: ['house', 'buildings', 'all', workspace.selectedOrgSlug, q],
    queryFn: () => houseApi.listBuildings({ page: 1, page_size: 100, keyword: q }),
    enabled,
  });
  const saveEstate = useMutation({
    mutationFn: (values: EstateFormValues) => (editingEstate ? houseApi.patchEstate(editingEstate.id, values) : houseApi.createEstate(values)),
    onSuccess: async () => {
      message.success(editingEstate ? '项目已更新' : '项目已创建');
      setEstateOpen(false);
      setEditingEstate(null);
      setDrawerState((current) => ({ ...current, estateEditId: undefined }));
      syncEstateDrawerSearch({ ...drawerState, estateEditId: undefined });
      await queryClient.invalidateQueries({ queryKey: ['house', 'estates'] });
    },
  });
  const saveBuilding = useMutation({
    mutationFn: (values: BuildingFormValues) => {
      const payload = { ...values, floors: Number(values.floors) };
      return editingBuilding ? houseApi.patchBuilding(editingBuilding.id, payload) : houseApi.createBuilding(payload);
    },
    onSuccess: async () => {
      message.success(editingBuilding ? '楼栋已更新' : '楼栋已创建');
      setBuildingOpen(false);
      setEditingBuilding(null);
      setDraftBuildingEstateId(undefined);
      setDrawerState((current) => ({ ...current, buildingEditId: undefined, buildingCreateEstateId: undefined }));
      syncEstateDrawerSearch({ ...drawerState, buildingEditId: undefined, buildingCreateEstateId: undefined });
      await queryClient.invalidateQueries({ queryKey: ['house', 'buildings'] });
    },
  });

  const updateDrawerState = (nextState: EstateDrawerState) => {
    syncEstateDrawerSearch(nextState);
    setDrawerState(nextState);
  };
  const clearDrawerState = () => updateDrawerState({});

  const openEstateCreate = () => {
    setEditingEstate(null);
    setEstateOpen(true);
    clearDrawerState();
  };

  const openEstateEdit = (record: EstateOut) => {
    setEditingEstate(record);
    setEstateOpen(true);
    updateDrawerState({ estateEditId: record.id });
  };

  const openBuildingCreate = (estateId?: number) => {
    setEditingBuilding(null);
    setDraftBuildingEstateId(estateId);
    setBuildingOpen(true);
    updateDrawerState({ buildingCreateEstateId: estateId });
  };

  const openBuildingEdit = (record: BuildingOut) => {
    setDraftBuildingEstateId(undefined);
    setEditingBuilding(record);
    setBuildingOpen(true);
    updateDrawerState({ buildingEditId: record.id });
  };

  const closeEstateDrawer = () => {
    setEstateOpen(false);
    setEditingEstate(null);
    clearDrawerState();
  };

  const closeBuildingDrawer = () => {
    setBuildingOpen(false);
    setEditingBuilding(null);
    setDraftBuildingEstateId(undefined);
    clearDrawerState();
  };

  const estateInitialValues: Partial<EstateFormValues> = editingEstate || { property_type: 'residential', is_active: true };
  const buildingInitialValues: Partial<BuildingFormValues> = editingBuilding || { estate_id: draftBuildingEstateId || allEstates.data?.items?.[0]?.id, floors: 1, elevator: false, is_active: true };
  const estateOverviewRows = allEstates.data?.items || estates.data?.items || [];
  const buildingOverviewRows = allBuildings.data?.items || buildings.data?.items || [];
  const filteredEstateOverviewRows = estateOverviewRows.filter((item) => estateMatchesTask(item, buildingOverviewRows, task));
  const filteredBuildingOverviewRows = buildingOverviewRows.filter((item) => buildingMatchesTask(item, task));
  const estateTableBaseRows = task ? estateOverviewRows : (estates.data?.items || []);
  const buildingTableBaseRows = task ? buildingOverviewRows : (buildings.data?.items || []);
  const estateRows = estateTableBaseRows.filter((item) => estateMatchesTask(item, buildingOverviewRows, task));
  const buildingRows = buildingTableBaseRows.filter((item) => buildingMatchesTask(item, task));
  const effectiveViewMode = getTaskViewMode(task, viewMode);
  const scopeText = getEstateScopeText({ q, task });
  const scopedOverview = Boolean(scopeText);
  const overviewLoading = isAnyInitialQueryPending([allEstates, allBuildings]);
  const estateListLoading = isInitialQueryPending(estates);
  const buildingListLoading = isInitialQueryPending(buildings);
  const overviewCards = getEstateScopedOverviewCards({
    estateRows: filteredEstateOverviewRows,
    buildingRows: filteredBuildingOverviewRows,
    q,
    task,
  });
  const focusedAction = getEstateFocusedActionCopy(task, drawerState);
  const estateTotal = task ? estateRows.length : estates.data?.total || 0;
  const buildingTotal = task ? buildingRows.length : buildings.data?.total || 0;
  const propertyTypeOptions = enumSelectOptions(houseEnums.data, 'house.estate_property_type');
  const visibleEstateViewCount = task ? filteredEstateOverviewRows.length : estateOverviewRows.length;
  const visibleBuildingViewCount = task ? filteredBuildingOverviewRows.length : buildingOverviewRows.length;
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
    syncEstateListSearch({ estatePage, buildingPage, q, view: viewMode, task });
  }, [estatePage, buildingPage, q, task, viewMode]);

  useEffect(() => {
    if (!drawerState.estateEditId || editingEstate || estateOpen || !allEstates.isSuccess) return;
    const target = estateOverviewRows.find((item) => item.id === drawerState.estateEditId);
    if (!target) return;
    setEditingEstate(target);
    setEstateOpen(true);
  }, [allEstates.isSuccess, drawerState.estateEditId, editingEstate, estateOpen, estateOverviewRows]);

  useEffect(() => {
    if (editingBuilding || buildingOpen || !allBuildings.isSuccess) return;
    if (drawerState.buildingEditId) {
      const target = buildingOverviewRows.find((item) => item.id === drawerState.buildingEditId);
      if (!target) return;
      setEditingBuilding(target);
      setBuildingOpen(true);
      return;
    }
    if (drawerState.buildingCreateEstateId) {
      setDraftBuildingEstateId(drawerState.buildingCreateEstateId);
      setBuildingOpen(true);
    }
  }, [allBuildings.isSuccess, buildingOpen, buildingOverviewRows, drawerState.buildingCreateEstateId, drawerState.buildingEditId, editingBuilding]);

  useEffect(() => {
    const handlePopState = () => {
      const listState = getEstateListStateFromSearch(window.location.search);
      setEstatePage(listState.estatePage);
      setBuildingPage(listState.buildingPage);
      setQ(listState.q);
      setSearchDraft(listState.q || '');
      setViewMode(listState.view);
      setTask(listState.task);
      setDrawerState(getEstateDrawerStateFromSearch(window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <TenantSelectionGuard title="项目楼栋">
      <div style={sectionStyle}>
        <Typography.Text strong>{scopedOverview ? '当前筛选概览' : '项目供给概览'}</Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {overviewCards.map((item) => (
            <Col key={item.key} xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title={item.title} value={getLoadingSafeCount(item.value, overviewLoading)} />
              </div>
            </Col>
          ))}
        </Row>
      </div>

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <SectionHeader
          title="基础资料视图"
          actions={
            <Segmented
              options={[
                { label: '全部', value: 'all' },
                { label: '项目台账', value: 'estates' },
                { label: '楼栋台账', value: 'buildings' },
              ]}
              value={effectiveViewMode}
              onChange={(value) => setViewMode(value as EstateViewMode)}
            />
          }
        />
        <Space wrap size={[16, 8]}>
          <Tag color={effectiveViewMode === 'all' ? 'blue' : 'default'}>{`项目 ${getLoadingSafeCount(visibleEstateViewCount, overviewLoading)}`}</Tag>
          <Tag color={effectiveViewMode === 'all' ? 'blue' : 'default'}>{`楼栋 ${getLoadingSafeCount(visibleBuildingViewCount, overviewLoading)}`}</Tag>
        </Space>
      </div>

      {scopeText ? (
        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space orientation="vertical" size={4}>
              <Typography.Text strong>{`当前只看：${scopeText}`}</Typography.Text>
            </Space>
            <Button size="small" href={getEstateListHref({ estatePage: 1, buildingPage: 1, view: viewMode })}>查看全部</Button>
          </Space>
        </div>
      ) : null}

      <Space wrap style={{ margin: '16px 0' }}>
        <Input.Search
          allowClear
          placeholder="项目 / 楼栋名称"
          value={searchDraft}
          onChange={(event) => {
            const nextValue = event.target.value;
            setSearchDraft(nextValue);
            if (!nextValue) {
              setEstatePage(1);
              setBuildingPage(1);
              setQ(undefined);
            }
          }}
          onSearch={(value) => {
            setEstatePage(1);
            setBuildingPage(1);
            const nextValue = value || undefined;
            setSearchDraft(value);
            setQ(nextValue);
          }}
          style={toolbarControlStyle}
        />
      </Space>
      {effectiveViewMode !== 'buildings' ? (
        <div style={sectionStyle}>
        <SectionHeader
          title="项目台账"
          actions={
            <Button type="primary" icon={<PlusOutlined />} onClick={openEstateCreate}>
              新建项目
            </Button>
          }
        />
        <Table<EstateOut>
          rowKey="id"
          loading={estateListLoading}
          columns={[
            { title: '名称', dataIndex: 'display_name', render: (_value, record) => record.display_name || record.name },
            { title: '城市', dataIndex: 'city', render: (_value, record) => `${record.city || '-'} / ${record.district || '-'}` },
            { title: '物业类型', dataIndex: 'property_type__mapping', render: (_value, record) => enumMapping(record.property_type, record.property_type__mapping) },
            { title: '楼栋覆盖', dataIndex: 'coverage', render: (_value, record) => <Typography.Text strong>{getEstateCoverageText(record, buildingOverviewRows)}</Typography.Text> },
            { title: '地址', dataIndex: 'address', render: (value) => value || '-' },
            { title: '建档建议', dataIndex: 'queue_hint', render: (_value, record) => <Typography.Text type="secondary">{getEstateRegisterHint(record, buildingOverviewRows)}</Typography.Text> },
            { title: '状态', dataIndex: 'is_active', render: (value) => (value === false ? <Tag>停用</Tag> : <Tag color="green">启用</Tag>) },
            {
              title: '操作',
              dataIndex: 'actions',
              fixed: 'right',
              render: (_value, record) => (
                <ResponsiveActions>
                  {record.is_active !== false ? (
                    <Button type="link" size="small" onClick={() => openBuildingCreate(record.id)}>
                      {task === 'no_building' && getEstateBuildings(buildingOverviewRows, record.id).length === 0 ? '补首栋楼' : '新建楼栋'}
                    </Button>
                  ) : null}
                  <Button type="link" size="small" onClick={() => openEstateEdit(record)}>
                    {task === 'estate_address' && !record.address ? '补项目地址' : '编辑'}
                  </Button>
                </ResponsiveActions>
              ),
            },
          ]}
          dataSource={estateRows}
          locale={{
            emptyText: getLoadingAwareEmptyState({
              loading: estateListLoading,
              loadingTitle: '项目数据加载中',
              loadingDescription: '正在同步项目底座和地址资料。',
              emptyState: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无项目资料">
                <Button type="primary" onClick={openEstateCreate}>新建项目</Button>
              </Empty>
              ),
            }),
          }}
          pagination={fixedPagePagination(estatePage, PAGE_SIZE, estateTotal, setEstatePage)}
          scroll={adminTableScroll}
        />
      </div>
      ) : null}
      {effectiveViewMode !== 'estates' ? (
        <div style={{ ...sectionStyle, marginTop: 16 }}>
        <SectionHeader
          title="楼栋台账"
          actions={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openBuildingCreate()}>
              新建楼栋
            </Button>
          }
        />
        <Table<BuildingOut>
          rowKey="id"
          loading={buildingListLoading}
          columns={[
            { title: '所属项目', dataIndex: 'estate_name' },
            { title: '名称', dataIndex: 'name' },
            { title: '楼层', dataIndex: 'floors' },
            { title: '供给条件', dataIndex: 'supply', render: (_value, record) => <Typography.Text strong>{getBuildingSupplyText(record)}</Typography.Text> },
            { title: '地址', dataIndex: 'address', render: (value) => value || '-' },
            { title: '当前动作', dataIndex: 'queue_hint', render: (_value, record) => <Typography.Text type="secondary">{getBuildingRegisterHint(record)}</Typography.Text> },
            { title: '状态', dataIndex: 'is_active', render: (value) => (value === false ? <Tag>停用</Tag> : <Tag color="green">启用</Tag>) },
            {
              title: '操作',
              dataIndex: 'actions',
              fixed: 'right',
              render: (_value, record) => (
                <ResponsiveActions>
                  {record.is_active !== false ? <a href={`/dashboard/property-rental/houses/new?building_id=${record.id}`}>登记房源</a> : null}
                  <Button
                    type="link"
                    size="small"
                    onClick={() => openBuildingEdit(record)}
                  >
                    {task === 'building_address' && !record.address ? '补楼栋地址' : '编辑'}
                  </Button>
                </ResponsiveActions>
              ),
            },
          ]}
          dataSource={buildingRows}
          locale={{
            emptyText: getLoadingAwareEmptyState({
              loading: buildingListLoading,
              loadingTitle: '楼栋数据加载中',
              loadingDescription: '正在同步楼栋底座和供给条件。',
              emptyState: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无楼栋资料">
                <Button type="primary" onClick={() => openBuildingCreate()}>新建楼栋</Button>
              </Empty>
              ),
            }),
          }}
          pagination={fixedPagePagination(buildingPage, PAGE_SIZE, buildingTotal, setBuildingPage)}
          scroll={adminTableScroll}
        />
      </div>
      ) : null}
      {focusedAction.title ? (
        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space orientation="vertical" size={4}>
              <Typography.Text strong>{focusedAction.title}</Typography.Text>
              <Typography.Text type="secondary">{focusedAction.description}</Typography.Text>
            </Space>
            <Button size="small" href={getEstateListHref({ estatePage, buildingPage, q, view: viewMode, task })}>返回队列</Button>
          </Space>
        </div>
      ) : null}
      <Drawer title={editingEstate ? '编辑项目' : '新建项目'} open={estateOpen} size="large" onClose={closeEstateDrawer} destroyOnHidden extra={<Button type="primary" htmlType="submit" form="estate-form" loading={saveEstate.isPending}>保存</Button>}>
        <Form
          id="estate-form"
          layout="vertical"
          initialValues={estateInitialValues}
          onFinish={(values) => saveEstate.mutate({ ...values, address: values.address || '', display_name: values.display_name || values.name })}
        >
          <Form.Item label="项目名称" name="name" rules={[{ required: true, message: '请输入项目名称' }]}><Input /></Form.Item>
          <Form.Item label="展示名称" name="display_name"><Input /></Form.Item>
          <Form.Item label="物业类型" name="property_type"><Select options={propertyTypeOptions} /></Form.Item>
          <Form.Item label="省份" name="province" rules={[{ required: true, message: '请输入省份' }]}><Input /></Form.Item>
          <Form.Item label="城市" name="city" rules={[{ required: true, message: '请输入城市' }]}><Input /></Form.Item>
          <Form.Item label="区域" name="district" rules={[{ required: true, message: '请输入区域' }]}><Input /></Form.Item>
          <Form.Item label="地址" name="address" extra="可先留空，后续补齐项目地址。"><Input placeholder="例如：科技园路 1 号（可稍后补）" /></Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Drawer>
      <Drawer
        title={editingBuilding ? '编辑楼栋' : '新建楼栋'}
        open={buildingOpen}
        size="large"
        onClose={closeBuildingDrawer}
        destroyOnHidden
        extra={<Button type="primary" htmlType="submit" form="building-form" loading={saveBuilding.isPending}>保存</Button>}
      >
        <Form id="building-form" layout="vertical" initialValues={buildingInitialValues} onFinish={(values) => saveBuilding.mutate(values)}>
          <Form.Item label="所属项目" name="estate_id" rules={[{ required: true, message: '请选择项目' }]}><Select options={(allEstates.data?.items || []).map((item) => ({ value: item.id, label: item.display_name || item.name }))} /></Form.Item>
          <Form.Item label="楼栋名" name="name" rules={[{ required: true, message: '请输入楼栋名' }]}><Input /></Form.Item>
          <Form.Item label="楼层" name="floors" rules={[{ required: true, message: '请输入楼层' }]}><Input type="number" min={1} /></Form.Item>
          <Form.Item label="电梯" name="elevator" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="地址" name="address"><Input /></Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default EstatesPage;
