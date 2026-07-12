import { useQuery } from '@tanstack/react-query';
import { Descriptions, Image, Space, Tag, Typography } from 'antd';
import { mediaCoverUrl } from '@/pages/property-rental/constants';
import { useTenantWorkspace } from '@/pages/tenant/shared';
import { enumMapping } from '@/services/manual/enums';
import { houseApi } from '@/services/manual/house';
import {
  EntityPreviewError,
  EntityPreviewSkeleton,
} from '../../EntityPreviewState';
import type { EntityPreviewPanelProps } from '../../types';

export function EstatePreviewPanel({ id }: EntityPreviewPanelProps) {
  const workspace = useTenantWorkspace();
  const estate = useQuery({
    queryKey: ['entity-preview', workspace.selectedOrgSlug, 'estate', id],
    queryFn: () => houseApi.getEstate(id),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
    gcTime: 600_000,
  });

  if (estate.isPending) {
    return <EntityPreviewSkeleton />;
  }

  if (estate.isError) {
    return (
      <EntityPreviewError
        error={estate.error}
        onRetry={() => estate.refetch()}
      />
    );
  }

  const coverUrl = mediaCoverUrl(estate.data.images);
  const location = [
    estate.data.province,
    estate.data.city,
    estate.data.district,
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <Space orientation="vertical" size={12} style={{ width: 340 }}>
      {coverUrl ? (
        <Image
          alt={estate.data.display_name || estate.data.name}
          height={128}
          preview={false}
          src={coverUrl}
          styles={{ root: { width: '100%' }, image: { objectFit: 'cover' } }}
          width="100%"
        />
      ) : null}
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <Typography.Text ellipsis strong>
          {estate.data.display_name || estate.data.name}
        </Typography.Text>
        <Space size={4} wrap>
          <Tag>
            {enumMapping(
              estate.data.property_type,
              estate.data.property_type__mapping,
            )}
          </Tag>
          <Tag color={estate.data.is_active ? 'green' : 'default'}>
            {estate.data.is_active ? '启用' : '停用'}
          </Tag>
        </Space>
      </Space>
      <Descriptions
        column={1}
        items={[
          { key: 'location', label: '所在区域', children: location || '-' },
          {
            key: 'address',
            label: '详细地址',
            children: estate.data.address || '-',
          },
        ]}
        size="small"
      />
    </Space>
  );
}
