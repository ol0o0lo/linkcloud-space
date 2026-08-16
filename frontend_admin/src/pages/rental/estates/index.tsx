import { BankOutlined, ClusterOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Icon } from '@iconify/react';
import elevatorIcon from '@iconify-icons/tabler/elevator';
import stairsIcon from '@iconify-icons/tabler/stairs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history, Link } from '@umijs/max';
import {
  Avatar,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  message,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  EntityPreviewDetailDrawer,
  EstatePreview,
} from '@/components/EntityPreview';
import { LocationPicker } from '@/components/LocationPicker';
import {
  adminTableScroll,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/space/shared';
import {
  enumMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import {
  type BuildingOut,
  type EstateOut,
  houseApi,
  type PageResult,
} from '@/services/manual/house';
import { appsSettingsApiListOrgSettings } from '@/services/openapi/organizationSettings';
import MediaRefsUpload from '../components/MediaRefsUpload';
import { PropertyTagSelect } from '../components/PropertyTagSelect';
import {
  HOUSE_MEDIA_RESOURCE_TYPE,
  HOUSE_MEDIA_TYPE,
  mediaCoverUrl,
} from '../constants';
import {
  formLocation,
  prefillBuildingLocation,
  settingLocation,
} from '../location-utils';
import { type DeleteTarget, ResourceDeleteModal } from './ResourceDeleteModal';

const PAGE_SIZE = 20;
const ALL_BUILDINGS_PAGE_SIZE = 500;
const BUILDING_ACCESS_ICON_STYLE: React.CSSProperties = {
  display: 'inline-block',
  marginInlineEnd: 4,
  verticalAlign: '-0.125em',
};
type EstateViewMode = 'all' | 'estates' | 'buildings';
type EstateTask =
  | 'estate_address'
  | 'building_address'
  | 'building_location'
  | 'no_building';
type EstateDrawerState = {
  estateEditId?: number;
  buildingEditId?: number;
  buildingCreateEstateId?: number;
};

function getPositiveId(value: string | null) {
  return value && /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

function getMapReturnTo() {
  const value = new URLSearchParams(window.location.search).get('return_to');
  return value === '/dashboard/rental/properties/map' ||
    value?.startsWith('/dashboard/rental/properties/map?')
    ? value
    : undefined;
}

function getEstateBuildings(buildings: BuildingOut[], estateId: number) {
  return buildings.filter((item) => item.estate_id === estateId);
}

function getEstateCoverageText(estate: EstateOut, buildings: BuildingOut[]) {
  const estateBuildings = getEstateBuildings(buildings, estate.id);
  return `${estateBuildings.length}栋`;
}

async function fetchAllBuildings(): Promise<PageResult<BuildingOut>> {
  const items: BuildingOut[] = [];
  let page = 1;
  let total = 0;

  while (true) {
    const result = await houseApi.listBuildings({
      page,
      page_size: ALL_BUILDINGS_PAGE_SIZE,
    });
    items.push(...result.items);
    total = result.total;

    if (!result.items.length || items.length >= total) break;
    page += 1;
  }

  return { items, total, page: 1, page_size: ALL_BUILDINGS_PAGE_SIZE };
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
  if (drawerState.estateEditId)
    params.set('estate_edit', String(drawerState.estateEditId));
  if (drawerState.buildingEditId)
    params.set('building_edit', String(drawerState.buildingEditId));
  if (drawerState.buildingCreateEstateId)
    params.set('building_create', String(drawerState.buildingCreateEstateId));
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function estateMatchesTask(
  estate: EstateOut,
  buildings: BuildingOut[],
  task?: EstateTask,
) {
  if (task === 'estate_address') return !estate.address;
  if (task === 'no_building')
    return getEstateBuildings(buildings, estate.id).length === 0;
  return true;
}

function buildingMatchesTask(building: BuildingOut, task?: EstateTask) {
  if (task === 'building_address') return !building.address;
  if (task === 'building_location')
    return building.lat == null || building.lng == null;
  return true;
}

function getTaskViewMode(
  task: EstateTask | undefined,
  fallback: EstateViewMode,
) {
  if (task === 'estate_address' || task === 'no_building') return 'estates';
  if (task === 'building_address' || task === 'building_location')
    return 'buildings';
  return fallback;
}

function getEstateListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const estatePageValue = Number(params.get('estate_page') || '1');
  const buildingPageValue = Number(params.get('building_page') || '1');
  const view = params.get('view');
  const task = params.get('task');
  return {
    estatePage:
      Number.isFinite(estatePageValue) && estatePageValue > 0
        ? estatePageValue
        : 1,
    buildingPage:
      Number.isFinite(buildingPageValue) && buildingPageValue > 0
        ? buildingPageValue
        : 1,
    q: params.get('keyword') || undefined,
    estateId: getPositiveId(params.get('estate_id')),
    view: view === 'estates' || view === 'buildings' ? view : 'all',
    task:
      task === 'estate_address' ||
      task === 'building_address' ||
      task === 'building_location' ||
      task === 'no_building'
        ? task
        : undefined,
  } satisfies {
    estatePage: number;
    buildingPage: number;
    q?: string;
    estateId?: number;
    view: EstateViewMode;
    task?: EstateTask;
  };
}

function syncEstateListSearch(filters: {
  estatePage: number;
  buildingPage: number;
  q?: string;
  estateId?: number;
  view: EstateViewMode;
  task?: EstateTask;
}) {
  const params = new URLSearchParams(window.location.search);
  params.delete('keyword');
  params.delete('task');
  params.delete('view');
  params.delete('estate_page');
  params.delete('building_page');
  params.delete('estate_id');
  if (filters.q) params.set('keyword', filters.q);
  if (filters.task) params.set('task', filters.task);
  if (filters.estateId) params.set('estate_id', String(filters.estateId));
  const taskView = getTaskViewMode(filters.task, 'all');
  if (filters.view !== 'all' && filters.view !== taskView)
    params.set('view', filters.view);
  if (filters.estatePage > 1)
    params.set('estate_page', String(filters.estatePage));
  if (filters.buildingPage > 1)
    params.set('building_page', String(filters.buildingPage));
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
  lat?: number | string | null;
  lng?: number | string | null;
};

type BuildingFormValues = {
  estate_id?: number | null;
  name: string;
  floors: number;
  elevator?: boolean;
  address?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  images?: Record<string, unknown>[];
  tags?: string[];
};

const EstatesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialListState = useRef(
    getEstateListStateFromSearch(window.location.search),
  );
  const initialDrawerState = useRef(
    getEstateDrawerStateFromSearch(window.location.search),
  );
  const [estatePage, setEstatePage] = useState(
    initialListState.current.estatePage,
  );
  const [buildingPage, setBuildingPage] = useState(
    initialListState.current.buildingPage,
  );
  const [q, setQ] = useState<string | undefined>(initialListState.current.q);
  const [estateId, setEstateId] = useState<number | undefined>(
    initialListState.current.estateId,
  );
  const [viewMode, setViewMode] = useState<EstateViewMode>(
    initialListState.current.view,
  );
  const [task, setTask] = useState<EstateTask | undefined>(
    initialListState.current.task,
  );
  const [drawerState, setDrawerState] = useState<EstateDrawerState>(
    initialDrawerState.current,
  );
  const [editingEstate, setEditingEstate] = useState<EstateOut | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<BuildingOut | null>(
    null,
  );
  const [draftBuildingEstateId, setDraftBuildingEstateId] = useState<number>();
  const [estateOpen, setEstateOpen] = useState(false);
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [buildingLocationTouched, setBuildingLocationTouched] = useState(false);
  const [estateForm] = Form.useForm<EstateFormValues>();
  const [buildingForm] = Form.useForm<BuildingFormValues>();
  const buildingEstateId = Form.useWatch('estate_id', buildingForm);
  const buildingAddress = Form.useWatch('address', buildingForm);
  const buildingLat = Form.useWatch('lat', buildingForm);
  const buildingLng = Form.useWatch('lng', buildingForm);
  const estateAddress = Form.useWatch('address', estateForm);
  const estateLat = Form.useWatch('lat', estateForm);
  const estateLng = Form.useWatch('lng', estateForm);
  const previousBuildingEstateId = useRef<number | null | undefined>(undefined);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseEnums = useEnums(['house.estate_property_type']);
  const estates = useQuery({
    queryKey: ['house', 'estates', workspace.selectedOrgSlug, estatePage, q],
    queryFn: () =>
      houseApi.listEstates({
        page: estatePage,
        page_size: PAGE_SIZE,
        keyword: q,
      }),
    enabled,
  });
  const allEstates = useQuery({
    queryKey: ['house', 'estates', 'all', workspace.selectedOrgSlug, q],
    queryFn: () =>
      houseApi.listEstates({ page: 1, page_size: 100, keyword: q }),
    enabled,
  });
  const buildings = useQuery({
    queryKey: [
      'house',
      'buildings',
      workspace.selectedOrgSlug,
      buildingPage,
      q,
      estateId,
    ],
    queryFn: () =>
      houseApi.listBuildings({
        page: buildingPage,
        page_size: PAGE_SIZE,
        keyword: q,
        ...(estateId ? { estate_id: estateId } : {}),
      }),
    enabled,
  });
  const allBuildings = useQuery({
    queryKey: ['house', 'buildings', 'all', workspace.selectedOrgSlug],
    queryFn: fetchAllBuildings,
    enabled,
  });
  const tagSuggestions = useQuery({
    queryKey: ['house', 'tag-suggestions'],
    queryFn: () => houseApi.getTagSuggestions(),
    enabled,
  });
  const orgSettings = useQuery({
    queryKey: [
      'settings-management',
      'organization',
      workspace.selectedOrgSlug,
    ],
    queryFn: () => appsSettingsApiListOrgSettings(),
    enabled,
  });
  const estateBuildings = useQuery({
    queryKey: [
      'house',
      'buildings',
      'estate',
      workspace.selectedOrgSlug,
      editingEstate?.id,
    ],
    queryFn: () => {
      if (!editingEstate) throw new Error('缺少项目 ID');
      return houseApi.listBuildings({
        estate_id: editingEstate.id,
        page: 1,
        page_size: 5,
      });
    },
    enabled: enabled && Boolean(editingEstate),
  });
  const saveEstate = useMutation({
    mutationFn: (values: EstateFormValues) =>
      editingEstate
        ? houseApi.patchEstate(editingEstate.id, values)
        : houseApi.createEstate(values),
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
      const selectedEstate = (allEstates.data?.items || []).find(
        (item) => item.id === values.estate_id,
      );
      const selectedEstateLocation = selectedEstate
        ? formLocation(selectedEstate)
        : null;
      const inheritedLocation =
        !editingBuilding &&
        !buildingLocationTouched &&
        (values.lat == null || values.lng == null) &&
        selectedEstateLocation
          ? prefillBuildingLocation(values.address, selectedEstateLocation)
          : {};
      const payload = {
        ...values,
        ...inheritedLocation,
        estate_id: values.estate_id ?? null,
        floors: Number(values.floors),
      };
      return editingBuilding
        ? houseApi.patchBuilding(editingBuilding.id, payload)
        : houseApi.createBuilding(payload);
    },
    onSuccess: async (building) => {
      message.success(editingBuilding ? '楼栋已更新' : '楼栋已创建');
      setBuildingOpen(false);
      setEditingBuilding(null);
      setDraftBuildingEstateId(undefined);
      setDrawerState((current) => ({
        ...current,
        buildingEditId: undefined,
        buildingCreateEstateId: undefined,
      }));
      syncEstateDrawerSearch({
        ...drawerState,
        buildingEditId: undefined,
        buildingCreateEstateId: undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['house', 'buildings'] });
      const returnTo = getMapReturnTo();
      if (returnTo) {
        const target = new URL(returnTo, window.location.origin);
        target.searchParams.set('selected_building_id', String(building.id));
        history.push(
          `${target.pathname.replace(/^\/dashboard/, '')}${target.search}`,
        );
      }
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
    setBuildingLocationTouched(false);
    previousBuildingEstateId.current = undefined;
    updateDrawerState({ buildingCreateEstateId: estateId });
  };

  const openBuildingEdit = (record: BuildingOut) => {
    setDraftBuildingEstateId(undefined);
    setEditingBuilding(record);
    setBuildingOpen(true);
    setBuildingLocationTouched(record.lat != null && record.lng != null);
    previousBuildingEstateId.current = record.estate_id;
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
    setBuildingLocationTouched(false);
    clearDrawerState();
  };

  const refreshDeleteLists = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['house', 'estates'] }),
      queryClient.invalidateQueries({ queryKey: ['house', 'buildings'] }),
    ]);
  }, [queryClient]);

  const closeDeleteModal = useCallback(() => {
    setDeleteTarget(null);
    void refreshDeleteLists();
  }, [refreshDeleteLists]);

  const estateInitialValues: Partial<EstateFormValues> = editingEstate || {
    property_type: 'residential',
  };
  const buildingInitialValues: Partial<BuildingFormValues> =
    editingBuilding || {
      estate_id: draftBuildingEstateId,
      floors: 1,
      elevator: false,
    };
  const estateOverviewRows =
    allEstates.data?.items || estates.data?.items || [];
  const buildingOverviewRows =
    allBuildings.data?.items || buildings.data?.items || [];
  const estateTableBaseRows = task
    ? estateOverviewRows
    : estates.data?.items || [];
  const buildingTableBaseRows = task
    ? buildingOverviewRows
    : buildings.data?.items || [];
  const estateRows = estateTableBaseRows.filter((item) =>
    estateMatchesTask(item, buildingOverviewRows, task),
  );
  const buildingRows = buildingTableBaseRows.filter(
    (item) =>
      (!estateId || item.estate_id === estateId) &&
      buildingMatchesTask(item, task),
  );
  const effectiveViewMode = getTaskViewMode(task, viewMode);
  const estateTotal = task ? estateRows.length : estates.data?.total || 0;
  const buildingTotal = task ? buildingRows.length : buildings.data?.total || 0;
  const propertyTypeOptions = enumSelectOptions(
    houseEnums.data,
    'house.estate_property_type',
  );
  const selectedEstate = estateId
    ? estateOverviewRows.find((item) => item.id === estateId)
    : undefined;
  const selectedBuildingEstate = (allEstates.data?.items || []).find(
    (item) => item.id === buildingEstateId,
  );
  const defaultLocation = settingLocation(
    orgSettings.data?.find(
      (item) => item.key === 'property_rental.default_location',
    )?.value,
  );
  const selectedEstateName =
    selectedEstate?.display_name ||
    selectedEstate?.name ||
    (estateId ? `小区 #${estateId}` : '');
  useEffect(() => {
    if (estateOpen) estateForm.setFieldsValue(estateInitialValues);
  }, [estateForm, estateOpen, editingEstate?.id]);
  useEffect(() => {
    if (buildingOpen) buildingForm.setFieldsValue(buildingInitialValues);
  }, [buildingForm, buildingOpen, draftBuildingEstateId, editingBuilding?.id]);
  const estateColumns: ProColumns<EstateOut>[] = [
    {
      title: '名称',
      dataIndex: 'display_name',
      render: (_value, record) => {
        const coverUrl = mediaCoverUrl(record.images);
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            <Avatar
              alt="项目图"
              icon={<ClusterOutlined data-testid="estate-image-placeholder" />}
              shape="square"
              size={40}
              src={coverUrl}
              style={{ borderRadius: 6, flex: '0 0 auto' }}
            />
            <Link to={`/rental/properties/estates/${record.id}`}>
              <Typography.Text ellipsis>
                {record.display_name || record.name}
              </Typography.Text>
            </Link>
          </div>
        );
      },
    },
    {
      title: '城市',
      dataIndex: 'city',
      render: (_value, record) =>
        `${record.city || '-'} / ${record.district || '-'}`,
    },
    {
      title: '物业类型',
      dataIndex: 'property_type__mapping',
      render: (_value, record) =>
        enumMapping(record.property_type, record.property_type__mapping),
    },
    {
      title: '楼栋数',
      dataIndex: 'coverage',
      render: (_value, record) => (
        <Typography.Text strong>
          {getEstateCoverageText(record, buildingOverviewRows)}
        </Typography.Text>
      ),
    },
    { title: '地址', dataIndex: 'address', render: (value) => value || '-' },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      valueType: 'option',
      render: (_value, record) => (
        <ResponsiveActions>
          <Button
            type="link"
            size="small"
            onClick={() => openBuildingCreate(record.id)}
          >
            {task === 'no_building' &&
            getEstateBuildings(buildingOverviewRows, record.id).length === 0
              ? '补首栋楼'
              : '新建楼栋'}
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => openEstateEdit(record)}
          >
            {task === 'estate_address' && !record.address
              ? '补项目地址'
              : '编辑'}
          </Button>
          <Button
            type="link"
            danger
            size="small"
            onClick={() =>
              setDeleteTarget({
                type: 'estate',
                id: record.id,
                label: record.display_name || record.name,
              })
            }
          >
            删除
          </Button>
        </ResponsiveActions>
      ),
    },
  ];
  const buildingColumns: ProColumns<BuildingOut>[] = [
    {
      title: '楼栋',
      dataIndex: 'name',
      render: (value, record) => (
        <Space size={8}>
          <Avatar
            icon={<BankOutlined data-testid="building-avatar-placeholder" />}
            shape="square"
            size={40}
            src={mediaCoverUrl(record.images)}
            style={{ borderRadius: 6 }}
          />
          <Link to={`/rental/properties/buildings/${record.id}`}>{value}</Link>
        </Space>
      ),
    },
    {
      title: '所属项目',
      dataIndex: 'estate',
      render: (_value, record) => (
        <EstatePreview id={record.estate?.id}>
          {record.estate?.display_name || record.estate?.name || '-'}
        </EstatePreview>
      ),
    },
    { title: '楼层', dataIndex: 'floors' },
    {
      title: '电梯',
      dataIndex: 'elevator',
      render: (value) =>
        value ? (
          <Tag
            color="success"
            icon={<Icon icon={elevatorIcon} width={14} height={14} />}
            styles={{ icon: BUILDING_ACCESS_ICON_STYLE }}
          >
            电梯
          </Tag>
        ) : (
          <Tag
            color="gold"
            icon={<Icon icon={stairsIcon} width={14} height={14} />}
            styles={{ icon: BUILDING_ACCESS_ICON_STYLE }}
          >
            步梯
          </Tag>
        ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (_value, record) =>
        record.tags?.length ? (
          <Space size={[4, 4]} wrap>
            {record.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    { title: '地址', dataIndex: 'address', render: (value) => value || '-' },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      valueType: 'option',
      render: (_value, record) => (
        <ResponsiveActions>
          <a
            href={`/dashboard/rental/properties/new?building_id=${record.id}`}
          >
            登记房源
          </a>
          <Button
            type="link"
            size="small"
            onClick={() => openBuildingEdit(record)}
          >
            {task === 'building_address' && !record.address
              ? '补楼栋地址'
              : '编辑'}
          </Button>
          <Button
            type="link"
            danger
            size="small"
            onClick={() =>
              setDeleteTarget({
                type: 'building',
                id: record.id,
                label: record.name,
              })
            }
          >
            删除
          </Button>
        </ResponsiveActions>
      ),
    },
  ];

  useEffect(() => {
    syncEstateListSearch({
      estatePage,
      buildingPage,
      q,
      estateId,
      view: viewMode,
      task,
    });
  }, [estateId, estatePage, buildingPage, q, task, viewMode]);

  useEffect(() => {
    if (
      !drawerState.estateEditId ||
      editingEstate ||
      estateOpen ||
      !allEstates.isSuccess
    )
      return;
    const target = estateOverviewRows.find(
      (item) => item.id === drawerState.estateEditId,
    );
    if (!target) return;
    setEditingEstate(target);
    setEstateOpen(true);
  }, [
    allEstates.isSuccess,
    drawerState.estateEditId,
    editingEstate,
    estateOpen,
    estateOverviewRows,
  ]);

  useEffect(() => {
    if (editingBuilding || buildingOpen || !allBuildings.isSuccess) return;
    if (drawerState.buildingEditId) {
      const target = buildingOverviewRows.find(
        (item) => item.id === drawerState.buildingEditId,
      );
      if (!target) return;
      setEditingBuilding(target);
      setBuildingOpen(true);
      return;
    }
    if (drawerState.buildingCreateEstateId) {
      setDraftBuildingEstateId(drawerState.buildingCreateEstateId);
      setBuildingOpen(true);
    }
  }, [
    allBuildings.isSuccess,
    buildingOpen,
    buildingOverviewRows,
    drawerState.buildingCreateEstateId,
    drawerState.buildingEditId,
    editingBuilding,
  ]);

  useEffect(() => {
    if (!buildingOpen || previousBuildingEstateId.current === buildingEstateId)
      return;
    const nextEstateLocation = selectedBuildingEstate
      ? formLocation(selectedBuildingEstate)
      : null;
    if (!buildingLocationTouched && nextEstateLocation) {
      buildingForm.setFieldsValue(
        prefillBuildingLocation(
          buildingForm.getFieldValue('address'),
          nextEstateLocation,
        ),
      );
    } else if (buildingLocationTouched && nextEstateLocation) {
      message.info('已保留手动填写的位置，请核对楼栋位置。');
    }
    previousBuildingEstateId.current = buildingEstateId;
  }, [
    buildingEstateId,
    buildingForm,
    buildingLocationTouched,
    buildingOpen,
    editingBuilding,
    selectedBuildingEstate,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      const listState = getEstateListStateFromSearch(window.location.search);
      setEstatePage(listState.estatePage);
      setBuildingPage(listState.buildingPage);
      setQ(listState.q);
      setEstateId(listState.estateId);
      setViewMode(listState.view);
      setTask(listState.task);
      setDrawerState(getEstateDrawerStateFromSearch(window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const listFilters = (
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
        <Segmented
          aria-label="项目楼栋视图筛选"
          options={[
            { label: '全部', value: 'all' },
            { label: '项目列表', value: 'estates' },
            { label: '楼栋列表', value: 'buildings' },
          ]}
          value={effectiveViewMode}
          onChange={(value) => setViewMode(value as EstateViewMode)}
        />
      </Space>
      {estateId ? (
        <Space wrap>
          <Typography.Text type="secondary">
            当前项目：{selectedEstateName}
          </Typography.Text>
          <Button
            size="small"
            onClick={() => {
              setEstateId(undefined);
              setBuildingPage(1);
            }}
            aria-label="清除小区筛选"
          >
            清除
          </Button>
        </Space>
      ) : null}
    </div>
  );

  return (
    <TenantSelectionGuard title="项目楼栋">
      {effectiveViewMode !== 'buildings' ? (
        <Card>
          {listFilters}
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
              <Button
                key="create"
                type="primary"
                icon={<PlusOutlined />}
                onClick={openEstateCreate}
              >
                新建项目
              </Button>,
            ]}
            ghost
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无项目资料"
                >
                  <Button type="primary" onClick={openEstateCreate}>
                    新建项目
                  </Button>
                </Empty>
              ),
            }}
            pagination={{
              current: estatePage,
              pageSize: PAGE_SIZE,
              total: estateTotal,
              onChange: setEstatePage,
            }}
            scroll={adminTableScroll}
          />
        </Card>
      ) : null}
      {effectiveViewMode !== 'estates' ? (
        <Card style={{ marginTop: effectiveViewMode === 'all' ? 16 : 0 }}>
          {effectiveViewMode === 'buildings' ? listFilters : null}
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
              <Button
                key="create"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openBuildingCreate()}
              >
                新建楼栋
              </Button>,
            ]}
            ghost
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无楼栋资料"
                >
                  <Button type="primary" onClick={() => openBuildingCreate()}>
                    新建楼栋
                  </Button>
                </Empty>
              ),
            }}
            pagination={{
              current: buildingPage,
              pageSize: PAGE_SIZE,
              total: buildingTotal,
              onChange: setBuildingPage,
            }}
            scroll={adminTableScroll}
          />
        </Card>
      ) : null}
      <ResourceDeleteModal
        open={Boolean(deleteTarget)}
        target={deleteTarget}
        onClose={closeDeleteModal}
        onDeleted={refreshDeleteLists}
      />
      <EntityPreviewDetailDrawer
        searchParam="preview_estate"
        title="项目详情"
        type="estate"
      />
      <EntityPreviewDetailDrawer
        searchParam="preview_building"
        title="楼栋详情"
        type="building"
      />
      <Drawer
        title={editingEstate ? '编辑项目' : '新建项目'}
        open={estateOpen}
        size="large"
        onClose={closeEstateDrawer}
        destroyOnHidden
        extra={
          <Button
            type="primary"
            htmlType="submit"
            form="estate-form"
            loading={saveEstate.isPending}
          >
            保存
          </Button>
        }
      >
        <Form
          form={estateForm}
          id="estate-form"
          layout="vertical"
          initialValues={estateInitialValues}
          onFinish={(values) =>
            saveEstate.mutate({
              ...values,
              address: values.address || '',
              display_name: values.display_name || values.name,
            })
          }
        >
          <Form.Item
            label="项目名称"
            name="name"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="展示名称" name="display_name">
            <Input />
          </Form.Item>
          <Form.Item label="物业类型" name="property_type">
            <Select options={propertyTypeOptions} />
          </Form.Item>
          <Form.Item
            label="省份"
            name="province"
            rules={[{ required: true, message: '请输入省份' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="城市"
            name="city"
            rules={[{ required: true, message: '请输入城市' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="区域"
            name="district"
            rules={[{ required: true, message: '请输入区域' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="地址"
            name="address"
            extra="可先留空，后续补齐项目地址。"
          >
            <Input placeholder="例如：科技园路 1 号（可稍后补）" />
          </Form.Item>
          <Form.Item name="lat" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="lng" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="项目位置">
            <LocationPicker
              ariaLabel="项目位置"
              value={formLocation({
                address: estateAddress,
                lat: estateLat,
                lng: estateLng,
              })}
              fallbackLocation={defaultLocation}
              onChange={(location) =>
                estateForm.setFieldsValue(location || { lat: null, lng: null })
              }
              allowClear
            />
          </Form.Item>
        </Form>
        {editingEstate && estateBuildings.data?.items.length ? (
          <Card
            size="small"
            title="关联楼栋"
            style={{ marginTop: 16 }}
            extra={
              <a
                href={`/dashboard/rental/properties/estates?view=buildings&estate_id=${editingEstate.id}`}
              >
                查看全部楼栋
              </a>
            }
          >
            {estateBuildings.data.items
              .map((building) => building.name)
              .join('、')}
          </Card>
        ) : null}
      </Drawer>
      <Drawer
        title={editingBuilding ? '编辑楼栋' : '新建楼栋'}
        open={buildingOpen}
        size="large"
        onClose={closeBuildingDrawer}
        destroyOnHidden
        extra={
          <Button
            type="primary"
            htmlType="submit"
            form="building-form"
            loading={saveBuilding.isPending}
          >
            保存
          </Button>
        }
      >
        <Form
          form={buildingForm}
          id="building-form"
          layout="vertical"
          initialValues={buildingInitialValues}
          onFinish={(values) => saveBuilding.mutate(values)}
        >
          <Form.Item label="所属项目" name="estate_id">
            <Select
              allowClear
              options={(allEstates.data?.items || []).map((item) => ({
                value: item.id,
                label: item.display_name || item.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="楼栋名"
            name="name"
            rules={[{ required: true, message: '请输入楼栋名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="楼层"
            name="floors"
            rules={[{ required: true, message: '请输入楼层' }]}
          >
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item label="电梯" name="elevator" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            label="标签"
            name="tags"
            extra="房源会在自身标签之后自动继承这些楼栋标签。"
          >
            <PropertyTagSelect
              suggestions={tagSuggestions.data?.tags ?? []}
              suggestionsLoading={tagSuggestions.isLoading}
              suggestionsError={tagSuggestions.isError}
            />
          </Form.Item>
          <Form.Item
            label="楼栋图片"
            name="images"
            extra="最多上传 9 张，第一张将作为楼栋首图。"
          >
            <MediaRefsUpload
              resourceType={HOUSE_MEDIA_RESOURCE_TYPE.BUILDING_IMAGE}
              mediaType={HOUSE_MEDIA_TYPE.IMAGE}
              maxCount={9}
              enableImageRoles={false}
            />
          </Form.Item>
          <Form.Item
            label="地址"
            name="address"
            rules={[
              { required: true, whitespace: true, message: '请输入楼栋地址' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="lat" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="lng" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="楼栋位置">
            <LocationPicker
              ariaLabel="楼栋位置"
              value={formLocation({
                address: buildingAddress,
                lat: buildingLat,
                lng: buildingLng,
              })}
              fallbackLocation={
                (selectedBuildingEstate &&
                  formLocation(selectedBuildingEstate)) ||
                defaultLocation
              }
              onChange={(location) => {
                setBuildingLocationTouched(true);
                buildingForm.setFieldsValue(
                  location || { lat: null, lng: null },
                );
              }}
              allowClear
            />
          </Form.Item>
        </Form>
        {editingBuilding?.estate ? (
          <Card size="small" title="所属小区" style={{ marginTop: 16 }}>
            {editingBuilding.estate.display_name || editingBuilding.estate.name}
          </Card>
        ) : null}
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default EstatesPage;
