import { useQuery } from '@tanstack/react-query';
import { Descriptions, Space, Tag, Typography } from 'antd';
import { buildingLabel } from '@/pages/property-rental/constants';
import { useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
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

export function BuildingPreviewPanel({ id }: EntityPreviewPanelProps) {
  const workspace = useTenantWorkspace();
  const building = useQuery({
    queryKey: ['entity-preview', workspace.selectedOrgSlug, 'building', id],
    queryFn: () => houseApi.getBuilding(id),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
    gcTime: 600_000,
  });

  if (building.isPending) {
    return <EntityPreviewSkeleton />;
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
    building.data.estate.display_name || building.data.estate.name;

  return (
    <Space orientation="vertical" size={12} style={{ width: 330 }}>
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <Typography.Text ellipsis strong>
          {buildingLabel(building.data)}
        </Typography.Text>
        <Tag color={building.data.is_active ? 'green' : 'default'}>
          {building.data.is_active ? '启用' : '停用'}
        </Tag>
      </Space>
      <Descriptions
        column={1}
        items={[
          { key: 'estate', label: '所属项目', children: estateName || '-' },
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
