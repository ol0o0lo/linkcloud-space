import {
  ClockCircleOutlined,
  DownOutlined,
  EditOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  AutoComplete,
  Button,
  Empty,
  Input,
  Skeleton,
  Tooltip,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { TreeSectionHeader } from '@/components/TreeSectionHeader';
import {
  type BuildingOut,
  type EstateOut,
  houseApi,
} from '@/services/manual/house';

const ESTATE_PAGE_SIZE = 30;
const BUILDING_PAGE_SIZE = 500;
const SEARCH_PAGE_SIZE = 50;
const RECENT_SCOPE_LIMIT = 5;

export type PropertyAssetScope = {
  estateId?: number;
  buildingId?: number;
};

export type PropertyStructureIntent = {
  estateCreate?: boolean;
  estateEditId?: number;
  buildingCreateStandalone?: boolean;
  buildingEditId?: number;
  buildingCreateEstateId?: number;
};

type RecentPropertyScope = {
  key: string;
  label: string;
  scope: PropertyAssetScope;
  count?: string;
};

type PropertyAssetNavigatorProps = {
  collapsed: boolean;
  disabled?: boolean;
  enabled: boolean;
  orgSlug?: string;
  scope: PropertyAssetScope;
  onOpenManagement: (intent?: PropertyStructureIntent) => void;
  onScopeChange: (scope: PropertyAssetScope) => void;
};

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    position: relative;
    display: flex;
    flex: 0 0 auto;
    width: 280px;
    min-width: 280px;
    height: 100%;
    min-height: 0;
    transition:
      width ${token.motionDurationMid} ${token.motionEaseOut},
      min-width ${token.motionDurationMid} ${token.motionEaseOut};
    will-change: width;

    @media (max-width: ${token.screenLG}px) {
      width: 100%;
      min-width: 0;
      height: min(480px, calc(100dvh - 200px));
      transition: height ${token.motionDurationMid} ${token.motionEaseOut};
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  collapsedShell: css`
    width: 0 !important;
    min-width: 0 !important;

    @media (max-width: ${token.screenLG}px) {
      width: 100% !important;
      height: 0 !important;
    }
  `,
  root: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    opacity: 1;
    transition:
      opacity ${token.motionDurationFast} ${token.motionEaseOut},
      border-color ${token.motionDurationMid} ${token.motionEaseOut};

    @media (max-width: ${token.screenLG}px) {
      height: 100%;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  collapsedRoot: css`
    border-color: transparent;
    opacity: 0;
    pointer-events: none;
  `,
  header: css`
    padding: 12px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  scopeHeading: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  scopeHeadingIcon: css`
    display: inline-flex;
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: ${token.fontSizeLG}px;
  `,
  search: css`
    width: 100%;
    margin-top: 12px;

    .ant-input-affix-wrapper,
    .ant-input-search-button {
      background: ${token.colorFillQuaternary};
      border-color: transparent;
      box-shadow: none;
    }

    .ant-input-search-button {
      color: ${token.colorTextSecondary};
    }

    &:focus-within {
      .ant-input-affix-wrapper,
      .ant-input-search-button {
        border-color: ${token.colorPrimary};
      }
    }
  `,
  searchHistoryHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
  `,
  searchHistoryOption: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  `,
  searchHistoryLabel: css`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  body: css`
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 8px;
  `,
  sectionLabel: css`
    display: block;
    padding: 12px 8px 6px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    font-weight: 600;
  `,
  primaryLinks: css`
    display: grid;
    gap: 4px;
    padding-block: 4px;
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 36px;
    padding-inline: 8px;
    border: 1px solid transparent;
    border-radius: ${token.borderRadius}px;
    color: ${token.colorText};
    transition:
      background-color ${token.motionDurationFast},
      border-color ${token.motionDurationFast},
      color ${token.motionDurationFast};

    &:hover {
      background: ${token.colorFillQuaternary};
    }

    &[data-active='true'] {
      background: ${token.colorPrimaryBg};
      border-color: ${token.colorPrimaryBorderHover};
      color: ${token.colorPrimary};
      font-weight: 500;
    }

    &[data-active='true'] .asset-row-count {
      padding: 2px 7px;
      border-radius: ${token.borderRadiusLG}px;
      background: ${token.colorBgContainer};
      color: ${token.colorPrimary};
    }

    &:hover .asset-row-count,
    &:has(.asset-row-actions:focus-within) .asset-row-count {
      opacity: 0;
      pointer-events: none;
    }

    &:hover .asset-row-actions,
    &:has(.asset-row-actions:focus-within) .asset-row-actions {
      opacity: 1;
      pointer-events: auto;
    }

    &:hover .asset-row-actions .ant-btn,
    &:has(.asset-row-actions:focus-within) .asset-row-actions .ant-btn {
      color: ${token.colorPrimary};
    }

    &[data-active='true'] > .ant-btn,
    &[data-active='true'] > .ant-btn:hover,
    &[data-active='true'] > .ant-btn:active,
    &[data-active='true'] > .ant-btn:focus,
    &[data-active='true'] .asset-row-actions .ant-btn {
      color: ${token.colorPrimary} !important;
    }

    > .ant-btn:hover,
    > .ant-btn:active,
    > .ant-btn:focus {
      background: transparent !important;
    }

    > .ant-btn:focus,
    > .ant-btn:focus-visible {
      outline: none !important;
    }
  `,
  labelButton: css`
    display: flex;
    flex: 1;
    min-width: 0;
    justify-content: flex-start;
    padding-inline: 4px;
    color: inherit;
    text-align: start;

    > span:last-child {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &:focus,
    &:focus-visible {
      outline: none !important;
    }
  `,
  count: css`
    flex: 0 0 auto;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    white-space: nowrap;
    transition:
      opacity ${token.motionDurationFast},
      background-color ${token.motionDurationFast},
      color ${token.motionDurationFast};
  `,
  rowTrailing: css`
    position: relative;
    display: flex;
    flex: 0 0 84px;
    height: 32px;
    align-items: center;
    justify-content: flex-end;

    .asset-row-count,
    .asset-row-actions {
      position: absolute;
      inset-inline-end: 2px;
      top: 50%;
      transform: translateY(-50%);
    }
  `,
  rowActions: css`
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    pointer-events: none;
    transition: opacity ${token.motionDurationFast};

    .ant-btn:hover,
    .ant-btn:active {
      background: transparent !important;
      color: ${token.colorPrimary};
    }
  `,
  childMotion: css`
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition:
      grid-template-rows ${token.motionDurationMid} ${token.motionEaseInOut},
      opacity ${token.motionDurationFast} ${token.motionEaseInOut},
      transform ${token.motionDurationMid} ${token.motionEaseInOut};
    will-change: grid-template-rows, opacity, transform;

    &[data-expanded='true'] {
      grid-template-rows: 1fr;
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  childMotionInner: css`
    min-height: 0;
    overflow: hidden;
  `,
  loadingSkeleton: css`
    padding-block: ${token.paddingXS}px;
  `,
  childList: css`
    position: relative;
    padding-inline-start: 28px;

    &[data-show-line='true']::before {
      position: absolute;
      inset-inline-start: 15px;
      top: 0;
      bottom: 18px;
      width: 1px;
      background: ${token.colorBorder};
      content: '';
    }
  `,
  nestedRow: css`
    position: relative;

    &::before {
      position: absolute;
      inset-inline-start: -13px;
      top: 18px;
      width: 13px;
      border-top: 1px solid ${token.colorBorder};
      content: '';
    }
  `,
  emptyBuildings: css`
    display: flex;
    min-height: 40px;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
    padding: 6px 8px 6px 10px;
    border: 1px dashed ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
  `,
  emptyBuildingsLabel: css`
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 6px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    white-space: nowrap;
  `,
  divider: css`
    margin: 10px 8px 0;
    border-top: 1px dashed ${token.colorBorderSecondary};
  `,
  footer: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    padding: 8px;
    border-top: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorFillQuaternary};
  `,
  footerButton: css`
    height: auto;
    min-width: 0;
    padding: 6px 2px;
    white-space: normal;

    > span:last-child {
      font-size: ${token.fontSizeSM}px;
      line-height: 1.25;
    }
  `,
  searchSection: css`
    padding-block-end: 8px;
  `,
}));

