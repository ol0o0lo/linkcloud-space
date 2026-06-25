import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Col, Drawer, Empty, Form, Input, Row, Segmented, Select, Space, Statistic, Switch, Table, Tag, Typography, message, theme } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { AdminToolbar, ResponsiveActions, adminTableScroll, toolbarControlStyle } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type BuildingOut, type EstateOut } from '@/services/manual/house';
import { labelOf, PROPERTY_TYPE_OPTIONS } from '../constants';
import { getLoadingAwareEmptyState, getLoadingSafeCount, getLoadingSafeText, isAnyInitialQueryPending, isInitialQueryPending } from '../loading';

const PAGE_SIZE = 20;
type EstateViewMode = 'all' | 'estates' | 'buildings';
type EstateTask = 'estate_address' | 'building_address' | 'no_building' | 'inactive';
type EstateDrawerState = {
  estateEditId?: number;
  buildingEditId?: number;
  buildingCreateEstateId?: number;
};

type EstateClosureSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  href: string;
};

type EstateOverviewCard = {
  key: string;
  title: string;
  value: number;
  hint: string;
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

function getEstateTaskSuggestion(task: EstateTask | undefined) {
  if (task === 'estate_address') {
    return '当前重点补齐项目地址，避免楼栋和房源挂接后继续缺少项目级定位与展示信息。';
  }
  if (task === 'building_address') {
    return '当前重点补齐楼栋地址，避免房源建档后定位、派单和到访导航继续缺底座信息。';
  }
  if (task === 'no_building') {
    return '当前先补齐首栋可用楼栋，再继续录入房源，避免项目台账看起来已就绪但无法真正承接房源。';
  }
  if (task === 'inactive') {
    return '当前先清理停用项目和楼栋，确认是否还应保留历史底座，避免新增房源误挂到停用资产。';
  }
  return undefined;
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
  if (filters.q) params.set('q', filters.q);
  if (filters.task) params.set('task', filters.task);
  const taskView = getTaskViewMode(filters.task, 'all');
  if (filters.view !== 'all' && filters.view !== taskView) params.set('view', filters.view);
  if (filters.estatePage > 1) params.set('estate_page', String(filters.estatePage));
  if (filters.buildingPage > 1) params.set('building_page', String(filters.buildingPage));
  const nextSearch = params.toString();
  return `/dashboard/property-rental/estates${nextSearch ? `?${nextSearch}` : ''}`;
}

function dashboardHref(path: string) {
  return `/dashboard${path}`;
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

function getEstatePageSuggestion(estates: EstateOut[], buildings: BuildingOut[], q?: string, task?: EstateTask) {
  const taskSuggestion = getEstateTaskSuggestion(task);
  if (taskSuggestion) return taskSuggestion;
  const inactiveEstateCount = estates.filter((item) => item.is_active === false).length;
  const inactiveBuildingCount = buildings.filter((item) => item.is_active === false).length;
  const missingAddress = estates.some((item) => !item.address) || buildings.some((item) => !item.address);
  const hasInactive = inactiveEstateCount > 0 || inactiveBuildingCount > 0;
  if (q) {
    if (!estates.length && !buildings.length) return '当前搜索结果为空，可以改搜项目名、楼栋名或回到全量台账继续排查基础资料。';
    if (hasInactive && missingAddress) return '当前结果里同时有停用和资料缺口，先确认是否仍在运营，再补地址与楼栋基础信息。';
    if (hasInactive) return '当前结果里存在停用项目或楼栋，新增房源前先确认是否仍应挂接到这套底座。';
    if (missingAddress) return '当前结果里还有地址缺口，继续建档前先补齐项目和楼栋资料。';
    return '当前结果可直接用于核对项目底座、楼栋覆盖和是否适合继续承接新房源。';
  }
  if (hasInactive && missingAddress) {
    return '优先清理停用项目/楼栋，并补齐项目地址和楼栋资料，避免房源建档时挂到无效基础数据。';
  }
  if (hasInactive) return '优先清理停用项目/楼栋，避免房源建档时挂到无效基础数据。';
  if (missingAddress) return '优先补齐项目地址和楼栋资料，避免房源建档时挂到不完整基础数据。';
  if (!buildings.length) return '先补楼栋底座，再开始批量建房源。';
  return '先维护好项目和楼栋底座，再把新房源挂到稳定的基础资料上。';
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
      { key: 'estate_address_scope', title: '当前待补项目地址', value: estateRows.length, hint: '当前队列内待补项目地址的项目数' },
      { key: 'estate_address_has_building', title: '已有楼栋覆盖', value: estateRows.filter((item) => getEstateBuildings(buildingRows, item.id).length > 0).length, hint: '补完地址后可继续维护楼栋和房源' },
      { key: 'estate_address_no_building', title: '待补首栋楼', value: noBuildingCount, hint: '补完项目地址后仍需继续补齐首栋楼' },
      { key: 'estate_address_active', title: '仍在启用', value: estateRows.filter((item) => item.is_active !== false).length, hint: '启用项目更应优先补齐底座资料' },
    ] satisfies EstateOverviewCard[];
  }

  if (task === 'building_address') {
    return [
      { key: 'building_address_scope', title: '当前待补楼栋地址', value: buildingRows.length, hint: '当前队列内待补楼栋地址的楼栋数' },
      { key: 'building_address_estates', title: '涉及项目', value: new Set(buildingRows.map((item) => item.estate_id)).size, hint: '需要同步核对这些项目下的房源挂接' },
      { key: 'building_address_active', title: '仍在启用', value: buildingRows.filter((item) => item.is_active !== false).length, hint: '启用楼栋补完地址后可继续登记房源' },
      { key: 'building_address_inactive', title: '已停用', value: inactiveBuildingCount, hint: '停用楼栋先确认是否仍需保留历史底座' },
    ] satisfies EstateOverviewCard[];
  }

  if (task === 'no_building') {
    return [
      { key: 'no_building_scope', title: '当前待补首栋楼', value: estateRows.length, hint: '当前仍无法真正承接房源的项目数' },
      { key: 'no_building_ready_address', title: '项目地址已齐', value: estateRows.filter((item) => Boolean(item.address)).length, hint: '这些项目可直接先补首栋楼' },
      { key: 'no_building_missing_address', title: '待补项目地址', value: estateAddressMissingCount, hint: '补首栋楼前还需先补项目地址' },
      { key: 'no_building_active', title: '仍在启用', value: estateRows.filter((item) => item.is_active !== false).length, hint: '启用项目要优先完成首栋覆盖' },
    ] satisfies EstateOverviewCard[];
  }

  if (task === 'inactive') {
    return [
      { key: 'inactive_estates', title: '停用项目', value: inactiveEstateCount, hint: '需确认是否仍保留这类项目底座' },
      { key: 'inactive_buildings', title: '停用楼栋', value: inactiveBuildingCount, hint: '停用楼栋不应继续承接新增房源' },
      { key: 'inactive_estate_address', title: '待补项目地址', value: estateAddressMissingCount, hint: '若要恢复运营，项目地址仍需补齐' },
      { key: 'inactive_building_address', title: '待补楼栋地址', value: buildingAddressMissingCount, hint: '若要恢复运营，楼栋地址仍需补齐' },
    ] satisfies EstateOverviewCard[];
  }

  if (q) {
    return [
      { key: 'search_estates', title: '当前项目', value: estateRows.length, hint: '关键字命中的项目数' },
      { key: 'search_buildings', title: '当前楼栋', value: buildingRows.length, hint: '关键字命中的楼栋数' },
      { key: 'search_missing', title: '资料缺口', value: estateAddressMissingCount + buildingAddressMissingCount + noBuildingCount, hint: '搜索结果里仍待处理的地址或首栋缺口' },
      { key: 'search_inactive', title: '停用资产', value: inactiveEstateCount + inactiveBuildingCount, hint: '搜索结果里需要确认是否继续运营的资产' },
    ] satisfies EstateOverviewCard[];
  }

  return [
    { key: 'estate_address', title: '待补项目地址', value: estateAddressMissingCount, hint: '项目地址不完整会持续影响楼栋和房源挂接' },
    { key: 'building_address', title: '待补楼栋地址', value: buildingAddressMissingCount, hint: '楼栋地址不完整时，房源定位和带看导航都会受影响' },
    { key: 'no_building', title: '待补首栋楼', value: noBuildingCount, hint: '没有首栋楼的项目仍无法真正承接房源' },
    { key: 'inactive_assets', title: '停用资产', value: inactiveEstateCount + inactiveBuildingCount, hint: '停用项目和楼栋要先确认是否仍保留在运营底座中' },
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
    q: params.get('q') || undefined,
    view: view === 'estates' || view === 'buildings' ? view : 'all',
    task: task === 'estate_address' || task === 'building_address' || task === 'no_building' || task === 'inactive' ? task : undefined,
  } satisfies { estatePage: number; buildingPage: number; q?: string; view: EstateViewMode; task?: EstateTask };
}

