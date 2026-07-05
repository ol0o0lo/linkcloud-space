import { PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Drawer, Empty, Form, Input, message, Segmented, Select, Space, Switch, Tag, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { adminTableScroll, ResponsiveActions } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { enumMapping, enumSelectOptions, useEnums } from '@/services/manual/enums';
import { type BuildingOut, type EstateOut, houseApi } from '@/services/manual/house';

const PAGE_SIZE = 20;
type EstateViewMode = 'all' | 'estates' | 'buildings';
type EstateTask = 'estate_address' | 'building_address' | 'no_building' | 'inactive';
type EstateDrawerState = {
  estateEditId?: number;
  buildingEditId?: number;
  buildingCreateEstateId?: number;
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

function getBuildingSupplyText(building: BuildingOut) {
  if (building.elevator) return '有电梯，可优先承接高层房源';
  if ((building.floors || 0) >= 10) return '无电梯高楼层，建档时注意居住体验';
  return '无电梯，适合低楼层房源';
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
  const estateTableBaseRows = task ? estateOverviewRows : (estates.data?.items || []);
  const buildingTableBaseRows = task ? buildingOverviewRows : (buildings.data?.items || []);
  const estateRows = estateTableBaseRows.filter((item) => estateMatchesTask(item, buildingOverviewRows, task));
  const buildingRows = buildingTableBaseRows.filter((item) => buildingMatchesTask(item, task));
  const effectiveViewMode = getTaskViewMode(task, viewMode);
  const estateTotal = task ? estateRows.length : estates.data?.total || 0;
  const buildingTotal = task ? buildingRows.length : buildings.data?.total || 0;
  const propertyTypeOptions = enumSelectOptions(houseEnums.data, 'house.estate_property_type');
  const estateColumns: ProColumns<EstateOut>[] = [
    { title: '名称', dataIndex: 'display_name', render: (_value, record) => record.display_name || record.name },
    { title: '城市', dataIndex: 'city', render: (_value, record) => `${record.city || '-'} / ${record.district || '-'}` },
    { title: '物业类型', dataIndex: 'property_type__mapping', render: (_value, record) => enumMapping(record.property_type, record.property_type__mapping) },
    { title: '楼栋覆盖', dataIndex: 'coverage', render: (_value, record) => <Typography.Text strong>{getEstateCoverageText(record, buildingOverviewRows)}</Typography.Text> },
    { title: '地址', dataIndex: 'address', render: (value) => value || '-' },
    { title: '状态', dataIndex: 'is_active', render: (value) => (value === false ? <Tag>停用</Tag> : <Tag color="green">启用</Tag>) },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      valueType: 'option',
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
  ];
  const buildingColumns: ProColumns<BuildingOut>[] = [
    { title: '所属项目', dataIndex: 'estate', render: (_value, record) => record.estate?.display_name || record.estate?.name || '-' },
    { title: '名称', dataIndex: 'name' },
    { title: '楼层', dataIndex: 'floors' },
    { title: '供给条件', dataIndex: 'supply', render: (_value, record) => <Typography.Text strong>{getBuildingSupplyText(record)}</Typography.Text> },
    { title: '地址', dataIndex: 'address', render: (value) => value || '-' },
    { title: '状态', dataIndex: 'is_active', render: (value) => (value === false ? <Tag>停用</Tag> : <Tag color="green">启用</Tag>) },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      valueType: 'option',
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
      setViewMode(listState.view);
      setTask(listState.task);
      setDrawerState(getEstateDrawerStateFromSearch(window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <TenantSelectionGuard title="项目楼栋">
      <Space wrap style={{ marginBottom: 16 }}>
        <Segmented
          options={[
            { label: '全部', value: 'all' },
            { label: '项目列表', value: 'estates' },
            { label: '楼栋列表', value: 'buildings' },
          ]}
          value={effectiveViewMode}
          onChange={(value) => setViewMode(value as EstateViewMode)}
        />
      </Space>
      {effectiveViewMode !== 'buildings' ? (
        <Card>
          <ProTable<EstateOut>
            rowKey="id"
            loading={estates.isLoading}
            headerTitle="项目列表"
            columns={estateColumns}
            dataSource={estateRows}
            search={false}
            options={{
              density: true,
              reload: false,
              search: {
                name: 'keyword',
                placeholder: '搜索项目 / 楼栋',
                value: q,
                onSearch: (value: string) => {
                  setEstatePage(1);
                  setBuildingPage(1);
                  setQ(value.trim() || undefined);
                },
              },
              setting: true,
            }}
            toolBarRender={() => [
              <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openEstateCreate}>
                新建项目
              </Button>,
            ]}
            ghost
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无项目资料">
                  <Button type="primary" onClick={openEstateCreate}>新建项目</Button>
                </Empty>
              ),
            }}
            pagination={{ current: estatePage, pageSize: PAGE_SIZE, total: estateTotal, onChange: setEstatePage }}
            scroll={adminTableScroll}
          />
        </Card>
      ) : null}
      {effectiveViewMode !== 'estates' ? (
        <Card style={{ marginTop: effectiveViewMode === 'all' ? 16 : 0 }}>
          <ProTable<BuildingOut>
            rowKey="id"
            loading={buildings.isLoading}
            headerTitle="楼栋列表"
            columns={buildingColumns}
            dataSource={buildingRows}
            search={false}
            options={{
              density: true,
              reload: false,
              ...(effectiveViewMode === 'buildings'
                ? {
                    search: {
                      name: 'keyword',
                      placeholder: '搜索项目 / 楼栋',
                      value: q,
                      onSearch: (value: string) => {
                        setEstatePage(1);
                        setBuildingPage(1);
                        setQ(value.trim() || undefined);
                      },
                    },
                  }
                : {}),
              setting: true,
            }}
            toolBarRender={() => [
              <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => openBuildingCreate()}>
                新建楼栋
              </Button>,
            ]}
            ghost
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无楼栋资料">
                  <Button type="primary" onClick={() => openBuildingCreate()}>新建楼栋</Button>
                </Empty>
              ),
            }}
            pagination={{ current: buildingPage, pageSize: PAGE_SIZE, total: buildingTotal, onChange: setBuildingPage }}
            scroll={adminTableScroll}
          />
        </Card>
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
