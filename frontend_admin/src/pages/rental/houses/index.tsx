import { HomeOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Icon } from '@iconify/react';
import elevatorIcon from '@iconify-icons/tabler/elevator';
import stairsIcon from '@iconify-icons/tabler/stairs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Input,
  Modal,
  message,
  Popover,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  BuildingPreview,
  ContactPreview,
  EstatePreview,
  HousePreview,
} from '@/components/EntityPreview';
import {
  adminTableScroll,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
import { useUserTableColumnsState } from '@/hooks/useUserTableColumnsState';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/space/shared';
import { enumMapping, enumSelectOptions, useEnums } from '@/services/manual/enums';
import { type HouseOut, houseApi } from '@/services/manual/house';
import {
  evaluateHousePublishState,
  HOUSE_STATUS,
  houseDisplayTags,
  houseMediaReadinessText,
  housePrimaryLayoutText,
  mediaCoverUrl,
  moneyText,
  STATUS_COLOR,
} from '../constants';
import { isInitialQueryPending } from '../loading';
import { useHousePublishRules } from '../useHousePublishRules';

const PAGE_SIZE = 20;
const HOUSE_TABLE_COLUMNS_PREFERENCE_KEY =
  'ui.table.property-rental.houses.columns.v1';
const HOUSE_TABLE_COLUMN_KEYS = [
  'house',
  'layout',
  'building',
  'asking_rent',
  'deposit_amount',
  'landlord',
  'has_elevator_access',
  'media',
  'effective_tags',
  'internal_notes',
  'status__mapping',
  'actions',
] as const;
const BUILDING_ACCESS_ICON_STYLE: React.CSSProperties = {
  display: 'inline-block',
  marginInlineEnd: 4,
  verticalAlign: '-0.125em',
};
type HouseScopeFilters = {
  q?: string;
  status?: string;
  buildingId?: number;
};

function getPositiveId(value: string | null) {
  return value && /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

function getHouseListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page') || '1');
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    q: params.get('keyword') || undefined,
    status: params.get('status') || undefined,
    buildingId: getPositiveId(params.get('building_id')),
  };
}