function syncEstateListSearch(filters: { estatePage: number; buildingPage: number; q?: string; view: EstateViewMode; task?: EstateTask }) {
  const params = new URLSearchParams(window.location.search);
  params.delete('q');
  params.delete('task');
  params.delete('view');
  params.delete('estate_page');
  params.delete('building_page');
  if (filters.q) params.set('q', filters.q);
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
  const estates = useQuery({ queryKey: ['house', 'estates', workspace.selectedOrgSlug, estatePage, q], queryFn: () => houseApi.listEstates({ page: estatePage, page_size: PAGE_SIZE, q }), enabled });
  const allEstates = useQuery({
    queryKey: ['house', 'estates', 'all', workspace.selectedOrgSlug, q],
    queryFn: () => houseApi.listEstates({ page: 1, page_size: 100, q }),
    enabled,
  });
  const buildings = useQuery({ queryKey: ['house', 'buildings', workspace.selectedOrgSlug, buildingPage, q], queryFn: () => houseApi.listBuildings({ page: buildingPage, page_size: PAGE_SIZE, q }), enabled });
  const allBuildings = useQuery({
    queryKey: ['house', 'buildings', 'all', workspace.selectedOrgSlug, q],
    queryFn: () => houseApi.listBuildings({ page: 1, page_size: 100, q }),
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
  const activeEstateCount = estateOverviewRows.filter((item) => item.is_active !== false).length;
  const activeBuildingCount = buildingOverviewRows.filter((item) => item.is_active !== false).length;
  const inactiveEstateCount = estateOverviewRows.filter((item) => item.is_active === false).length;
  const inactiveBuildingCount = buildingOverviewRows.filter((item) => item.is_active === false).length;
  const estateAddressMissingCount = estateOverviewRows.filter((item) => !item.address).length;
  const buildingAddressMissingCount = buildingOverviewRows.filter((item) => !item.address).length;
  const noBuildingCount = estateOverviewRows.filter((item) => getEstateBuildings(buildingOverviewRows, item.id).length === 0).length;
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
  const pageSuggestion = overviewLoading
    ? '正在整理项目和楼栋底座，请稍候再判断资料缺口和治理优先级。'
    : getEstatePageSuggestion(filteredEstateOverviewRows, filteredBuildingOverviewRows, q, task);
  const focusedAction = getEstateFocusedActionCopy(task, drawerState);
  const estateTotal = task ? estateRows.length : estates.data?.total || 0;
  const buildingTotal = task ? buildingRows.length : buildings.data?.total || 0;
  const queueCounts = {
    all: estateOverviewRows.length + buildingOverviewRows.length,
    estate_address: estateOverviewRows.filter((item) => estateMatchesTask(item, buildingOverviewRows, 'estate_address')).length,
    building_address: buildingOverviewRows.filter((item) => buildingMatchesTask(item, 'building_address')).length,
    no_building: estateOverviewRows.filter((item) => estateMatchesTask(item, buildingOverviewRows, 'no_building')).length,
    inactive:
      estateOverviewRows.filter((item) => estateMatchesTask(item, buildingOverviewRows, 'inactive')).length
      + buildingOverviewRows.filter((item) => buildingMatchesTask(item, 'inactive')).length,
  } as const;
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
  const signalTileStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
    height: '100%',
    padding: 16,
  } as const;
  const closureSignals: EstateClosureSignal[] = [
    {
      key: 'estate_address',
      title: '项目底座',
      emphasis: estateAddressMissingCount > 0 ? '先补项目地址' : '项目稳定',
      summary: `${activeEstateCount} 个在管项目 / ${estateAddressMissingCount} 个待补地址`,
      description: '项目地址和项目级底座不完整时，后续楼栋、房源和展示链路都会持续带着缺口往后传。',
      actionLabel: '进入项目地址队列',
      href: dashboardHref('/property-rental/estates?task=estate_address'),
    },
    {
      key: 'no_building',
      title: '首栋补齐',
      emphasis: noBuildingCount > 0 ? '先补首栋' : '楼栋齐备',
      summary: `${noBuildingCount} 个待补首栋 / ${activeBuildingCount} 个在管楼栋`,
      description: '项目只有真正落下第一栋可用楼栋，后面的房源建档才算能开始承接业务。',
      actionLabel: '进入首栋补齐队列',
      href: dashboardHref('/property-rental/estates?task=no_building'),
    },
    {
      key: 'building_address',
      title: '楼栋治理',
      emphasis: buildingAddressMissingCount > 0 ? '先补楼栋地址' : '楼栋稳定',
      summary: `${buildingAddressMissingCount} 个待补地址 / ${activeBuildingCount} 个可挂房源`,
      description: '楼栋地址和供给条件不清楚时，房源挂接、带看导航和后续派单都会变得不可靠。',
      actionLabel: '进入楼栋治理队列',
      href: dashboardHref('/property-rental/estates?task=building_address'),
    },
    {
      key: 'inactive',
      title: '停用清理',
      emphasis: inactiveEstateCount + inactiveBuildingCount > 0 ? '先做清理' : '停用平稳',
      summary: `${inactiveEstateCount} 个停用项目 / ${inactiveBuildingCount} 个停用楼栋`,
      description: '停用项目和楼栋要尽早确认是否继续保留，避免新增房源误挂到已经退出运营的资产上。',
      actionLabel: '进入停用清理队列',
      href: dashboardHref('/property-rental/estates?task=inactive'),
    },
  ];

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

  const queueButtons: { key: 'all' | EstateTask; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'estate_address', label: '待补项目地址' },
    { key: 'building_address', label: '待补楼栋地址' },
    { key: 'no_building', label: '待补首栋楼' },
    { key: 'inactive', label: '停用资产' },
  ];
  const visibleQueueButtons = queueButtons.filter((item) => queueCounts[item.key] > 0 || (item.key === 'all' ? !task : task === item.key));
  const hiddenQueueCount = queueButtons.length - visibleQueueButtons.length;

  const applyTask = (nextTask: 'all' | EstateTask) => {
    setEstatePage(1);
    setBuildingPage(1);
    setTask(nextTask === 'all' ? undefined : nextTask);
    if (nextTask === 'estate_address' || nextTask === 'no_building') {
      setViewMode('estates');
      return;
    }
    if (nextTask === 'building_address') {
      setViewMode('buildings');
      return;
    }
    if (nextTask === 'inactive') {
      setViewMode('all');
    }
  };

  return (
    <TenantSelectionGuard title="项目楼栋" subtitle="维护房源所在的小区、项目和楼栋基础资料。">
      <div style={sectionStyle}>
        <Typography.Text strong>{scopedOverview ? '当前筛选概览' : '项目供给概览'}</Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {overviewCards.map((item) => (
            <Col key={item.key} xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title={item.title} value={getLoadingSafeCount(item.value, overviewLoading)} />
                <Typography.Text type="secondary">{getLoadingSafeText(item.hint, '正在整理当前治理范围...', overviewLoading)}</Typography.Text>
              </div>
            </Col>
          ))}
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
          <Typography.Text strong>基础治理队列</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary">先补项目和楼栋底座，再清理停用资产，避免后续房源建档挂到不完整或无效基础资料上。</Typography.Text>
          </div>
        </div>
        <Space wrap>
          {visibleQueueButtons.map((item) => (
            <Button
              key={item.key}
              size="small"
              type={(item.key === 'all' ? !task : task === item.key) ? 'primary' : 'default'}
              onClick={() => applyTask(item.key)}
            >
              {`${item.label} ${getLoadingSafeCount(queueCounts[item.key], overviewLoading)}`}
            </Button>
          ))}
        </Space>
        {hiddenQueueCount > 0 ? (
          <div style={{ marginTop: 12 }}>
            <Typography.Text type="secondary">已收起 {hiddenQueueCount} 个 0 项，避免把空队列和当前重点放在同一层级。</Typography.Text>
          </div>
        ) : null}
      </div>

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, width: '100%', marginBottom: 16 }}>
          <div>
            <Typography.Text strong>基础资料视图</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Typography.Text type="secondary">按当前维护重点切到项目或楼栋台账，减少同屏干扰，把底座治理工作拆成更稳定的台账动作。</Typography.Text>
            </div>
          </div>
          <Segmented
            options={[
              { label: '全部', value: 'all' },
              { label: '项目台账', value: 'estates' },
              { label: '楼栋台账', value: 'buildings' },
            ]}
            value={effectiveViewMode}
            onChange={(value) => setViewMode(value as EstateViewMode)}
          />
        </div>
        <Space wrap size={[16, 8]}>
          <Typography.Text type="secondary">{getLoadingSafeText('按当前维护重点切换到项目或楼栋台账，减少同屏信息干扰。', '正在整理基础资料视图...', overviewLoading)}</Typography.Text>
          <Tag color={effectiveViewMode === 'all' ? 'blue' : 'default'}>{`项目 ${getLoadingSafeCount(visibleEstateViewCount, overviewLoading)}`}</Tag>
          <Tag color={effectiveViewMode === 'all' ? 'blue' : 'default'}>{`楼栋 ${getLoadingSafeCount(visibleBuildingViewCount, overviewLoading)}`}</Tag>
        </Space>
      </div>

      {scopeText ? (
        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space orientation="vertical" size={4}>
              <Typography.Text strong>{`当前只看：${scopeText}`}</Typography.Text>
              <Typography.Text type="secondary">{pageSuggestion}</Typography.Text>
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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, width: '100%', marginBottom: 16 }}>
          <div>
            <Typography.Text strong>项目台账</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Typography.Text type="secondary">维护项目命名、地址和首栋覆盖，为楼栋和房源建档提供稳定的项目底座。</Typography.Text>
            </div>
          </div>
          <AdminToolbar><Button type="primary" icon={<PlusOutlined />} onClick={openEstateCreate}>新建项目</Button></AdminToolbar>
        </div>
        <Table<EstateOut>
          rowKey="id"
          loading={estateListLoading}
          columns={[
            { title: '名称', dataIndex: 'display_name', render: (_value, record) => record.display_name || record.name },
            { title: '城市', dataIndex: 'city', render: (_value, record) => `${record.city || '-'} / ${record.district || '-'}` },
            { title: '物业类型', dataIndex: 'property_type', render: (value) => labelOf(PROPERTY_TYPE_OPTIONS, value) },
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
          pagination={{ current: estatePage, pageSize: PAGE_SIZE, total: estateTotal, showSizeChanger: false, onChange: setEstatePage }}
          scroll={adminTableScroll}
        />
      </div>
      ) : null}
      {effectiveViewMode !== 'estates' ? (
        <div style={{ ...sectionStyle, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, width: '100%', marginBottom: 16 }}>
          <div>
            <Typography.Text strong>楼栋台账</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Typography.Text type="secondary">维护楼栋供给条件、地址和可挂房源能力，确保房源建档可以直接落到有效楼栋。</Typography.Text>
            </div>
          </div>
          <AdminToolbar><Button type="primary" icon={<PlusOutlined />} onClick={() => openBuildingCreate()}>新建楼栋</Button></AdminToolbar>
        </div>
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
          pagination={{ current: buildingPage, pageSize: PAGE_SIZE, total: buildingTotal, showSizeChanger: false, onChange: setBuildingPage }}
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
          <Form.Item label="物业类型" name="property_type"><Select options={PROPERTY_TYPE_OPTIONS} /></Form.Item>
          <Form.Item label="省份" name="province" rules={[{ required: true, message: '请输入省份' }]}><Input /></Form.Item>
          <Form.Item label="城市" name="city" rules={[{ required: true, message: '请输入城市' }]}><Input /></Form.Item>
          <Form.Item label="区域" name="district" rules={[{ required: true, message: '请输入区域' }]}><Input /></Form.Item>
          <Form.Item label="地址" name="address" extra="可先留空，后续通过治理队列补齐项目地址。"><Input placeholder="例如：科技园路 1 号（可稍后补）" /></Form.Item>
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
