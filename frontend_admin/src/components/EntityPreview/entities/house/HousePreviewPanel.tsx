import { useQuery } from '@tanstack/react-query';
import { Descriptions, Image, Space, Typography } from 'antd';
import { AppStatusTag } from '@/components/AppStatus';
import {
  buildingLabel,
  contactLabel,
  houseDisplayTags,
  houseLabel,
  housePrimaryLayoutText,
  mediaCoverUrl,
  moneyText,
} from '@/pages/rental/constants';
import { useTenantWorkspace } from '@/pages/space/shared';
import { enumMapping } from '@/services/manual/enums';
import { type HouseOut, houseApi } from '@/services/manual/house';
import {
  EntityPreviewCard,
  EntityPreviewCardBody,
  EntityPreviewFact,
  EntityPreviewFactGrid,
  EntityPreviewField,
  EntityPreviewFieldList,
  EntityPreviewHeader,
  EntityPreviewMedia,
  EntityPreviewSection,
} from '../../EntityPreviewCard';
import {
  EntityPreviewError,
  EntityPreviewSkeleton,
} from '../../EntityPreviewState';
import type { EntityPreviewPanelProps } from '../../types';
import { BuildingPreview } from '../building/BuildingPreview';

function layoutText(house: HouseOut) {
  const rooms = [
    housePrimaryLayoutText(house),
    house.bathrooms == null ? null : `${house.bathrooms}卫`,
  ].filter((value) => value && value !== '-');
  const area = house.area ? `${house.area}㎡` : null;
  return [rooms.join(''), area].filter(Boolean).join(' / ') || '-';
}

function roomLayoutText(house: HouseOut) {
  return (
    [
      housePrimaryLayoutText(house),
      house.bathrooms == null ? null : `${house.bathrooms}卫`,
    ]
      .filter((value) => value && value !== '-')
      .join('') || '-'
  );
}

function floorOrientationText(house: HouseOut) {
  return (
    [
      house.floor == null ? null : `${house.floor} 层`,
      house.orientation__mapping || house.orientation,
    ]
      .filter(Boolean)
      .join(' / ') || '-'
  );
}

function amenitiesText(house: HouseOut) {
  return [
    house.decoration__mapping || house.decoration,
    house.building?.elevator ? '有电梯' : null,
    house.kitchens == null ? null : `${house.kitchens} 厨`,
    house.balconies == null ? null : `${house.balconies} 阳台`,
  ]
    .filter(Boolean)
    .join('、');
}

export function HousePreviewPanel({ id, variant }: EntityPreviewPanelProps) {
  const workspace = useTenantWorkspace();
  const house = useQuery({
    queryKey: ['entity-preview', workspace.selectedOrgSlug, 'house', id],
    queryFn: () => houseApi.getHouse(id),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
    gcTime: 600_000,
  });

  if (house.isPending) {
    return (
      <EntityPreviewSkeleton
        variant={variant}
        withMedia={variant === 'popover'}
      />
    );
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
  const title = houseLabel(house.data);
  const displayTags = houseDisplayTags(house.data);
  const amenities = amenitiesText(house.data);
  const hasSupplementary = Boolean(
    amenities || displayTags.length || house.data.internal_notes,
  );

  if (variant === 'popover') {
    return (
      <EntityPreviewCard ariaLabel={`${title}预览`} footerMeta={`房源 #${id}`}>
        <EntityPreviewMedia alt={title} entityLabel="房源" src={coverUrl} />
        <EntityPreviewHeader
          aside={
            <AppStatusTag name="house" state={house.data.status}>
              {enumMapping(house.data.status, house.data.status__mapping)}
            </AppStatusTag>
          }
          highlight={
            <Space size={8} wrap>
              <Typography.Text strong type="danger" style={{ fontSize: 18 }}>
                {moneyText(house.data.asking_rent)}
              </Typography.Text>
              <Typography.Text type="secondary">
                押金 {moneyText(house.data.deposit_amount)}
              </Typography.Text>
            </Space>
          }
          subtitle={house.data.building?.address || undefined}
          title={title}
        />
        <EntityPreviewCardBody>
          <EntityPreviewSection>
            <EntityPreviewFactGrid>
              <EntityPreviewFact
                label="户型"
                value={roomLayoutText(house.data)}
              />
              <EntityPreviewFact
                label="面积"
                value={house.data.area ? `${house.data.area}㎡` : '-'}
              />
              <EntityPreviewFact
                label="楼层 / 朝向"
                value={floorOrientationText(house.data)}
              />
              <EntityPreviewFact
                label="所属楼栋"
                value={buildingLabel(house.data.building)}
              />
              <EntityPreviewFact full label="房东" value={landlord} />
            </EntityPreviewFactGrid>
            {hasSupplementary ? (
              <EntityPreviewFieldList>
                {amenities ? (
                  <EntityPreviewField label="配套" value={amenities} />
                ) : null}
                {house.data.internal_notes ? (
                  <EntityPreviewField
                    label="内部备注"
                    value={house.data.internal_notes}
                  />
                ) : null}
                {displayTags.length ? (
                  <EntityPreviewField
                    label="标签"
                    value={
                      <Typography.Text
                        ellipsis={{ tooltip: displayTags.join(' · ') }}
                        style={{ display: 'block' }}
                      >
                        {displayTags.join(' · ')}
                      </Typography.Text>
                    }
                  />
                ) : null}
              </EntityPreviewFieldList>
            ) : null}
          </EntityPreviewSection>
        </EntityPreviewCardBody>
      </EntityPreviewCard>
    );
  }

  return (
    <Space orientation="vertical" size={12} style={{ width: 340 }}>
      {coverUrl ? (
        <Image
          alt={title}
          height={128}
          preview={false}
          src={coverUrl}
          styles={{ root: { width: '100%' }, image: { objectFit: 'cover' } }}
          width="100%"
        />
      ) : null}
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <Typography.Text ellipsis strong>
          {title}
        </Typography.Text>
        <Typography.Text strong type="danger">
          {moneyText(house.data.asking_rent)}
        </Typography.Text>
        <Space size={4} wrap>
          <AppStatusTag name="house" state={house.data.status}>
            {enumMapping(house.data.status, house.data.status__mapping)}
          </AppStatusTag>
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
            children: (
              <BuildingPreview id={house.data.building_id}>
                {buildingLabel(house.data.building)}
              </BuildingPreview>
            ),
          },
          { key: 'landlord', label: '房东', children: landlord },
        ]}
        size="small"
      />
    </Space>
  );
}
