import { useQuery } from '@tanstack/react-query';
import { Descriptions, Image, Space, Tag, Typography } from 'antd';
import {
  buildingLabel,
  mediaCoverUrl,
} from '@/pages/rental/constants';
import { useTenantWorkspace } from '@/pages/space/shared';
import { houseApi } from '@/services/manual/house';
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

function floorText(
  floors: number,
  underFloors: number | null,
  yearBuilt: number | null,
) {
  return [
    `${floors} 层`,
    underFloors == null ? null : `地下 ${underFloors} 层`,
    yearBuilt == null ? null : `${yearBuilt} 年`,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function BuildingPreviewPanel({ id, variant }: EntityPreviewPanelProps) {
  const workspace = useTenantWorkspace();
  const building = useQuery({
    queryKey: ['entity-preview', workspace.selectedOrgSlug, 'building', id],
    queryFn: () => houseApi.getBuilding(id),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
    gcTime: 600_000,
  });

  if (building.isPending) {
    return (
      <EntityPreviewSkeleton
        variant={variant}
        withMedia={variant === 'popover'}
      />
    );
  }

  if (building.isError) {
    return (
      <EntityPreviewError
        error={building.error}
        onRetry={() => building.refetch()}
      />
    );
  }

  const estateName =
    building.data.estate?.display_name ||
    building.data.estate?.name ||
    '未关联项目';
  const coverUrl = mediaCoverUrl(building.data.images);
  const title = buildingLabel(building.data);
  const tags = building.data.tags || [];

  if (variant === 'popover') {
    return (
      <EntityPreviewCard ariaLabel={`${title}预览`} footerMeta={`楼栋 #${id}`}>
        <EntityPreviewMedia
          alt={building.data.name}
          entityLabel="楼栋"
          src={coverUrl}
        />
        <EntityPreviewHeader
          subtitle={building.data.address || undefined}
          title={title}
        />
        <EntityPreviewCardBody>
          <EntityPreviewSection>
            <EntityPreviewFactGrid>
              <EntityPreviewFact full label="所属小区" value={estateName} />
              <EntityPreviewFact
                label="总楼层"
                value={`${building.data.floors} 层`}
              />
              <EntityPreviewFact
                label="地下楼层"
                value={
                  building.data.under_floors == null
                    ? '-'
                    : `${building.data.under_floors} 层`
                }
              />
              <EntityPreviewFact
                full
                label="建成年份"
                value={
                  building.data.year_built == null
                    ? '-'
                    : `${building.data.year_built} 年`
                }
              />
            </EntityPreviewFactGrid>
            <EntityPreviewFieldList>
              <EntityPreviewField
                label="电梯"
                value={building.data.elevator ? '有电梯' : '无电梯'}
              />
              <EntityPreviewField
                label="详细地址"
                value={building.data.address || '-'}
              />
              {tags.length ? (
                <EntityPreviewField
                  label="标签"
                  value={
                    <Space size={[4, 4]} wrap>
                      {tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Space>
                  }
                />
              ) : null}
            </EntityPreviewFieldList>
          </EntityPreviewSection>
        </EntityPreviewCardBody>
      </EntityPreviewCard>
    );
  }

  return (
    <Space orientation="vertical" size={12} style={{ width: 330 }}>
      {coverUrl ? (
        <Image
          alt={building.data.name}
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
      </Space>
      <Descriptions
        column={1}
        items={[
          { key: 'estate', label: '所属项目', children: estateName },
          {
            key: 'floors',
            label: '楼层 / 年份',
            children: floorText(
              building.data.floors,
              building.data.under_floors,
              building.data.year_built,
            ),
          },
          {
            key: 'elevator',
            label: '电梯',
            children: building.data.elevator ? '有电梯' : '无电梯',
          },
          {
            key: 'address',
            label: '详细地址',
            children: building.data.address || '-',
          },
        ]}
        size="small"
      />
    </Space>
  );
}
