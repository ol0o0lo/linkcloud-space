import { useQuery } from '@tanstack/react-query';
import { Descriptions, Space, Tag, Typography } from 'antd';
import { useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
import {
  EntityPreviewError,
  EntityPreviewSkeleton,
} from '../../EntityPreviewState';
import type { EntityPreviewPanelProps } from '../../types';

export function ContactPreviewPanel({ id }: EntityPreviewPanelProps) {
  const workspace = useTenantWorkspace();
  const contact = useQuery({
    queryKey: ['entity-preview', workspace.selectedOrgSlug, 'contact', id],
    queryFn: () => houseApi.getContact(id),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
    gcTime: 600_000,
  });

  if (contact.isPending) {
    return <EntityPreviewSkeleton />;
  }

  if (contact.isError) {
    return (
      <EntityPreviewError
        error={contact.error}
        onRetry={() => contact.refetch()}
      />
    );
  }

  const roles = contact.data.roles || [];

  return (
    <Space orientation="vertical" size={12} style={{ width: 330 }}>
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <Typography.Text ellipsis strong>
          {contact.data.name} / {contact.data.phone}
        </Typography.Text>
        <Tag color={contact.data.is_active === false ? 'default' : 'green'}>
          {contact.data.is_active === false ? '停用' : '启用'}
        </Tag>
      </Space>
      <Descriptions
        column={1}
        items={[
          {
            key: 'roles',
            label: '角色',
            children: roles.length ? (
              <Space size={[4, 4]} wrap>
                {roles.map((role, index) => (
                  <Tag key={role}>
                    {contact.data.roles__mapping?.[index] || role}
                  </Tag>
                ))}
              </Space>
            ) : (
              '-'
            ),
          },
          { key: 'email', label: '邮箱', children: contact.data.email || '-' },
          { key: 'notes', label: '备注', children: contact.data.notes || '-' },
        ]}
        size="small"
      />
    </Space>
  );
}