function recentStorageKey(orgSlug?: string) {
  return `ui.property-rental.asset-navigator.recent.${orgSlug || 'default'}`;
}

function collapsedStorageKey(orgSlug?: string) {
  return `ui.property-rental.asset-navigator.collapsed.${orgSlug || 'default'}`;
}

function readRecentScopes(orgSlug?: string): RecentPropertyScope[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(recentStorageKey(orgSlug)) || '[]',
    );
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_SCOPE_LIMIT) : [];
  } catch {
    return [];
  }
}

export function readPropertyAssetNavigatorCollapsed(orgSlug?: string) {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(collapsedStorageKey(orgSlug)) === 'true';
}

export function writePropertyAssetNavigatorCollapsed(
  collapsed: boolean,
  orgSlug?: string,
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(collapsedStorageKey(orgSlug), String(collapsed));
}

function buildScopedPath(
  pathname: string,
  scope: PropertyAssetScope,
  buildingParam: string,
) {
  const params = new URLSearchParams();
  if (scope.buildingId) params.set(buildingParam, String(scope.buildingId));
  else if (scope.estateId) params.set('estate_id', String(scope.estateId));
  const search = params.toString();
  return `${pathname}${search ? `?${search}` : ''}`;
}

function estateName(estate: EstateOut) {
  return estate.display_name || estate.name;
}

