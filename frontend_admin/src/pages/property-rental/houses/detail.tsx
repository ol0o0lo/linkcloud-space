import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@umijs/max';
import { Button, Card, Descriptions, List, Space, Tag, message } from 'antd';
import React, { useMemo } from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type HouseOut } from '@/services/manual/house';
import MediaRefsUpload from '../components/MediaRefsUpload';
import {
  getHouseMediaCompleteness,
  HOUSE_MEDIA_RESOURCE_TYPE,
  HOUSE_MEDIA_TYPE,
  HOUSE_PUBLISH_STATUS_TEXT,
  type MediaRefValue,
  STATUS_COLOR,
  STATUS_TEXT,
} from '../constants';

function getPublishMissingItems(house?: HouseOut) {
  if (!house) return ['加载中'];
  const media = getHouseMediaCompleteness(house);
  return [
    !media.hasLandlord ? '补充房东' : null,
    !media.hasCover ? '设置封面' : null,
    media.imageCount < 3 ? '至少 3 张图片' : null,
    !media.hasFloorPlan ? '上传户型图' : null,
    !house.asking_rent ? '填写挂牌租金' : null,
  ].filter(Boolean) as string[];
}

const HouseDetailPage: React.FC = () => {
  const params = useParams();
  const houseId = Number(params.id);
  const queryClient = useQueryClient();
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug && houseId);
  const queryKey = ['house', 'detail', workspace.selectedOrgSlug, houseId];
  const house = useQuery({ queryKey, queryFn: () => houseApi.getHouse(houseId), enabled });
  const patchHouse = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.patchHouse(houseId, values),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
      message.success('房源已更新');
    },
  });
  const missingItems = useMemo(() => getPublishMissingItems(house.data), [house.data]);
  const canPublish = Boolean(house.data && missingItems.length === 0);

  return (
    <TenantSelectionGuard title="房源详情" subtitle="维护资料、媒体和发布状态。">
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card
          title={house.data?.room_number || '房源详情'}
          loading={house.isLoading}
          extra={
            <Button type="primary" disabled={!canPublish} loading={patchHouse.isPending} onClick={() => patchHouse.mutate({ publish_status: 'published' })}>
              发布房源
            </Button>
          }
        >
          {house.data ? (
            <Descriptions column={3}>
              <Descriptions.Item label="房号">{house.data.room_number}</Descriptions.Item>
              <Descriptions.Item label="房态"><Tag color={STATUS_COLOR[house.data.status] || 'default'}>{STATUS_TEXT[house.data.status] || house.data.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="发布">{HOUSE_PUBLISH_STATUS_TEXT[house.data.publish_status] || house.data.publish_status}</Descriptions.Item>
              <Descriptions.Item label="挂牌租金">{house.data.asking_rent || '-'}</Descriptions.Item>
              <Descriptions.Item label="押金">{house.data.deposit_amount || '-'}</Descriptions.Item>
              <Descriptions.Item label="可租日期">{house.data.available_from || '-'}</Descriptions.Item>
            </Descriptions>
          ) : null}
        </Card>

        <Card title="发布检查">
          {missingItems.length ? (
            <List size="small" dataSource={missingItems} renderItem={(item) => <List.Item>{item}</List.Item>} />
          ) : (
            <Tag color="green">可发布</Tag>
          )}
        </Card>

        <Card title="媒体相册">
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <MediaRefsUpload
              value={house.data?.images as MediaRefValue[] | undefined}
              resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_IMAGE}
              mediaType={HOUSE_MEDIA_TYPE.IMAGE}
              onChange={(images) => patchHouse.mutate({ images })}
            />
            <MediaRefsUpload
              value={house.data?.videos as MediaRefValue[] | undefined}
              resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_VIDEO}
              mediaType={HOUSE_MEDIA_TYPE.VIDEO}
              onChange={(videos) => patchHouse.mutate({ videos })}
            />
          </Space>
        </Card>
      </Space>
    </TenantSelectionGuard>
  );
};

export default HouseDetailPage;
