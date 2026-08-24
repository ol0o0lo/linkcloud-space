import {
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { EditableProTable } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Avatar,
  Button,
  Card,
  Drawer,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  Modal,
  message,
  Popover,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { AppStatusTag } from '@/components/AppStatus';
import {
  BuildingPreview,
  ContactPreview,
  EstatePreview,
  HousePreview,
} from '@/components/EntityPreview';
import { useUserTableColumnsState } from '@/hooks/useUserTableColumnsState';
import {
  adminTableScroll,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import {
  enumMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import {
  type BuildingOut,
  type ContactOut,
  type HouseOut,
  houseApi,
} from '@/services/manual/house';
import {
  buildingLabel,
  contactLabel,
  evaluateHousePublishState,
  HOUSE_STATUS,
  houseBalconyText,
  houseDisplayTags,
  houseKitchenText,
  houseMediaReadinessText,
  housePrimaryLayoutText,
  type MediaRefValue,
  mediaCoverUrl,
  moneyText,
} from '../constants';
import EstatesPage from '../estates';
import { isInitialQueryPending } from '../loading';
import { useHousePublishRules } from '../useHousePublishRules';
import { usePagedSelectOptions } from '../usePagedSelectOptions';
import {
  buildHouseInlinePatch,
  type HouseInlineEditableFields,
  type HouseMediaEditValue,
  HouseMediaInlineEditorModal,
  HouseRoomLayoutInlineEditor,
} from './HouseListInlineEditors';
import {
  HOUSE_STATUS_COLUMN_WIDTH,
  HOUSE_TABLE_BODY_SCROLL_Y,
  HOUSE_TABLE_PAGINATION_MIN_HEIGHT,
} from './houseListLayout';
import {
  PropertyAssetNavigator,
  type PropertyAssetScope,
  type PropertyStructureIntent,
  readPropertyAssetNavigatorCollapsed,
  writePropertyAssetNavigatorCollapsed,
} from './PropertyAssetNavigator';

const DEFAULT_PAGE_SIZE = 20;
const HOUSE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const HOUSE_TABLE_KEY = 'rental.houses';
const HOUSE_SORTABLE_FIELDS = [
  'room_number',
  'layout',
  'building',
  'asking_rent',
  'deposit_amount',
  'landlord',
  'status',
] as const;

const useStyles = createStyles(({ css, token }) => ({
  stableEditableTable: css`
    .ant-table-thead > tr > th {
      background: ${token.colorFillQuaternary};
      color: ${token.colorTextSecondary};
      font-weight: 600;
    }

    .ant-table-thead > tr > th.ant-table-cell-fix-start,
    .ant-table-thead > tr > th.ant-table-cell-fix-end {
      background:
        linear-gradient(
          ${token.colorFillQuaternary},
          ${token.colorFillQuaternary}
        ),
        ${token.colorBgContainer};
    }

    .ant-table-tbody > tr > .ant-table-cell {
      height: 69px;
      vertical-align: middle;
      transition: background-color ${token.motionDurationFast};
    }

    .ant-table-tbody > tr > .ant-table-cell-fix-start,
    .ant-table-tbody > tr > .ant-table-cell-fix-end {
      background: ${token.colorBgContainer};
    }

    .ant-table-tbody > tr:hover > .ant-table-cell {
      background: ${token.colorPrimaryBg};
    }

    .ant-table-tbody > tr:hover [data-house-avatar='true'] {
      border-color: ${token.colorBorder};
      background: ${token.colorFillSecondary};
    }

    .ant-table-body {
      min-height: ${HOUSE_TABLE_BODY_SCROLL_Y};
      scrollbar-gutter: stable;
    }

    .ant-table-cell .ant-form-item {
      margin-bottom: 0 !important;
    }

    .ant-table-cell .ant-form-item-control-input {
      min-height: 32px;
    }

    .ant-table-cell textarea.ant-input {
      height: 32px !important;
      min-height: 32px !important;
      resize: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .ant-table-tbody > tr > .ant-table-cell {
        transition: none;
      }
    }
  `,
  assetLayout: css`
    display: flex;
    align-items: stretch;
    gap: 16px;
    height: calc(100dvh - 120px);
    min-height: 520px;
    min-width: 0;
    transition: gap ${token.motionDurationMid} ${token.motionEaseOut};

    &:has([data-asset-navigator-collapsed='true']) {
      gap: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }

    @media (max-width: ${token.screenLG}px) {
      height: auto;
      min-height: 0;
      flex-direction: column;
    }
  `,
  tablePane: css`
    display: flex;
    flex: 1;
    min-height: 0;
    min-width: 0;
  `,
  tableCard: css`
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border-color: ${token.colorBorderSecondary};

    > .ant-card-body {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      box-sizing: border-box;
      padding: 0 ${token.padding}px ${token.paddingSM}px;
    }

    .ant-pro-table-list-toolbar-container {
      flex-wrap: wrap;
      gap: ${token.marginSM}px;
    }

    .ant-pro-table-list-toolbar-left,
    .ant-pro-table-list-toolbar-right {
      min-width: 0;
    }

    .ant-pro-table-list-toolbar-right {
      margin-inline-start: auto;
    }

    .ant-pagination {
      align-items: center;
      min-height: ${HOUSE_TABLE_PAGINATION_MIN_HEIGHT}px;
      margin-block: ${token.margin}px ${token.marginSM}px;
    }

    @media (max-width: ${token.screenLG}px) {
      min-height: 560px;
    }
  `,
  houseIdentity: css`
    display: flex;
    align-items: center;
    gap: ${token.marginSM}px;
    min-width: 0;

    .ant-typography {
      font-weight: 600;
    }
  `,
  houseAvatar: css`
    flex: 0 0 auto;
    border: 1px solid ${token.colorBorder};
    background: ${token.colorFillSecondary};
    transition:
      background-color ${token.motionDurationFast},
      border-color ${token.motionDurationFast};

    img {
      object-fit: cover;
    }
  `,
  housePlaceholder: css`
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    overflow: hidden;
  `,
  housePlaceholderIcon: css`
    width: 28px;
    height: 28px;
    color: ${token.colorTextSecondary} !important;
    opacity: 0.88;
  `,
  emptyState: css`
    padding-block: ${token.paddingXL}px;
  `,
  emptyDescription: css`
    display: flex;
    flex-direction: column;
    gap: ${token.marginXXS}px;
  `,
}));

type HouseSortableField = (typeof HOUSE_SORTABLE_FIELDS)[number];
type HouseOrdering = HouseSortableField | `-${HouseSortableField}`;
type HouseScopeFilters = {
  q?: string;
  status?: string;
  estateId?: number;
  buildingId?: number;
  ordering?: HouseOrdering;
};

type EditableHouseRow = HouseOut & HouseInlineEditableFields;

function toEditableHouseRow(house: HouseOut): EditableHouseRow {
  return {
    ...house,
    room_layout_edit: {
      bedrooms: house.bedrooms,
      living_rooms: house.living_rooms,
    },
    media_edit: {
      images: (house.images || []) as MediaRefValue[],
      videos: (house.videos || []) as MediaRefValue[],
    },
  };
}

function getPositiveId(value: string | null) {
  return value && /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

function getHousePageSize(value: string | null) {
  const pageSize = Number(value);
  return HOUSE_PAGE_SIZE_OPTIONS.includes(pageSize)
    ? pageSize
    : DEFAULT_PAGE_SIZE;
}

function parseHouseOrdering(value: string | null): HouseOrdering | undefined {
  if (!value || value.includes(',')) return undefined;
  const field = value.startsWith('-') ? value.slice(1) : value;
  if (!HOUSE_SORTABLE_FIELDS.includes(field as HouseSortableField)) {
    return undefined;
  }
  return value as HouseOrdering;
}

function getHouseOrderingField(columnKey: string) {
  if (columnKey === 'room_layout_edit') return 'layout';
  if (columnKey === 'building_id') return 'building';
  if (columnKey === 'landlord_id') return 'landlord';
  return columnKey;
}

function getHouseColumnSortOrder(
  ordering: HouseOrdering | undefined,
  field: HouseSortableField,
) {
  if (ordering === field) return 'ascend' as const;
  if (ordering === `-${field}`) return 'descend' as const;
  return undefined;
}

function getHouseListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page') || '1');
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    pageSize: getHousePageSize(params.get('page_size')),
    q: params.get('keyword') || undefined,
    status: params.get('status') || undefined,
    estateId: getPositiveId(params.get('estate_id')),
    buildingId: getPositiveId(params.get('building_id')),
    ordering: parseHouseOrdering(params.get('ordering')),
  };
}

function syncHouseListSearch(
  filters: HouseScopeFilters & { page: number; pageSize: number },
) {
  const params = new URLSearchParams(window.location.search);
  params.delete('keyword');
  params.delete('status');
  params.delete('estate_id');
  params.delete('building_id');
  params.delete('ordering');
  params.delete('page');
  params.delete('page_size');
  if (filters.q) params.set('keyword', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.estateId) params.set('estate_id', String(filters.estateId));
  if (filters.buildingId) params.set('building_id', String(filters.buildingId));
  if (filters.ordering) params.set('ordering', filters.ordering);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set('page_size', String(filters.pageSize));
  }
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function syncPropertyStructureIntent(intent?: PropertyStructureIntent) {
  const params = new URLSearchParams(window.location.search);
  params.delete('estate_edit');
  params.delete('estate_create');
  params.delete('building_edit');
  params.delete('building_create');
  if (intent?.estateCreate) {
    params.set('estate_create', '1');
  }
  if (intent?.estateEditId) {
    params.set('estate_edit', String(intent.estateEditId));
  }
  if (intent?.buildingEditId) {
    params.set('building_edit', String(intent.buildingEditId));
  }
  if (intent?.buildingCreateEstateId) {
    params.set('building_create', String(intent.buildingCreateEstateId));
  }
  if (intent?.buildingCreateStandalone) {
    params.set('building_create', 'standalone');
  }
  const nextSearch = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`,
  );
}

function buildHouseDetailHref(houseId: number, action?: 'edit') {
  const params = new URLSearchParams();
  if (action) params.set('action', action);
  const nextSearch = params.toString();
  return `/dashboard/rental/properties/${houseId}${nextSearch ? `?${nextSearch}` : ''}`;
}

function HouseTags({ tags }: { tags: string[] }) {
  if (!tags.length) return '-';

  const renderTags = () =>
    tags.map((tag) => (
      <Tag key={tag} style={{ marginInlineEnd: 4 }}>
        {tag}
      </Tag>
    ));

  return (
    <Popover
      content={
        <Space
          aria-label="完整房源标签"
          size={[4, 4]}
          wrap
          style={{ maxWidth: 360 }}
        >
          {renderTags()}
        </Space>
      }
    >
      <span
        data-testid="house-tags-summary"
        style={{
          display: 'block',
          maxWidth: 160,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        {renderTags()}
      </span>
    </Popover>
  );
}

const HousesPage: React.FC = () => {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const publishRules = useHousePublishRules();
  const queryClient = useQueryClient();
  const initialListState = useRef(
    getHouseListStateFromSearch(window.location.search),
  );
  const [q, setQ] = useState<string | undefined>(initialListState.current.q);
  const [searchDraft, setSearchDraft] = useState(
    initialListState.current.q || '',
  );
  const [status, setStatus] = useState<string | undefined>(
    initialListState.current.status,
  );
  const [estateId, setEstateId] = useState<number | undefined>(
    initialListState.current.estateId,
  );
  const [buildingId, setBuildingId] = useState<number | undefined>(
    initialListState.current.buildingId,
  );
  const [ordering, setOrdering] = useState<HouseOrdering | undefined>(
    initialListState.current.ordering,
  );
  const [page, setPage] = useState(initialListState.current.page);
  const [pageSize, setPageSize] = useState(initialListState.current.pageSize);
  const [listingConfirmHouseId, setListingConfirmHouseId] = useState<
    number | null
  >(null);
  const [listingConfirmStatus, setListingConfirmStatus] = useState<
    'listed' | 'vacant' | null
  >(null);
  const [editableKeys, setEditableKeys] = useState<React.Key[]>([]);
  const [tableRows, setTableRows] = useState<EditableHouseRow[]>([]);
  const [mediaEditorHouseId, setMediaEditorHouseId] = useState<number | null>(
    null,
  );
  const [mediaDrafts, setMediaDrafts] = useState<
    Record<number, HouseMediaEditValue>
  >({});
  const [structureOpen, setStructureOpen] = useState(false);
  const [assetNavigatorCollapsed, setAssetNavigatorCollapsed] = useState(() =>
    readPropertyAssetNavigatorCollapsed(workspace.selectedOrgSlug),
  );
  const enabled = Boolean(workspace.selectedOrgSlug);

  useEffect(() => {
    setAssetNavigatorCollapsed(
      readPropertyAssetNavigatorCollapsed(workspace.selectedOrgSlug),
    );
  }, [workspace.selectedOrgSlug]);

  const houseEnums = useEnums([
    'house.house_status',
    'house.house_orientation',
    'house.house_decoration',
  ]);
  const houses = useQuery({
    queryKey: [
      'house',
      'houses',
      workspace.selectedOrgSlug,
      page,
      pageSize,
      q,
      status,
      estateId,
      buildingId,
      ordering,
    ],
    queryFn: () =>
      houseApi.listHouses({
        page,
        page_size: pageSize,
        keyword: q,
        status,
        ...(estateId && !buildingId ? { estate_id: estateId } : {}),
        ...(buildingId ? { building_id: buildingId } : {}),
        ...(ordering ? { ordering } : {}),
      }),
    enabled,
  });
  const patchHouse = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: number;
      values: Record<string, unknown>;
      successMessage?: string;
    }) => houseApi.patchHouse(id, values),
    onSuccess: async (data, variables) => {
      setTableRows((current) =>
        current.map((row) =>
          row.id === variables.id ? toEditableHouseRow(data) : row,
        ),
      );
      message.success(variables.successMessage || '房源状态已更新');
      await queryClient.invalidateQueries({ queryKey: ['house', 'houses'] });
    },
  });
  const openListingConfirm = (id: number, nextStatus: 'listed' | 'vacant') => {
    setListingConfirmHouseId(id);
    setListingConfirmStatus(nextStatus);
  };
  const rows = useMemo(() => houses.data?.items || [], [houses.data?.items]);
  const listLoading = isInitialQueryPending(houses);
  const houseStatusOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_status',
  );
  const orientationOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_orientation',
  );
  const decorationOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_decoration',
  );
  const clearHouseFilters = () => {
    setPage(1);
    setSearchDraft('');
    setQ(undefined);
    setStatus(undefined);
  };
  const hasActiveFilters = Boolean(q || status);
  const emptyState = (
    <div className={styles.emptyState}>
      {hasActiveFilters ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span className={styles.emptyDescription}>
              <Typography.Text strong>未找到符合条件的房源</Typography.Text>
              <Typography.Text type="secondary">
                可以清除关键词或房态筛选后重试
              </Typography.Text>
            </span>
          }
        >
          <Button onClick={clearHouseFilters}>清除筛选</Button>
        </Empty>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span className={styles.emptyDescription}>
              <Typography.Text strong>当前范围暂无房源</Typography.Text>
              <Typography.Text type="secondary">
                新建房源后可在这里维护房态与出租资料
              </Typography.Text>
            </span>
          }
        >
          <Button
            type="primary"
            aria-label="新建房源"
            icon={<PlusOutlined />}
            onClick={() => history.push('/rental/properties/new')}
          >
            新建房源
          </Button>
        </Empty>
      )}
    </div>
  );
  const editorEnabled = enabled && editableKeys.length > 0;
  const editingRows = useMemo(() => {
    const editingIds = new Set(editableKeys.map(String));
    return tableRows.filter((row) => editingIds.has(String(row.id)));
  }, [editableKeys, tableRows]);
  const selectedBuildingIds = useMemo(
    () => editingRows.map((row) => row.building_id),
    [editingRows],
  );
  const selectedLandlordIds = useMemo(
    () => editingRows.map((row) => row.landlord_id),
    [editingRows],
  );
  const pinnedBuildings = useMemo(
    () =>
      editingRows
        .map((row) => row.building)
        .filter((building): building is BuildingOut => Boolean(building)),
    [editingRows],
  );
  const pinnedLandlords = useMemo(
    () =>
      editingRows
        .map((row) => row.landlord)
        .filter((landlord): landlord is ContactOut => Boolean(landlord)),
    [editingRows],
  );
  const editorBuildings = usePagedSelectOptions<BuildingOut>({
    getOptionLabel: buildingLabel,
    getSelectedFallbackLabel: (id) => `楼栋 #${id}`,
    queryKey: ['house', 'list-editor', 'buildings', workspace.selectedOrgSlug],
    queryFn: (query) => houseApi.listBuildings(query),
    pinnedItems: pinnedBuildings,
    selectedIds: selectedBuildingIds,
    enabled: editorEnabled,
  });
  const editorLandlords = usePagedSelectOptions<ContactOut>({
    getOptionLabel: contactLabel,
    getSelectedFallbackLabel: (id) => `联系人 #${id}`,
    queryKey: ['house', 'list-editor', 'landlords', workspace.selectedOrgSlug],
    queryFn: (query) =>
      houseApi.listContacts({
        ...query,
        role: 'landlord',
        task: 'active',
      }),
    pinnedItems: pinnedLandlords,
    selectedIds: selectedLandlordIds,
    enabled: editorEnabled,
  });
  const tagSuggestions = useQuery({
    queryKey: ['house', 'tag-suggestions'],
    queryFn: () => houseApi.getTagSuggestions(),
    enabled: editorEnabled,
  });

  useEffect(() => {
    if (editableKeys.length) return;
    setTableRows(rows.map(toEditableHouseRow));
  }, [editableKeys.length, rows]);

  useEffect(() => {
    syncHouseListSearch({
      page,
      pageSize,
      q,
      status,
      estateId,
      buildingId,
      ordering,
    });
  }, [buildingId, estateId, ordering, page, pageSize, q, status]);

  useEffect(() => {
    const handlePopState = () => {
      const listState = getHouseListStateFromSearch(window.location.search);
      setQ(listState.q);
      setSearchDraft(listState.q || '');
      setStatus(listState.status);
      setPage(listState.page);
      setPageSize(listState.pageSize);
      setEstateId(listState.estateId);
      setBuildingId(listState.buildingId);
      setOrdering(listState.ordering);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const columns: ProColumns<EditableHouseRow>[] = [
    {
      title: '房源',
      dataIndex: 'room_number',
      key: 'room_number',
      sorter: true,
      defaultSortOrder: getHouseColumnSortOrder(ordering, 'room_number'),
      search: false,
      width: 160,
      fixed: 'left',
      formItemProps: {
        rules: [{ required: true, message: '请输入房号' }],
      },
      formItemRender: () => <Input aria-label="房号" style={{ width: 120 }} />,
      render: (_value, record) => {
        const coverUrl = mediaCoverUrl(record.images);
        return (
          <div className={styles.houseIdentity}>
            <Avatar
              alt="房源图"
              className={styles.houseAvatar}
              data-house-avatar="true"
              icon={
                <span
                  aria-hidden="true"
                  className={styles.housePlaceholder}
                  data-testid="house-image-placeholder"
                >
                  <AppIcon
                    className={styles.housePlaceholderIcon}
                    data-house-placeholder-icon="true"
                    name="house.placeholder"
                  />
                </span>
              }
              shape="square"
              size={48}
              src={coverUrl}
            />
            <HousePreview id={record.id}>
              <Typography.Text>{record.room_number}</Typography.Text>
            </HousePreview>
          </div>
        );
      },
    },
    {
      title: '所属项目',
      dataIndex: ['building', 'estate'],
      key: 'estate',
      search: false,
      width: 160,
      editable: false,
      render: (_value, record) => {
        const estate = record.building?.estate;
        const name = estate?.display_name || estate?.name;
        return name ? (
          <EstatePreview id={estate.id}>
            <Typography.Text ellipsis>{name}</Typography.Text>
          </EstatePreview>
        ) : (
          <Typography.Text type="secondary">独立楼栋</Typography.Text>
        );
      },
    },
    {
      title: '户型',
      dataIndex: 'room_layout_edit',
      key: 'room_layout_edit',
      sorter: true,
      defaultSortOrder: getHouseColumnSortOrder(ordering, 'layout'),
      search: false,
      width: 184,
      align: 'center',
      formItemRender: (_schema, config) => (
        <HouseRoomLayoutInlineEditor
          value={config.value}
          onChange={config.onChange}
        />
      ),
      render: (_value, record) =>
        housePrimaryLayoutText(record, {
          bedroomLabel: '房',
          livingRoomLabel: '厅',
        }),
    },
    {
      title: '卫生间',
      dataIndex: 'bathrooms',
      key: 'bathrooms',
      search: false,
      width: 96,
      align: 'right',
      formItemRender: () => (
        <InputNumber aria-label="卫生间" min={0} style={{ width: 88 }} />
      ),
      render: (_value, record) =>
        record.bedrooms === 1 && record.living_rooms === 0
          ? '-'
          : `${record.bathrooms || 0}卫`,
    },
    {
      title: '厨房',
      dataIndex: 'kitchens',
      key: 'kitchens',
      search: false,
      width: 80,
      align: 'right',
      formItemRender: () => (
        <InputNumber aria-label="厨房" min={0} style={{ width: 88 }} />
      ),
      render: (_value, record) => houseKitchenText(record),
    },
    {
      title: '阳台',
      dataIndex: 'balconies',
      key: 'balconies',
      search: false,
      width: 80,
      align: 'right',
      formItemRender: () => (
        <InputNumber aria-label="阳台" min={0} style={{ width: 88 }} />
      ),
      render: (_value, record) => houseBalconyText(record),
    },
    {
      title: '建筑面积',
      dataIndex: 'area',
      key: 'area',
      search: false,
      width: 116,
      align: 'right',
      formItemRender: () => (
        <InputNumber
          aria-label="建筑面积"
          min={0}
          precision={2}
          suffix="㎡"
          style={{ width: 116 }}
        />
      ),
      render: (_value, record) => (record.area ? `${record.area}㎡` : '-'),
    },
    {
      title: '套内面积',
      dataIndex: 'interior_area',
      key: 'interior_area',
      search: false,
      width: 116,
      align: 'right',
      formItemRender: () => (
        <InputNumber
          aria-label="套内面积"
          min={0}
          precision={2}
          suffix="㎡"
          style={{ width: 116 }}
        />
      ),
      render: (_value, record) =>
        record.interior_area ? `${record.interior_area}㎡` : '-',
    },
    {
      title: '楼层',
      dataIndex: 'floor',
      key: 'floor',
      search: false,
      width: 88,
      align: 'right',
      formItemRender: () => (
        <InputNumber aria-label="所在楼层" suffix="层" style={{ width: 88 }} />
      ),
      render: (_value, record) =>
        record.floor === null || record.floor === undefined
          ? '-'
          : `${record.floor}层`,
    },
    {
      title: '朝向',
      dataIndex: 'orientation',
      key: 'orientation',
      search: false,
      width: 110,
      align: 'center',
      formItemRender: () => (
        <Select
          allowClear
          aria-label="朝向"
          placeholder="朝向"
          showSearch={{ optionFilterProp: 'label' }}
          options={orientationOptions}
          style={{ width: 110 }}
        />
      ),
      render: (_value, record) =>
        record.orientation
          ? enumMapping(record.orientation, record.orientation__mapping)
          : '-',
    },
    {
      title: '装修',
      dataIndex: 'decoration',
      key: 'decoration',
      search: false,
      width: 110,
      align: 'center',
      formItemRender: () => (
        <Select
          allowClear
          aria-label="装修"
          placeholder="装修"
          showSearch={{ optionFilterProp: 'label' }}
          options={decorationOptions}
          style={{ width: 110 }}
        />
      ),
      render: (_value, record) =>
        record.decoration
          ? enumMapping(record.decoration, record.decoration__mapping)
          : '-',
    },
    {
      title: '所属楼栋',
      dataIndex: 'building_id',
      key: 'building_id',
      sorter: true,
      defaultSortOrder: getHouseColumnSortOrder(ordering, 'building'),
      search: false,
      width: 190,
      formItemProps: {
        rules: [{ required: true, message: '请选择楼栋' }],
      },
      formItemRender: () => (
        <Select
          aria-label="所属楼栋"
          showSearch={editorBuildings.showSearch}
          loading={editorBuildings.loading}
          notFoundContent={editorBuildings.notFoundContent}
          onOpenChange={editorBuildings.onOpenChange}
          onPopupScroll={editorBuildings.onPopupScroll}
          placeholder="搜索小区或楼栋"
          style={{ width: 220 }}
          options={editorBuildings.options}
        />
      ),
      render: (_value, record) => {
        const buildingName =
          record.building?.name || `楼栋 #${record.building_id}`;
        return (
          <BuildingPreview id={record.building_id}>
            <Typography.Text ellipsis>{buildingName}</Typography.Text>
          </BuildingPreview>
        );
      },
    },
    {
      title: '楼栋电梯',
      dataIndex: ['building', 'elevator'],
      key: 'building_elevator',
      search: false,
      width: 100,
      editable: false,
      align: 'center',
      render: (_value, record) => (
        <Tag color={record.building?.elevator ? 'success' : 'default'}>
          {record.building?.elevator ? '有电梯' : '无电梯'}
        </Tag>
      ),
    },
    {
      title: '挂牌租金',
      dataIndex: 'asking_rent',
      key: 'asking_rent',
      sorter: true,
      defaultSortOrder: getHouseColumnSortOrder(ordering, 'asking_rent'),
      search: false,
      width: 110,
      align: 'right',
      formItemRender: () => (
        <InputNumber
          aria-label="挂牌租金"
          min={0}
          precision={2}
          style={{ width: 120 }}
        />
      ),
      render: (_value, record) => moneyText(record.asking_rent),
    },
    {
      title: '押金',
      dataIndex: 'deposit_amount',
      key: 'deposit_amount',
      sorter: true,
      defaultSortOrder: getHouseColumnSortOrder(ordering, 'deposit_amount'),
      search: false,
      width: 110,
      align: 'right',
      formItemRender: () => (
        <InputNumber
          aria-label="押金"
          min={0}
          precision={2}
          style={{ width: 120 }}
        />
      ),
      render: (_value, record) => moneyText(record.deposit_amount),
    },
    {
      title: '房东',
      dataIndex: 'landlord_id',
      key: 'landlord_id',
      sorter: true,
      defaultSortOrder: getHouseColumnSortOrder(ordering, 'landlord'),
      search: false,
      width: 150,
      formItemRender: () => (
        <Select
          allowClear
          aria-label="房东"
          showSearch={editorLandlords.showSearch}
          loading={editorLandlords.loading}
          notFoundContent={editorLandlords.notFoundContent}
          onOpenChange={editorLandlords.onOpenChange}
          onPopupScroll={editorLandlords.onPopupScroll}
          placeholder="搜索房东姓名或手机号"
          style={{ width: 200 }}
          options={editorLandlords.options}
        />
      ),
      render: (_value, record) => (
        <ContactPreview id={record.landlord_id}>
          {record.landlord?.name || '待补房东'}
        </ContactPreview>
      ),
    },
    {
      title: '图片视频',
      dataIndex: 'media_edit',
      key: 'media',
      search: false,
      width: 130,
      editable: false,
      align: 'center',
      render: (_value, record, _index, action) => {
        const media = mediaDrafts[record.id];
        const mediaText = media
          ? `${media.images.length} 图 / ${media.videos.length} 视频`
          : houseMediaReadinessText(record);
        const isEditing = editableKeys.includes(record.id);
        return (
          <Button
            type="link"
            size="small"
            aria-label="图片视频"
            onClick={() => {
              if (!isEditing) {
                action?.startEditable?.(record.id);
              }
              setMediaEditorHouseId(record.id);
            }}
          >
            {mediaText}
          </Button>
        );
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      search: false,
      width: 180,
      valueType: 'select',
      fieldProps: {
        'aria-label': '房源标签',
        allowClear: true,
        maxTagCount: 1,
        maxTagPlaceholder: (omittedValues: unknown[]) =>
          `+${omittedValues.length}`,
        mode: 'tags',
        placeholder: '输入标签后回车',
        style: { width: 220 },
        tokenSeparators: [',', '，', ';', '；', '、'],
        options: (tagSuggestions.data?.tags || []).map((tag) => ({
          label: tag,
          value: tag,
        })),
      },
      render: (_value, record) => <HouseTags tags={houseDisplayTags(record)} />,
    },
    {
      title: '对外描述',
      dataIndex: 'public_description',
      key: 'public_description',
      search: false,
      width: 220,
      formItemRender: () => (
        <Input.TextArea
          aria-label="对外描述"
          autoSize={{ minRows: 1, maxRows: 1 }}
          style={{ width: 260 }}
        />
      ),
      render: (_value, record) =>
        record.public_description ? (
          <Typography.Text
            ellipsis
            title={record.public_description}
            type="secondary"
          >
            {record.public_description}
          </Typography.Text>
        ) : (
          '-'
        ),
    },
    {
      title: '内部备注',
      dataIndex: 'internal_notes',
      key: 'internal_notes',
      search: false,
      width: 180,
      formItemRender: () => (
        <Input.TextArea
          aria-label="内部备注"
          autoSize={{ minRows: 1, maxRows: 1 }}
          style={{ width: 220 }}
        />
      ),
      render: (_value, record) =>
        record.internal_notes ? (
          <Typography.Text
            ellipsis
            title={record.internal_notes}
            type="secondary"
          >
            {record.internal_notes}
          </Typography.Text>
        ) : (
          '-'
        ),
    },
    {
      title: '房态',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      defaultSortOrder: getHouseColumnSortOrder(ordering, 'status'),
      fixed: 'right',
      width: HOUSE_STATUS_COLUMN_WIDTH,
      search: false,
      align: 'center',
      formItemRender: () => (
        <Select
          aria-label="房态"
          options={houseStatusOptions}
          style={{ width: 120 }}
        />
      ),
      render: (_value, record) => (
        <AppStatusTag name="house" state={record.status}>
          {enumMapping(record.status, record.status__mapping)}
        </AppStatusTag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      key: 'actions',
      valueType: 'option',
      fixed: 'right',
      search: false,
      width: 120,
      align: 'center',
      render: (_value, record, _index, action) => {
        const isListed = record.status === HOUSE_STATUS.LISTED;
        const canToggleListing =
          isListed || record.status === HOUSE_STATUS.VACANT;
        const nextStatus = isListed ? HOUSE_STATUS.VACANT : HOUSE_STATUS.LISTED;
        return (
          <ResponsiveActions>
            <Tooltip title="行内编辑">
              <Button
                type="link"
                size="small"
                aria-label={`编辑房源 ${record.room_number}`}
                icon={<EditOutlined />}
                onClick={() => action?.startEditable?.(record.id)}
              />
            </Tooltip>
            <a href={buildHouseDetailHref(record.id, 'edit')}>编辑资料</a>
            <Tooltip title="更多操作">
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'publish',
                      disabled:
                        !canToggleListing ||
                        (nextStatus === HOUSE_STATUS.LISTED &&
                          publishRules.isPending),
                      label: isListed ? '下架' : '发布',
                    },
                  ],
                  onClick: () => {
                    if (nextStatus === HOUSE_STATUS.LISTED) {
                      const publishState = evaluateHousePublishState(
                        record,
                        publishRules.rules,
                      );
                      if (!publishState.canPublish) {
                        message.warning(
                          `请先补齐：${publishState.blockingIssues.join('、')}`,
                        );
                        return;
                      }
                    }
                    openListingConfirm(record.id, nextStatus);
                  },
                }}
              >
                <Button
                  type="text"
                  size="small"
                  aria-label="更多操作"
                  icon={<MoreOutlined />}
                />
              </Dropdown>
            </Tooltip>
          </ResponsiveActions>
        );
      },
    },
  ];
  const tableColumnsState = useUserTableColumnsState({
    tableKey: HOUSE_TABLE_KEY,
    columns,
  });

  const handleScopeChange = (scope: PropertyAssetScope) => {
    setPage(1);
    setEstateId(scope.estateId);
    setBuildingId(scope.buildingId);
  };

  const handleOpenStructure = (intent?: PropertyStructureIntent) => {
    syncPropertyStructureIntent(intent);
    setStructureOpen(true);
  };

  const handleCloseStructure = () => {
    syncPropertyStructureIntent();
    setStructureOpen(false);
  };

  const handleAssetNavigatorCollapsedChange = (collapsed: boolean) => {
    setAssetNavigatorCollapsed(collapsed);
    writePropertyAssetNavigatorCollapsed(collapsed, workspace.selectedOrgSlug);
  };
  return (
    <TenantSelectionGuard title="房源">
      <div className={styles.assetLayout}>
        <PropertyAssetNavigator
          collapsed={assetNavigatorCollapsed}
          disabled={editableKeys.length > 0}
          enabled={enabled}
          orgSlug={workspace.selectedOrgSlug}
          scope={{ estateId, buildingId }}
          onOpenManagement={handleOpenStructure}
          onScopeChange={handleScopeChange}
        />
        <div className={styles.tablePane}>
          <Card className={styles.tableCard}>
            <EditableProTable<EditableHouseRow>
              key={`house-table-ordering:${ordering || 'default'}`}
              className={styles.stableEditableTable}
              rowKey="id"
              loading={listLoading}
              columns={columns}
              value={tableRows}
              onChange={(nextRows) => setTableRows([...nextRows])}
              recordCreatorProps={false}
              editable={{
                type: 'multiple',
                editableKeys,
                saveText: '保存',
                cancelText: '取消',
                onChange: (keys) => {
                  setEditableKeys(keys);
                  if (!keys.length) {
                    setMediaEditorHouseId(null);
                  }
                },
                onSave: async (key, record) => {
                  const houseId = Number(key);
                  await patchHouse.mutateAsync({
                    id: houseId,
                    values: buildHouseInlinePatch({
                      ...record,
                      media_edit: mediaDrafts[houseId] || record.media_edit,
                    }),
                    successMessage: '房源已更新',
                  });
                  setMediaEditorHouseId((current) =>
                    current === houseId ? null : current,
                  );
                  setMediaDrafts((current) => {
                    const next = { ...current };
                    delete next[houseId];
                    return next;
                  });
                },
                onCancel: async (key) => {
                  const houseId = Number(key);
                  setMediaEditorHouseId((current) =>
                    current === houseId ? null : current,
                  );
                  setMediaDrafts((current) => {
                    const next = { ...current };
                    delete next[houseId];
                    return next;
                  });
                },
                actionRender: (_row, _config, defaultDoms) => [
                  defaultDoms.save,
                  defaultDoms.cancel,
                ],
              }}
              search={false}
              locale={{ emptyText: emptyState }}
              headerTitle={
                <Tooltip
                  title={
                    assetNavigatorCollapsed ? '展开房源范围' : '收起房源范围'
                  }
                >
                  <Button
                    type="text"
                    aria-label={
                      assetNavigatorCollapsed ? '展开房源范围' : '收起侧栏'
                    }
                    icon={
                      assetNavigatorCollapsed ? (
                        <MenuUnfoldOutlined />
                      ) : (
                        <MenuFoldOutlined />
                      )
                    }
                    onClick={() =>
                      handleAssetNavigatorCollapsedChange(
                        !assetNavigatorCollapsed,
                      )
                    }
                  />
                </Tooltip>
              }
              options={{
                density: true,
                reload: false,
                setting: true,
              }}
              columnsState={{
                value: tableColumnsState.value,
                onChange: tableColumnsState.onChange,
              }}
              toolBarRender={() => [
                <Input.Search
                  key="keyword"
                  allowClear
                  disabled={editableKeys.length > 0}
                  placeholder="搜索房号 / 小区 / 楼栋 / 房东"
                  value={searchDraft}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setSearchDraft(nextValue);
                    if (!nextValue) {
                      setPage(1);
                      setQ(undefined);
                    }
                  }}
                  onSearch={(value) => {
                    setPage(1);
                    const nextValue = value.trim() || undefined;
                    setSearchDraft(value);
                    setQ(nextValue);
                  }}
                  style={{ width: 240 }}
                />,
                <Select
                  key="status"
                  aria-label="房态筛选"
                  allowClear
                  disabled={editableKeys.length > 0}
                  placeholder="房态"
                  options={houseStatusOptions}
                  value={status}
                  onChange={(value) => {
                    setPage(1);
                    setStatus(value);
                  }}
                  style={{ width: 120 }}
                />,
                <Button
                  key="create"
                  type="primary"
                  aria-label="新建房源"
                  disabled={editableKeys.length > 0}
                  icon={<PlusOutlined />}
                  onClick={() => history.push('/rental/properties/new')}
                >
                  新建房源
                </Button>,
              ]}
              ghost
              pagination={{
                current: page,
                disabled: editableKeys.length > 0,
                pageSize,
                pageSizeOptions: HOUSE_PAGE_SIZE_OPTIONS,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 套`,
                total: houses.data?.total || 0,
                onChange: (nextPage, nextPageSize) => {
                  if (editableKeys.length) return;
                  if (nextPageSize !== pageSize) {
                    setPage(1);
                    setPageSize(nextPageSize);
                    return;
                  }
                  setPage(nextPage);
                },
              }}
              scroll={{
                ...adminTableScroll,
                scrollToFirstRowOnChange: true,
                y: HOUSE_TABLE_BODY_SCROLL_Y,
              }}
              onTableChange={(_pagination, _filters, sorter, extra) => {
                if (editableKeys.length) return;
                if (extra.action !== 'sort' || Array.isArray(sorter)) return;
                const field = getHouseOrderingField(
                  String(sorter.columnKey || ''),
                );
                const nextOrdering = sorter.order
                  ? parseHouseOrdering(
                      `${sorter.order === 'descend' ? '-' : ''}${field}`,
                    )
                  : undefined;
                setPage(1);
                setOrdering(nextOrdering);
              }}
            />
          </Card>
        </div>
      </div>
      <HouseMediaInlineEditorModal
        open={mediaEditorHouseId !== null}
        value={
          mediaEditorHouseId === null
            ? undefined
            : mediaDrafts[mediaEditorHouseId] ||
              tableRows.find((row) => row.id === mediaEditorHouseId)?.media_edit
        }
        onClose={() => setMediaEditorHouseId(null)}
        onChange={(value) => {
          if (mediaEditorHouseId === null) return;
          setMediaDrafts((current) => ({
            ...current,
            [mediaEditorHouseId]: value,
          }));
        }}
      />
      <Modal
        open={listingConfirmStatus !== null}
        aria-label={
          listingConfirmStatus === HOUSE_STATUS.LISTED
            ? '确认发布房源'
            : '确认下架房源'
        }
        title={
          listingConfirmStatus === HOUSE_STATUS.LISTED
            ? '确认发布房源'
            : '确认下架房源'
        }
        okText={
          listingConfirmStatus === HOUSE_STATUS.LISTED ? '确认发布' : '确认下架'
        }
        cancelText="先取消"
        transitionName=""
        maskTransitionName=""
        onCancel={() => {
          setListingConfirmHouseId(null);
          setListingConfirmStatus(null);
        }}
        onOk={async () => {
          const nextStatus = listingConfirmStatus;
          const nextId = listingConfirmHouseId;
          if (!nextStatus || !nextId) return;
          setListingConfirmHouseId(null);
          setListingConfirmStatus(null);
          await patchHouse.mutateAsync({
            id: nextId,
            values: { status: nextStatus },
          });
        }}
      >
        <Typography.Text>
          {listingConfirmStatus === HOUSE_STATUS.LISTED
            ? '确认后房源状态将切换为招租，继续承接带看。'
            : '确认后房源状态将切换为空置，不再对外展示。'}
        </Typography.Text>
      </Modal>
      <Drawer
        title="管理项目与楼栋"
        open={structureOpen}
        size="large"
        destroyOnHidden
        onClose={handleCloseStructure}
      >
        <EstatesPage />
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default HousesPage;
