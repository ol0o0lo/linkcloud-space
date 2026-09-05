import {
  ClockCircleOutlined,
  DownOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  AutoComplete,
  Button,
  Empty,
  Input,
  Popover,
  Segmented,
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
  type HouseListParams,
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

type PropertyHouseScope = NonNullable<HouseListParams['scope']>;

export type PropertyAssetAction =
  | { type: 'create-estate' }
  | { type: 'create-building'; estateId?: number }
  | { type: 'edit-estate'; estateId: number }
  | { type: 'edit-building'; buildingId: number };

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
  houseScope: PropertyHouseScope;
  orgSlug?: string;
  scope: PropertyAssetScope;
  onAction: (action: PropertyAssetAction) => void;
  onHouseScopeChange: (scope: PropertyHouseScope) => void;
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
  scopeTitle: css`
    display: inline-flex;
    align-items: flex-start;
    white-space: nowrap;
  `,
  scopeControls: css`
    display: flex;
    align-items: center;
    margin-inline-start: auto;
  `,
  scopeHelpButton: css`
    position: relative;
    top: -5px;
    width: 18px;
    min-width: 18px;
    height: 18px;
    padding: 0;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;

    &:hover,
    &:active {
      border-color: transparent !important;
      background: transparent !important;
      color: ${token.colorTextSecondary} !important;
      box-shadow: none !important;
    }
  `,
  scopeHelpContent: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

async function fetchAllEstateBuildings(
  estateId: number,
  houseScope: PropertyHouseScope,
) {
  const items: BuildingOut[] = [];
  let page = 1;

  while (true) {
    const result = await houseApi.listBuildings({
      estate_id: estateId,
      scope: houseScope,
      page,
      page_size: BUILDING_PAGE_SIZE,
    });
    items.push(...result.items);
    if (!result.items.length || items.length >= result.total) break;
    page += 1;
  }

  return items;
}

async function fetchAllBuildings(houseScope: PropertyHouseScope) {
  const items: BuildingOut[] = [];
  let page = 1;

  while (true) {
    const result = await houseApi.listBuildings({
      page,
      page_size: BUILDING_PAGE_SIZE,
      scope: houseScope,
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
  houseScope,
  orgSlug,
  scope,
  onExpandedChange,
  onAction,
  onRememberScope,
  onScopeChange,
}: {
  disabled: boolean;
  enabled: boolean;
  estate: EstateOut;
  expanded: boolean;
  houseScope: PropertyHouseScope;
  orgSlug?: string;
  scope: PropertyAssetScope;
  onExpandedChange: (expanded: boolean) => void;
  onAction: (action: PropertyAssetAction) => void;
  onRememberScope: (scope: RecentPropertyScope) => void;
  onScopeChange: (scope: PropertyAssetScope) => void;
}) {
  const { styles } = useStyles();
  const name = estateName(estate);
  const buildings = useQuery({
    queryKey: [
      'house',
      'asset-navigator',
      'buildings',
      orgSlug,
      houseScope,
      estate.id,
    ],
    queryFn: () => fetchAllEstateBuildings(estate.id, houseScope),
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
                  onAction({ type: 'create-building', estateId: estate.id })
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
                onClick={() =>
                  onAction({ type: 'edit-estate', estateId: estate.id })
                }
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
                          onAction({
                            type: 'edit-building',
                            buildingId: building.id,
                          })
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
  houseScope,
  orgSlug,
  scope,
  onAction,
  onHouseScopeChange,
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
    queryKey: ['house', 'asset-navigator', 'estates', orgSlug, houseScope],
    queryFn: ({ pageParam }) =>
      houseApi.listEstates({
        page: pageParam,
        page_size: ESTATE_PAGE_SIZE,
        scope: houseScope,
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
      houseScope,
      searchKeyword,
    ],
    queryFn: () =>
      houseApi.listEstates({
        keyword: searchKeyword,
        page: 1,
        page_size: SEARCH_PAGE_SIZE,
        scope: houseScope,
      }),
    enabled: enabled && Boolean(searchKeyword),
  });
  const searchedBuildings = useQuery({
    queryKey: [
      'house',
      'asset-navigator',
      'search-buildings',
      orgSlug,
      houseScope,
      searchKeyword,
    ],
    queryFn: () =>
      houseApi.listBuildings({
        keyword: searchKeyword,
        page: 1,
        page_size: SEARCH_PAGE_SIZE,
        scope: houseScope,
      }),
    enabled: enabled && Boolean(searchKeyword),
  });
  const standaloneBuildings = useQuery({
    queryKey: [
      'house',
      'asset-navigator',
      'standalone-buildings',
      orgSlug,
      houseScope,
    ],
    queryFn: async () =>
      (await fetchAllBuildings(houseScope)).filter(
        (building) => !building.estate_id,
      ),
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
    setExpandedEstateIds((current) =>
      current.includes(estateId) ? current : [...current, estateId],
    );
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
            <span className={styles.scopeTitle}>
              <Typography.Text strong>房源范围</Typography.Text>
              <Popover
                trigger="click"
                placement="bottomLeft"
                title="房源范围说明"
                content={
                  <div className={styles.scopeHelpContent}>
                    <Typography.Text>
                      <Typography.Text strong>全部：</Typography.Text>
                      查看空间内全部房源
                    </Typography.Text>
                    <Typography.Text>
                      <Typography.Text strong>我的：</Typography.Text>
                      仅查看当前账号负责的房源
                    </Typography.Text>
                  </div>
                }
              >
                <Button
                  type="text"
                  size="small"
                  className={styles.scopeHelpButton}
                  aria-label="查看房源范围说明"
                  icon={<QuestionCircleOutlined />}
                />
              </Popover>
            </span>
            <div className={styles.scopeControls}>
              <Segmented<PropertyHouseScope>
                aria-label="房源范围选择"
                disabled={disabled}
                name="house-scope"
                options={[
                  { label: '全部', value: 'all' },
                  { label: '我的', value: 'mine' },
                ]}
                value={houseScope}
                onChange={onHouseScopeChange}
              />
            </div>
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
                setExpandedEstateIds((current) =>
                  current.includes(recentScope.scope.estateId as number)
                    ? current
                    : [...current, recentScope.scope.estateId as number],
                );
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
                        setExpandedEstateIds((current) =>
                          current.includes(estate.id)
                            ? current
                            : [...current, estate.id],
                        );
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
                          setExpandedEstateIds((current) =>
                            current.includes(building.estate_id as number)
                              ? current
                              : [...current, building.estate_id as number],
                          );
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
                  onClick: () => onAction({ type: 'create-estate' }),
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
                  houseScope={houseScope}
                  orgSlug={orgSlug}
                  scope={scope}
                  onExpandedChange={(expanded) =>
                    setExpandedEstateIds((current) =>
                      expanded
                        ? current.includes(estate.id)
                          ? current
                          : [...current, estate.id]
                        : current.filter((id) => id !== estate.id),
                    )
                  }
                  onAction={onAction}
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
                  onClick: () => onAction({ type: 'create-building' }),
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
                                onAction({
                                  type: 'edit-building',
                                  buildingId: building.id,
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
