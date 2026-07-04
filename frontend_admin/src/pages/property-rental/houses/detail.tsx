import { EditOutlined, PictureOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  theme,
} from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/tenant/shared';
import {
  houseApi,
  type HouseOut,
  type LeaseOut,
  type ViewingRecordOut,
} from '@/services/manual/house';
import {
  enumMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import MediaRefsUpload from '../components/MediaRefsUpload';
import {
  buildingLabel,
  canHousePublish,
  contactLabel,
  dateTimeText,
  getHouseBlockingIssues,
  getTrackedHousePublishIssues,
  getHouseWarningIssues,
  houseLabel,
  houseMediaReadinessText,
  HOUSE_MEDIA_RESOURCE_TYPE,
  HOUSE_MEDIA_TYPE,
  HOUSE_PUBLISH_STATUS_COLOR,
  moneyText,
  type MediaRefValue,
  STATUS_COLOR,
} from '../constants';

type DetailFocusState = {
  action?: string;
  task?: string;
};

type HouseChecklistRow = {
  key: string;
  stage: string;
  status: string;
  detail: string;
  actionLabel: string;
  actionType?: 'primary' | 'default';
  actionPath?: string;
  actionClick?: () => void;
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

function getFocusedActionCopy(action?: string | null, task?: string | null) {
  if (action === 'edit' && task === 'landlord') {
    return {
      title: '当前操作：补齐房东资料',
      description:
        '当前入口来自待补房东队列，先补出租方主体，再继续处理租金、媒体和发布检查。',
    };
  }
  if (action === 'edit' && task === 'rent') {
    return {
      title: '当前操作：补齐租金信息',
      description:
        '当前入口来自待补租金队列，先补报价、押金和可租日期，再继续处理媒体和发布检查。',
    };
  }
  if (action === 'media' && task === 'cover') {
    return {
      title: '当前操作：补齐封面图',
      description:
        '当前入口来自媒体队列，优先补主封面，再继续完善户型图和基础图片。',
    };
  }
  if (action === 'media' && task === 'images') {
    return {
      title: '当前操作：补足基础图片',
      description:
        '当前入口来自媒体队列，优先补足客厅、卧室等基础图，提升线上展示和带看效率。',
    };
  }
  if (action === 'media' && task === 'floor_plan') {
    return {
      title: '当前操作：补齐户型图',
      description:
        '当前入口来自媒体队列，优先补结构图，再继续完善封面和基础图片。',
    };
  }
  if (action === 'media' && task === 'video') {
    return {
      title: '当前操作：补齐视频资料',
      description:
        '当前入口来自媒体队列，优先补视频，再继续完善封面、户型图和基础图片。',
    };
  }
  if (action === 'media') {
    return {
      title: '当前操作：维护媒体相册',
      description:
        '当前入口来自房源经营链路，统一维护封面、户型图、视频和基础图片；是否阻断发布以当前空间策略为准。',
    };
  }
  if (action === 'edit') {
    return {
      title: '当前操作：补齐发布资料',
      description:
        '当前入口来自发布工作区，先补房东、租金等基础字段，再继续处理媒体和发布检查。',
    };
  }
  return {};
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

function getPublishMissingItems(house?: HouseOut) {
  if (!house) return ['加载中'];
  return getTrackedHousePublishIssues(house);
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

function getWorkflowStage(
  house: HouseOut,
  options: {
    canPublish: boolean;
    latestViewing?: ViewingRecordOut;
    currentLease?: LeaseOut;
  },
) {
  const { canPublish, latestViewing, currentLease } = options;
  if (currentLease?.status === 'active') return '租约生效中';
  if (currentLease?.status === 'pending') return '待租约生效';
  if (latestViewing?.status === 'converted' && latestViewing.signed_lease_id)
    return '已成交已签约';
  if (needsViewingContactCompletion(latestViewing)) return '成交待补租客';
  if (latestViewing?.status === 'converted') return '成交待签约';
  if (house.publish_status === 'published') return '已发布待带看';
  if (canPublish) return '可发布待上线';
  return '待补资料后发布';
}

function getHouseWorkflowHint(options: {
  latestViewing?: ViewingRecordOut;
  currentLease?: LeaseOut;
}) {
  const { latestViewing, currentLease } = options;
  if (currentLease?.status === 'active')
    return currentLease.contract_files?.length
      ? '租约已生效，当前重点转向履约维护。'
      : '租约已生效，但合同资料还未归档。';
  if (currentLease?.status === 'pending')
    return currentLease.contract_files?.length
      ? '租约待生效，继续跟进入住安排。'
      : '租约待生效，优先补齐合同资料。';
  if (latestViewing?.status === 'converted' && latestViewing.signed_lease_id)
    return '已从带看转为租约，继续跟进起租和合同归档。';
  if (needsViewingContactCompletion(latestViewing))
    return '成交已确认，但签约前需先补齐租客主体。';
  if (latestViewing?.status === 'converted')
    return '客户已成交，下一步应立即创建租约。';
  if (latestViewing) return '当前还在带看跟进阶段，需继续确认客户意向。';
  return '当前还没有带看或租约记录。';
}

function getViewingChecklistState(latestViewing?: ViewingRecordOut) {
  if (!latestViewing) {
    return {
      status: '暂无带看',
      detail:
        '当前还没有客户进线或预约记录，建议先补首条带看，后续才有成交和签约转化。',
      actionLabel: '登记首条带看',
      actionType: 'primary' as const,
    };
  }
  if (needsViewingContactCompletion(latestViewing)) {
    return {
      status: '待补租客',
      detail: '成交已确认，但租客主体还没绑定，当前不能继续签约。',
      actionLabel: '去补租客',
      actionPath: viewingContactFixHref(latestViewing.id),
    };
  }
  if (latestViewing.status === 'converted' && !latestViewing.signed_lease_id) {
    return {
      status: '待签约',
      detail: '客户已成交但还没转租约，建议立即建档并同步合同资料。',
      actionLabel: '执行签约',
      actionPath: dashboardHref(
        `/property-rental/leases?source_viewing_record_id=${latestViewing.id}`,
      ),
      actionType: 'primary' as const,
    };
  }
  if (latestViewing.status === 'converted' && latestViewing.signed_lease_id) {
    return {
      status: '已转租约',
      detail: '最近成交已经关联租约，当前重点转向合同归档和起租安排。',
      actionLabel: '查看签约',
      actionPath: dashboardHref(
        `/property-rental/leases?house_id=${latestViewing.house_id}&edit=${latestViewing.signed_lease_id}`,
      ),
    };
  }
  return {
    status: enumMapping(latestViewing.status, latestViewing.status__mapping),
    detail: '客户仍在带看跟进阶段，继续维护预约、回访和成交进度。',
    actionLabel: '查看带看',
    actionPath: dashboardHref(
      `/property-rental/viewings?house_id=${latestViewing.house_id}`,
    ),
  };
}

function getLeaseChecklistState(houseId: number, currentLease?: LeaseOut) {
  if (!currentLease) {
    return {
      status: '暂无租约',
      detail: '当前还没有租约记录，成交后要尽快补租约，避免链路断在带看。',
      actionLabel: '创建首份租约',
      actionPath: dashboardHref(`/property-rental/leases?house_id=${houseId}`),
      actionType: 'primary' as const,
    };
  }
  if (!currentLease.contract_files?.length) {
    return {
      status: '待补合同',
      detail: '租约已存在，但合同资料还没归档，后续履约和结算会受影响。',
      actionLabel: '去补合同',
      actionPath: leaseEditHref(houseId, currentLease.id, { task: 'contract' }),
    };
  }
  return {
    status: enumMapping(currentLease.status, currentLease.status__mapping),
    detail: '租约和合同资料都已建立，当前可以继续维护履约进度。',
    actionLabel: '查看签约',
    actionPath: leaseEditHref(houseId, currentLease.id),
  };
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
  const focusTask = detailFocus.task;
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
  const missingItems = useMemo(
    () => getPublishMissingItems(house.data),
    [house.data],
  );
  const blockingIssues = useMemo(
    () => (house.data ? getHouseBlockingIssues(house.data) : ['加载中']),
    [house.data],
  );
  const warningIssues = useMemo(
    () => (house.data ? getHouseWarningIssues(house.data) : []),
    [house.data],
  );
  const canPublish = Boolean(house.data && canHousePublish(house.data));
  const isPublished = house.data?.publish_status === 'published';
  const needsMetadata = missingItems.some(
    (item) => item === '缺房东' || item === '缺租金',
  );
  const needsMedia = missingItems.some(
    (item) =>
      item === '缺封面' ||
      item === '图片不足' ||
      item === '缺户型图' ||
      item === '视频不足',
  );
  const latestViewing = viewings.data?.items?.[0];
  const currentLease =
    leases.data?.items?.find(
      (item) => item.status === 'active' || item.status === 'pending',
    ) || leases.data?.items?.[0];
  const orientationOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_orientation',
  );
  const decorationOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_decoration',
  );
  const workflowStage = house.data
    ? getWorkflowStage(house.data, { canPublish, latestViewing, currentLease })
    : '-';
  const workflowHint = getHouseWorkflowHint({ latestViewing, currentLease });
  const publishButtonLabel = isPublished
    ? '下架房源'
    : canPublish
      ? '发布房源'
      : '待补齐后发布';
  const derivedMetadataTask = missingItems.includes('缺房东')
    ? 'landlord'
    : missingItems.includes('缺租金')
      ? 'rent'
      : undefined;
  const derivedMediaTask = missingItems.includes('缺封面')
    ? 'cover'
    : missingItems.includes('图片不足')
      ? 'images'
      : missingItems.includes('缺户型图')
        ? 'floor_plan'
        : missingItems.includes('视频不足')
          ? 'video'
          : undefined;
  const activeMetadataTask =
    focusAction === 'edit' && (focusTask === 'landlord' || focusTask === 'rent')
      ? focusTask
      : derivedMetadataTask;
  const activeMediaTask =
    focusAction === 'media' &&
    (focusTask === 'cover' ||
      focusTask === 'images' ||
      focusTask === 'floor_plan' ||
      focusTask === 'video')
      ? focusTask
      : derivedMediaTask;
  const focusedAction = getFocusedActionCopy(focusAction, focusTask);
  const focusedActionTitle = focusedAction.title;
  const focusedActionDescription = focusedAction.description;
  const editSectionStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    background: token.colorBgContainer,
  } as const;
  const openEdit = () => {
    updateDetailFocus({ action: 'edit', task: activeMetadataTask });
    setEditOpen(true);
  };
  const openPublishConfirm = (publishStatus: 'published' | 'unpublished') => {
    setPublishConfirmStatus(publishStatus);
  };
  const scrollToMedia = () => {
    updateDetailFocus({ action: 'media', task: activeMediaTask });
    mediaSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };
  const nextActions = useMemo(() => {
    if (!house.data) return [];
    const actions: {
      key: string;
      label: string;
      helper: string;
      type?: 'primary' | 'default';
      href?: string;
      onClick?: () => void;
    }[] = [];
    if (needsMetadata) {
      actions.push({
        key: 'metadata',
        label: '补充基础资料',
        helper: '先补房东、租金等发布基础字段',
        type: 'primary',
        onClick: openEdit,
      });
    }
    if (needsMedia) {
      actions.push({
        key: 'media',
        label: '维护媒体相册',
        helper: canPublish
          ? '当前不阻断发布，可继续补齐封面、户型图和基础图片'
          : '先补封面、户型图和基础图片，再回到发布检查',
        onClick: scrollToMedia,
      });
    }
    if (
      latestViewing?.status === 'converted' &&
      !latestViewing.signed_lease_id
    ) {
      actions.push({
        key: 'lease',
        label: needsViewingContactCompletion(latestViewing)
          ? '补租客'
          : '去签约',
        helper: needsViewingContactCompletion(latestViewing)
          ? '成交已确认，但签约前还需先补齐租客主体'
          : '这套房已有成交带看，优先补租约建档',
        href: needsViewingContactCompletion(latestViewing)
          ? viewingContactFixHref(latestViewing.id)
          : dashboardHref(
              `/property-rental/leases?source_viewing_record_id=${latestViewing.id}`,
            ),
      });
    } else if (currentLease && !currentLease.contract_files?.length) {
      actions.push({
        key: 'contract',
        label: '补合同',
        helper: '租约已存在，但合同资料还未归档',
        href: leaseEditHref(houseId, currentLease.id, { task: 'contract' }),
      });
    }
    actions.push({
      key: 'viewing',
      label: '登记带看',
      helper: latestViewing
        ? '继续跟进新增客户，补充带看记录'
        : '暂无客户记录，建议先登记首条带看',
      href: dashboardHref(`/property-rental/viewings?house_id=${houseId}`),
    });
    return actions;
  }, [
    canPublish,
    currentLease,
    house.data,
    houseId,
    latestViewing,
    needsMedia,
    needsMetadata,
  ]);
  const checklistRows = useMemo<HouseChecklistRow[]>(() => {
    const publishAction = isPublished
      ? {
          actionLabel: '执行下架',
          actionClick: () => openPublishConfirm('unpublished'),
        }
      : canPublish
        ? {
            actionLabel: '执行发布',
            actionClick: () => openPublishConfirm('published'),
            actionType: 'primary' as const,
          }
        : needsMetadata
          ? {
              actionLabel: '去补资料',
              actionClick: openEdit,
            }
          : needsMedia
            ? {
                actionLabel: '去维护相册',
                actionClick: scrollToMedia,
              }
            : {
                actionLabel: '查看详情',
                actionPath: dashboardHref(`/property-rental/houses/${houseId}`),
              };
    const publishDetail =
      blockingIssues.length > 0
        ? `当前阻断：${blockingIssues.join('、')}`
        : warningIssues.length > 0
          ? `当前提醒：${warningIssues.join('、')}`
          : '当前资料已满足发布检查。';
    const viewingState = getViewingChecklistState(latestViewing);
    const leaseState = getLeaseChecklistState(houseId, currentLease);
    return [
      {
        key: 'publish',
        stage: '发布检查',
        status: isPublished ? '已发布' : canPublish ? '可发布' : '待补资料',
        detail: publishDetail,
        ...publishAction,
      },
      {
        key: 'viewing',
        stage: '带看跟进',
        ...viewingState,
      },
      {
        key: 'lease',
        stage: '租约合同',
        ...leaseState,
      },
    ];
  }, [
    blockingIssues,
    canPublish,
    currentLease,
    houseId,
    isPublished,
    latestViewing,
    needsMedia,
    needsMetadata,
    warningIssues,
  ]);

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
        {focusedActionTitle && house.data ? (
          <Alert
            type="info"
            showIcon
            title={focusedActionTitle}
            description={focusedActionDescription}
            action={
              <Button
                size="small"
                href={dashboardHref(`/property-rental/houses/${houseId}`)}
              >
                返回详情
              </Button>
            }
          />
        ) : null}
        <Card
          title={house.data ? houseLabel(house.data) : '房源详情'}
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
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap size={[8, 8]}>
                <Tag color={STATUS_COLOR[house.data.status] || 'default'}>
                  {enumMapping(house.data.status, house.data.status__mapping)}
                </Tag>
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
                <Tag color={canPublish ? 'blue' : 'orange'}>
                  {workflowStage}
                </Tag>
                <Typography.Text type="secondary">
                  {houseMediaReadinessText(house.data)}
                </Typography.Text>
              </Space>
              <Typography.Text type="secondary">{workflowHint}</Typography.Text>
            </Space>
          ) : null}
        </Card>

        <Row gutter={[16, 16]} align="top">
          <Col xs={24} xl={15}>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Card title="闭环工作台">
                <Typography.Text strong>闭环清单</Typography.Text>
                <Table<HouseChecklistRow>
                  style={{ marginTop: 12 }}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '环节', dataIndex: 'stage', width: 120 },
                    {
                      title: '当前状态',
                      dataIndex: 'status',
                      width: 140,
                      render: (value) => (
                        <Tag
                          color={
                            value === '待补资料' ||
                            value === '待补租客' ||
                            value === '待补合同'
                              ? 'orange'
                              : value === '可发布' || value === '待签约'
                                ? 'blue'
                                : 'green'
                          }
                        >
                          {value}
                        </Tag>
                      ),
                    },
                    { title: '影响与下一步', dataIndex: 'detail' },
                    {
                      title: '操作',
                      dataIndex: 'actions',
                      width: 160,
                      render: (_value, record) =>
                        record.actionPath ? (
                          <Button
                            type={record.actionType}
                            size="small"
                            href={record.actionPath}
                          >
                            {record.actionLabel}
                          </Button>
                        ) : (
                          <Button
                            type={record.actionType}
                            size="small"
                            onClick={record.actionClick}
                          >
                            {record.actionLabel}
                          </Button>
                        ),
                    },
                  ]}
                  dataSource={checklistRows}
                />
              </Card>

              <Card title="房源资料">
                {house.data ? (
                  <Descriptions column={2}>
                    <Descriptions.Item label="项目">
                      {house.data.estate_name || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="楼栋">
                      {house.data.building_name || house.data.building_id}
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
                          HOUSE_PUBLISH_STATUS_COLOR[
                            house.data.publish_status
                          ] || 'default'
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
                    <Descriptions.Item label="可租日期">
                      {house.data.available_from || '-'}
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
                      {house.data.landlord_id
                        ? contactLabel(house.data)
                        : '待补'}
                    </Descriptions.Item>
                  </Descriptions>
                ) : null}
              </Card>
            </Space>
          </Col>
          <Col xs={24} xl={9}>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Card title="优先动作">
                <Space
                  orientation="vertical"
                  size={12}
                  style={{ width: '100%' }}
                >
                  {nextActions.map((action) => (
                    <Space
                      key={action.key}
                      orientation="vertical"
                      size={4}
                      style={{ width: '100%' }}
                    >
                      {action.href ? (
                        <Button type={action.type} href={action.href}>
                          {action.label}
                        </Button>
                      ) : (
                        <Button type={action.type} onClick={action.onClick}>
                          {action.label}
                        </Button>
                      )}
                      <Typography.Text type="secondary">
                        {action.helper}
                      </Typography.Text>
                    </Space>
                  ))}
                </Space>
              </Card>
              <Card title="发布缺口">
                <Space
                  orientation="vertical"
                  size={12}
                  style={{ width: '100%' }}
                >
                  <Space wrap size={[8, 8]}>
                    <Tag
                      color={
                        isPublished ? 'green' : canPublish ? 'blue' : 'orange'
                      }
                    >
                      {isPublished
                        ? '已发布'
                        : canPublish
                          ? '可发布'
                          : '暂不可发布'}
                    </Tag>
                    <Typography.Text type="secondary">
                      {house.data ? houseMediaReadinessText(house.data) : '-'}
                    </Typography.Text>
                  </Space>
                  <Alert
                    type="info"
                    showIcon
                    title="发布规则由空间统一控制"
                    action={
                      <Button
                        size="small"
                        href="/dashboard/settings-management/organization"
                      >
                        去空间设置
                      </Button>
                    }
                  />
                  <Space wrap>
                    {blockingIssues.map((item) => (
                      <Tag color="orange" key={`blocking-${item}`}>
                        {item}
                      </Tag>
                    ))}
                    {warningIssues.map((item) => (
                      <Tag color="blue" key={`warning-${item}`}>
                        {item}
                      </Tag>
                    ))}
                    {!blockingIssues.length && !warningIssues.length ? (
                      <Typography.Text type="secondary">
                        当前没有发布缺口。
                      </Typography.Text>
                    ) : null}
                  </Space>
                  <Space wrap size={8}>
                    {needsMetadata ? (
                      <Button
                        icon={<EditOutlined />}
                        size="small"
                        onClick={openEdit}
                      >
                        补资料
                      </Button>
                    ) : null}
                    {needsMedia ? (
                      <Button
                        icon={<PictureOutlined />}
                        size="small"
                        onClick={scrollToMedia}
                      >
                        去维护相册
                      </Button>
                    ) : null}
                  </Space>
                </Space>
              </Card>
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
            </Space>
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="top">
          <Col xs={24} xl={12}>
            <Card title="带看记录">
              <Table<ViewingRecordOut>
                rowKey="id"
                loading={viewings.isLoading}
                columns={[
                  { title: '客户', dataIndex: 'customer_name' },
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
                columns={[
                  {
                    title: '租客',
                    dataIndex: 'tenant_id',
                    render: (_value, record) => contactLabel(record),
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
                    render: (value) => (
                      <Space size={8}>
                        <span>{`${value?.length || 0} 份`}</span>
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
                          <Form.Item label="可租日期" name="available_from">
                            <Input type="date" />
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
