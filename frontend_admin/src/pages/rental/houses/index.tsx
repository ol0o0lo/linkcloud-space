import {
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  PlusOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { EditableProTable } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dropdown,
  Empty,
  Form,
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
import { AdvancedFilterToolbar } from '@/components/AdvancedFilterToolbar';
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
  type EstateOut,
  type HouseOut,
  type HousePatchInput,
  houseApi,
} from '@/services/manual/house';
import DealSigningDrawer from '../components/DealSigningDrawer';
import {
  buildingLabel,
  contactLabel,
  dateTimeText,
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
  HouseMatchShareModal,
  mergeHouseMatchSelection,
} from './HouseMatchShareModal';
import {
  HOUSE_STATUS_COLUMN_WIDTH,
  HOUSE_TABLE_BODY_SCROLL_Y,
  HOUSE_TABLE_CONTEXT_BODY_SCROLL_Y,
  HOUSE_TABLE_PAGINATION_MIN_HEIGHT,
} from './houseListLayout';
import {
  getHouseListStateFromSearch,
  HOUSE_PAGE_SIZE_OPTIONS,
  type HouseInspectionFilter,
  type HouseInspectionReason,
  type HouseOrdering,
  type HouseScope,
  type HouseSortableField,
  type HouseStatus,
  parseHouseOrdering,
  syncHouseListSearch,
} from './listState';
import {
  type PropertyAssetAction,
  PropertyAssetNavigator,
  type PropertyAssetScope,
  readPropertyAssetNavigatorCollapsed,
  writePropertyAssetNavigatorCollapsed,
} from './PropertyAssetNavigator';
import {
  PropertyAssetWorkspace,
  type PropertyAssetWorkspaceTab,
} from './PropertyAssetWorkspace';