function syncHouseListSearch(filters: HouseScopeFilters & { page: number }) {
  const params = new URLSearchParams(window.location.search);
  params.delete('keyword');
  params.delete('status');
  params.delete('building_id');
  params.delete('page');
  if (filters.q) params.set('keyword', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.buildingId) params.set('building_id', String(filters.buildingId));
  if (filters.page > 1) params.set('page', String(filters.page));
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function buildHouseDetailHref(
  houseId: number,
  action?: 'edit',
) {
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

function houseLayoutText(house: HouseOut) {
  const primaryLayout = housePrimaryLayoutText(house);
  if (primaryLayout === '-' || house.bathrooms == null) return primaryLayout;
  return `${primaryLayout} · ${house.bathrooms}卫`;
}

function houseLayoutFacts(house: HouseOut) {
  return [
    house.area ? `${house.area}㎡` : null,
    house.floor != null ? `${house.floor}层` : null,
    house.orientation
      ? enumMapping(house.orientation, house.orientation__mapping)
      : null,
    house.decoration
      ? enumMapping(house.decoration, house.decoration__mapping)
      : null,
  ].filter((value): value is string => Boolean(value));
}

const HousesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const publishRules = useHousePublishRules();
  const queryClient = useQueryClient();
  const tableColumnsState = useUserTableColumnsState({
    preferenceKey: HOUSE_TABLE_COLUMNS_PREFERENCE_KEY,
    columnKeys: HOUSE_TABLE_COLUMN_KEYS,
  });
  const initialListState = useRef(
    getHouseListStateFromSearch(window.location.search),
  );
  const [q, setQ] = useState<string | undefined>(initialListState.current.q);
  const [searchDraft, setSearchDraft] = useState(initialListState.current.q || '');
  const [status, setStatus] = useState<string | undefined>(initialListState.current.status);
  const [buildingId, setBuildingId] = useState<number | undefined>(initialListState.current.buildingId);
  const [page, setPage] = useState(initialListState.current.page);
  const [listingConfirmHouseId, setListingConfirmHouseId] = useState<
    number | null
  >(null);
  const [listingConfirmStatus, setListingConfirmStatus] = useState<
    'listed' | 'vacant' | null
  >(null);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseEnums = useEnums(['house.house_status']);
  const houses = useQuery({
    queryKey: [
      'house',
      'houses',
      workspace.selectedOrgSlug,
      page,
      q,
      status,
      buildingId,
    ],
    queryFn: () =>
      houseApi.listHouses({
        page,
        page_size: PAGE_SIZE,
        keyword: q,
        status,
        ...(buildingId ? { building_id: buildingId } : {}),
      }),
    enabled,
  });
  const selectedBuilding = useQuery({
    queryKey: ['house', 'building', workspace.selectedOrgSlug, buildingId],
    queryFn: () => {
      if (!buildingId) throw new Error('缺少楼栋 ID');
      return houseApi.getBuilding(buildingId);
    },
    enabled: enabled && Boolean(buildingId),
  });
  const patchHouse = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: number;
      values: Record<string, unknown>;
    }) => houseApi.patchHouse(id, values),
    onSuccess: async () => {
      message.success('房源状态已更新');
      await queryClient.invalidateQueries({ queryKey: ['house', 'houses'] });
    },
  });
  const openListingConfirm = (
    id: number,
    nextStatus: 'listed' | 'vacant',
  ) => {
    setListingConfirmHouseId(id);
    setListingConfirmStatus(nextStatus);
  };
  const rows = houses.data?.items || [];
  const listLoading = isInitialQueryPending(houses);
  const houseStatusOptions = enumSelectOptions(houseEnums.data, 'house.house_status');
  useEffect(() => {
    syncHouseListSearch({
      page,
      q,
      status,
      buildingId,
    });
  }, [buildingId, page, q, status]);

  useEffect(() => {
    const handlePopState = () => {
      const listState = getHouseListStateFromSearch(window.location.search);
      setQ(listState.q);
      setSearchDraft(listState.q || '');
      setStatus(listState.status);
      setPage(listState.page);
      setBuildingId(listState.buildingId);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const columns: ProColumns<HouseOut>[] = [
    {
      title: '房源',
      dataIndex: 'house',
      search: false,
      width: 120,
      render: (_value, record) => {
        const coverUrl = mediaCoverUrl(record.images);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Avatar
              alt="房源图"
              icon={<HomeOutlined data-testid="house-image-placeholder" />}
              shape="square"
              size={40}
              src={coverUrl}
              style={{ borderRadius: 6, flex: '0 0 auto' }}
            />
            <HousePreview id={record.id}>{record.room_number}</HousePreview>
          </div>
        );
      },
    },
    {
      title: '户型',
      dataIndex: 'layout',
      search: false,
      width: 150,
      render: (_value, record) => {
        const facts = houseLayoutFacts(record);
        const factsText = facts.join(' · ');
        return (
          <div
            style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
          >
            <Typography.Text>{houseLayoutText(record)}</Typography.Text>
            {factsText ? (
              <Typography.Text ellipsis title={factsText} type="secondary">
                {factsText}
              </Typography.Text>
            ) : null}
          </div>
        );
      },
    },
    {
      title: '所属楼栋',
      dataIndex: 'building',
      search: false,
      width: 150,
      render: (_value, record) => {
        const estate = record.building?.estate;
        const estateName = estate?.display_name || estate?.name || '未关联项目';
        const buildingName = record.building?.name || `楼栋 #${record.building_id}`;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <EstatePreview id={estate?.id}>
              <Typography.Text ellipsis>{estateName}</Typography.Text>
            </EstatePreview>
            <BuildingPreview id={record.building_id}>
              <Typography.Text ellipsis type="secondary">{buildingName}</Typography.Text>
            </BuildingPreview>
          </div>
        );
      },
    },
    {
      title: '挂牌租金',
      dataIndex: 'asking_rent',
      search: false,
      width: 100,
      render: (_value, record) => moneyText(record.asking_rent),
    },
    {
      title: '押金',
      dataIndex: 'deposit_amount',
      width: 100,
      search: false,
      render: (_value, record) => moneyText(record.deposit_amount),
    },
    {
      title: '房东',
      dataIndex: 'landlord',
      search: false,
      width: 150,
      render: (_value, record) => (
        <ContactPreview id={record.landlord_id}>
          {record.landlord?.name || '待补房东'}
        </ContactPreview>
      ),
    },
    {
      title: '电梯',
      dataIndex: 'has_elevator_access',
      search: false,
      width: 90,
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
      title: '媒体',
      dataIndex: 'media',
      search: false,
      width: 110,
      render: (_value, record) => houseMediaReadinessText(record),
    },
    {
      title: '标签',
      dataIndex: 'effective_tags',
      search: false,
      width: 180,
      render: (_value, record) => {
        const tags = houseDisplayTags(record);
        return <HouseTags tags={tags} />;
      },
    },
    {
      title: '内部备注',
      dataIndex: 'internal_notes',
      search: false,
      width: 180,
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
      dataIndex: 'status__mapping',
      fixed: 'right',
      width: 80,
      search: false,
      render: (_value, record) => (
        <Tag color={STATUS_COLOR[record.status] || 'default'}>
          {enumMapping(record.status, record.status__mapping)}
        </Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      search: false,
      width: 112,
      render: (_value, record) => {
        const isListed = record.status === HOUSE_STATUS.LISTED;
        const canToggleListing = isListed || record.status === HOUSE_STATUS.VACANT;
        const nextStatus = isListed ? HOUSE_STATUS.VACANT : HOUSE_STATUS.LISTED;
        return (
          <ResponsiveActions>
            <a href={buildHouseDetailHref(record.id, 'edit')}>编辑资料</a>
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
                  if (
                    nextStatus === HOUSE_STATUS.LISTED
                  ) {
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
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </ResponsiveActions>
        );
      },
    },
  ];

  return (
    <TenantSelectionGuard title="房源">
      {buildingId ? (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Typography.Text>当前楼栋筛选：{selectedBuilding.data?.name || `楼栋 #${buildingId}`}</Typography.Text>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setBuildingId(undefined);
              setPage(1);
            }}
            aria-label="清除楼栋筛选"
          >
            清除
          </Button>
        </Card>
      ) : null}
      <Card>
        <ProTable<HouseOut>
          rowKey="id"
          loading={listLoading}
          headerTitle="房源列表"
          columns={columns}
          dataSource={rows}
          search={false}
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
              placeholder="搜索房号 / 项目 / 楼栋 / 房东"
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
              style={{ width: 280 }}
            />,
            <Select
              key="status"
              allowClear
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
              icon={<PlusOutlined />}
              onClick={() => history.push('/rental/properties/new')}
            >
              新建房源
            </Button>,
          ]}
          ghost
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: houses.data?.total || 0,
            onChange: setPage,
          }}
          scroll={adminTableScroll}
        />
      </Card>
      <Modal
        open={listingConfirmStatus !== null}
        aria-label={
          listingConfirmStatus === HOUSE_STATUS.LISTED ? '确认发布房源' : '确认下架房源'
        }
        title={
          listingConfirmStatus === HOUSE_STATUS.LISTED ? '确认发布房源' : '确认下架房源'
        }
        okText={listingConfirmStatus === HOUSE_STATUS.LISTED ? '确认发布' : '确认下架'}
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
            ? '确认后房源状态将切换为招租中，继续承接带看。'
            : '确认后房源状态将切换为空置，不再对外展示。'}
        </Typography.Text>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default HousesPage;