function estateCountText(estate: EstateOut) {
  const parts: string[] = [];
  if (typeof estate.building_count === 'number') {
    parts.push(`${estate.building_count}栋`);
  }
  if (typeof estate.counts?.total === 'number') {
    parts.push(`${estate.counts.total}套`);
  }
  return parts.join(' · ');
}

function buildingCountText(building: BuildingOut) {
  return typeof building.counts?.total === 'number'
    ? String(building.counts.total)
    : '';
}

async function fetchAllEstateBuildings(estateId: number) {
  const items: BuildingOut[] = [];
  let page = 1;

  while (true) {
    const result = await houseApi.listBuildings({
      estate_id: estateId,
      page,
      page_size: BUILDING_PAGE_SIZE,
    });
    items.push(...result.items);
    if (!result.items.length || items.length >= result.total) break;
    page += 1;
  }

  return items;
}

async function fetchAllBuildings() {
  const items: BuildingOut[] = [];
  let page = 1;

  while (true) {
    const result = await houseApi.listBuildings({
      page,
      page_size: BUILDING_PAGE_SIZE,
    });
    items.push(...result.items);
    if (!result.items.length || items.length >= result.total) break;
    page += 1;
  }

  return items;
}

function EstateNode({
  disabled,
  enabled,
  estate,
  expanded,
  orgSlug,
  scope,
  onExpandedChange,
  onOpenManagement,
  onRememberScope,
  onScopeChange,
}: {
  disabled: boolean;
  enabled: boolean;
  estate: EstateOut;
  expanded: boolean;
  orgSlug?: string;
  scope: PropertyAssetScope;
  onExpandedChange: (expanded: boolean) => void;
  onOpenManagement: (intent?: PropertyStructureIntent) => void;
  onRememberScope: (scope: RecentPropertyScope) => void;
  onScopeChange: (scope: PropertyAssetScope) => void;
}) {
  const { styles } = useStyles();
  const name = estateName(estate);
  const buildings = useQuery({
    queryKey: ['house', 'asset-navigator', 'buildings', orgSlug, estate.id],
    queryFn: () => fetchAllEstateBuildings(estate.id),
    enabled: enabled && expanded,
  });

  return (
    <div>
      <div className={styles.row} data-active={scope.estateId === estate.id}>
        <Button
          type="text"
          size="small"
          disabled={disabled}
          aria-label={`${expanded ? '收起' : '展开'}${name}`}
          icon={expanded ? <DownOutlined /> : <RightOutlined />}
          onClick={() => onExpandedChange(!expanded)}
        />
        <AppIcon name="estate" />
        <Button
          type="text"
          className={`${styles.labelButton} asset-row-label`}
          disabled={disabled}
          aria-label={`选择项目 ${name}`}
          aria-current={scope.estateId === estate.id ? 'page' : undefined}
          onClick={() => {
            if (scope.estateId === estate.id) {
              onExpandedChange(false);
              onScopeChange({});
              return;
            }
            if (!expanded) onExpandedChange(true);
            const nextScope = { estateId: estate.id };
            onScopeChange(nextScope);
            onRememberScope({
              key: `estate:${estate.id}`,
              label: name,
              scope: nextScope,
              count: estateCountText(estate),
            });
          }}
        >
          {name}
        </Button>
        <span className={styles.rowTrailing}>
          <span className={`${styles.count} asset-row-count`}>
            {estateCountText(estate)}
          </span>
          <span className={`${styles.rowActions} asset-row-actions`}>
            <Tooltip title={`新建${name}楼栋`}>
              <Button
                type="text"
                size="small"
                disabled={disabled}
                aria-label={`新建${name}楼栋`}
                icon={<PlusOutlined />}
                onClick={() =>
                  onOpenManagement({ buildingCreateEstateId: estate.id })
                }
              />
            </Tooltip>
            <Tooltip title={`编辑${name}项目`}>
              <Button
                type="text"
                size="small"
                disabled={disabled}
                aria-label={`编辑${name}项目`}
                icon={<EditOutlined />}
                onClick={() => onOpenManagement({ estateEditId: estate.id })}
              />
            </Tooltip>
          </span>
        </span>
      </div>
      <div
        aria-hidden={!expanded}
        className={styles.childMotion}
        data-expanded={expanded}
      >
        <div className={styles.childMotionInner}>
          <div
            className={styles.childList}
            data-show-line={Boolean(buildings.data?.length)}
          >
            {buildings.isPending ? (
              <Skeleton
                active
                className={styles.loadingSkeleton}
                paragraph={{ rows: 2 }}
              />
            ) : null}
            {buildings.data?.map((building) => (
              <div
                className={`${styles.row} ${styles.nestedRow}`}
                data-active={scope.buildingId === building.id}
                key={building.id}
              >
                <AppIcon name="building" />
                <Button
                  type="text"
                  className={`${styles.labelButton} asset-row-label`}
                  disabled={disabled}
                  aria-label={`选择楼栋 ${name} / ${building.name}`}
                  aria-current={
                    scope.buildingId === building.id ? 'page' : undefined
                  }
                  onClick={() => {
                    const nextScope = { buildingId: building.id };
                    onScopeChange(nextScope);
                    onRememberScope({
                      key: `building:${building.id}`,
                      label: `${name} / ${building.name}`,
                      scope: nextScope,
                      count: buildingCountText(building),
                    });
                  }}
                >
                  {building.name}
                </Button>
                <span className={styles.rowTrailing}>
                  <span className={`${styles.count} asset-row-count`}>
                    {buildingCountText(building)}
                  </span>
                  <span className={`${styles.rowActions} asset-row-actions`}>
                    <Tooltip title="新建房源">
                      <Button
                        type="text"
                        size="small"
                        disabled={disabled}
                        aria-label={`在${name} / ${building.name}下新建房源`}
                        icon={<PlusOutlined />}
                        onClick={() =>
                          history.push(
                            `/rental/properties/new?building_id=${building.id}`,
                          )
                        }
                      />
                    </Tooltip>
                    <Tooltip title="编辑楼栋">
                      <Button
                        type="text"
                        size="small"
                        disabled={disabled}
                        aria-label={`编辑${name} / ${building.name}`}
                        icon={<EditOutlined />}
                        onClick={() =>
                          onOpenManagement({ buildingEditId: building.id })
                        }
                      />
                    </Tooltip>
                  </span>
                </span>
              </div>
            ))}
            {buildings.isSuccess && buildings.data.length === 0 ? (
              <div className={styles.emptyBuildings}>
                <span className={styles.emptyBuildingsLabel}>
                  <AppIcon aria-hidden="true" name="building" />
                  <span>暂无楼栋</span>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PropertyAssetNavigator({
  collapsed,
  disabled = false,
  enabled,
  orgSlug,
  scope,
  onOpenManagement,
  onScopeChange,
}: PropertyAssetNavigatorProps) {
  const { cx, styles } = useStyles();
  const [expandedEstateIds, setExpandedEstateIds] = useState<number[]>([]);
  const [standaloneExpanded, setStandaloneExpanded] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchKeyword, setSearchKeyword] = useState<string>();
  const [searchHistoryOpen, setSearchHistoryOpen] = useState(false);
  const [recentScopes, setRecentScopes] = useState<RecentPropertyScope[]>(() =>
    readRecentScopes(orgSlug),
  );
  const selectedBuilding = useQuery({
    queryKey: [
      'house',
      'asset-navigator',
      'selected-building',
      orgSlug,
      scope.buildingId,
    ],
    queryFn: () => houseApi.getBuilding(scope.buildingId as number),
    enabled: enabled && Boolean(scope.buildingId),
  });
  const estates = useInfiniteQuery({
    queryKey: ['house', 'asset-navigator', 'estates', orgSlug],
    queryFn: ({ pageParam }) =>
      houseApi.listEstates({
        page: pageParam,
        page_size: ESTATE_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.page_size < lastPage.total
        ? lastPage.page + 1
        : undefined,
    enabled,
  });
  const estateItems = useMemo(
    () => estates.data?.pages.flatMap((page) => page.items) || [],
    [estates.data?.pages],
  );
  const searchedEstates = useQuery({
    queryKey: [
      'house',
      'asset-navigator',
      'search-estates',
      orgSlug,
      searchKeyword,
    ],
    queryFn: () =>
      houseApi.listEstates({
        keyword: searchKeyword,
        page: 1,
        page_size: SEARCH_PAGE_SIZE,
      }),
    enabled: enabled && Boolean(searchKeyword),
  });
  const searchedBuildings = useQuery({
    queryKey: [
      'house',
      'asset-navigator',
      'search-buildings',
      orgSlug,
      searchKeyword,
    ],
    queryFn: () =>
      houseApi.listBuildings({
        keyword: searchKeyword,
        page: 1,
        page_size: SEARCH_PAGE_SIZE,
      }),
    enabled: enabled && Boolean(searchKeyword),
  });
  const standaloneBuildings = useQuery({
    queryKey: ['house', 'asset-navigator', 'standalone-buildings', orgSlug],
    queryFn: async () =>
      (await fetchAllBuildings()).filter((building) => !building.estate_id),
    enabled: enabled && standaloneExpanded,
  });

  const rememberScope = (recentScope: RecentPropertyScope) => {
    setRecentScopes((current) => {
      const next = [
        recentScope,
        ...current.filter((item) => item.key !== recentScope.key),
      ].slice(0, RECENT_SCOPE_LIMIT);
      window.localStorage.setItem(
        recentStorageKey(orgSlug),
        JSON.stringify(next),
      );
      return next;
    });
  };

  const clearRecentScopes = () => {
    setRecentScopes([]);
    setSearchHistoryOpen(false);
    window.localStorage.removeItem(recentStorageKey(orgSlug));
  };

  const clearSearch = () => {
    setSearchDraft('');
    setSearchKeyword(undefined);
  };

  const recentSearchOptions = recentScopes.map((recentScope) => ({
    value: recentScope.key,
    'aria-label': recentScope.label,
    label: (
      <div className={styles.searchHistoryOption}>
        <span className={styles.searchHistoryLabel}>
          <ClockCircleOutlined /> {recentScope.label}
        </span>
        {recentScope.count ? (
          <Typography.Text type="secondary">
            {recentScope.count}
          </Typography.Text>
        ) : null}
      </div>
    ),
  }));

  useEffect(() => {
    const estateId = scope.estateId || selectedBuilding.data?.estate_id;
    if (!estateId) return;
    setExpandedEstateIds([estateId]);
  }, [scope.estateId, selectedBuilding.data?.estate_id]);

  useEffect(() => {
    setRecentScopes(readRecentScopes(orgSlug));
  }, [orgSlug]);

  return (
    <div
      className={cx(styles.shell, collapsed && styles.collapsedShell)}
      data-asset-navigator-collapsed={collapsed}
    >
      <aside
        className={cx(styles.root, collapsed && styles.collapsedRoot)}
        aria-hidden={collapsed}
        aria-label="房源资产导航"
      >
        <div className={styles.header}>
          <div className={styles.scopeHeading}>
            <span
              className={styles.scopeHeadingIcon}
              aria-hidden="true"
              data-scope-heading-icon="true"
            >
              <AppIcon name="house" />
            </span>
            <Typography.Text strong>房源范围</Typography.Text>
          </div>
          <AutoComplete
            className={styles.search}
            disabled={disabled}
            open={
              searchHistoryOpen &&
              !searchDraft &&
              recentSearchOptions.length > 0
            }
            options={!searchDraft ? recentSearchOptions : []}
            popupRender={(menu) => (
              <div>
                <div className={styles.searchHistoryHeader}>
                  <Typography.Text type="secondary">最近使用</Typography.Text>
                  <Button
                    type="text"
                    size="small"
                    aria-label="清除搜索历史"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={clearRecentScopes}
                  >
                    清除
                  </Button>
                </div>
                {menu}
              </div>
            )}
            value={searchDraft}
            onChange={(value) => {
              setSearchDraft(value);
              if (!value) {
                setSearchKeyword(undefined);
                setSearchHistoryOpen(true);
              }
            }}
            onFocus={() => {
              if (!searchDraft) setSearchHistoryOpen(true);
            }}
            onOpenChange={(open) => setSearchHistoryOpen(open && !searchDraft)}
            onSelect={(value) => {
              const recentScope = recentScopes.find(
                (item) => item.key === value,
              );
              if (!recentScope) return;
              if (recentScope.scope.estateId) {
                setExpandedEstateIds([recentScope.scope.estateId]);
              }
              onScopeChange(recentScope.scope);
              rememberScope(recentScope);
              clearSearch();
              setSearchHistoryOpen(false);
            }}
          >
            <Input.Search
              allowClear
              aria-label="搜索项目或楼栋"
              placeholder="搜索项目或楼栋"
              onSearch={(value) => {
                setSearchHistoryOpen(false);
                setSearchKeyword(value.trim() || undefined);
              }}
            />
          </AutoComplete>
        </div>
        <div className={styles.body}>
          {searchKeyword ? (
            <div className={styles.searchSection}>
              <span className={styles.sectionLabel}>项目</span>
              {searchedEstates.isPending ? (
                <Skeleton
                  active
                  className={styles.loadingSkeleton}
                  paragraph={{ rows: 2 }}
                />
              ) : null}
              {searchedEstates.data?.items.map((estate) => {
                const name = estateName(estate);
                return (
                  <div
                    className={styles.row}
                    data-active={scope.estateId === estate.id}
                    key={`search-estate-${estate.id}`}
                  >
                    <AppIcon name="estate" />
                    <Button
                      type="text"
                      className={`${styles.labelButton} asset-row-label`}
                      disabled={disabled}
                      aria-label={`选择项目 ${name}`}
                      aria-current={
                        scope.estateId === estate.id ? 'page' : undefined
                      }
                      onClick={() => {
                        setExpandedEstateIds([estate.id]);
                        const nextScope = { estateId: estate.id };
                        onScopeChange(nextScope);
                        rememberScope({
                          key: `estate:${estate.id}`,
                          label: name,
                          scope: nextScope,
                          count: estateCountText(estate),
                        });
                        clearSearch();
                      }}
                    >
                      {name}
                    </Button>
                    <span className={`${styles.count} asset-row-count`}>
                      {estateCountText(estate)}
                    </span>
                  </div>
                );
              })}
              <span className={styles.sectionLabel}>楼栋</span>
              {searchedBuildings.isPending ? (
                <Skeleton
                  active
                  className={styles.loadingSkeleton}
                  paragraph={{ rows: 2 }}
                />
              ) : null}
              {searchedBuildings.data?.items.map((building) => {
                const parentName = building.estate
                  ? estateName(building.estate as EstateOut)
                  : '独立楼栋';
                return (
                  <div
                    className={styles.row}
                    data-active={scope.buildingId === building.id}
                    key={`search-building-${building.id}`}
                  >
                    <AppIcon name="building" />
                    <Button
                      type="text"
                      className={`${styles.labelButton} asset-row-label`}
                      disabled={disabled}
                      aria-label={`选择楼栋 ${parentName} / ${building.name}`}
                      aria-current={
                        scope.buildingId === building.id ? 'page' : undefined
                      }
                      onClick={() => {
                        if (building.estate_id) {
                          setExpandedEstateIds([building.estate_id]);
                        }
                        const nextScope = { buildingId: building.id };
                        onScopeChange(nextScope);
                        rememberScope({
                          key: `building:${building.id}`,
                          label: `${parentName} / ${building.name}`,
                          scope: nextScope,
                          count: buildingCountText(building),
                        });
                        clearSearch();
                      }}
                    >
                      {building.name}
                      <Typography.Text type="secondary">
                        {` · ${parentName}`}
                      </Typography.Text>
                    </Button>
                    <span className={`${styles.count} asset-row-count`}>
                      {buildingCountText(building)}
                    </span>
                  </div>
                );
              })}
              {searchedEstates.isSuccess &&
              searchedBuildings.isSuccess &&
              !searchedEstates.data.items.length &&
              !searchedBuildings.data.items.length ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="未找到匹配的项目或楼栋"
                />
              ) : null}
            </div>
          ) : (
            <>
              <div className={styles.primaryLinks}>
                <div
                  className={styles.row}
                  data-active={!scope.estateId && !scope.buildingId}
                >
                  <AppIcon name="house" />
                  <Button
                    type="text"
                    className={`${styles.labelButton} asset-row-label`}
                    disabled={disabled}
                    aria-current={
                      !scope.estateId && !scope.buildingId ? 'page' : undefined
                    }
                    onClick={() => onScopeChange({})}
                  >
                    全部房源
                  </Button>
                </div>
              </div>
              <TreeSectionHeader
                title="住宅小区"
                createAction={{
                  disabled,
                  label: '新建项目',
                  onClick: () => onOpenManagement({ estateCreate: true }),
                }}
                collapseAllAction={
                  expandedEstateIds.length
                    ? { onClick: () => setExpandedEstateIds([]) }
                    : undefined
                }
              />
              {estates.isPending ? (
                <Skeleton
                  active
                  className={styles.loadingSkeleton}
                  paragraph={{ rows: 6 }}
                />
              ) : null}
              {estateItems.map((estate) => (
                <EstateNode
                  key={estate.id}
                  disabled={disabled}
                  enabled={enabled}
                  estate={estate}
                  expanded={expandedEstateIds.includes(estate.id)}
                  orgSlug={orgSlug}
                  scope={scope}
                  onExpandedChange={(expanded) =>
                    setExpandedEstateIds(expanded ? [estate.id] : [])
                  }
                  onOpenManagement={onOpenManagement}
                  onRememberScope={rememberScope}
                  onScopeChange={onScopeChange}
                />
              ))}
              {estates.isSuccess && estateItems.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无项目"
                />
              ) : null}
              {estates.hasNextPage ? (
                <Button
                  type="link"
                  block
                  loading={estates.isFetchingNextPage}
                  onClick={() => estates.fetchNextPage()}
                >
                  加载更多项目
                </Button>
              ) : null}
              <div className={styles.divider} />
              <TreeSectionHeader
                title="独立楼栋"
                createAction={{
                  disabled,
                  label: '新建独立楼栋',
                  onClick: () =>
                    onOpenManagement({ buildingCreateStandalone: true }),
                }}
              />
              <div className={styles.row}>
                <Button
                  type="text"
                  size="small"
                  disabled={disabled}
                  aria-label={`${standaloneExpanded ? '收起' : '展开'}独立楼栋`}
                  icon={
                    standaloneExpanded ? <DownOutlined /> : <RightOutlined />
                  }
                  onClick={() => setStandaloneExpanded((current) => !current)}
                />
                <AppIcon name="building" />
                <Button
                  type="text"
                  className={styles.labelButton}
                  disabled={disabled}
                  onClick={() => setStandaloneExpanded((current) => !current)}
                >
                  全部独立楼栋
                </Button>
                {standaloneBuildings.data ? (
                  <span className={styles.count}>
                    {standaloneBuildings.data.length}栋
                  </span>
                ) : null}
              </div>
              {standaloneExpanded ? (
                <div
                  className={styles.childList}
                  data-show-line={Boolean(standaloneBuildings.data?.length)}
                >
                  {standaloneBuildings.isPending ? (
                    <Skeleton
                      active
                      className={styles.loadingSkeleton}
                      paragraph={{ rows: 2 }}
                    />
                  ) : null}
                  {standaloneBuildings.data?.map((building) => (
                    <div
                      className={`${styles.row} ${styles.nestedRow}`}
                      data-active={scope.buildingId === building.id}
                      key={`standalone-${building.id}`}
                    >
                      <AppIcon name="building" />
                      <Button
                        type="text"
                        className={`${styles.labelButton} asset-row-label`}
                        disabled={disabled}
                        aria-label={`选择楼栋 独立楼栋 / ${building.name}`}
                        aria-current={
                          scope.buildingId === building.id ? 'page' : undefined
                        }
                        onClick={() => {
                          const nextScope = { buildingId: building.id };
                          onScopeChange(nextScope);
                          rememberScope({
                            key: `building:${building.id}`,
                            label: `独立楼栋 / ${building.name}`,
                            scope: nextScope,
                            count: buildingCountText(building),
                          });
                        }}
                      >
                        {building.name}
                      </Button>
                      <span className={styles.rowTrailing}>
                        <span className={`${styles.count} asset-row-count`}>
                          {buildingCountText(building)}
                        </span>
                        <span
                          className={`${styles.rowActions} asset-row-actions`}
                        >
                          <Tooltip title="新建房源">
                            <Button
                              type="text"
                              size="small"
                              disabled={disabled}
                              aria-label={`在独立楼栋 / ${building.name}下新建房源`}
                              icon={<PlusOutlined />}
                              onClick={() =>
                                history.push(
                                  `/rental/properties/new?building_id=${building.id}`,
                                )
                              }
                            />
                          </Tooltip>
                          <Tooltip title="编辑楼栋">
                            <Button
                              type="text"
                              size="small"
                              disabled={disabled}
                              aria-label={`编辑独立楼栋 / ${building.name}`}
                              icon={<EditOutlined />}
                              onClick={() =>
                                onOpenManagement({
                                  buildingEditId: building.id,
                                })
                              }
                            />
                          </Tooltip>
                        </span>
                      </span>
                    </div>
                  ))}
                  {standaloneBuildings.isSuccess &&
                  standaloneBuildings.data.length === 0 ? (
                    <Typography.Text type="secondary">
                      暂无独立楼栋
                    </Typography.Text>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className={styles.footer}>
          <Button
            type="text"
            className={styles.footerButton}
            aria-label="管理项目与楼栋"
            icon={<SettingOutlined />}
            onClick={() => onOpenManagement()}
          >
            管理结构
          </Button>
          <Button
            type="text"
            className={styles.footerButton}
            aria-label="地图查看"
            icon={<AppIcon name="location" />}
            onClick={() =>
              history.push(
                buildScopedPath(
                  '/rental/properties/map',
                  scope,
                  'selected_building_id',
                ),
              )
            }
          >
            地图查看
          </Button>
          <Button
            type="text"
            className={styles.footerButton}
            aria-label="房态同步"
            icon={<SyncOutlined />}
            onClick={() =>
              history.push(
                buildScopedPath(
                  '/rental/properties/vacancy-sync',
                  scope,
                  'building_id',
                ),
              )
            }
          >
            房态同步
          </Button>
        </div>
      </aside>
    </div>
  );
}