const HOUSE_TABLE_KEY = 'rental.houses';

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
  scopedAssetTable: css`
    .ant-table-body {
      min-height: ${HOUSE_TABLE_CONTEXT_BODY_SCROLL_Y};
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
  assetNavigatorToggle: css`
    margin-inline-end: ${token.marginSM}px;
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
  shareBadge: css`
    .ant-badge-count {
      background: ${token.colorPrimary};
      box-shadow: 0 0 0 1px ${token.colorBgContainer};
    }
  `,
  houseColumnTitle: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: ${token.marginXXS}px;
  `,
  selectedCountButton: css`
    height: auto;
    padding-inline: 2px;
    font-size: ${token.fontSizeSM}px;
  `,
}));

type HouseAdvancedFilterDraft = {
  inspectionFilter?: HouseInspectionFilter;
  q: string;
  status?: HouseStatus;
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

function HouseInspectionReasons({ house }: { house: HouseOut }) {
  const reasons = house.inspection_reasons || [];
  if (!reasons.length) return '-';
  return (
    <Space size={[4, 4]} wrap>
      {reasons.map((reason) => {
        if (reason === 'missing_images') {
          return (
            <Tag key={reason} color="warning">
              缺少照片
            </Tag>
          );
        }
        if (reason === 'missing_videos') {
          return (
            <Tag key={reason} color="warning">
              缺少视频
            </Tag>
          );
        }
        return (
          <Tag key={reason} color="error">
            {house.inspection_max_age_days
              ? `超过 ${house.inspection_max_age_days} 天未更新`
              : '资料已过期'}
          </Tag>
        );
      })}
    </Space>
  );
}

const HousesPage: React.FC = () => {
  const { styles, cx } = useStyles();
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
  const [status, setStatus] = useState<HouseStatus | undefined>(
    initialListState.current.status,
  );
  const [estateId, setEstateId] = useState<number | undefined>(
    initialListState.current.estateId,
  );
  const [buildingId, setBuildingId] = useState<number | undefined>(
    initialListState.current.buildingId,
  );
  const [assetTab, setAssetTab] = useState<PropertyAssetWorkspaceTab>(
    initialListState.current.assetTab,
  );
  const [assetAction, setAssetAction] = useState<
    PropertyAssetAction | undefined
  >(initialListState.current.assetAction);
  const [ordering, setOrdering] = useState<HouseOrdering | undefined>(
    initialListState.current.ordering,
  );
  const [scope, setScope] = useState<HouseScope>(
    initialListState.current.scope,
  );
  const [inspectionDue, setInspectionDue] = useState(
    initialListState.current.inspectionDue,
  );
  const [inspectionReason, setInspectionReason] = useState<
    HouseInspectionReason | undefined
  >(initialListState.current.inspectionReason);
  const [page, setPage] = useState(initialListState.current.page);
  const [pageSize, setPageSize] = useState(initialListState.current.pageSize);
  const [listingConfirmHouseId, setListingConfirmHouseId] = useState<
    number | null
  >(null);
  const [listingConfirmStatus, setListingConfirmStatus] = useState<
    'listed' | 'vacant' | null
  >(null);
  const [editableKeys, setEditableKeys] = useState<React.Key[]>([]);
  const [selectedHouseIds, setSelectedHouseIds] = useState<number[]>([]);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [responsiveOverflowFilterKeys, setResponsiveOverflowFilterKeys] =
    useState<string[]>([]);
  const [advancedFilterDraft, setAdvancedFilterDraft] =
    useState<HouseAdvancedFilterDraft>(() => ({
      q: initialListState.current.q || '',
      status: initialListState.current.status,
      inspectionFilter:
        initialListState.current.inspectionReason ||
        (initialListState.current.inspectionDue ? 'due' : undefined),
    }));
  const [houseMatchOpen, setHouseMatchOpen] = useState(false);
  const [dealSigningHouse, setDealSigningHouse] = useState<HouseOut | null>(
    null,
  );
  const [confirmCurrentHouse, setConfirmCurrentHouse] =
    useState<HouseOut | null>(null);
  const [tableRows, setTableRows] = useState<EditableHouseRow[]>([]);
  const [mediaEditorHouseId, setMediaEditorHouseId] = useState<number | null>(
    null,
  );
  const [mediaDrafts, setMediaDrafts] = useState<
    Record<number, HouseMediaEditValue>
  >({});
  const [assetProfileEditing, setAssetProfileEditing] = useState(false);
  const [assetNavigatorCollapsed, setAssetNavigatorCollapsed] = useState(() =>
    readPropertyAssetNavigatorCollapsed(workspace.selectedOrgSlug),
  );
  const enabled = Boolean(workspace.selectedOrgSlug);
  const isMineScope = scope === 'mine';
  const inspectionFilter: HouseInspectionFilter | undefined =
    inspectionReason || (inspectionDue ? 'due' : undefined);

  useEffect(() => {
    setAssetNavigatorCollapsed(
      readPropertyAssetNavigatorCollapsed(workspace.selectedOrgSlug),
    );
    setSelectedHouseIds([]);
    setAdvancedFilterOpen(false);
    setHouseMatchOpen(false);
    setDealSigningHouse(null);
    setConfirmCurrentHouse(null);
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
      scope,
      inspectionDue,
      inspectionReason,
    ],
    queryFn: () =>
      houseApi.listHouses({
        page,
        page_size: pageSize,
        keyword: q,
        status,
        scope,
        ...(inspectionDue ? { inspection_due: true } : {}),
        ...(inspectionDue && inspectionReason
          ? { inspection_reason: inspectionReason }
          : {}),
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
      values: HousePatchInput;
      successMessage?: string;
    }) => houseApi.patchHouse(id, values),
    onSuccess: async (data, variables) => {
      setTableRows((current) =>
        current.map((row) =>
          row.id === variables.id ? toEditableHouseRow(data) : row,
        ),
      );
      message.success(variables.successMessage || '房源已更新');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['house', 'houses'] }),
        queryClient.invalidateQueries({
          queryKey: ['house', 'workbench-inspections'],
        }),
      ]);
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
    setInspectionDue(false);
    setInspectionReason(undefined);
  };
  const hasActiveFilters = Boolean(q || status || inspectionReason);
  const newHouseHref = buildingId
    ? `/rental/properties/new?building_id=${buildingId}`
    : '/rental/properties/new';
  const emptyState = (
    <div className={styles.emptyState}>
      {inspectionDue && !hasActiveFilters ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span className={styles.emptyDescription}>
              <Typography.Text strong>
                {isMineScope
                  ? '当前负责房源均无需勘察'
                  : '当前没有需要勘察的房源'}
              </Typography.Text>
              <Typography.Text type="secondary">
                {isMineScope
                  ? '当前没有需要补充照片、视频或复查资料的负责房源'
                  : '组织内没有需要补充照片、视频或复查资料的房源'}
              </Typography.Text>
            </span>
          }
        >
          <Button
            onClick={() => {
              setPage(1);
              setInspectionReason(undefined);
              setInspectionDue(false);
            }}
          >
            {isMineScope ? '查看我的全部房源' : '查看全部房源'}
          </Button>
        </Empty>
      ) : hasActiveFilters ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span className={styles.emptyDescription}>
              <Typography.Text strong>未找到符合条件的房源</Typography.Text>
              <Typography.Text type="secondary">
                可以清除关键词、房态或勘察原因筛选后重试
              </Typography.Text>
            </span>
          }
        >
          <Button onClick={clearHouseFilters}>清除筛选</Button>
        </Empty>
      ) : isMineScope ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span className={styles.emptyDescription}>
              <Typography.Text strong>
                当前没有分配给你的负责房源
              </Typography.Text>
              <Typography.Text type="secondary">
                管理员完成房东、小区或楼栋分工后，相关房源会显示在这里
              </Typography.Text>
            </span>
          }
        />
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
            onClick={() => history.push(newHouseHref)}
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
    if (editableKeys.length) setAdvancedFilterOpen(false);
  }, [editableKeys.length]);

  useEffect(() => {
    syncHouseListSearch({
      assetAction,
      assetTab,
      page,
      pageSize,
      q,
      status,
      estateId,
      buildingId,
      ordering,
      scope,
      inspectionDue,
      inspectionReason,
    });
  }, [
    assetAction,
    assetTab,
    buildingId,
    estateId,
    inspectionReason,
    ordering,
    page,
    pageSize,
    q,
    status,
    scope,
    inspectionDue,
  ]);

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
      setAssetTab(listState.assetTab);
      setAssetAction(listState.assetAction);
      setOrdering(listState.ordering);
      setScope(listState.scope);
      setInspectionDue(listState.inspectionDue);
      setInspectionReason(listState.inspectionReason);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const columns: ProColumns<EditableHouseRow>[] = [
    {
      title: (
        <span className={styles.houseColumnTitle}>
          <span>房源</span>
          {selectedHouseIds.length ? (
            <Button
              type="link"
              size="small"
              className={styles.selectedCountButton}
              aria-label={`清除已选择的 ${selectedHouseIds.length} 套房源`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedHouseIds([]);
              }}
            >
              已选 {selectedHouseIds.length}
            </Button>
          ) : null}
        </span>
      ),
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
      title: '勘察原因',
      dataIndex: 'inspection_reasons',
      key: 'inspection_reasons',
      search: false,
      editable: false,
      hideInTable: !inspectionDue,
      width: 240,
      render: (_value, record) => <HouseInspectionReasons house={record} />,
    },
    {
      title: '资料更新',
      dataIndex: 'updated_at',
      key: 'updated_at',
      search: false,
      editable: false,
      hideInTable: !inspectionDue,
      width: 170,
      align: 'center',
      render: (_value, record) => dateTimeText(record.updated_at),
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
      width: inspectionDue ? 180 : 120,
      align: 'center',
      render: (_value, record, _index, action) => {
        const isListed = record.status === HOUSE_STATUS.LISTED;
        const canToggleListing =
          isListed || record.status === HOUSE_STATUS.VACANT;
        const canDealSign = record.status !== HOUSE_STATUS.INACTIVE;
        const nextStatus = isListed ? HOUSE_STATUS.VACANT : HOUSE_STATUS.LISTED;
        const inspectionReasons = record.inspection_reasons || [];
        const hasMissingMedia = inspectionReasons.some(
          (reason) =>
            reason === 'missing_images' || reason === 'missing_videos',
        );
        const hasExpiredInspection = inspectionReasons.includes('expired');
        return (
          <ResponsiveActions>
            {inspectionDue ? (
              hasMissingMedia ? (
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    action?.startEditable?.(record.id);
                    setMediaEditorHouseId(record.id);
                  }}
                >
                  补充资料
                </Button>
              ) : (
                <Button
                  type="link"
                  size="small"
                  onClick={() => action?.startEditable?.(record.id)}
                >
                  更新资料
                </Button>
              )
            ) : (
              <Tooltip title="快速编辑">
                <Button
                  type="link"
                  size="small"
                  aria-label={`快速编辑房源 ${record.room_number}`}
                  icon={<EditOutlined />}
                  onClick={() => action?.startEditable?.(record.id)}
                />
              </Tooltip>
            )}
            <a
              href={buildHouseDetailHref(
                record.id,
                inspectionDue ? undefined : 'edit',
              )}
            >
              {inspectionDue ? '查看详情' : '完整编辑'}
            </a>
            <Tooltip title="更多操作">
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    ...(inspectionDue && hasExpiredInspection
                      ? [
                          {
                            key: 'confirm-current',
                            label: '确认资料仍有效',
                          },
                        ]
                      : []),
                    {
                      key: 'deal-signing',
                      disabled: !canDealSign,
                      label: '成交签约',
                    },
                    {
                      key: 'publish',
                      disabled:
                        !canToggleListing ||
                        (nextStatus === HOUSE_STATUS.LISTED &&
                          publishRules.isPending),
                      label: isListed ? '下架' : '发布',
                    },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'confirm-current') {
                      setConfirmCurrentHouse(record);
                      return;
                    }
                    if (key === 'deal-signing') {
                      setDealSigningHouse(record);
                      return;
                    }
                    if (key !== 'publish') return;
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

  const handleScopeChange = (assetScope: PropertyAssetScope) => {
    setPage(1);
    setAssetAction(undefined);
    setAssetTab('houses');
    setEstateId(assetScope.estateId);
    setBuildingId(assetScope.buildingId);
  };

  const handleAssetTabChange = (nextTab: PropertyAssetWorkspaceTab) => {
    if (editableKeys.length || assetProfileEditing) return;
    setAssetTab(nextTab);
  };

  const handleAssetAction = (nextAction: PropertyAssetAction) => {
    if (editableKeys.length || assetProfileEditing) return;
    setPage(1);
    setAssetAction(nextAction);
    if (nextAction.type === 'create-building' && nextAction.estateId) {
      setEstateId(nextAction.estateId);
      setBuildingId(undefined);
      return;
    }
    if (nextAction.type === 'edit-estate') {
      setEstateId(nextAction.estateId);
      setBuildingId(undefined);
      setAssetTab('profile');
      return;
    }
    if (nextAction.type === 'edit-building') {
      setEstateId(undefined);
      setBuildingId(nextAction.buildingId);
      setAssetTab('profile');
    }
  };

  const handleAssetActionCancel = () => {
    setAssetAction(undefined);
  };

  const handleAssetSaved = (
    kind: 'estate' | 'building',
    asset: EstateOut | BuildingOut,
  ) => {
    setPage(1);
    setAssetAction(undefined);
    setAssetTab('profile');
    if (kind === 'estate') {
      setEstateId(asset.id);
      setBuildingId(undefined);
      return;
    }
    setEstateId(undefined);
    setBuildingId(asset.id);
  };

  const handleAssetDeleted = () => {
    setPage(1);
    setAssetAction(undefined);
    setAssetTab('houses');
    setEstateId(undefined);
    setBuildingId(undefined);
  };

  const handleAssetNavigatorCollapsedChange = (collapsed: boolean) => {
    setAssetNavigatorCollapsed(collapsed);
    writePropertyAssetNavigatorCollapsed(collapsed, workspace.selectedOrgSlug);
  };
  const assetNavigatorToggle = (
    <Tooltip title={assetNavigatorCollapsed ? '展开房源范围' : '收起房源范围'}>
      <Button
        className={styles.assetNavigatorToggle}
        type="text"
        aria-label={assetNavigatorCollapsed ? '展开房源范围' : '收起侧栏'}
        icon={
          assetNavigatorCollapsed ? (
            <MenuUnfoldOutlined />
          ) : (
            <MenuFoldOutlined />
          )
        }
        onClick={() =>
          handleAssetNavigatorCollapsedChange(!assetNavigatorCollapsed)
        }
      />
    </Tooltip>
  );
  const handleHouseScopeChange = (nextScope: HouseScope) => {
    if (editableKeys.length) return;
    setPage(1);
    setSelectedHouseIds([]);
    setEstateId(undefined);
    setBuildingId(undefined);
    setAssetAction(undefined);
    setAssetTab('houses');
    setScope(nextScope);
  };
  const handleAdvancedFilterOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setAdvancedFilterDraft({
        q: q || '',
        status,
        inspectionFilter,
      });
    }
    setAdvancedFilterOpen(nextOpen);
  };
  const handleConfirmAdvancedFilters = () => {
    setPage(1);
    setSelectedHouseIds([]);
    if (responsiveOverflowFilterKeys.includes('keyword')) {
      const nextKeyword = advancedFilterDraft.q.trim() || undefined;
      setSearchDraft(advancedFilterDraft.q);
      setQ(nextKeyword);
    }
    setStatus(advancedFilterDraft.status);
    if (!advancedFilterDraft.inspectionFilter) {
      setInspectionDue(false);
      setInspectionReason(undefined);
      return;
    }
    setInspectionDue(true);
    setInspectionReason(
      advancedFilterDraft.inspectionFilter === 'due'
        ? undefined
        : advancedFilterDraft.inspectionFilter,
    );
  };
  return (
    <TenantSelectionGuard title="房源">
      <div className={styles.assetLayout}>
        <PropertyAssetNavigator
          collapsed={assetNavigatorCollapsed}
          disabled={editableKeys.length > 0 || assetProfileEditing}
          enabled={enabled}
          houseScope={scope}
          orgSlug={workspace.selectedOrgSlug}
          scope={{ estateId, buildingId }}
          onAction={handleAssetAction}
          onHouseScopeChange={handleHouseScopeChange}
          onScopeChange={handleScopeChange}
        />
        <div className={styles.tablePane}>
          <Card className={styles.tableCard}>
            <PropertyAssetWorkspace
              action={assetAction}
              activeTab={assetTab}
              buildingId={buildingId}
              estateId={estateId}
              tabSwitchDisabled={editableKeys.length > 0}
              onAction={handleAssetAction}
              onActionCancel={handleAssetActionCancel}
              onAssetDeleted={handleAssetDeleted}
              onAssetSaved={handleAssetSaved}
              onEditingChange={setAssetProfileEditing}
              onScopeChange={handleScopeChange}
              onTabChange={handleAssetTabChange}
              tabBarExtraContent={assetNavigatorToggle}
            >
              <EditableProTable<EditableHouseRow>
                key={`house-table-ordering:${ordering || 'default'}`}
                className={cx(
                  styles.stableEditableTable,
                  Boolean(estateId || buildingId) && styles.scopedAssetTable,
                )}
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
                  <Space size="small">
                    {!estateId && !buildingId ? assetNavigatorToggle : null}
                    <Typography.Text strong>房源列表</Typography.Text>
                  </Space>
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
                rowSelection={{
                  preserveSelectedRowKeys: true,
                  selectedRowKeys: selectedHouseIds,
                  getCheckboxProps: (record) => ({
                    disabled:
                      editableKeys.length > 0 ||
                      record.status !== HOUSE_STATUS.LISTED ||
                      (selectedHouseIds.length >= 100 &&
                        !selectedHouseIds.includes(record.id)),
                  }),
                  onChange: (nextKeys) => {
                    setSelectedHouseIds((current) => {
                      const merged = mergeHouseMatchSelection(
                        current,
                        nextKeys,
                      );
                      if (
                        merged === current &&
                        nextKeys.length > current.length
                      ) {
                        message.warning('手工配房最多选择 100 套房源');
                      }
                      return merged;
                    });
                  },
                }}
                tableAlertRender={false}
                tableAlertOptionRender={false}
                toolBarRender={() => [
                  <AdvancedFilterToolbar
                    key="house-filters"
                    advancedActive={Boolean(
                      (status && status !== HOUSE_STATUS.LISTED) ||
                        inspectionDue,
                    )}
                    advancedContent={
                      <Form
                        component={false}
                        disabled={editableKeys.length > 0}
                        layout="vertical"
                        requiredMark={false}
                      >
                        <Form.Item label="房态">
                          <Select<HouseStatus>
                            aria-label="房态筛选"
                            allowClear
                            options={houseStatusOptions}
                            placeholder="全部房态"
                            value={advancedFilterDraft.status}
                            onChange={(value) =>
                              setAdvancedFilterDraft((current) => ({
                                ...current,
                                status: value,
                              }))
                            }
                          />
                        </Form.Item>
                        <Form.Item label="勘察状态">
                          <Select<HouseInspectionFilter>
                            aria-label="勘察筛选"
                            allowClear
                            options={[
                              { label: '待勘察', value: 'due' },
                              { label: '缺少照片', value: 'missing_images' },
                              { label: '缺少视频', value: 'missing_videos' },
                              { label: '资料过期', value: 'expired' },
                            ]}
                            placeholder="全部勘察状态"
                            value={advancedFilterDraft.inspectionFilter}
                            onChange={(value) =>
                              setAdvancedFilterDraft((current) => ({
                                ...current,
                                inspectionFilter: value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Form>
                    }
                    responsiveFilters={[
                      {
                        key: 'keyword',
                        priority: 10,
                        active: Boolean(q),
                        content: (
                          <Input.Search
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
                          />
                        ),
                        drawerContent: (
                          <Form.Item label="关键词">
                            <Input
                              allowClear
                              aria-label="关键词高级筛选"
                              placeholder="搜索房号 / 小区 / 楼栋 / 房东"
                              value={advancedFilterDraft.q}
                              onChange={(event) =>
                                setAdvancedFilterDraft((current) => ({
                                  ...current,
                                  q: event.target.value,
                                }))
                              }
                            />
                          </Form.Item>
                        ),
                      },
                    ]}
                    actions={
                      <>
                        {selectedHouseIds.length ? (
                          <Tooltip
                            title={`生成配房链接（已选 ${selectedHouseIds.length} 套）`}
                          >
                            <Badge
                              count={selectedHouseIds.length}
                              className={styles.shareBadge}
                              offset={[-2, 2]}
                              size="small"
                            >
                              <Button
                                aria-label={`生成配房链接，已选 ${selectedHouseIds.length} 套`}
                                disabled={editableKeys.length > 0}
                                icon={<ShareAltOutlined />}
                                onClick={() => setHouseMatchOpen(true)}
                              />
                            </Badge>
                          </Tooltip>
                        ) : null}
                        <Button
                          type="primary"
                          aria-label="新建房源"
                          disabled={editableKeys.length > 0}
                          icon={<PlusOutlined />}
                          onClick={() => history.push(newHouseHref)}
                        >
                          新建房源
                        </Button>
                      </>
                    }
                    disabled={editableKeys.length > 0}
                    open={advancedFilterOpen}
                    triggerAriaLabel="高级筛选"
                    triggerText={null}
                    onConfirm={handleConfirmAdvancedFilters}
                    onOpenChange={handleAdvancedFilterOpenChange}
                    onResponsiveOverflowChange={setResponsiveOverflowFilterKeys}
                    onReset={() =>
                      setAdvancedFilterDraft((current) => ({
                        q: responsiveOverflowFilterKeys.includes('keyword')
                          ? ''
                          : current.q,
                        status: HOUSE_STATUS.LISTED,
                      }))
                    }
                  />,
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
                  y:
                    estateId || buildingId
                      ? HOUSE_TABLE_CONTEXT_BODY_SCROLL_Y
                      : HOUSE_TABLE_BODY_SCROLL_Y,
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
            </PropertyAssetWorkspace>
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
      <HouseMatchShareModal
        open={houseMatchOpen}
        selectedHouseIds={selectedHouseIds}
        decorationOptions={decorationOptions}
        onCancel={() => setHouseMatchOpen(false)}
      />
      <DealSigningDrawer
        open={Boolean(dealSigningHouse)}
        house={dealSigningHouse}
        onClose={() => setDealSigningHouse(null)}
      />
      <Modal
        open={Boolean(confirmCurrentHouse)}
        title="确认房源资料仍有效"
        okText="确认仍有效"
        cancelText="返回核对"
        confirmLoading={patchHouse.isPending}
        onCancel={() => setConfirmCurrentHouse(null)}
        onOk={async () => {
          if (!confirmCurrentHouse) return;
          await patchHouse.mutateAsync({
            id: confirmCurrentHouse.id,
            values: { confirm_current: true },
            successMessage: '房源资料已确认有效',
          });
          setConfirmCurrentHouse(null);
        }}
      >
        <Typography.Paragraph>
          请确认已经核对“{confirmCurrentHouse?.room_number}
          ”的房源资料，且当前信息仍然准确。
        </Typography.Paragraph>
        <Typography.Text type="secondary">
          确认后会刷新资料更新时间；如果照片、视频仍有缺失，房源仍会保留在待勘察列表中。
        </Typography.Text>
      </Modal>
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
    </TenantSelectionGuard>
  );
};

export default HousesPage;
