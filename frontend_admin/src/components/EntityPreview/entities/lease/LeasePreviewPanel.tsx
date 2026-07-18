import { useQuery } from '@tanstack/react-query';
import { Descriptions, Space, Tag, Typography } from 'antd';
import {
  contactLabel,
  houseLabel,
  moneyText,
  STATUS_COLOR,
} from '@/pages/property-rental/constants';
import { useTenantWorkspace } from '@/pages/tenant/shared';
import { enumMapping } from '@/services/manual/enums';
import { houseApi } from '@/services/manual/house';
import {
  EntityPreviewCard,
  EntityPreviewCardBody,
  EntityPreviewFact,
  EntityPreviewFactGrid,
  EntityPreviewField,
  EntityPreviewFieldList,
  EntityPreviewHeader,
  EntityPreviewSection,
} from '../../EntityPreviewCard';
import {
  EntityPreviewError,
  EntityPreviewSkeleton,
} from '../../EntityPreviewState';
import type { EntityPreviewPanelProps } from '../../types';

export function LeasePreviewPanel({ id, variant }: EntityPreviewPanelProps) {
  const workspace = useTenantWorkspace();
  const lease = useQuery({
    queryKey: ['entity-preview', workspace.selectedOrgSlug, 'lease', id],
    queryFn: () => houseApi.getLease(id),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
    gcTime: 600_000,
  });

  if (lease.isPending) {
    return <EntityPreviewSkeleton variant={variant} />;
  }

  if (lease.isError) {
    return (
      <EntityPreviewError error={lease.error} onRetry={() => lease.refetch()} />
    );
  }

  const contractCount = lease.data.contract_files?.length ?? 0;

  if (variant === 'popover') {
    const title = houseLabel(lease.data);

    return (
      <EntityPreviewCard
        ariaLabel={`${title}租约预览`}
        footerMeta={`租约 #${id}`}
      >
        <EntityPreviewHeader
          aside={
            <Tag color={STATUS_COLOR[lease.data.status] || 'default'}>
              {enumMapping(lease.data.status, lease.data.status__mapping)}
            </Tag>
          }
          highlight={
            <Typography.Text strong type="danger" style={{ fontSize: 18 }}>
              {moneyText(lease.data.monthly_rent)}
            </Typography.Text>
          }
          subtitle={contactLabel(lease.data)}
          title={title}
        />
        <EntityPreviewCardBody>
          <EntityPreviewSection>
            <EntityPreviewFactGrid>
              <EntityPreviewFact
                full
                label="租期"
                value={`${lease.data.start_date || '-'} 至 ${lease.data.end_date || '-'}`}
              />
              <EntityPreviewFact
                label="押金"
                value={moneyText(lease.data.deposit)}
              />
              <EntityPreviewFact
                label="付款日"
                value={
                  lease.data.payment_day
                    ? `每月 ${lease.data.payment_day} 日`
                    : '-'
                }
              />
            </EntityPreviewFactGrid>
            <EntityPreviewFieldList>
              <EntityPreviewField
                label="合同文件"
                value={`${contractCount} 份`}
              />
            </EntityPreviewFieldList>
          </EntityPreviewSection>
        </EntityPreviewCardBody>
      </EntityPreviewCard>
    );
  }

  return (
    <Space orientation="vertical" size={10} style={{ width: 330 }}>
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <Typography.Text ellipsis strong>
          {houseLabel(lease.data)}
        </Typography.Text>
        <Typography.Text type="secondary">
          {contactLabel(lease.data)}
        </Typography.Text>
        <Space size={8} wrap>
          <Typography.Text strong type="danger">
            {moneyText(lease.data.monthly_rent)}
          </Typography.Text>
          <Tag color={STATUS_COLOR[lease.data.status] || 'default'}>
            {enumMapping(lease.data.status, lease.data.status__mapping)}
          </Tag>
        </Space>
      </Space>
      <Descriptions
        column={1}
        items={[
          {
            key: 'period',
            label: '租期',
            children: `${lease.data.start_date || '-'} 至 ${lease.data.end_date || '-'}`,
          },
          {
            key: 'deposit',
            label: '押金',
            children: moneyText(lease.data.deposit),
          },
          {
            key: 'payment-day',
            label: '付款日',
            children: lease.data.payment_day
              ? `每月 ${lease.data.payment_day} 日`
              : '-',
          },
          {
            key: 'contracts',
            label: '合同文件',
            children: `${contractCount} 份`,
          },
        ]}
        size="small"
      />
    </Space>
  );
}
