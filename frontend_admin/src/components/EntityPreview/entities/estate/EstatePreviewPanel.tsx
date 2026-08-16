import { useQuery } from '@tanstack/react-query';
import { Descriptions, Image, Space, Tag, Typography } from 'antd';
import { mediaCoverUrl } from '@/pages/rental/constants';
import { useTenantWorkspace } from '@/pages/space/shared';
import { enumMapping } from '@/services/manual/enums';
import { houseApi } from '@/services/manual/house';
import {
  EntityPreviewCard,
  EntityPreviewCardBody,
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

export function EstatePreviewPanel({ id, variant }: EntityPreviewPanelProps) {
  const workspace = useTenantWorkspace();
  const estate = useQuery({
    queryKey: ['entity-preview', workspace.selectedOrgSlug, 'estate', id],
    queryFn: () => houseApi.getEstate(id),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
    gcTime: 600_000,
  });

  if (estate.isPending) {
    return (
      <EntityPreviewSkeleton
        variant={variant}
        withMedia={variant === 'popover'}
      />
    );
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
  const locationSummary = [
    estate.data.province,
    estate.data.city,
    estate.data.district,
  ]
    .filter(Boolean)
    .join(' · ');
  const title = estate.data.display_name || estate.data.name;

  if (variant === 'popover') {
    return (
      <EntityPreviewCard ariaLabel={`${title}预览`} footerMeta={`小区 #${id}`}>
        <EntityPreviewMedia alt={title} entityLabel="小区" src={coverUrl} />
        <EntityPreviewHeader
          subtitle={[estate.data.city, estate.data.district]
            .filter(Boolean)
            .join(' · ')}
          tags={
            <Tag>
              {enumMapping(
                estate.data.property_type,
                estate.data.property_type__mapping,
              )}
            </Tag>
          }
          title={title}
        />
        <EntityPreviewCardBody>
          <EntityPreviewSection>
            <EntityPreviewFieldList>
              <EntityPreviewField
                label="所在区域"
                value={locationSummary || '-'}
              />
              <EntityPreviewField
                label="详细地址"
                value={estate.data.address || '-'}
              />
            </EntityPreviewFieldList>
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
        <Space size={4} wrap>
          <Tag>
            {enumMapping(
              estate.data.property_type,
              estate.data.property_type__mapping,
            )}
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
