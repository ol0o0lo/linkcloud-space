import { useQuery } from '@tanstack/react-query';
import { Descriptions, Space, Tag, Typography } from 'antd';
import {
  contactLabel,
  dateTimeText,
  houseLabel,
  STATUS_COLOR,
} from '@/pages/property-rental/constants';
import { useTenantWorkspace } from '@/pages/tenant/shared';
import { enumMapping } from '@/services/manual/enums';
import { houseApi } from '@/services/manual/house';
import {
  EntityPreviewError,
  EntityPreviewSkeleton,
} from '../../EntityPreviewState';
import type { EntityPreviewPanelProps } from '../../types';

export function ViewingPreviewPanel({ id }: EntityPreviewPanelProps) {
  const workspace = useTenantWorkspace();
  const viewing = useQuery({
    queryKey: ['entity-preview', workspace.selectedOrgSlug, 'viewing', id],
    queryFn: () => houseApi.getViewingRecord(id),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
    gcTime: 600_000,
  });

  if (viewing.isPending) {
    return <EntityPreviewSkeleton />;
  }

  if (viewing.isError) {
    return (
      <EntityPreviewError
        error={viewing.error}
        onRetry={() => viewing.refetch()}
      />
    );
  }

  const customer = [viewing.data.customer_name, viewing.data.customer_phone]
    .filter(Boolean)
    .join(' / ');

  return (
    <Space orientation="vertical" size={10} style={{ width: 330 }}>
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <Typography.Text ellipsis strong>
          {customer || '-'}
        </Typography.Text>
        <Typography.Text ellipsis type="secondary">
          {houseLabel(viewing.data)}
        </Typography.Text>
        <Space size={8} wrap>
          <Tag color={STATUS_COLOR[viewing.data.status] || 'default'}>
            {enumMapping(viewing.data.status, viewing.data.status__mapping)}
          </Tag>
          {viewing.data.signed_lease_id ? (
            <Tag color="success">已签约</Tag>
          ) : null}
        </Space>
      </Space>
      <Descriptions
        column={1}
        items={[
          {
            key: 'contact',
            label: '联系人',
            children: viewing.data.contact
              ? contactLabel(viewing.data)
              : '未绑定联系人',
          },
          {
            key: 'scheduled-at',
            label: '预约时间',
            children: dateTimeText(viewing.data.scheduled_at),
          },
          {
            key: 'viewed-at',
            label: '实际带看',
            children: dateTimeText(viewing.data.viewed_at),
          },
          {
            key: 'notes',
            label: '备注',
            children: viewing.data.notes || '-',
          },
        ]}
        size="small"
      />
    </Space>
  );
}
