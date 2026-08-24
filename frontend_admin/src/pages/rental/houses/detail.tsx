import {
  ArrowLeftOutlined,
  EditOutlined,
  FileAddOutlined,
  HeartFilled,
  HeartOutlined,
  MoreOutlined,
  ScheduleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  theme,
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
  LeasePreview,
  ViewingPreview,
} from '@/components/EntityPreview';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import {
  enumMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import {
  favoriteKeys,
  useFavoriteState,
  useToggleFavorite,
} from '@/services/manual/favoriteHooks';
import {
  type BuildingOut,
  type ContactOut,
  type HouseOut,
  houseApi,
  type LeaseOut,
  type ViewingRecordOut,
} from '@/services/manual/house';
import MediaRefsUpload from '../components/MediaRefsUpload';
import {
  getInheritedPropertyTags,
  normalizePropertyTags,
  PropertyTagSelect,
} from '../components/PropertyTagSelect';
import {
  buildingLabel,
  contactLabel,
  dateTimeText,
  evaluateHousePublishState,
  HOUSE_MEDIA_RESOURCE_TYPE,
  HOUSE_MEDIA_TYPE,
  HOUSE_STATUS,
  houseBalconyText,
  houseDisplayTags,
  houseKitchenText,
  housePrimaryLayoutText,
  type MediaRefValue,
  stripDerivedMediaFields,
} from '../constants';
import { useHousePublishRules } from '../useHousePublishRules';
import { usePagedSelectOptions } from '../usePagedSelectOptions';
import HouseLocationPoiCard from './HouseLocationPoiCard';
import HouseMediaHero from './HouseMediaHero';
import {
  InlineEditableField,
  type InlineEditCloseReason,
  useInlineEditingSupported,
} from './InlineEditableField';

type DetailFocusState = {
  action?: string;
  scopeKey?: string;
  task?: string;
};

type InlineFieldKey =
  | 'area'
  | 'asking_rent'
  | 'balconies'
  | 'bathrooms'
  | 'decoration'
  | 'deposit_amount'
  | 'floor'
  | 'internal_notes'
  | 'kitchens'
  | 'landlord_id'
  | 'layout'
  | 'orientation'
  | 'public_description'
  | 'room_number'
  | 'tags'
  | `extra:${string}`;

type InlineLayoutValue = {
  bedrooms?: number | null;
  living_rooms?: number | null;
};

type InlineLayoutDraft = {
  bedrooms: number | null;
  living_rooms: number | null;
};

type InlineExtraDraft =
  | { kind: 'array'; value: string[] }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'number'; value: number | null }
  | { kind: 'object'; value: string }
  | { kind: 'text'; value: string };

type PendingInlineAction =
  | { field: InlineFieldKey; type: 'field' }
  | { task?: string; type: 'drawer' };

const HOUSE_EDIT_NUMERIC_FIELDS = [
  'floor',
  'area',
  'interior_area',
  'asking_rent',
  'deposit_amount',
  'bedrooms',
  'living_rooms',
  'bathrooms',
  'kitchens',
  'balconies',
] as const;
const HOUSE_EDIT_NULLABLE_FIELDS = [
  'landlord_id',
  'orientation',
  'decoration',
] as const;

const useStyles = createStyles(({ css, token }) => ({
  heroCard: css`
    overflow: hidden;

    .ant-card-body {
      padding: 0;
    }
  `,
  summaryPane: css`
    display: flex;
    min-height: 430px;
    height: 100%;
    flex-direction: column;
    justify-content: center;
    padding: 28px 30px;

    @media (max-width: 991px) {
      min-height: auto;
      padding: 24px;
    }
  `,
  locationLine: css`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 10px;
    color: ${token.colorTextSecondary};
  `,
  identityBlock: css`
    padding-bottom: 18px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  identityHeader: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  `,
  statusLine: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;

    .ant-tag {
      margin-inline-end: 0;
    }
  `,
  pageToolbar: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 40px;
    gap: 16px;

    @media (max-width: 575px) {
      align-items: flex-start;
      flex-direction: column;
    }
  `,
  pageActions: css`
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  `,
  rentBlock: css`
    padding: 18px 0 16px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  rentLine: css`
    display: flex;
    align-items: baseline;
    gap: 6px;
  `,
  rentAmount: css`
    color: ${token.colorError} !important;
  `,
  depositLine: css`
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 8px;
  `,
  depositAmount: css`
    color: ${token.colorTextSecondary};
    font-weight: ${token.fontWeightStrong};
  `,
  factsGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 8px;

    @media (max-width: 420px) {
      grid-template-columns: 1fr;
    }
  `,
  factItem: css`
    min-width: 0;
    padding: 12px 0;
    border-bottom: 1px solid ${token.colorBorderSecondary};

    &:nth-of-type(odd) {
      padding-right: 18px;
      border-right: 1px solid ${token.colorBorderSecondary};
    }

    &:nth-of-type(even) {
      padding-left: 18px;
    }

    @media (max-width: 420px) {
      padding-right: 0 !important;
      padding-left: 0 !important;
      border-right: 0 !important;
    }
  `,
  factValue: css`
    display: block;
    margin-top: 4px;
    color: ${token.colorText};
    font-weight: ${token.fontWeightStrong};
    line-height: 1.5;
    overflow-wrap: anywhere;
    white-space: normal;
  `,
  descriptionText: css`
    margin: 0;
    color: ${token.colorText};
    line-height: 1.8;
    white-space: pre-wrap;
  `,
  noteLine: css`
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 12px;
  `,
  tagsSection: css`
    margin-top: 12px;

    .ant-tag {
      margin-inline-end: 0;
    }
  `,
  fieldsSection: css`
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid ${token.colorBorderSecondary};
  `,
  materialGroupGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 767px) {
      grid-template-columns: 1fr;
    }
  `,
  materialGroup: css`
    min-width: 0;
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  materialGroupWide: css`
    grid-column: 1 / -1;
  `,
  materialGroupTitle: css`
    display: block;
    margin-bottom: 14px;
    color: ${token.colorTextSecondary};
  `,
  materialFieldGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 24px;

    @media (max-width: 575px) {
      grid-template-columns: 1fr;
    }
  `,
  materialFieldWide: css`
    grid-column: 1 / -1;
  `,
  materialField: css`
    min-width: 0;
  `,
  materialFieldLabel: css`
    display: block;
    margin-bottom: 4px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  materialFieldValue: css`
    color: ${token.colorText};
    line-height: 1.6;
    overflow-wrap: anywhere;
  `,
  drawerTabs: css`
    .ant-tabs-nav {
      position: sticky;
      top: 0;
      z-index: 2;
      margin-bottom: 16px;
      background: ${token.colorBgContainer};
    }
  `,
  recordTable: css`
    .ant-table-thead > tr > th {
      white-space: nowrap;
    }

    .ant-table-cell {
      vertical-align: middle;
    }

    .ant-table-body {
      scrollbar-gutter: stable;
    }
  `,
  recordPrimary: css`
    display: block;
    color: ${token.colorText};
    font-weight: ${token.fontWeightStrong};
    line-height: 1.5;
    white-space: nowrap;
  `,
  recordSecondary: css`
    display: block;
    margin-top: 2px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    line-height: 1.4;
    white-space: nowrap;
  `,
  recordMoney: css`
    display: block;
    color: ${token.colorText};
    font-weight: ${token.fontWeightStrong};
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  `,
}));

function dashboardHref(path: string) {
  return `/dashboard${path}`;
}

function getDetailFocusFromSearch(search: string): DetailFocusState {
  const params = new URLSearchParams(search);
  return {
    action: params.get('action') || undefined,
    task: params.get('task') || undefined,
  };
}

