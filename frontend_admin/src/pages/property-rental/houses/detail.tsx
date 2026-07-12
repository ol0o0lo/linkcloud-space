import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  message,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { ContactPreview, LeasePreview, ViewingPreview } from '@/components/EntityPreview';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/tenant/shared';
import {
  enumMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import {
  type HouseOut,
  houseApi,
  type LeaseOut,
  type ViewingRecordOut,
} from '@/services/manual/house';
import MediaRefsUpload from '../components/MediaRefsUpload';
import {
  buildingLabel,
  canHousePublish,
  contactLabel,
  dateTimeText,
  HOUSE_MEDIA_RESOURCE_TYPE,
  HOUSE_MEDIA_TYPE,
  HOUSE_PUBLISH_STATUS_COLOR,
  type MediaRefValue,
  moneyText,
  STATUS_COLOR,
} from '../constants';

type DetailFocusState = {
  action?: string;
  task?: string;
};

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
  return dashboardHref(`/property-rental/leases?${params.toString()}`);
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
    `/property-rental/viewings?pending_lease=true&contact_missing=true&edit=${viewingId}`,
  );
}

function layoutText(house: HouseOut) {
  const values = [
    { value: house.bedrooms, label: '室' },
    { value: house.living_rooms, label: '厅' },
    { value: house.bathrooms, label: '卫' },
    { value: house.kitchens, label: '厨' },
    { value: house.balconies, label: '阳台' },
  ];
  return values.some((item) => item.value != null)
    ? values.map((item) => `${item.value ?? 0}${item.label}`).join(' / ')
    : '-';
}

