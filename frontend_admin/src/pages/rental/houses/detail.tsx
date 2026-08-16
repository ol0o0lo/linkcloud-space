import {
  ArrowLeftOutlined,
  EditOutlined,
  EnvironmentOutlined,
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
  Modal,
  message,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import {
  BuildingPreview,
  ContactPreview,
  EstatePreview,
  HousePreview,
  LeasePreview,
  ViewingPreview,
} from '@/components/EntityPreview';
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
  favoriteKeys,
  useFavoriteState,
  useToggleFavorite,
} from '@/services/manual/favoriteHooks';
import {
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
  houseDisplayTags,
  housePrimaryLayoutText,
  type MediaRefValue,
  STATUS_COLOR,
} from '../constants';
import { useHousePublishRules } from '../useHousePublishRules';
import HouseLocationPoiCard from './HouseLocationPoiCard';
import HouseMediaHero from './HouseMediaHero';

type DetailFocusState = {
  action?: string;
  scopeKey?: string;
  task?: string;
};

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
  customFieldsGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;

    @media (max-width: 767px) {
      grid-template-columns: 1fr;
    }
  `,
  customFieldWide: css`
    grid-column: 1 / -1;
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

function leaseEditHref(
  houseId: number,
  leaseId: number,
  options?: { task?: string },
) {
  const params = new URLSearchParams({
    house_id: String(houseId),
  });
  if (options?.task) params.set('task', options.task);
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

function chineseCount(value: number) {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (!Number.isInteger(value) || value < 0 || value > 99) return String(value);
  if (value < 10) return digits[value];
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${tens === 1 ? '' : digits[tens]}十${ones ? digits[ones] : ''}`;
}

function layoutText(house: HouseOut) {
  return housePrimaryLayoutText(house, { formatCount: chineseCount });
}

function secondaryLayoutText(house: HouseOut) {
  const values = [
    { value: house.bathrooms, label: '卫' },
    { value: house.kitchens, label: '厨' },
    { value: house.balconies, label: '阳台' },
  ].filter((item) => item.value != null);
  return values.length
    ? values.map((item) => `${item.value}${item.label}`).join(' / ')
    : '-';
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

function prepareExtraFormValues(extra?: Record<string, unknown> | null) {
  return Object.fromEntries(
    Object.entries(extra || {}).map(([key, value]) => [
      key,
      isPlainObject(value) ? JSON.stringify(value, null, 2) : value,
    ]),
  );
}

function normalizeExtraFormValues(
  values: Record<string, unknown> | undefined,
  original: Record<string, unknown> | undefined,
) {
  return Object.fromEntries(
    Object.entries(values || {}).map(([key, value]) => {
      const originalValue = original?.[key];
      if (typeof originalValue === 'number') {
        const parsed = value === '' || value == null ? null : Number(value);
        return [key, Number.isNaN(parsed) ? originalValue : parsed];
      }
      if (isPlainObject(originalValue) && typeof value === 'string') {
        return [key, value.trim() ? JSON.parse(value) : {}];
      }
      return [key, value];
    }),
  );
}

function customExtraInput(value: unknown) {
  if (typeof value === 'boolean') {
    return (
      <Select
        options={[
          { label: '是', value: true },
          { label: '否', value: false },
        ]}
      />
    );
  }
  if (typeof value === 'number') {
    return <Input type="number" />;
  }
  if (Array.isArray(value)) {
    return <Select mode="tags" tokenSeparators={[',']} />;
  }
  if (isPlainObject(value)) {
    return <Input.TextArea autoSize={{ minRows: 4, maxRows: 10 }} />;
  }
  if (typeof value === 'string' && value.length > 80) {
    return <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />;
  }
  return <Input />;
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
  const [editTab, setEditTab] = useState('basic');
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
  const buildings = useQuery({
    queryKey: ['house', 'detail', 'buildings', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listBuildings({ page: 1, page_size: 100 }),
    enabled: relatedEnabled && editOpen,
  });
  const tagSuggestions = useQuery({
    queryKey: ['house', 'tag-suggestions'],
    queryFn: () => houseApi.getTagSuggestions(),
    enabled: relatedEnabled && editOpen,
  });
  const landlords = useQuery({
    queryKey: ['house', 'detail', 'landlords', workspace.selectedOrgSlug],
    queryFn: () =>
      houseApi.listContacts({
        page: 1,
        page_size: 100,
        role: 'landlord',
        task: 'active',
      }),
    enabled: relatedEnabled && editOpen,
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
  const patchHouse = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      houseApi.patchHouse(houseId, values),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: favoriteKeys.target('house', houseId),
        }),
        queryClient.invalidateQueries({ queryKey: favoriteKeys.lists() }),
      ]);
      message.success('房源已更新');
    },
  });
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
  const openEdit = (task?: string) => {
    setEditTab(
      task === 'media' ? 'media' : task === 'extra' ? 'display' : 'basic',
    );
    updateDetailFocus({ action: 'edit', task });
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
  const landlordItems = Array.from(
    new Map(
      [
        ...(landlords.data?.items || []),
        ...(currentHouse?.landlord ? [currentHouse.landlord] : []),
      ].map((item) => [item.id, item]),
    ).values(),
  );
  const displayTags = houseDisplayTags(currentHouse);
  const ownTags = normalizePropertyTags(currentHouse?.tags);
  const inheritedTags = getInheritedPropertyTags(ownTags, displayTags);
  const houseImages = (currentHouse?.images || []) as MediaRefValue[];
  const houseVideos = (currentHouse?.videos || []) as MediaRefValue[];
  const customFieldEntries = Object.entries(currentHouse?.extra || {});
  const editInitialValues = currentHouse
    ? {
        ...currentHouse,
        extra: prepareExtraFormValues(currentHouse.extra),
      }
    : undefined;
  const quickActionItems = currentHouse
    ? [
        {
          key: 'viewing',
          icon: <ScheduleOutlined />,
          label: (
            <a
              href={dashboardHref(
                `/rental/viewings?house_id=${houseId}`,
              )}
            >
              登记带看
            </a>
          ),
        },
        {
          key: 'lease',
          icon: <FileAddOutlined />,
          label: (
            <a
              href={dashboardHref(
                `/rental/leases?house_id=${houseId}`,
              )}
            >
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
                      <Tag
                        color={STATUS_COLOR[currentHouse.status] || 'default'}
                      >
                        {enumMapping(
                          currentHouse.status,
                          currentHouse.status__mapping,
                        )}
                      </Tag>
                    </div>
                    <div className={styles.locationLine}>
                      <EnvironmentOutlined style={{ marginTop: 3 }} />
                      <span>
                        {currentHouse.building?.address || '楼栋地址待补充'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.rentBlock}>
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
                        <Typography.Text type="secondary">/ 月</Typography.Text>
                      ) : null}
                    </div>
                    <div className={styles.depositLine}>
                      <Typography.Text type="secondary">押金</Typography.Text>
                      <Typography.Text className={styles.depositAmount}>
                        {compactMoneyText(currentHouse.deposit_amount)}
                      </Typography.Text>
                    </div>
                  </div>
                  <div className={styles.factsGrid}>
                    <div className={styles.factItem}>
                      <Typography.Text type="secondary">户型</Typography.Text>
                      <span className={styles.factValue}>
                        {layoutText(currentHouse)}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <Typography.Text type="secondary">面积</Typography.Text>
                      <span className={styles.factValue}>
                        {currentHouse.area ? `${currentHouse.area} ㎡` : '-'}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <Typography.Text type="secondary">楼层</Typography.Text>
                      <span className={styles.factValue}>
                        {currentHouse.floor == null
                          ? '-'
                          : `${currentHouse.floor} 层`}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <Typography.Text type="secondary">
                        电梯可达
                      </Typography.Text>
                      <span className={styles.factValue}>
                        {currentHouse.has_elevator_access == null
                          ? '-'
                          : currentHouse.has_elevator_access
                            ? '是'
                            : '否'}
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
                  <p className={styles.descriptionText}>
                    {currentHouse.public_description || '暂无对外房源描述'}
                  </p>
                  <div className={styles.noteLine}>
                    <Typography.Text strong>内部备注：</Typography.Text>
                    <Typography.Text type="secondary">
                      {currentHouse.internal_notes || '暂无内部备注'}
                    </Typography.Text>
                  </div>
                  <section aria-label="房源标签" className={styles.tagsSection}>
                    {displayTags.length ? (
                      <Space size={[4, 8]} wrap>
                        {ownTags.map((tag) => (
                          <Tag color="purple" key={`own-${tag}`}>
                            {tag}
                          </Tag>
                        ))}
                        {inheritedTags.map((tag) => (
                          <Tag key={`inherited-${tag}`}>{tag}</Tag>
                        ))}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">
                        暂无标签
                      </Typography.Text>
                    )}
                  </section>
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
                          <div className={styles.materialField}>
                            <Typography.Text
                              className={styles.materialFieldLabel}
                            >
                              楼栋 / 房号
                            </Typography.Text>
                            <div className={styles.materialFieldValue}>
                              <Space separator="/" size={6}>
                                <BuildingPreview id={currentHouse.building_id}>
                                  {currentHouse.building?.name ||
                                    `楼栋 #${currentHouse.building_id}`}
                                </BuildingPreview>
                                <HousePreview id={currentHouse.id}>
                                  {currentHouse.room_number}
                                </HousePreview>
                              </Space>
                            </div>
                          </div>
                          <div className={styles.materialField}>
                            <Typography.Text
                              className={styles.materialFieldLabel}
                            >
                              房东信息
                            </Typography.Text>
                            <div className={styles.materialFieldValue}>
                              {currentHouse.landlord_id ? (
                                <ContactPreview id={currentHouse.landlord_id}>
                                  {contactLabel(currentHouse)}
                                </ContactPreview>
                              ) : (
                                <Typography.Text type="warning">
                                  待补房东
                                </Typography.Text>
                              )}
                            </div>
                          </div>
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
                          <div className={styles.materialField}>
                            <Typography.Text
                              className={styles.materialFieldLabel}
                            >
                              卫 / 厨 / 阳台
                            </Typography.Text>
                            <div className={styles.materialFieldValue}>
                              {secondaryLayoutText(currentHouse)}
                            </div>
                          </div>
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
                          <div className={styles.materialField}>
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
                          </div>
                          <div className={styles.materialField}>
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
                          </div>
                          {customFieldEntries.map(([key, value]) => (
                            <div
                              className={cx(
                                styles.materialField,
                                isWideCustomField(value) &&
                                  styles.materialFieldWide,
                              )}
                              key={key}
                            >
                              <Typography.Text
                                className={styles.materialFieldLabel}
                              >
                                {customFieldLabel(key)}
                              </Typography.Text>
                              <div className={styles.materialFieldValue}>
                                {customFieldValue(value)}
                              </div>
                            </div>
                          ))}
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
                          title: '客户 / 状态',
                          dataIndex: 'customer_name',
                          width: 260,
                          render: (value, record) => (
                            <div>
                              <Space size={6} wrap>
                                <ViewingPreview id={record.id}>
                                  <span className={styles.recordPrimary}>
                                    {value}
                                  </span>
                                </ViewingPreview>
                                <Tag
                                  color={
                                    STATUS_COLOR[record.status] || 'default'
                                  }
                                >
                                  {enumMapping(
                                    record.status,
                                    record.status__mapping,
                                  )}
                                </Tag>
                              </Space>
                              <span className={styles.recordSecondary}>
                                {record.customer_phone || '-'}
                              </span>
                            </div>
                          ),
                        },
                        {
                          title: '预约时间',
                          dataIndex: 'scheduled_at',
                          width: 170,
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
                          title: '租客 / 状态',
                          dataIndex: 'tenant_id',
                          width: 200,
                          render: (_value, record) => (
                            <div>
                              <Space size={6} wrap>
                                <ContactPreview id={record.tenant_id}>
                                  <span className={styles.recordPrimary}>
                                    {record.tenant?.name ||
                                      `联系人 #${record.tenant_id}`}
                                  </span>
                                </ContactPreview>
                                <Tag
                                  color={
                                    STATUS_COLOR[record.status] || 'default'
                                  }
                                >
                                  {enumMapping(
                                    record.status,
                                    record.status__mapping,
                                  )}
                                </Tag>
                              </Space>
                              <span className={styles.recordSecondary}>
                                {record.tenant?.phone || '-'}
                              </span>
                            </div>
                          ),
                        },
                        {
                          title: '租金',
                          dataIndex: 'monthly_rent',
                          width: 130,
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
                          render: (value, record) => (
                            <div>
                              <Space size={6} wrap>
                                <LeasePreview id={record.id}>
                                  <span>{`租约 #${record.id} · ${value?.length || 0} 份`}</span>
                                </LeasePreview>
                                {!value?.length ? (
                                  <Tag color="orange">待补合同</Tag>
                                ) : null}
                              </Space>
                              <a
                                href={
                                  record.contract_files?.length
                                    ? leaseEditHref(houseId, record.id)
                                    : leaseEditHref(houseId, record.id, {
                                        task: 'contract',
                                      })
                                }
                                style={{ display: 'block', marginTop: 4 }}
                              >
                                {record.contract_files?.length
                                  ? '编辑租约'
                                  : '补合同'}
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
            ? '确认后房源状态将切换为招租中，继续承接带看。'
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
            htmlType="submit"
            form="house-edit-form"
            loading={patchHouse.isPending}
          >
            保存
          </Button>
        }
      >
        <Form
          key={detailScopeKey}
          id="house-edit-form"
          layout="vertical"
          initialValues={editInitialValues}
          preserve={false}
          onFinish={(values) => {
            const payload = {
              ...values,
              extra: normalizeExtraFormValues(
                values.extra,
                currentHouse?.extra,
              ),
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
                              options={(buildings.data?.items || []).map(
                                (item) => ({
                                  value: item.id,
                                  label: buildingLabel(item),
                                }),
                              )}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="房东" name="landlord_id">
                            <Select
                              allowClear
                              options={landlordItems.map((item) => ({
                                value: item.id,
                                label: contactLabel(item),
                              }))}
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
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item label="押金" name="deposit_amount">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="所在楼层" name="floor">
                            <Input type="number" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="房态" name="status">
                            <Select options={statusOptions} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>

                    <div style={editSectionStyle}>
                      <Typography.Text strong>户型与面积</Typography.Text>
                      <Row gutter={[16, 0]} style={{ marginTop: 12 }}>
                        <Col xs={24} md={12}>
                          <Form.Item label="建筑面积" name="area">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="套内面积" name="interior_area">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item label="室" name="bedrooms">
                            <Input type="number" min={0} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item label="厅" name="living_rooms">
                            <Input type="number" min={0} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item label="卫" name="bathrooms">
                            <Input type="number" min={0} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item label="厨" name="kitchens">
                            <Input type="number" min={0} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item label="阳台" name="balconies">
                            <Input type="number" min={0} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={9}>
                          <Form.Item label="朝向" name="orientation">
                            <Select allowClear options={orientationOptions} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={9}>
                          <Form.Item label="装修" name="decoration">
                            <Select allowClear options={decorationOptions} />
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
                            const selectedBuilding = (
                              buildings.data?.items || []
                            ).find(
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

                    <div style={editSectionStyle}>
                      <Typography.Text strong>自定义字段</Typography.Text>
                      {Object.entries(currentHouse?.extra || {}).length ? (
                        <div
                          className={styles.customFieldsGrid}
                          style={{ marginTop: 12 }}
                        >
                          {Object.entries(currentHouse?.extra || {}).map(
                            ([key, value]) => (
                              <div
                                className={
                                  isWideCustomField(value)
                                    ? styles.customFieldWide
                                    : undefined
                                }
                                key={key}
                              >
                                <Form.Item
                                  label={customFieldLabel(key)}
                                  name={['extra', key]}
                                  rules={
                                    isPlainObject(value)
                                      ? [
                                          {
                                            validator: async (_rule, input) => {
                                              if (!input?.trim()) return;
                                              try {
                                                const parsed =
                                                  JSON.parse(input);
                                                if (!isPlainObject(parsed)) {
                                                  throw new Error();
                                                }
                                              } catch {
                                                throw new Error(
                                                  '请输入有效的 JSON 对象',
                                                );
                                              }
                                            },
                                          },
                                        ]
                                      : undefined
                                  }
                                >
                                  {customExtraInput(value)}
                                </Form.Item>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <Typography.Text type="secondary">
                          当前房源暂无自定义字段。
                        </Typography.Text>
                      )}
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
                      <Space align="center" size={8} wrap>
                        <Typography.Text strong>图片与视频</Typography.Text>
                        <Tag color="blue" variant="filled">
                          即时保存
                        </Tag>
                      </Space>
                      <Typography.Text type="secondary">
                        图片角色、封面和排序调整会立即保存，不受右上角保存按钮影响。
                      </Typography.Text>
                      <MediaRefsUpload
                        title="图片资料"
                        value={houseImages}
                        resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_IMAGE}
                        mediaType={HOUSE_MEDIA_TYPE.IMAGE}
                        maxCount={9}
                        onChange={(images) => patchHouse.mutate({ images })}
                      />
                      <MediaRefsUpload
                        title="视频资料"
                        value={houseVideos}
                        resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_VIDEO}
                        mediaType={HOUSE_MEDIA_TYPE.VIDEO}
                        maxCount={3}
                        onChange={(videos) => patchHouse.mutate({ videos })}
                      />
                      {patchHouse.isPending ? (
                        <Typography.Text type="secondary">
                          正在保存调整…
                        </Typography.Text>
                      ) : null}
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
