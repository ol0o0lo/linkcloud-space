import { MoreOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Button,
  Card,
  Dropdown,
  Input,
  Modal,
  message,
  Select,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { ContactPreview, HousePreview } from '@/components/EntityPreview';
import {
  adminTableScroll,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/tenant/shared';
import { enumMapping, enumSelectOptions, useEnums } from '@/services/manual/enums';
import { type HouseOut, houseApi } from '@/services/manual/house';
import {
  canHousePublish,
  contactLabel,
  HOUSE_PUBLISH_STATUS_COLOR,
  houseLabel,
  houseMediaReadinessText,
  mediaCoverUrl,
  moneyText,
  STATUS_COLOR,
} from '../constants';
import { isInitialQueryPending } from '../loading';

const PAGE_SIZE = 20;
type HouseScopeFilters = {
  q?: string;
  status?: string;
};

function getHouseListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page') || '1');
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    q: params.get('keyword') || undefined,
    status: params.get('status') || undefined,
  };
}

function syncHouseListSearch(filters: HouseScopeFilters & { page: number }) {
  const params = new URLSearchParams();
  if (filters.q) params.set('keyword', filters.q);
  if (filters.status) params.set('status', filters.status);
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
  return `/dashboard/property-rental/houses/${houseId}${nextSearch ? `?${nextSearch}` : ''}`;
}

const HousesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialListState = useRef(
    getHouseListStateFromSearch(window.location.search),
  );
  const [q, setQ] = useState<string | undefined>(initialListState.current.q);
  const [searchDraft, setSearchDraft] = useState(initialListState.current.q || '');
  const [status, setStatus] = useState<string | undefined>(initialListState.current.status);
  const [page, setPage] = useState(initialListState.current.page);
  const [publishConfirmHouseId, setPublishConfirmHouseId] = useState<
    number | null
  >(null);
  const [publishConfirmStatus, setPublishConfirmStatus] = useState<
    'published' | 'unpublished' | null
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
    ],
    queryFn: () =>
      houseApi.listHouses({
        page,
        page_size: PAGE_SIZE,
        keyword: q,
        status,
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
    }) => houseApi.patchHouse(id, values),
    onSuccess: async () => {
      message.success('房源状态已更新');
      await queryClient.invalidateQueries({ queryKey: ['house', 'houses'] });
    },
  });
  const openPublishConfirm = (
    id: number,
    nextStatus: 'published' | 'unpublished',
  ) => {
    setPublishConfirmHouseId(id);
    setPublishConfirmStatus(nextStatus);
  };
  const rows = houses.data?.items || [];
  const listLoading = isInitialQueryPending(houses);
  const houseStatusOptions = enumSelectOptions(houseEnums.data, 'house.house_status');
  useEffect(() => {
    syncHouseListSearch({
      page,
      q,
      status,
    });
  }, [page, q, status]);

  useEffect(() => {
    const handlePopState = () => {
      const listState = getHouseListStateFromSearch(window.location.search);
      setQ(listState.q);
      setSearchDraft(listState.q || '');
      setStatus(listState.status);
      setPage(listState.page);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const columns: ProColumns<HouseOut>[] = [
    {
      title: '房源',
      dataIndex: 'house',
      search: false,
      width: 220,
      render: (_value, record) => {
        const coverUrl = mediaCoverUrl(record.images);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {coverUrl ? (
              <img
                alt="房源图"
                src={coverUrl}
                style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flex: '0 0 auto' }}
              />
            ) : null}
            <HousePreview id={record.id}><Typography.Text ellipsis>{houseLabel(record)}</Typography.Text></HousePreview>
          </div>
        );
      },
    },
    {
      title: '房东',
      dataIndex: 'landlord',
      search: false,
      width: 180,
      render: (_value, record) =>
        <ContactPreview id={record.landlord_id}>{record.landlord_id ? contactLabel(record) : '待补房东'}</ContactPreview>,
    },
    {
      title: '挂牌租金',
      dataIndex: 'asking_rent',
      search: false,
      width: 100,
      render: (_value, record) => moneyText(record.asking_rent),
    },
    {
      title: '媒体',
      dataIndex: 'media',
      search: false,
      width: 120,
      render: (_value, record) => houseMediaReadinessText(record),
    },
    {
      title: '房态',
      dataIndex: 'status__mapping',
      width: 80,
      search: false,
      render: (_value, record) => (
        <Tag color={STATUS_COLOR[record.status] || 'default'}>
          {enumMapping(record.status, record.status__mapping)}
        </Tag>
      ),
    },
    {
      title: '发布',
      dataIndex: 'publish_status__mapping',
      width: 80,
      search: false,
      render: (_value, record) => (
        <Tag
          color={HOUSE_PUBLISH_STATUS_COLOR[record.publish_status] || 'default'}
        >
          {enumMapping(record.publish_status, record.publish_status__mapping)}
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
        const nextPublishStatus =
          record.publish_status === 'published' ? 'unpublished' : 'published';
        return (
          <ResponsiveActions>
            <a href={buildHouseDetailHref(record.id, 'edit')}>编辑</a>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'detail', label: '详情' },
                  {
                    key: 'publish',
                    label:
                      record.publish_status === 'published' ? '下架' : '发布',
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'detail') {
                    history.push(buildHouseDetailHref(record.id).replace('/dashboard', ''));
                    return;
                  }
                  if (nextPublishStatus === 'published' && !canHousePublish(record)) {
                    message.warning('请先补齐房东和租金');
                    return;
                  }
                  openPublishConfirm(record.id, nextPublishStatus);
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
              onClick={() => history.push('/property-rental/houses/new')}
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
        open={publishConfirmStatus !== null}
        aria-label={
          publishConfirmStatus === 'published' ? '确认发布房源' : '确认下架房源'
        }
        title={
          publishConfirmStatus === 'published' ? '确认发布房源' : '确认下架房源'
        }
        okText={publishConfirmStatus === 'published' ? '确认发布' : '确认下架'}
        cancelText="先取消"
        transitionName=""
        maskTransitionName=""
        onCancel={() => {
          setPublishConfirmHouseId(null);
          setPublishConfirmStatus(null);
        }}
        onOk={async () => {
          const nextStatus = publishConfirmStatus;
          const nextId = publishConfirmHouseId;
          if (!nextStatus || !nextId) return;
          setPublishConfirmHouseId(null);
          setPublishConfirmStatus(null);
          await patchHouse.mutateAsync({
            id: nextId,
            values: { publish_status: nextStatus },
          });
        }}
      >
        <Typography.Text>
          {publishConfirmStatus === 'published'
            ? '确认后会把这套房源切换为已发布状态，继续承接带看。'
            : '确认后会把这套房源切换为已下架状态，前台将不再作为可发布房源展示。'}
        </Typography.Text>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default HousesPage;