const HouseDetailPage: React.FC = () => {
  const params = useParams();
  const houseId = Number(params.id);
  const queryClient = useQueryClient();
  const mediaSectionRef = useRef<HTMLDivElement | null>(null);
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [publishConfirmStatus, setPublishConfirmStatus] = useState<
    'published' | 'unpublished' | null
  >(null);
  const [editOpen, setEditOpen] = useState(false);
  const [detailFocus, setDetailFocus] = useState<DetailFocusState>(() =>
    typeof window === 'undefined'
      ? {}
      : getDetailFocusFromSearch(window.location.search),
  );
  const workspace = useTenantWorkspace();
  const focusAction = detailFocus.action;
  const enabled = Boolean(workspace.selectedOrgSlug && houseId);
  const houseEnums = useEnums([
    'house.house_orientation',
    'house.house_decoration',
  ]);
  const queryKey = ['house', 'detail', workspace.selectedOrgSlug, houseId];
  const updateDetailFocus = (nextFocus: DetailFocusState) => {
    syncDetailFocusSearch(nextFocus);
    setDetailFocus(nextFocus);
  };
  const clearDetailFocus = () => updateDetailFocus({});
  const house = useQuery({
    queryKey,
    queryFn: () => houseApi.getHouse(houseId),
    enabled,
  });
  const buildings = useQuery({
    queryKey: ['house', 'detail', 'buildings', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listBuildings({ page: 1, page_size: 100 }),
    enabled,
  });
  const landlords = useQuery({
    queryKey: ['house', 'detail', 'landlords', workspace.selectedOrgSlug],
    queryFn: () =>
      houseApi.listContacts({ page: 1, page_size: 100, role: 'landlord' }),
    enabled,
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
      houseApi.listViewingRecords({ page: 1, page_size: 5, house_id: houseId }),
    enabled,
  });
  const leases = useQuery({
    queryKey: ['house', 'detail', 'leases', workspace.selectedOrgSlug, houseId],
    queryFn: () =>
      houseApi.listLeases({ page: 1, page_size: 5, house_id: houseId }),
    enabled,
  });
  const patchHouse = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      houseApi.patchHouse(houseId, values),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
      setEditOpen(false);
      clearDetailFocus();
      message.success('房源已更新');
    },
  });
  const canPublish = Boolean(house.data && canHousePublish(house.data));
  const isPublished = house.data?.publish_status === 'published';
  const orientationOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_orientation',
  );
  const decorationOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_decoration',
  );
  const publishButtonLabel = isPublished
    ? '下架房源'
    : canPublish
      ? '发布房源'
      : '待补齐后发布';
  const editSectionStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    background: token.colorBgContainer,
  } as const;
  const openEdit = () => {
    setEditOpen(true);
  };
  const openPublishConfirm = (publishStatus: 'published' | 'unpublished') => {
    setPublishConfirmStatus(publishStatus);
  };
  const scrollToMedia = () => {
    mediaSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  useEffect(() => {
    if (!house.data) return;
    if (focusAction === 'edit') {
      setEditOpen(true);
      return;
    }
    if (focusAction !== 'media') return;
    const timer = window.setTimeout(() => {
      scrollToMedia();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [focusAction, house.data]);

  useEffect(() => {
    const handlePopState = () => {
      setDetailFocus(getDetailFocusFromSearch(window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <TenantSelectionGuard title="房源详情">
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Row gutter={[16, 16]} align="top">
          <Col xs={24}>
            <Card
              title="房源资料"
              loading={house.isLoading}
              extra={
                <Space>
                  <Button onClick={openEdit} disabled={!house.data}>
                    编辑资料
                  </Button>
                  {isPublished ? (
                    <Button
                      danger
                      loading={patchHouse.isPending}
                      onClick={() => openPublishConfirm('unpublished')}
                    >
                      下架房源
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      disabled={!canPublish}
                      loading={patchHouse.isPending}
                      onClick={() => openPublishConfirm('published')}
                    >
                      {publishButtonLabel}
                    </Button>
                  )}
                </Space>
              }
            >
              {house.data ? (
                <Descriptions column={2}>
                  <Descriptions.Item label="项目">
                    {house.data.building?.estate?.display_name || house.data.building?.estate?.name || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="楼栋">
                    {house.data.building?.name || house.data.building_id}
                  </Descriptions.Item>
                  <Descriptions.Item label="房号">
                    {house.data.room_number}
                  </Descriptions.Item>
                  <Descriptions.Item label="房态">
                    <Tag color={STATUS_COLOR[house.data.status] || 'default'}>
                      {enumMapping(
                        house.data.status,
                        house.data.status__mapping,
                      )}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="发布">
                    <Tag
                      color={
                        HOUSE_PUBLISH_STATUS_COLOR[house.data.publish_status] ||
                        'default'
                      }
                    >
                      {enumMapping(
                        house.data.publish_status,
                        house.data.publish_status__mapping,
                      )}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="挂牌租金">
                    {house.data.asking_rent || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="押金">
                    {house.data.deposit_amount || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="户型">
                    {layoutText(house.data)}
                  </Descriptions.Item>
                  <Descriptions.Item label="建筑面积">
                    {house.data.area || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="套内面积">
                    {house.data.interior_area || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="房东">
                    {house.data.landlord_id ? contactLabel(house.data) : '待补'}
                  </Descriptions.Item>
                </Descriptions>
              ) : null}
            </Card>
          </Col>
          <Col xs={24}>
            <div ref={mediaSectionRef}>
              <Card title="媒体相册">
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  <MediaRefsUpload
                    title="图片资料"
                    value={house.data?.images as MediaRefValue[] | undefined}
                    resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_IMAGE}
                    mediaType={HOUSE_MEDIA_TYPE.IMAGE}
                    onChange={(images) => patchHouse.mutate({ images })}
                  />
                  <MediaRefsUpload
                    title="视频资料"
                    value={house.data?.videos as MediaRefValue[] | undefined}
                    resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_VIDEO}
                    mediaType={HOUSE_MEDIA_TYPE.VIDEO}
                    onChange={(videos) => patchHouse.mutate({ videos })}
                  />
                </Space>
              </Card>
            </div>
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="top">
          <Col xs={24} xl={12}>
            <Card title="带看记录">
              <Table<ViewingRecordOut>
                rowKey="id"
                loading={viewings.isLoading}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: '客户', dataIndex: 'customer_name', render: (value, record) => <ViewingPreview id={record.id}>{value}</ViewingPreview> },
                  { title: '手机', dataIndex: 'customer_phone' },
                  {
                    title: '预约时间',
                    dataIndex: 'scheduled_at',
                    render: dateTimeText,
                  },
                  {
                    title: '状态',
                    dataIndex: 'status__mapping',
                    render: (_value, record) => (
                      <Tag color={STATUS_COLOR[record.status] || 'default'}>
                        {enumMapping(record.status, record.status__mapping)}
                      </Tag>
                    ),
                  },
                  {
                    title: '操作',
                    dataIndex: 'actions',
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
                          <a href={viewingContactFixHref(record.id)}>补租客</a>
                        );
                      }
                      if (record.status === 'converted') {
                        return (
                          <a
                            href={dashboardHref(
                              `/property-rental/leases?source_viewing_record_id=${record.id}`,
                            )}
                          >
                            去签约
                          </a>
                        );
                      }
                      return (
                        <a
                          href={dashboardHref(
                            `/property-rental/viewings?house_id=${houseId}`,
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
                        href={`/dashboard/property-rental/viewings?house_id=${houseId}`}
                        type="primary"
                      >
                        登记首条带看
                      </Button>
                    </Empty>
                  ),
                }}
                pagination={false}
              />
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card title="租约记录">
              <Table<LeaseOut>
                rowKey="id"
                loading={leases.isLoading}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: '租客',
                    dataIndex: 'tenant_id',
                    render: (_value, record) => <ContactPreview id={record.tenant_id}>{contactLabel(record)}</ContactPreview>,
                  },
                  { title: '起租', dataIndex: 'start_date' },
                  { title: '到期', dataIndex: 'end_date' },
                  {
                    title: '月租',
                    dataIndex: 'monthly_rent',
                    render: moneyText,
                  },
                  {
                    title: '状态',
                    dataIndex: 'status__mapping',
                    render: (_value, record) => (
                      <Tag color={STATUS_COLOR[record.status] || 'default'}>
                        {enumMapping(record.status, record.status__mapping)}
                      </Tag>
                    ),
                  },
                  {
                    title: '合同',
                    dataIndex: 'contract_files',
                    render: (value, record) => (
                      <Space size={8}>
                        <LeasePreview id={record.id}><span>{`${value?.length || 0} 份`}</span></LeasePreview>
                        {!value?.length ? (
                          <Tag color="orange">待补合同</Tag>
                        ) : null}
                      </Space>
                    ),
                  },
                  {
                    title: '操作',
                    dataIndex: 'actions',
                    render: (_value, record) => (
                      <a
                        href={
                          record.contract_files?.length
                            ? leaseEditHref(houseId, record.id)
                            : leaseEditHref(houseId, record.id, {
                                task: 'contract',
                              })
                        }
                      >
                        {record.contract_files?.length ? '编辑租约' : '补合同'}
                      </a>
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
                        href={`/dashboard/property-rental/leases?house_id=${houseId}`}
                        type="primary"
                      >
                        创建首份租约
                      </Button>
                    </Empty>
                  ),
                }}
                pagination={false}
              />
            </Card>
          </Col>
        </Row>
      </Space>
      <Modal
        open={publishConfirmStatus !== null}
        title={
          publishConfirmStatus === 'published' ? '确认发布房源' : '确认下架房源'
        }
        okText={publishConfirmStatus === 'published' ? '确认发布' : '确认下架'}
        cancelText="先取消"
        transitionName=""
        maskTransitionName=""
        onCancel={() => setPublishConfirmStatus(null)}
        onOk={async () => {
          const nextStatus = publishConfirmStatus;
          if (!nextStatus) return;
          setPublishConfirmStatus(null);
          await patchHouse.mutateAsync({ publish_status: nextStatus });
        }}
      >
        <Typography.Text>
          {publishConfirmStatus === 'published'
            ? '确认后会把这套房源切换为已发布状态，继续承接带看。'
            : '确认后会把这套房源切换为已下架状态，前台将不再作为可发布房源展示。'}
        </Typography.Text>
      </Modal>
      <Drawer
        title="编辑房源资料"
        open={editOpen}
        size="large"
        onClose={() => {
          setEditOpen(false);
          if (focusAction === 'edit') {
            clearDetailFocus();
          }
        }}
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
          form={form}
          id="house-edit-form"
          layout="vertical"
          initialValues={house.data}
          preserve={false}
          onFinish={(values) => patchHouse.mutate(values)}
        >
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={[16, 16]} align="top">
              <Col xs={24}>
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  <div style={editSectionStyle}>
                    <Space
                      orientation="vertical"
                      size={12}
                      style={{ width: '100%' }}
                    >
                      <div>
                        <Typography.Text strong>归属与发布基础</Typography.Text>
                      </div>
                      <Row gutter={[16, 0]}>
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
                              options={(landlords.data?.items || []).map(
                                (item) => ({
                                  value: item.id,
                                  label: contactLabel(item),
                                }),
                              )}
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
                      </Row>
                    </Space>
                  </div>

                  <div style={editSectionStyle}>
                    <Space
                      orientation="vertical"
                      size={12}
                      style={{ width: '100%' }}
                    >
                      <div>
                        <Typography.Text strong>户型与面积</Typography.Text>
                      </div>
                      <Row gutter={[16, 0]}>
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
                    </Space>
                  </div>

                  <div style={editSectionStyle}>
                    <Space
                      orientation="vertical"
                      size={12}
                      style={{ width: '100%' }}
                    >
                      <div>
                        <Typography.Text strong>展示与内部说明</Typography.Text>
                      </div>
                      <Form.Item label="对外描述" name="public_description">
                        <Input.TextArea rows={4} />
                      </Form.Item>
                      <Form.Item
                        label="内部备注"
                        name="internal_notes"
                        style={{ marginBottom: 0 }}
                      >
                        <Input.TextArea rows={4} />
                      </Form.Item>
                    </Space>
                  </div>
                </Space>
              </Col>
            </Row>
          </Space>
        </Form>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default HouseDetailPage;