function syncDetailFocusSearch(focus: DetailFocusState) {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  params.delete('action');
  params.delete('task');
  if (focus.action) params.set('action', focus.action);
  if (focus.task) params.set('task', focus.task);

  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function leaseEditHref(houseId: number, leaseId: number) {
  const params = new URLSearchParams({
    house_id: String(houseId),
  });
  params.set('edit', String(leaseId));
  return dashboardHref(`/rental/leases?${params.toString()}`);
}

function needsViewingContactCompletion(viewing?: ViewingRecordOut) {
  return (
    viewing?.status === 'converted' &&
    !viewing.signed_lease_id &&
    !viewing.contact_id
  );
}

function viewingContactFixHref(viewingId: number) {
  return dashboardHref(
    `/rental/viewings?pending_lease=true&contact_missing=true&edit=${viewingId}`,
  );
}

function houseTitle(house: HouseOut) {
  return [
    house.building?.estate?.display_name || house.building?.estate?.name,
    house.building?.name,
    house.room_number,
  ]
    .filter(Boolean)
    .join(' · ');
}

function mappedText(value?: string | null, mapping?: string | null) {
  return value ? enumMapping(value, mapping || undefined) : '-';
}

function compactMoneyText(value?: string | number | null) {
  if (value == null || value === '') return '-';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `¥${value}`;
  return `¥${amount.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
  })}`;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableNumberUnchanged(draft: number | null, value: unknown) {
  return draft === nullableNumber(value);
}

function validateNonNegativeDecimal(value: number | null, label: string) {
  if (value === null) return undefined;
  if (!Number.isFinite(value) || value < 0) return `${label}必须大于等于 0`;
  const fraction = String(value).split('.')[1];
  return fraction && fraction.length > 2
    ? `${label}最多保留两位小数`
    : undefined;
}

function validateInteger(
  value: number | null,
  label: string,
  options?: { nonNegative?: boolean },
) {
  if (value === null) return undefined;
  if (!Number.isInteger(value)) return `${label}必须为整数`;
  if (options?.nonNegative && value < 0) return `${label}必须大于等于 0`;
  return undefined;
}

function dateTimeParts(value?: string | null) {
  const text = dateTimeText(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
  return {
    date: match?.[1] || text,
    time: match?.[2] || '',
  };
}

function customFieldLabel(key: string) {
  return key.replace(/[_-]+/g, ' ').trim() || key;
}

function customFieldValue(value: unknown): React.ReactNode {
  if (value == null || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) {
    const values = [...new Set(value.map((item) => String(item)))];
    return values.length ? (
      <Space size={[4, 4]} wrap>
        {values.map((item) => (
          <Tag key={item}>{item}</Tag>
        ))}
      </Space>
    ) : (
      '-'
    );
  }
  if (typeof value === 'object') {
    return (
      <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(value, null, 2)}
      </Typography.Text>
    );
  }
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isWideCustomField(value: unknown) {
  if (isPlainObject(value)) return true;
  if (Array.isArray(value)) return value.length > 3;
  return typeof value === 'string' && value.length > 18;
}

function prepareInlineExtraDraft(value: unknown): InlineExtraDraft {
  if (Array.isArray(value)) {
    return { kind: 'array', value: value.map((item) => String(item)) };
  }
  if (isPlainObject(value)) {
    return { kind: 'object', value: JSON.stringify(value, null, 2) };
  }
  if (typeof value === 'boolean') return { kind: 'boolean', value };
  if (typeof value === 'number') return { kind: 'number', value };
  return { kind: 'text', value: value == null ? '' : String(value) };
}

function parseInlineExtraDraft(
  draft: InlineExtraDraft,
  originalValue: unknown,
): unknown {
  if (draft.kind === 'object') return JSON.parse(draft.value);
  if (draft.kind === 'array') {
    const originalItems = Array.isArray(originalValue) ? originalValue : [];
    const originalsByText = new Map(
      originalItems.map((item) => [String(item), item]),
    );
    return draft.value.map((item) =>
      originalsByText.has(item) ? originalsByText.get(item) : item,
    );
  }
  if (draft.kind === 'text' && draft.value === '' && originalValue == null) {
    return originalValue;
  }
  return draft.value;
}

function validateInlineExtraDraft(draft: InlineExtraDraft) {
  if (draft.kind !== 'object') return undefined;
  try {
    const parsed = JSON.parse(draft.value);
    return isPlainObject(parsed) ? undefined : '请输入 JSON 对象';
  } catch {
    return 'JSON 格式不正确';
  }
}

function inlineExtraDraftUnchanged(
  draft: InlineExtraDraft,
  originalValue: unknown,
) {
  return (
    JSON.stringify(parseInlineExtraDraft(draft, originalValue)) ===
    JSON.stringify(originalValue)
  );
}

function normalizeHouseEditNumericValues(values: Record<string, unknown>) {
  const normalized = { ...values };
  HOUSE_EDIT_NUMERIC_FIELDS.forEach((field) => {
    if (
      normalized[field] === '' ||
      normalized[field] === null ||
      normalized[field] === undefined
    ) {
      normalized[field] = 0;
    }
  });
  HOUSE_EDIT_NULLABLE_FIELDS.forEach((field) => {
    if (normalized[field] === '' || normalized[field] === undefined) {
      normalized[field] = null;
    }
  });
  return normalized;
}

function getRequestErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as {
    info?: { code?: number };
    response?: { status?: number; data?: { code?: number } };
  };
  return (
    candidate.info?.code ||
    candidate.response?.data?.code ||
    candidate.response?.status
  );
}

function getRequestErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return '保存失败，请稍后重试';
  const candidate = error as {
    error?: string;
    info?: { error?: string; message?: string };
    message?: string;
    response?: { data?: { error?: string; message?: string } };
  };
  return (
    candidate.info?.message ||
    candidate.info?.error ||
    candidate.response?.data?.message ||
    candidate.response?.data?.error ||
    candidate.message ||
    candidate.error ||
    '保存失败，请稍后重试'
  );
}

const HouseDetailPage: React.FC = () => {
  const params = useParams();
  const houseId = Number(params.id);
  const validHouseId = Number.isInteger(houseId) && houseId > 0;
  const queryClient = useQueryClient();
  const { styles, cx } = useStyles();
  const { token } = theme.useToken();
  const [publishConfirmStatus, setPublishConfirmStatus] = useState<
    'listed' | 'vacant' | null
  >(null);
  const [editForm] = Form.useForm();
  const [editTab, setEditTab] = useState('basic');
  const [draftImages, setDraftImages] = useState<MediaRefValue[]>([]);
  const [draftVideos, setDraftVideos] = useState<MediaRefValue[]>([]);
  const [activeInlineField, setActiveInlineField] =
    useState<InlineFieldKey | null>(null);
  const [inlineSaving, setInlineSaving] = useState(false);
  const pendingInlineActionRef = useRef<PendingInlineAction | null>(null);
  const inlineEditingSupported = useInlineEditingSupported();
  const workspace = useTenantWorkspace();
  const publishRules = useHousePublishRules();
  const detailScopeKey = `${workspace.selectedOrgSlug || 'no-org'}:${validHouseId ? houseId : 'invalid'}`;
  const [detailFocus, setDetailFocus] = useState<DetailFocusState>(() =>
    typeof window === 'undefined'
      ? { scopeKey: detailScopeKey }
      : {
          ...getDetailFocusFromSearch(window.location.search),
          scopeKey: detailScopeKey,
        },
  );
  const scopedDetailFocus =
    detailFocus.scopeKey === detailScopeKey
      ? detailFocus
      : typeof window === 'undefined'
        ? {}
        : getDetailFocusFromSearch(window.location.search);
  const focusAction = scopedDetailFocus.action;
  const enabled = Boolean(workspace.selectedOrgSlug && validHouseId);
  const houseEnums = useEnums([
    'house.house_status',
    'house.house_orientation',
    'house.house_decoration',
  ]);
  const queryKey = ['house', 'detail', workspace.selectedOrgSlug, houseId];
  const updateDetailFocus = (nextFocus: DetailFocusState) => {
    syncDetailFocusSearch(nextFocus);
    setDetailFocus({ ...nextFocus, scopeKey: detailScopeKey });
  };
  const clearDetailFocus = () => updateDetailFocus({});
  const house = useQuery({
    queryKey,
    queryFn: () => houseApi.getHouse(houseId),
    enabled,
    retry: (failureCount, error) => {
      const code = getRequestErrorCode(error);
      if (code === 401 || code === 403 || code === 404) return false;
      return failureCount < 2;
    },
  });
  const relatedEnabled = enabled && house.data?.id === houseId;
  const favoriteState = useFavoriteState('house', houseId, {
    enabled: relatedEnabled,
  });
  const editOpen =
    relatedEnabled && (focusAction === 'edit' || focusAction === 'media');
  const pinnedBuildings = useMemo(
    () => [house.data?.building as BuildingOut | undefined],
    [house.data?.building],
  );
  const pinnedLandlords = useMemo(
    () => [house.data?.landlord as ContactOut | undefined],
    [house.data?.landlord],
  );
  const buildings = usePagedSelectOptions<BuildingOut>({
    getOptionLabel: buildingLabel,
    getSelectedFallbackLabel: (id) => `楼栋 #${id}`,
    queryKey: ['house', 'detail', 'buildings', workspace.selectedOrgSlug],
    queryFn: (query) => houseApi.listBuildings(query),
    pinnedItems: pinnedBuildings,
    selectedIds: [house.data?.building_id],
    enabled: relatedEnabled && editOpen,
  });
  const tagSuggestions = useQuery({
    queryKey: ['house', 'tag-suggestions'],
    queryFn: () => houseApi.getTagSuggestions(),
    enabled: relatedEnabled && editOpen,
  });
  const landlords = usePagedSelectOptions<ContactOut>({
    getOptionLabel: contactLabel,
    getSelectedFallbackLabel: (id) => `联系人 #${id}`,
    queryKey: ['house', 'detail', 'landlords', workspace.selectedOrgSlug],
    queryFn: (query) =>
      houseApi.listContacts({
        ...query,
        role: 'landlord',
        task: 'active',
      }),
    pinnedItems: pinnedLandlords,
    selectedIds: [house.data?.landlord_id],
    enabled:
      relatedEnabled &&
      (editOpen ||
        (inlineEditingSupported && activeInlineField === 'landlord_id')),
  });
  const viewings = useQuery({
    queryKey: [
      'house',
      'detail',
      'viewings',
      workspace.selectedOrgSlug,
      houseId,
    ],
    queryFn: () =>
      houseApi.listViewingRecords({
        page: 1,
        page_size: 10,
        house_id: houseId,
      }),
    enabled: relatedEnabled,
  });
  const leases = useQuery({
    queryKey: ['house', 'detail', 'leases', workspace.selectedOrgSlug, houseId],
    queryFn: () =>
      houseApi.listLeases({ page: 1, page_size: 5, house_id: houseId }),
    enabled: relatedEnabled,
  });
  const toggleFavorite = useToggleFavorite('house', houseId, {
    onSuccess: (_, wasFavorite) => {
      message.success(wasFavorite ? '已取消收藏' : '已收藏');
    },
    onError: () => message.error('收藏操作失败，请稍后重试'),
  });
  const syncHouseResult = (next: HouseOut) => {
    queryClient.setQueryData(queryKey, next);
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: favoriteKeys.target('house', houseId),
      }),
      queryClient.invalidateQueries({ queryKey: favoriteKeys.lists() }),
    ]);
  };
  const patchHouse = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      houseApi.patchHouse(houseId, values),
    onSuccess: (next) => {
      syncHouseResult(next);
      message.success('房源已更新');
    },
  });
  const saveInlinePatch = async (values: Record<string, unknown>) => {
    try {
      const next = await houseApi.patchHouse(houseId, values);
      syncHouseResult(next);
    } catch (error) {
      throw new Error(getRequestErrorMessage(error));
    }
  };
  const canPublish = Boolean(
    house.data &&
      !publishRules.isPending &&
      evaluateHousePublishState(house.data, publishRules.rules).canPublish,
  );
  const isPublished = house.data?.status === HOUSE_STATUS.LISTED;
  const canStartListing =
    house.data?.status === HOUSE_STATUS.VACANT && canPublish;
  const orientationOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_orientation',
  );
  const decorationOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_decoration',
  );
  const statusOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_status',
  );
  const publishButtonLabel = isPublished
    ? '下架房源'
    : canStartListing
      ? '发布房源'
      : house.data?.status === HOUSE_STATUS.VACANT
        ? '待补齐后发布'
        : '仅空置房源可发布';
  const editSectionStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    background: token.colorBgContainer,
  } as const;
  const inlineEditingEnabled =
    inlineEditingSupported && relatedEnabled && !editOpen;
  const performOpenEdit = (task?: string) => {
    setEditTab(
      task === 'media' ? 'media' : task === 'extra' ? 'display' : 'basic',
    );
    updateDetailFocus({ action: 'edit', task });
  };
  const openEdit = (task?: string) => {
    if (activeInlineField) {
      pendingInlineActionRef.current = { type: 'drawer', task };
      return;
    }
    performOpenEdit(task);
  };
  const requestInlineField = (field: InlineFieldKey) => {
    if (!inlineEditingEnabled || patchHouse.isPending) return;
    if (activeInlineField && activeInlineField !== field) {
      pendingInlineActionRef.current = { type: 'field', field };
      return;
    }
    if (!activeInlineField) setActiveInlineField(field);
  };
  const finishInlineField = (reason: InlineEditCloseReason) => {
    setInlineSaving(false);
    if (reason === 'cancelled') {
      pendingInlineActionRef.current = null;
      setActiveInlineField(null);
      return;
    }

    const pendingAction = pendingInlineActionRef.current;
    pendingInlineActionRef.current = null;
    setActiveInlineField(null);
    if (pendingAction?.type === 'field') {
      setActiveInlineField(pendingAction.field);
      return;
    }
    if (pendingAction?.type === 'drawer') {
      performOpenEdit(pendingAction.task);
    }
  };
  const failInlineField = () => {
    pendingInlineActionRef.current = null;
    setInlineSaving(false);
  };
  const closeEdit = () => {
    setEditTab('basic');
    clearDetailFocus();
  };
  const openPublishConfirm = (publishStatus: 'listed' | 'vacant') => {
    setPublishConfirmStatus(publishStatus);
  };

  useEffect(() => {
    setPublishConfirmStatus(null);
    setActiveInlineField(null);
    setInlineSaving(false);
    pendingInlineActionRef.current = null;
  }, [detailScopeKey]);

  useEffect(() => {
    if (!editOpen) return;
    if (focusAction === 'media') {
      setEditTab('media');
      return;
    }
    if (scopedDetailFocus.task === 'extra') {
      setEditTab('display');
      return;
    }
    setEditTab('basic');
  }, [editOpen, focusAction, scopedDetailFocus.task]);

  useEffect(() => {
    const handlePopState = () => {
      setDetailFocus({
        ...getDetailFocusFromSearch(window.location.search),
        scopeKey: detailScopeKey,
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [detailScopeKey]);

  const detailErrorCode = getRequestErrorCode(house.error);
  const detailErrorStatus: '403' | '404' | 'error' =
    detailErrorCode === 403 ? '403' : detailErrorCode === 404 ? '404' : 'error';
  const currentHouse = house.data;
  const buildingItems = buildings.items;
  const displayTags = houseDisplayTags(currentHouse);
  const ownTags = normalizePropertyTags(currentHouse?.tags);
  const inheritedTags = getInheritedPropertyTags(ownTags, displayTags);
  const houseImages = (currentHouse?.images || []) as MediaRefValue[];
  const houseVideos = (currentHouse?.videos || []) as MediaRefValue[];
  const customFieldEntries = Object.entries(currentHouse?.extra || {});
  const editInitialValues = currentHouse ? { ...currentHouse } : undefined;

  useEffect(() => {
    if (!editOpen || !currentHouse) return;
    editForm.resetFields();
    editForm.setFieldsValue(currentHouse);
    setDraftImages((currentHouse.images || []) as MediaRefValue[]);
    setDraftVideos((currentHouse.videos || []) as MediaRefValue[]);
  }, [currentHouse, editForm, editOpen]);
  const quickActionItems = currentHouse
    ? [
        {
          key: 'viewing',
          icon: <ScheduleOutlined />,
          label: (
            <a href={dashboardHref(`/rental/viewings?house_id=${houseId}`)}>
              登记带看
            </a>
          ),
        },
        {
          key: 'lease',
          icon: <FileAddOutlined />,
          label: (
            <a href={dashboardHref(`/rental/leases?house_id=${houseId}`)}>
              新建租约
            </a>
          ),
        },
        {
          key: 'status',
          icon: <SwapOutlined />,
          label: '修改房态',
        },
        { type: 'divider' as const },
        {
          key: 'publish',
          danger: isPublished,
          disabled: !isPublished && !canStartListing,
          label: publishButtonLabel,
        },
        { type: 'divider' as const },
        {
          key: 'back',
          icon: <ArrowLeftOutlined />,
          label: (
            <a href={dashboardHref('/rental/properties/list')}>返回列表</a>
          ),
        },
      ]
    : [];

  return (
    <TenantSelectionGuard title={false}>
      {!validHouseId ? (
        <Result
          status="404"
          title="房源地址无效"
          subTitle="请从房源列表重新选择要查看的房源。"
          extra={
            <Button type="primary" href="/dashboard/rental/properties/list">
              返回房源列表
            </Button>
          }
        />
      ) : house.isLoading ? (
        <Card loading style={{ minHeight: 360 }} />
      ) : house.isError ? (
        <Result
          status={detailErrorStatus}
          title={
            detailErrorCode === 404
              ? '未找到房源'
              : detailErrorCode === 403
                ? '无权查看此房源'
                : '房源加载失败'
          }
          subTitle={
            detailErrorCode === 404
              ? '房源不存在，或不属于当前空间。'
              : detailErrorCode === 403
                ? '请确认已选择正确的空间，并拥有相应访问权限。'
                : '暂时无法取得房源资料，请稍后重试。'
          }
          extra={
            <Space wrap>
              <Button href="/dashboard/rental/properties/list">
                返回房源列表
              </Button>
              {detailErrorCode !== 404 ? (
                <Button type="primary" onClick={() => house.refetch()}>
                  重新加载
                </Button>
              ) : null}
            </Space>
          }
        />
      ) : currentHouse ? (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div className={styles.pageToolbar}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              房源详情
            </Typography.Title>
            <div className={styles.pageActions}>
              <Button
                aria-label="编辑资料"
                icon={<EditOutlined />}
                type="primary"
                onPointerDown={() => {
                  if (activeInlineField) {
                    pendingInlineActionRef.current = { type: 'drawer' };
                  }
                }}
                onClick={() => openEdit()}
              >
                编辑资料
              </Button>
              <Dropdown
                placement="bottomRight"
                trigger={['click']}
                menu={{
                  items: quickActionItems,
                  onClick: ({ key }) => {
                    if (key === 'status') {
                      openEdit('status');
                      return;
                    }
                    if (key === 'publish') {
                      openPublishConfirm(
                        isPublished ? HOUSE_STATUS.VACANT : HOUSE_STATUS.LISTED,
                      );
                    }
                  },
                }}
              >
                <Button aria-label="更多快捷操作" icon={<MoreOutlined />} />
              </Dropdown>
            </div>
          </div>
          <Card className={styles.heroCard}>
            <Row gutter={0} align="stretch">
              <Col xs={24} lg={15}>
                <HouseMediaHero images={houseImages} videos={houseVideos} />
              </Col>
              <Col xs={24} lg={9}>
                <div className={styles.summaryPane}>
                  <div className={styles.identityBlock}>
                    <div className={styles.identityHeader}>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {houseTitle(currentHouse)}
                      </Typography.Title>
                      <Button
                        aria-label={
                          favoriteState.isFavorite ? '取消收藏' : '收藏房源'
                        }
                        disabled={
                          !favoriteState.data ||
                          (!isPublished && !favoriteState.isFavorite)
                        }
                        icon={
                          favoriteState.isFavorite ? (
                            <HeartFilled />
                          ) : (
                            <HeartOutlined />
                          )
                        }
                        loading={
                          favoriteState.isLoading || toggleFavorite.isPending
                        }
                        shape="circle"
                        style={
                          favoriteState.isFavorite
                            ? { color: token.colorError }
                            : undefined
                        }
                        title={
                          favoriteState.isFavorite
                            ? '取消收藏'
                            : isPublished
                              ? '收藏房源'
                              : '仅公开招租房源可收藏'
                        }
                        type="text"
                        onClick={() =>
                          toggleFavorite.mutate(favoriteState.isFavorite)
                        }
                      />
                    </div>
                    <div className={styles.statusLine}>
                      <AppStatusTag name="house" state={currentHouse.status}>
                        {enumMapping(
                          currentHouse.status,
                          currentHouse.status__mapping,
                        )}
                      </AppStatusTag>
                    </div>
                    <div className={styles.locationLine}>
                      <AppIcon name="location" style={{ marginTop: 3 }} />
                      <span>
                        {currentHouse.building?.address || '楼栋地址待补充'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.rentBlock}>
                    <InlineEditableField<
                      string | number | null | undefined,
                      number | null
                    >
                      active={activeInlineField === 'asking_rent'}
                      ariaLabel="编辑挂牌租金"
                      disabled={inlineSaving || patchHouse.isPending}
                      enabled={inlineEditingEnabled}
                      fieldKey="asking_rent"
                      isUnchanged={nullableNumberUnchanged}
                      prepareDraft={nullableNumber}
                      renderDisplay={() => (
                        <div className={styles.rentLine}>
                          <Typography.Title
                            className={styles.rentAmount}
                            level={2}
                            style={{ margin: 0 }}
                          >
                            {currentHouse.asking_rent
                              ? compactMoneyText(currentHouse.asking_rent)
                              : '租金待补'}
                          </Typography.Title>
                          {currentHouse.asking_rent ? (
                            <Typography.Text type="secondary">
                              / 月
                            </Typography.Text>
                          ) : null}
                        </div>
                      )}
                      renderEditor={({ draft, saving, setDraft }) => (
                        <InputNumber
                          autoFocus
                          aria-label="挂牌租金"
                          changeOnBlur={false}
                          controls={false}
                          disabled={saving}
                          min={0}
                          precision={2}
                          prefix="¥"
                          size="small"
                          suffix="/ 月"
                          value={draft}
                          style={{ width: '100%' }}
                          onChange={setDraft}
                        />
                      )}
                      validate={(draft) =>
                        validateNonNegativeDecimal(draft, '挂牌租金')
                      }
                      value={currentHouse.asking_rent}
                      onClose={finishInlineField}
                      onRequestActivate={(field) =>
                        requestInlineField(field as InlineFieldKey)
                      }
                      onSave={(draft) =>
                        saveInlinePatch({ asking_rent: draft })
                      }
                      onSaveFailure={failInlineField}
                      onSavingChange={setInlineSaving}
                    />
                    <InlineEditableField<
                      string | number | null | undefined,
                      number | null
                    >
                      active={activeInlineField === 'deposit_amount'}
                      ariaLabel="编辑押金"
                      disabled={inlineSaving || patchHouse.isPending}
                      enabled={inlineEditingEnabled}
                      fieldKey="deposit_amount"
                      isUnchanged={nullableNumberUnchanged}
                      prepareDraft={nullableNumber}
                      renderDisplay={() => (
                        <div className={styles.depositLine}>
                          <Typography.Text type="secondary">
                            押金
                          </Typography.Text>
                          <Typography.Text className={styles.depositAmount}>
                            {compactMoneyText(currentHouse.deposit_amount)}
                          </Typography.Text>
                        </div>
                      )}
                      renderEditor={({ draft, saving, setDraft }) => (
                        <InputNumber
                          autoFocus
                          aria-label="押金"
                          changeOnBlur={false}
                          controls={false}
                          disabled={saving}
                          min={0}
                          precision={2}
                          prefix="¥"
                          size="small"
                          value={draft}
                          style={{ width: '100%' }}
                          onChange={setDraft}
                        />
                      )}
                      validate={(draft) =>
                        validateNonNegativeDecimal(draft, '押金')
                      }
                      value={currentHouse.deposit_amount}
                      onClose={finishInlineField}
                      onRequestActivate={(field) =>
                        requestInlineField(field as InlineFieldKey)
                      }
                      onSave={(draft) =>
                        saveInlinePatch({ deposit_amount: draft })
                      }
                      onSaveFailure={failInlineField}
                      onSavingChange={setInlineSaving}
                    />
                  </div>
                  <div className={styles.factsGrid}>
                    <InlineEditableField<InlineLayoutValue, InlineLayoutDraft>
                      active={activeInlineField === 'layout'}
                      ariaLabel="编辑户型"
                      className={styles.factItem}
                      disabled={inlineSaving || patchHouse.isPending}
                      enabled={inlineEditingEnabled}
                      fieldKey="layout"
                      isUnchanged={(draft, value) =>
                        draft.bedrooms === nullableNumber(value.bedrooms) &&
                        draft.living_rooms ===
                          nullableNumber(value.living_rooms)
                      }
                      prepareDraft={(value) => ({
                        bedrooms: nullableNumber(value.bedrooms),
                        living_rooms: nullableNumber(value.living_rooms),
                      })}
                      renderDisplay={() => (
                        <>
                          <Typography.Text type="secondary">
                            户型
                          </Typography.Text>
                          <span className={styles.factValue}>
                            {housePrimaryLayoutText(currentHouse, {
                              bedroomLabel: '房',
                              livingRoomLabel: '厅',
                            })}
                          </span>
                        </>
                      )}
                      renderEditor={({ draft, saving, setDraft }) => (
                        <div>
                          <Typography.Text type="secondary">
                            户型
                          </Typography.Text>
                          <Space.Compact block style={{ marginTop: 4 }}>
                            <InputNumber
                              autoFocus
                              aria-label="室"
                              changeOnBlur={false}
                              controls={false}
                              disabled={saving}
                              min={0}
                              precision={0}
                              size="small"
                              suffix="室"
                              value={draft.bedrooms}
                              onChange={(bedrooms) =>
                                setDraft({ ...draft, bedrooms })
                              }
                            />
                            <InputNumber
                              aria-label="厅"
                              changeOnBlur={false}
                              controls={false}
                              disabled={saving}
                              min={0}
                              precision={0}
                              size="small"
                              suffix="厅"
                              value={draft.living_rooms}
                              onChange={(living_rooms) =>
                                setDraft({ ...draft, living_rooms })
                              }
                            />
                          </Space.Compact>
                        </div>
                      )}
                      validate={(draft) =>
                        validateInteger(draft.bedrooms, '室', {
                          nonNegative: true,
                        }) ||
                        validateInteger(draft.living_rooms, '厅', {
                          nonNegative: true,
                        })
                      }
                      value={{
                        bedrooms: currentHouse.bedrooms,
                        living_rooms: currentHouse.living_rooms,
                      }}
                      onClose={finishInlineField}
                      onRequestActivate={(field) =>
                        requestInlineField(field as InlineFieldKey)
                      }
                      onSave={(draft) =>
                        saveInlinePatch({
                          bedrooms: draft.bedrooms,
                          living_rooms: draft.living_rooms,
                        })
                      }
                      onSaveFailure={failInlineField}
                      onSavingChange={setInlineSaving}
                    />
                    <InlineEditableField<
                      string | number | null | undefined,
                      number | null
                    >
                      active={activeInlineField === 'area'}
                      ariaLabel="编辑建筑面积"
                      className={styles.factItem}
                      disabled={inlineSaving || patchHouse.isPending}
                      enabled={inlineEditingEnabled}
                      fieldKey="area"
                      isUnchanged={nullableNumberUnchanged}
                      prepareDraft={nullableNumber}
                      renderDisplay={() => (
                        <>
                          <Typography.Text type="secondary">
                            面积
                          </Typography.Text>
                          <span className={styles.factValue}>
                            {currentHouse.area
                              ? `${currentHouse.area} ㎡`
                              : '-'}
                          </span>
                        </>
                      )}
                      renderEditor={({ draft, saving, setDraft }) => (
                        <div>
                          <Typography.Text type="secondary">
                            面积
                          </Typography.Text>
                          <InputNumber
                            autoFocus
                            aria-label="建筑面积"
                            changeOnBlur={false}
                            controls={false}
                            disabled={saving}
                            min={0}
                            precision={2}
                            size="small"
                            suffix="㎡"
                            value={draft}
                            style={{ width: '100%', marginTop: 4 }}
                            onChange={setDraft}
                          />
                        </div>
                      )}
                      validate={(draft) =>
                        validateNonNegativeDecimal(draft, '建筑面积')
                      }
                      value={currentHouse.area}
                      onClose={finishInlineField}
                      onRequestActivate={(field) =>
                        requestInlineField(field as InlineFieldKey)
                      }
                      onSave={(draft) => saveInlinePatch({ area: draft })}
                      onSaveFailure={failInlineField}
                      onSavingChange={setInlineSaving}
                    />
                    <InlineEditableField<
                      number | null | undefined,
                      number | null
                    >
                      active={activeInlineField === 'floor'}
                      ariaLabel="编辑楼层"
                      className={styles.factItem}
                      disabled={inlineSaving || patchHouse.isPending}
                      enabled={inlineEditingEnabled}
                      fieldKey="floor"
                      isUnchanged={nullableNumberUnchanged}
                      prepareDraft={nullableNumber}
                      renderDisplay={() => (
                        <>
                          <Typography.Text type="secondary">
                            楼层
                          </Typography.Text>
                          <span className={styles.factValue}>
                            {currentHouse.floor == null
                              ? '-'
                              : `${currentHouse.floor} 层`}
                          </span>
                        </>
                      )}
                      renderEditor={({ draft, saving, setDraft }) => (
                        <div>
                          <Typography.Text type="secondary">
                            楼层
                          </Typography.Text>
                          <InputNumber
                            autoFocus
                            aria-label="楼层"
                            changeOnBlur={false}
                            controls={false}
                            disabled={saving}
                            precision={0}
                            size="small"
                            suffix="层"
                            value={draft}
                            style={{ width: '100%', marginTop: 4 }}
                            onChange={setDraft}
                          />
                        </div>
                      )}
                      validate={(draft) => validateInteger(draft, '楼层')}
                      value={currentHouse.floor}
                      onClose={finishInlineField}
                      onRequestActivate={(field) =>
                        requestInlineField(field as InlineFieldKey)
                      }
                      onSave={(draft) => saveInlinePatch({ floor: draft })}
                      onSaveFailure={failInlineField}
                      onSavingChange={setInlineSaving}
                    />
                    <div className={styles.factItem}>
                      <Typography.Text type="secondary">
                        楼栋电梯
                      </Typography.Text>
                      <span className={styles.factValue}>
                        {currentHouse.building.elevator ? '有' : '无'}
                      </span>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>

          <Row gutter={[16, 16]} align="top">
            <Col xs={24} xl={16}>
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Card title="房源资料">
                  <InlineEditableField<string, string>
                    active={activeInlineField === 'public_description'}
                    ariaLabel="编辑对外描述"
                    className={styles.descriptionText}
                    disabled={inlineSaving || patchHouse.isPending}
                    enabled={inlineEditingEnabled}
                    fieldKey="public_description"
                    isUnchanged={(draft, value) => draft === value}
                    prepareDraft={(value) => value}
                    renderDisplay={() => (
                      <span>
                        {currentHouse.public_description || '暂无对外房源描述'}
                      </span>
                    )}
                    renderEditor={({ draft, saving, setDraft }) => (
                      <Input.TextArea
                        autoFocus
                        aria-label="对外描述"
                        autoSize={{ minRows: 2, maxRows: 6 }}
                        disabled={saving}
                        size="small"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                      />
                    )}
                    value={currentHouse.public_description || ''}
                    onClose={finishInlineField}
                    onRequestActivate={(field) =>
                      requestInlineField(field as InlineFieldKey)
                    }
                    onSave={(draft) =>
                      saveInlinePatch({ public_description: draft })
                    }
                    onSaveFailure={failInlineField}
                    onSavingChange={setInlineSaving}
                  />
                  <InlineEditableField<string, string>
                    active={activeInlineField === 'internal_notes'}
                    ariaLabel="编辑内部备注"
                    className={styles.noteLine}
                    disabled={inlineSaving || patchHouse.isPending}
                    enabled={inlineEditingEnabled}
                    fieldKey="internal_notes"
                    isUnchanged={(draft, value) => draft === value}
                    prepareDraft={(value) => value}
                    renderDisplay={() => (
                      <>
                        <Typography.Text strong>内部备注：</Typography.Text>
                        <Typography.Text type="secondary">
                          {currentHouse.internal_notes || '暂无内部备注'}
                        </Typography.Text>
                      </>
                    )}
                    renderEditor={({ draft, saving, setDraft }) => (
                      <div style={{ width: '100%' }}>
                        <Typography.Text strong>内部备注</Typography.Text>
                        <Input.TextArea
                          autoFocus
                          aria-label="内部备注"
                          autoSize={{ minRows: 2, maxRows: 6 }}
                          disabled={saving}
                          size="small"
                          style={{ marginTop: 4 }}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                        />
                      </div>
                    )}
                    value={currentHouse.internal_notes || ''}
                    onClose={finishInlineField}
                    onRequestActivate={(field) =>
                      requestInlineField(field as InlineFieldKey)
                    }
                    onSave={(draft) =>
                      saveInlinePatch({ internal_notes: draft })
                    }
                    onSaveFailure={failInlineField}
                    onSavingChange={setInlineSaving}
                  />
                  <InlineEditableField<string[], string[]>
                    active={activeInlineField === 'tags'}
                    ariaLabel="编辑房源标签"
                    className={styles.tagsSection}
                    disabled={inlineSaving || patchHouse.isPending}
                    enabled={inlineEditingEnabled}
                    fieldKey="tags"
                    isUnchanged={(draft, value) =>
                      draft.length === value.length &&
                      draft.every((tag, index) => tag === value[index])
                    }
                    prepareDraft={normalizePropertyTags}
                    renderDisplay={() => (
                      <section aria-label="房源标签">
                        {displayTags.length ? (
                          <Space size={[4, 8]} wrap>
                            {ownTags.map((tag) => (
                              <Tag color="purple" key={`own-${tag}`}>
                                {tag}
                              </Tag>
                            ))}
                            {inheritedTags.map((tag) => (
                              <Tooltip
                                key={`inherited-${tag}`}
                                title="该标签来自楼栋，暂不可修改"
                              >
                                <Tag
                                  color="blue"
                                  icon={<AppIcon name="building" />}
                                >
                                  {tag}
                                </Tag>
                              </Tooltip>
                            ))}
                          </Space>
                        ) : (
                          <Typography.Text type="secondary">
                            暂无标签
                          </Typography.Text>
                        )}
                      </section>
                    )}
                    renderEditor={({
                      draft,
                      getPopupContainer,
                      saving,
                      setDraft,
                    }) => (
                      <section aria-label="房源标签">
                        <PropertyTagSelect
                          autoFocus
                          aria-label="房源标签"
                          disabled={saving}
                          getPopupContainer={getPopupContainer}
                          inheritedTags={inheritedTags}
                          size="small"
                          suggestions={tagSuggestions.data?.tags ?? []}
                          suggestionsError={tagSuggestions.isError}
                          suggestionsLoading={tagSuggestions.isLoading}
                          value={draft}
                          onChange={setDraft}
                        />
                      </section>
                    )}
                    value={ownTags}
                    onClose={finishInlineField}
                    onRequestActivate={(field) =>
                      requestInlineField(field as InlineFieldKey)
                    }
                    onSave={(draft) => saveInlinePatch({ tags: draft })}
                    onSaveFailure={failInlineField}
                    onSavingChange={setInlineSaving}
                  />
                  <section
                    aria-label="房源字段"
                    className={styles.fieldsSection}
                  >
                    <div className={styles.materialGroupGrid}>
                      <section
                        aria-label="归属信息"
                        className={cx(
                          styles.materialGroup,
                          styles.materialGroupWide,
                        )}
                      >
                        <Typography.Text
                          className={styles.materialGroupTitle}
                          strong
                        >
                          归属信息
                        </Typography.Text>
                        <div className={styles.materialFieldGrid}>
                          <div className={styles.materialField}>
                            <Typography.Text
                              className={styles.materialFieldLabel}
                            >
                              项目
                            </Typography.Text>
                            <div className={styles.materialFieldValue}>
                              {currentHouse.building?.estate ? (
                                <EstatePreview
                                  id={currentHouse.building.estate.id}
                                >
                                  {currentHouse.building.estate.display_name ||
                                    currentHouse.building.estate.name}
                                </EstatePreview>
                              ) : (
                                '独立楼栋'
                              )}
                            </div>
                          </div>
                          <InlineEditableField<string, string>
                            active={activeInlineField === 'room_number'}
                            activateOnContainerClick={false}
                            ariaLabel="编辑房号"
                            className={styles.materialField}
                            disabled={inlineSaving || patchHouse.isPending}
                            enabled={inlineEditingEnabled}
                            fieldKey="room_number"
                            isUnchanged={(draft, value) =>
                              draft.trim() === value
                            }
                            prepareDraft={(value) => value}
                            renderDisplay={() => (
                              <>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  楼栋 / 房号
                                </Typography.Text>
                                <div className={styles.materialFieldValue}>
                                  <Space separator="/" size={6}>
                                    <BuildingPreview
                                      id={currentHouse.building_id}
                                    >
                                      {currentHouse.building?.name ||
                                        `楼栋 #${currentHouse.building_id}`}
                                    </BuildingPreview>
                                    <HousePreview id={currentHouse.id}>
                                      {currentHouse.room_number}
                                    </HousePreview>
                                  </Space>
                                </div>
                              </>
                            )}
                            renderEditor={({ draft, saving, setDraft }) => (
                              <div>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  房号
                                </Typography.Text>
                                <Input
                                  autoFocus
                                  aria-label="房号"
                                  disabled={saving}
                                  maxLength={64}
                                  size="small"
                                  value={draft}
                                  onChange={(event) =>
                                    setDraft(event.target.value)
                                  }
                                />
                              </div>
                            )}
                            validate={(draft) => {
                              const roomNumber = draft.trim();
                              if (!roomNumber) return '请输入房号';
                              return roomNumber.length > 64
                                ? '房号最多 64 个字符'
                                : undefined;
                            }}
                            value={currentHouse.room_number}
                            onClose={finishInlineField}
                            onRequestActivate={(field) =>
                              requestInlineField(field as InlineFieldKey)
                            }
                            onSave={(draft) =>
                              saveInlinePatch({ room_number: draft.trim() })
                            }
                            onSaveFailure={failInlineField}
                            onSavingChange={setInlineSaving}
                          />
                          <InlineEditableField<number | null, number | null>
                            active={activeInlineField === 'landlord_id'}
                            activateOnContainerClick={false}
                            ariaLabel="编辑房东"
                            className={styles.materialField}
                            disabled={inlineSaving || patchHouse.isPending}
                            enabled={inlineEditingEnabled}
                            fieldKey="landlord_id"
                            isUnchanged={(draft, value) => draft === value}
                            prepareDraft={(value) => value}
                            renderDisplay={() => (
                              <>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  房东信息
                                </Typography.Text>
                                <div className={styles.materialFieldValue}>
                                  {currentHouse.landlord_id ? (
                                    <ContactPreview
                                      id={currentHouse.landlord_id}
                                    >
                                      {contactLabel(currentHouse)}
                                    </ContactPreview>
                                  ) : (
                                    <Typography.Text type="warning">
                                      待补房东
                                    </Typography.Text>
                                  )}
                                </div>
                              </>
                            )}
                            renderEditor={({
                              draft,
                              getPopupContainer,
                              save,
                              saving,
                              setDraft,
                            }) => (
                              <div>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  房东信息
                                </Typography.Text>
                                <Select
                                  allowClear
                                  autoFocus
                                  aria-label="房东"
                                  disabled={saving}
                                  getPopupContainer={getPopupContainer}
                                  loading={landlords.loading}
                                  notFoundContent={landlords.notFoundContent}
                                  options={landlords.options}
                                  placeholder="搜索或选择房东"
                                  showSearch={landlords.showSearch}
                                  size="small"
                                  value={draft ?? undefined}
                                  style={{ width: '100%' }}
                                  onChange={(next) => {
                                    setDraft(next ?? null);
                                    save();
                                  }}
                                  onOpenChange={landlords.onOpenChange}
                                  onPopupScroll={landlords.onPopupScroll}
                                />
                                {landlords.isError ? (
                                  <Button
                                    danger
                                    size="small"
                                    type="link"
                                    onClick={() => void landlords.refetch()}
                                  >
                                    房东加载失败，重新加载
                                  </Button>
                                ) : null}
                              </div>
                            )}
                            value={currentHouse.landlord_id ?? null}
                            onClose={finishInlineField}
                            onRequestActivate={(field) =>
                              requestInlineField(field as InlineFieldKey)
                            }
                            onSave={(draft) =>
                              saveInlinePatch({ landlord_id: draft })
                            }
                            onSaveFailure={failInlineField}
                            onSavingChange={setInlineSaving}
                          />
                          <div className={styles.materialField}>
                            <Typography.Text
                              className={styles.materialFieldLabel}
                            >
                              楼栋地址
                            </Typography.Text>
                            <div className={styles.materialFieldValue}>
                              {currentHouse.building?.address || '-'}
                            </div>
                          </div>
                        </div>
                      </section>

                      <section
                        aria-label="房源属性"
                        className={cx(
                          styles.materialGroup,
                          styles.materialGroupWide,
                        )}
                      >
                        <Typography.Text
                          className={styles.materialGroupTitle}
                          strong
                        >
                          房源属性
                        </Typography.Text>
                        <div className={styles.materialFieldGrid}>
                          <InlineEditableField<
                            number | null | undefined,
                            number | null
                          >
                            active={activeInlineField === 'bathrooms'}
                            ariaLabel="编辑卫生间"
                            className={styles.materialField}
                            disabled={inlineSaving || patchHouse.isPending}
                            enabled={inlineEditingEnabled}
                            fieldKey="bathrooms"
                            isUnchanged={nullableNumberUnchanged}
                            prepareDraft={nullableNumber}
                            renderDisplay={() => (
                              <>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  卫生间
                                </Typography.Text>
                                <div className={styles.materialFieldValue}>
                                  {currentHouse.bathrooms == null
                                    ? '-'
                                    : `${currentHouse.bathrooms}卫`}
                                </div>
                              </>
                            )}
                            renderEditor={({ draft, saving, setDraft }) => (
                              <div>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  卫生间
                                </Typography.Text>
                                <InputNumber
                                  autoFocus
                                  aria-label="卫生间"
                                  changeOnBlur={false}
                                  controls={false}
                                  disabled={saving}
                                  min={0}
                                  precision={0}
                                  size="small"
                                  suffix="卫"
                                  value={draft}
                                  style={{ width: '100%' }}
                                  onChange={setDraft}
                                />
                              </div>
                            )}
                            validate={(draft) =>
                              validateInteger(draft, '卫生间', {
                                nonNegative: true,
                              })
                            }
                            value={currentHouse.bathrooms}
                            onClose={finishInlineField}
                            onRequestActivate={(field) =>
                              requestInlineField(field as InlineFieldKey)
                            }
                            onSave={(draft) =>
                              saveInlinePatch({ bathrooms: draft })
                            }
                            onSaveFailure={failInlineField}
                            onSavingChange={setInlineSaving}
                          />
                          <InlineEditableField<
                            number | null | undefined,
                            number | null
                          >
                            active={activeInlineField === 'kitchens'}
                            ariaLabel="编辑厨房"
                            className={styles.materialField}
                            disabled={inlineSaving || patchHouse.isPending}
                            enabled={inlineEditingEnabled}
                            fieldKey="kitchens"
                            isUnchanged={nullableNumberUnchanged}
                            prepareDraft={nullableNumber}
                            renderDisplay={() => (
                              <>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  厨房
                                </Typography.Text>
                                <div className={styles.materialFieldValue}>
                                  {houseKitchenText(currentHouse)}
                                </div>
                              </>
                            )}
                            renderEditor={({ draft, saving, setDraft }) => (
                              <div>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  厨房
                                </Typography.Text>
                                <InputNumber
                                  autoFocus
                                  aria-label="厨房"
                                  changeOnBlur={false}
                                  controls={false}
                                  disabled={saving}
                                  min={0}
                                  precision={0}
                                  size="small"
                                  suffix="厨"
                                  value={draft}
                                  style={{ width: '100%' }}
                                  onChange={setDraft}
                                />
                              </div>
                            )}
                            validate={(draft) =>
                              validateInteger(draft, '厨房', {
                                nonNegative: true,
                              })
                            }
                            value={currentHouse.kitchens}
                            onClose={finishInlineField}
                            onRequestActivate={(field) =>
                              requestInlineField(field as InlineFieldKey)
                            }
                            onSave={(draft) =>
                              saveInlinePatch({ kitchens: draft })
                            }
                            onSaveFailure={failInlineField}
                            onSavingChange={setInlineSaving}
                          />
                          <InlineEditableField<
                            number | null | undefined,
                            number | null
                          >
                            active={activeInlineField === 'balconies'}
                            ariaLabel="编辑阳台"
                            className={styles.materialField}
                            disabled={inlineSaving || patchHouse.isPending}
                            enabled={inlineEditingEnabled}
                            fieldKey="balconies"
                            isUnchanged={nullableNumberUnchanged}
                            prepareDraft={nullableNumber}
                            renderDisplay={() => (
                              <>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  阳台
                                </Typography.Text>
                                <div className={styles.materialFieldValue}>
                                  {houseBalconyText(currentHouse)}
                                </div>
                              </>
                            )}
                            renderEditor={({ draft, saving, setDraft }) => (
                              <div>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  阳台
                                </Typography.Text>
                                <InputNumber
                                  autoFocus
                                  aria-label="阳台"
                                  changeOnBlur={false}
                                  controls={false}
                                  disabled={saving}
                                  min={0}
                                  precision={0}
                                  size="small"
                                  suffix="阳台"
                                  value={draft}
                                  style={{ width: '100%' }}
                                  onChange={setDraft}
                                />
                              </div>
                            )}
                            validate={(draft) =>
                              validateInteger(draft, '阳台', {
                                nonNegative: true,
                              })
                            }
                            value={currentHouse.balconies}
                            onClose={finishInlineField}
                            onRequestActivate={(field) =>
                              requestInlineField(field as InlineFieldKey)
                            }
                            onSave={(draft) =>
                              saveInlinePatch({ balconies: draft })
                            }
                            onSaveFailure={failInlineField}
                            onSavingChange={setInlineSaving}
                          />
                          <div className={styles.materialField}>
                            <Typography.Text
                              className={styles.materialFieldLabel}
                            >
                              套内面积
                            </Typography.Text>
                            <div className={styles.materialFieldValue}>
                              {currentHouse.interior_area
                                ? `${currentHouse.interior_area} ㎡`
                                : '-'}
                            </div>
                          </div>
                          <InlineEditableField<string | null, string | null>
                            active={activeInlineField === 'orientation'}
                            ariaLabel="编辑朝向"
                            className={styles.materialField}
                            disabled={inlineSaving || patchHouse.isPending}
                            enabled={
                              inlineEditingEnabled && !houseEnums.isError
                            }
                            fieldKey="orientation"
                            isUnchanged={(draft, value) => draft === value}
                            prepareDraft={(value) => value}
                            renderDisplay={() => (
                              <>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  朝向
                                </Typography.Text>
                                <div className={styles.materialFieldValue}>
                                  {mappedText(
                                    currentHouse.orientation,
                                    currentHouse.orientation__mapping,
                                  )}
                                </div>
                              </>
                            )}
                            renderEditor={({
                              draft,
                              getPopupContainer,
                              save,
                              saving,
                              setDraft,
                            }) => (
                              <div>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  朝向
                                </Typography.Text>
                                <Select
                                  allowClear
                                  autoFocus
                                  aria-label="朝向"
                                  disabled={saving}
                                  getPopupContainer={getPopupContainer}
                                  options={orientationOptions}
                                  size="small"
                                  value={draft ?? undefined}
                                  style={{ width: '100%' }}
                                  onChange={(next) => {
                                    setDraft(next ?? null);
                                    save();
                                  }}
                                />
                              </div>
                            )}
                            value={currentHouse.orientation ?? null}
                            onClose={finishInlineField}
                            onRequestActivate={(field) =>
                              requestInlineField(field as InlineFieldKey)
                            }
                            onSave={(draft) =>
                              saveInlinePatch({ orientation: draft })
                            }
                            onSaveFailure={failInlineField}
                            onSavingChange={setInlineSaving}
                          />
                          <InlineEditableField<string | null, string | null>
                            active={activeInlineField === 'decoration'}
                            ariaLabel="编辑装修"
                            className={styles.materialField}
                            disabled={inlineSaving || patchHouse.isPending}
                            enabled={
                              inlineEditingEnabled && !houseEnums.isError
                            }
                            fieldKey="decoration"
                            isUnchanged={(draft, value) => draft === value}
                            prepareDraft={(value) => value}
                            renderDisplay={() => (
                              <>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  装修
                                </Typography.Text>
                                <div className={styles.materialFieldValue}>
                                  {mappedText(
                                    currentHouse.decoration,
                                    currentHouse.decoration__mapping,
                                  )}
                                </div>
                              </>
                            )}
                            renderEditor={({
                              draft,
                              getPopupContainer,
                              save,
                              saving,
                              setDraft,
                            }) => (
                              <div>
                                <Typography.Text
                                  className={styles.materialFieldLabel}
                                >
                                  装修
                                </Typography.Text>
                                <Select
                                  allowClear
                                  autoFocus
                                  aria-label="装修"
                                  disabled={saving}
                                  getPopupContainer={getPopupContainer}
                                  options={decorationOptions}
                                  size="small"
                                  value={draft ?? undefined}
                                  style={{ width: '100%' }}
                                  onChange={(next) => {
                                    setDraft(next ?? null);
                                    save();
                                  }}
                                />
                              </div>
                            )}
                            value={currentHouse.decoration ?? null}
                            onClose={finishInlineField}
                            onRequestActivate={(field) =>
                              requestInlineField(field as InlineFieldKey)
                            }
                            onSave={(draft) =>
                              saveInlinePatch({ decoration: draft })
                            }
                            onSaveFailure={failInlineField}
                            onSavingChange={setInlineSaving}
                          />
                          {customFieldEntries.map(([key, value]) => {
                            const fieldKey = `extra:${key}` as const;
                            const editorLabel = `扩展字段${customFieldLabel(key)}`;
                            return (
                              <InlineEditableField<unknown, InlineExtraDraft>
                                active={activeInlineField === fieldKey}
                                ariaLabel={`编辑${editorLabel}`}
                                className={cx(
                                  styles.materialField,
                                  isWideCustomField(value) &&
                                    styles.materialFieldWide,
                                )}
                                disabled={inlineSaving || patchHouse.isPending}
                                enabled={inlineEditingEnabled}
                                fieldKey={fieldKey}
                                isUnchanged={inlineExtraDraftUnchanged}
                                key={key}
                                prepareDraft={prepareInlineExtraDraft}
                                renderDisplay={() => (
                                  <>
                                    <Typography.Text
                                      className={styles.materialFieldLabel}
                                    >
                                      {customFieldLabel(key)}
                                    </Typography.Text>
                                    <div className={styles.materialFieldValue}>
                                      {customFieldValue(value)}
                                    </div>
                                  </>
                                )}
                                renderEditor={({
                                  draft,
                                  getPopupContainer,
                                  save,
                                  saving,
                                  setDraft,
                                }) => (
                                  <div>
                                    <Typography.Text
                                      className={styles.materialFieldLabel}
                                    >
                                      {customFieldLabel(key)}
                                    </Typography.Text>
                                    {draft.kind === 'boolean' ? (
                                      <Select
                                        autoFocus
                                        aria-label={editorLabel}
                                        disabled={saving}
                                        getPopupContainer={getPopupContainer}
                                        options={[
                                          { label: '是', value: true },
                                          { label: '否', value: false },
                                        ]}
                                        size="small"
                                        value={draft.value}
                                        style={{ width: '100%' }}
                                        onChange={(next) => {
                                          setDraft({
                                            kind: 'boolean',
                                            value: next,
                                          });
                                          save();
                                        }}
                                      />
                                    ) : draft.kind === 'number' ? (
                                      <InputNumber
                                        autoFocus
                                        aria-label={editorLabel}
                                        controls={false}
                                        disabled={saving}
                                        size="small"
                                        value={draft.value}
                                        style={{ width: '100%' }}
                                        onChange={(next) =>
                                          setDraft({
                                            kind: 'number',
                                            value: next,
                                          })
                                        }
                                      />
                                    ) : draft.kind === 'array' ? (
                                      <Select<string[]>
                                        autoFocus
                                        aria-label={editorLabel}
                                        disabled={saving}
                                        getPopupContainer={getPopupContainer}
                                        mode="tags"
                                        options={draft.value.map((item) => ({
                                          label: item,
                                          value: item,
                                        }))}
                                        size="small"
                                        tokenSeparators={[',', '，']}
                                        value={draft.value}
                                        style={{ width: '100%' }}
                                        onChange={(next) =>
                                          setDraft({
                                            kind: 'array',
                                            value: next,
                                          })
                                        }
                                      />
                                    ) : draft.kind === 'object' ||
                                      isWideCustomField(value) ? (
                                      <Input.TextArea
                                        autoFocus
                                        aria-label={editorLabel}
                                        autoSize={{ minRows: 3, maxRows: 8 }}
                                        disabled={saving}
                                        size="small"
                                        value={draft.value}
                                        onChange={(event) =>
                                          setDraft({
                                            kind: draft.kind,
                                            value: event.target.value,
                                          })
                                        }
                                      />
                                    ) : (
                                      <Input
                                        autoFocus
                                        aria-label={editorLabel}
                                        disabled={saving}
                                        size="small"
                                        value={draft.value}
                                        onChange={(event) =>
                                          setDraft({
                                            kind: 'text',
                                            value: event.target.value,
                                          })
                                        }
                                      />
                                    )}
                                  </div>
                                )}
                                validate={validateInlineExtraDraft}
                                value={value}
                                onClose={finishInlineField}
                                onRequestActivate={(field) =>
                                  requestInlineField(field as InlineFieldKey)
                                }
                                onSave={(draft) =>
                                  saveInlinePatch({
                                    extra: {
                                      ...(currentHouse.extra || {}),
                                      [key]: parseInlineExtraDraft(
                                        draft,
                                        value,
                                      ),
                                    },
                                  })
                                }
                                onSaveFailure={failInlineField}
                                onSavingChange={setInlineSaving}
                              />
                            );
                          })}
                        </div>
                      </section>
                    </div>
                  </section>
                </Card>
                <Card
                  title={
                    <Space size={8}>
                      <span>带看记录</span>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: token.fontSizeSM, fontWeight: 400 }}
                      >
                        最近 10 条
                      </Typography.Text>
                    </Space>
                  }
                  extra={
                    <Button
                      type="link"
                      href={`/dashboard/rental/viewings?house_id=${houseId}`}
                    >
                      查看全部
                    </Button>
                  }
                >
                  {viewings.isError ? (
                    <Empty description="带看记录加载失败">
                      <Button onClick={() => viewings.refetch()}>
                        重新加载
                      </Button>
                    </Empty>
                  ) : (
                    <Table<ViewingRecordOut>
                      className={styles.recordTable}
                      rowKey="id"
                      loading={viewings.isLoading}
                      size="small"
                      scroll={
                        (viewings.data?.items.length || 0) > 8
                          ? { x: 'max-content', y: 520 }
                          : { x: 'max-content' }
                      }
                      columns={[
                        {
                          title: '客户',
                          dataIndex: 'customer_name',
                          width: 190,
                          render: (value, record) => (
                            <div>
                              <ViewingPreview id={record.id}>
                                <span className={styles.recordPrimary}>
                                  {value}
                                </span>
                              </ViewingPreview>
                              <span className={styles.recordSecondary}>
                                {record.customer_phone || '-'}
                              </span>
                            </div>
                          ),
                        },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          width: 100,
                          align: 'center',
                          render: (value, record) => (
                            <AppStatusTag name="viewing" state={value}>
                              {enumMapping(value, record.status__mapping)}
                            </AppStatusTag>
                          ),
                        },
                        {
                          title: '预约时间',
                          dataIndex: 'scheduled_at',
                          width: 170,
                          align: 'center',
                          render: (value) => {
                            const parts = dateTimeParts(value);
                            return (
                              <div>
                                <span className={styles.recordPrimary}>
                                  {parts.date}
                                </span>
                                {parts.time ? (
                                  <span className={styles.recordSecondary}>
                                    {parts.time}
                                  </span>
                                ) : null}
                              </div>
                            );
                          },
                        },
                        {
                          title: '操作',
                          dataIndex: 'actions',
                          width: 110,
                          align: 'center',
                          render: (_value, record) => {
                            if (
                              record.status === 'converted' &&
                              record.signed_lease_id
                            ) {
                              return (
                                <a
                                  href={leaseEditHref(
                                    houseId,
                                    record.signed_lease_id,
                                  )}
                                >
                                  查看租约
                                </a>
                              );
                            }
                            if (needsViewingContactCompletion(record)) {
                              return (
                                <a href={viewingContactFixHref(record.id)}>
                                  补租客
                                </a>
                              );
                            }
                            if (record.status === 'converted') {
                              return (
                                <a
                                  href={dashboardHref(
                                    `/rental/leases?source_viewing_record_id=${record.id}`,
                                  )}
                                >
                                  去签约
                                </a>
                              );
                            }
                            return (
                              <a
                                href={dashboardHref(
                                  `/rental/viewings?house_id=${houseId}`,
                                )}
                              >
                                查看带看
                              </a>
                            );
                          },
                        },
                      ]}
                      dataSource={viewings.data?.items || []}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="暂无带看记录"
                          >
                            <Button
                              href={`/dashboard/rental/viewings?house_id=${houseId}`}
                              type="primary"
                            >
                              登记首条带看
                            </Button>
                          </Empty>
                        ),
                      }}
                      pagination={false}
                    />
                  )}
                </Card>

                <Card
                  title="租约记录"
                  extra={
                    <Button
                      type="link"
                      href={`/dashboard/rental/leases?house_id=${houseId}`}
                    >
                      查看全部
                    </Button>
                  }
                >
                  {leases.isError ? (
                    <Empty description="租约记录加载失败">
                      <Button onClick={() => leases.refetch()}>重新加载</Button>
                    </Empty>
                  ) : (
                    <Table<LeaseOut>
                      className={styles.recordTable}
                      rowKey="id"
                      loading={leases.isLoading}
                      size="small"
                      scroll={{ x: 'max-content' }}
                      columns={[
                        {
                          title: '租客',
                          dataIndex: 'tenant_id',
                          width: 180,
                          render: (_value, record) => (
                            <div>
                              <ContactPreview id={record.tenant_id}>
                                <span className={styles.recordPrimary}>
                                  {record.tenant?.name ||
                                    `联系人 #${record.tenant_id}`}
                                </span>
                              </ContactPreview>
                              <span className={styles.recordSecondary}>
                                {record.tenant?.phone || '-'}
                              </span>
                            </div>
                          ),
                        },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          width: 100,
                          align: 'center',
                          render: (value, record) => (
                            <AppStatusTag name="lease" state={value}>
                              {enumMapping(value, record.status__mapping)}
                            </AppStatusTag>
                          ),
                        },
                        {
                          title: '租金',
                          dataIndex: 'monthly_rent',
                          width: 130,
                          align: 'right',
                          render: (value, record) => (
                            <div>
                              <span className={styles.recordMoney}>
                                {compactMoneyText(value)}
                              </span>
                              {record.deposit ? (
                                <span className={styles.recordSecondary}>
                                  押金 {compactMoneyText(record.deposit)}
                                </span>
                              ) : null}
                            </div>
                          ),
                        },
                        {
                          title: '租期',
                          dataIndex: 'start_date',
                          width: 170,
                          align: 'center',
                          render: (_value, record) => (
                            <div>
                              <span className={styles.recordPrimary}>
                                {record.start_date}
                              </span>
                              <span className={styles.recordSecondary}>
                                至 {record.end_date}
                              </span>
                            </div>
                          ),
                        },
                        {
                          title: '合同 / 操作',
                          dataIndex: 'contract_files',
                          width: 170,
                          align: 'center',
                          render: (value, record) => (
                            <div>
                              <Space size={6} wrap>
                                <LeasePreview id={record.id}>
                                  <span>
                                    {value?.length
                                      ? `租约 #${record.id} · ${value.length} 份合同`
                                      : `租约 #${record.id}`}
                                  </span>
                                </LeasePreview>
                              </Space>
                              <a
                                href={leaseEditHref(houseId, record.id)}
                                style={{ display: 'block', marginTop: 4 }}
                              >
                                编辑租约
                              </a>
                            </div>
                          ),
                        },
                      ]}
                      dataSource={leases.data?.items || []}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="暂无租约记录"
                          >
                            <Button
                              href={`/dashboard/rental/leases?house_id=${houseId}`}
                              type="primary"
                            >
                              创建首份租约
                            </Button>
                          </Empty>
                        ),
                      }}
                      pagination={false}
                    />
                  )}
                </Card>
              </Space>
            </Col>
            <Col xs={24} xl={8}>
              <HouseLocationPoiCard
                buildingId={currentHouse.building_id}
                buildingName={
                  currentHouse.building?.name ||
                  `楼栋 #${currentHouse.building_id}`
                }
                lat={currentHouse.building?.lat}
                lng={currentHouse.building?.lng}
                returnTo={
                  typeof window === 'undefined'
                    ? `/dashboard/rental/properties/${houseId}`
                    : `${window.location.pathname}${window.location.search}`
                }
              />
            </Col>
          </Row>
        </Space>
      ) : (
        <Empty description="未找到房源" />
      )}
      <Modal
        open={publishConfirmStatus !== null}
        title={
          publishConfirmStatus === HOUSE_STATUS.LISTED
            ? '确认发布房源'
            : '确认下架房源'
        }
        okText={
          publishConfirmStatus === HOUSE_STATUS.LISTED ? '确认发布' : '确认下架'
        }
        cancelText="先取消"
        transitionName=""
        maskTransitionName=""
        onCancel={() => setPublishConfirmStatus(null)}
        onOk={async () => {
          const nextStatus = publishConfirmStatus;
          if (!nextStatus) return;
          setPublishConfirmStatus(null);
          await patchHouse.mutateAsync({ status: nextStatus });
        }}
      >
        <Typography.Text>
          {publishConfirmStatus === HOUSE_STATUS.LISTED
            ? '确认后房源状态将切换为招租，继续承接带看。'
            : '确认后房源状态将切换为空置，不再对外展示。'}
        </Typography.Text>
      </Modal>
      <Drawer
        title="编辑房源资料"
        open={editOpen}
        size="large"
        onClose={closeEdit}
        destroyOnHidden
        extra={
          <Button
            type="primary"
            loading={patchHouse.isPending}
            onClick={() => editForm.submit()}
          >
            保存
          </Button>
        }
      >
        <Form
          key={detailScopeKey}
          form={editForm}
          id="house-edit-form"
          layout="vertical"
          initialValues={editInitialValues}
          preserve={false}
          onFinish={(values) => {
            const payload = {
              ...normalizeHouseEditNumericValues(values),
              images: stripDerivedMediaFields(draftImages),
              videos: stripDerivedMediaFields(draftVideos),
            };
            patchHouse.mutate(payload, { onSuccess: closeEdit });
          }}
        >
          <Tabs
            activeKey={editTab}
            className={styles.drawerTabs}
            items={[
              {
                key: 'basic',
                label: '基础资料',
                forceRender: true,
                children: (
                  <Space
                    orientation="vertical"
                    size={16}
                    style={{ width: '100%' }}
                  >
                    <div style={editSectionStyle}>
                      <Typography.Text strong>归属与发布基础</Typography.Text>
                      <Row gutter={[16, 0]} style={{ marginTop: 12 }}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label="楼栋"
                            name="building_id"
                            rules={[{ required: true, message: '请选择楼栋' }]}
                          >
                            <Select
                              showSearch={buildings.showSearch}
                              loading={buildings.loading}
                              notFoundContent={buildings.notFoundContent}
                              onOpenChange={buildings.onOpenChange}
                              onPopupScroll={buildings.onPopupScroll}
                              placeholder="搜索小区或楼栋"
                              options={buildings.options}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="房东" name="landlord_id">
                            <Select
                              allowClear
                              showSearch={landlords.showSearch}
                              loading={landlords.loading}
                              notFoundContent={landlords.notFoundContent}
                              onOpenChange={landlords.onOpenChange}
                              onPopupScroll={landlords.onPopupScroll}
                              placeholder="搜索房东姓名或手机号"
                              options={landlords.options}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            label="房号"
                            name="room_number"
                            rules={[{ required: true, message: '请输入房号' }]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item label="挂牌租金" name="asking_rent">
                            <Input min={0} step="0.01" type="number" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item label="押金" name="deposit_amount">
                            <Input min={0} step="0.01" type="number" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="所在楼层" name="floor">
                            <Input step="1" type="number" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="房态" name="status">
                            <Select showSearch options={statusOptions} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>

                    <div style={editSectionStyle}>
                      <Typography.Text strong>户型与面积</Typography.Text>
                      <Row gutter={[16, 0]} style={{ marginTop: 12 }}>
                        <Col xs={24} md={12}>
                          <Form.Item label="建筑面积" name="area">
                            <Input min={0} step="0.01" type="number" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="套内面积" name="interior_area">
                            <Input min={0} step="0.01" type="number" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item label="卧室" name="bedrooms">
                            <Input min={0} step="1" type="number" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item label="客厅" name="living_rooms">
                            <Input min={0} step="1" type="number" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item label="卫生间" name="bathrooms">
                            <Input min={0} step="1" type="number" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item label="厨房" name="kitchens">
                            <Input min={0} step="1" type="number" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item label="阳台" name="balconies">
                            <Input min={0} step="1" type="number" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={9}>
                          <Form.Item label="朝向" name="orientation">
                            <Select
                              showSearch
                              allowClear
                              options={orientationOptions}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={9}>
                          <Form.Item label="装修" name="decoration">
                            <Select
                              showSearch
                              allowClear
                              options={decorationOptions}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  </Space>
                ),
              },
              {
                key: 'display',
                label: '展示说明',
                forceRender: true,
                children: (
                  <Space
                    orientation="vertical"
                    size={16}
                    style={{ width: '100%' }}
                  >
                    <div style={editSectionStyle}>
                      <Typography.Text strong>展示与内部说明</Typography.Text>
                      <div style={{ marginTop: 12 }}>
                        <Form.Item label="对外描述" name="public_description">
                          <Input.TextArea rows={4} />
                        </Form.Item>
                        <Form.Item
                          noStyle
                          shouldUpdate={(previousValues, currentValues) =>
                            previousValues.building_id !==
                            currentValues.building_id
                          }
                        >
                          {({ getFieldValue }) => {
                            const selectedBuilding = buildingItems.find(
                              (item) =>
                                item.id === getFieldValue('building_id'),
                            );
                            return (
                              <Form.Item label="房源标签" name="tags">
                                <PropertyTagSelect
                                  inheritedTags={selectedBuilding?.tags}
                                  suggestions={tagSuggestions.data?.tags ?? []}
                                  suggestionsLoading={tagSuggestions.isLoading}
                                  suggestionsError={tagSuggestions.isError}
                                />
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                        <Form.Item
                          label="内部备注"
                          name="internal_notes"
                          style={{ marginBottom: 0 }}
                        >
                          <Input.TextArea rows={4} />
                        </Form.Item>
                      </div>
                    </div>
                  </Space>
                ),
              },
              {
                key: 'media',
                label: '图片视频',
                forceRender: true,
                children: (
                  <div style={editSectionStyle}>
                    <Space
                      orientation="vertical"
                      size={16}
                      style={{ width: '100%' }}
                    >
                      <Typography.Text strong>图片与视频</Typography.Text>
                      <Typography.Text type="secondary">
                        上传、删除、封面和排序调整将在点击右上角“保存”后统一生效。
                      </Typography.Text>
                      <MediaRefsUpload
                        title="图片资料"
                        value={draftImages}
                        resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_IMAGE}
                        mediaType={HOUSE_MEDIA_TYPE.IMAGE}
                        maxCount={9}
                        preserveDerivedFieldsOnChange
                        onChange={(images) =>
                          setDraftImages(images as MediaRefValue[])
                        }
                      />
                      <MediaRefsUpload
                        title="视频资料"
                        value={draftVideos}
                        resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_VIDEO}
                        mediaType={HOUSE_MEDIA_TYPE.VIDEO}
                        maxCount={3}
                        preserveDerivedFieldsOnChange
                        onChange={(videos) =>
                          setDraftVideos(videos as MediaRefValue[])
                        }
                      />
                    </Space>
                  </div>
                ),
              },
            ]}
            onChange={setEditTab}
          />
        </Form>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default HouseDetailPage;
