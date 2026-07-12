import { useQuery } from '@tanstack/react-query';
import { Descriptions, Image, Space, Tag, Typography } from 'antd';
import {
  buildingLabel,
  contactLabel,
  HOUSE_PUBLISH_STATUS_COLOR,
  houseLabel,
  mediaCoverUrl,
  moneyText,
  STATUS_COLOR,
} from '@/pages/property-rental/constants';
import { useTenantWorkspace } from '@/pages/tenant/shared';
import { enumMapping } from '@/services/manual/enums';
import { type HouseOut, houseApi } from '@/services/manual/house';
import {
  EntityPreviewError,
  EntityPreviewSkeleton,
} from '../../EntityPreviewState';
import type { EntityPreviewPanelProps } from '../../types';

function layoutText(house: HouseOut) {
  const rooms = [
    house.bedrooms == null ? null : `${house.bedrooms}室`,
    house.living_rooms == null ? null : `${house.living_rooms}厅`,
    house.bathrooms == null ? null : `${house.bathrooms}卫`,
  ].filter(Boolean);
  const area = house.area ? `${house.area}㎡` : null;
  return [rooms.join(''), area].filter(Boolean).join(' / ') || '-';
}

export function HousePreviewPanel({ id }: EntityPreviewPanelProps) {
  const workspace = useTenantWorkspace();
  const house = useQuery({
    queryKey: ['entity-preview', workspace.selectedOrgSlug, 'house', id],
    queryFn: () => houseApi.getHouse(id),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
    gcTime: 600_000,
  });

  if (house.isPending) {
    return <EntityPreviewSkeleton />;
  }

  if (house.isError) {
    return (
      <EntityPreviewError error={house.error} onRetry={() => house.refetch()} />
    );
  }

  const coverUrl = mediaCoverUrl(house.data.images);
  const landlord = house.data.landlord_id
    ? contactLabel(house.data)
    : '待补房东';

  return (
    <Space orientation="vertical" size={12} style={{ width: 340 }}>
      {coverUrl ? (
        <Image
          alt={houseLabel(house.data)}
          height={128}
          preview={false}
          src={coverUrl}
          styles={{ root: { width: '100%' }, image: { objectFit: 'cover' } }}
          width="100%"
        />
      ) : null}
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <Typography.Text ellipsis strong>
          {houseLabel(house.data)}
        </Typography.Text>
        <Typography.Text strong type="danger">
          {moneyText(house.data.asking_rent)}
        </Typography.Text>
        <Space size={4} wrap>
          <Tag color={STATUS_COLOR[house.data.status] || 'default'}>
            {enumMapping(house.data.status, house.data.status__mapping)}
          </Tag>
          <Tag
            color={
              HOUSE_PUBLISH_STATUS_COLOR[house.data.publish_status] || 'default'
            }
          >
            {enumMapping(
              house.data.publish_status,
              house.data.publish_status__mapping,
            )}
          </Tag>
        </Space>
      </Space>
      <Descriptions
        column={1}
        items={[
          {
            key: 'layout',
            label: '面积 / 户型',
            children: layoutText(house.data),
          },
          {
            key: 'building',
            label: '所属楼栋',
            children: buildingLabel(house.data.building),
          },
          { key: 'landlord', label: '房东', children: landlord },
        ]}
        size="small"
      />
    </Space>
  );
}
