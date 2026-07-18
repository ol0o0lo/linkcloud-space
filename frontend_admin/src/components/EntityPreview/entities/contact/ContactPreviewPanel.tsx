import { useQuery } from '@tanstack/react-query';
import { Avatar, Descriptions, Space, Tag, Typography, theme } from 'antd';
import { useTenantWorkspace } from '@/pages/tenant/shared';
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

export function ContactPreviewPanel({ id, variant }: EntityPreviewPanelProps) {
  const { token } = theme.useToken();
  const workspace = useTenantWorkspace();
  const contact = useQuery({
    queryKey: ['entity-preview', workspace.selectedOrgSlug, 'contact', id],
    queryFn: () => houseApi.getContact(id),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
    gcTime: 600_000,
  });

  if (contact.isPending) {
    return <EntityPreviewSkeleton variant={variant} />;
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

  if (variant === 'popover') {
    const initial = contact.data.name.trim().slice(0, 1) || '?';
    const roleTags = roles.length ? (
      <Space size={[4, 4]} wrap>
        {roles.map((role, index) => (
          <Tag key={role}>{contact.data.roles__mapping?.[index] || role}</Tag>
        ))}
      </Space>
    ) : (
      '-'
    );

    return (
      <EntityPreviewCard
        ariaLabel={`${contact.data.name}预览`}
        footerMeta={`联系人 #${id}`}
      >
        <div style={{ paddingTop: 16 }}>
          <EntityPreviewHeader
            aside={
              <Tag
                color={contact.data.is_active === false ? 'default' : 'green'}
              >
                {contact.data.is_active === false ? '停用' : '启用'}
              </Tag>
            }
            leading={
              <Avatar
                size={36}
                style={{
                  backgroundColor:
                    contact.data.is_active === false
                      ? token.colorFillSecondary
                      : token.colorPrimaryBg,
                  color:
                    contact.data.is_active === false
                      ? token.colorTextDisabled
                      : token.colorPrimary,
                }}
              >
                {initial}
              </Avatar>
            }
            subtitle={contact.data.phone || '-'}
            title={contact.data.name}
          />
        </div>
        <EntityPreviewCardBody>
          <EntityPreviewSection>
            <EntityPreviewFactGrid>
              <EntityPreviewFact full label="角色" value={roleTags} />
            </EntityPreviewFactGrid>
            <EntityPreviewFieldList>
              <EntityPreviewField
                label="邮箱"
                value={contact.data.email || '-'}
              />
              <EntityPreviewField
                label="备注"
                value={contact.data.notes || '-'}
              />
            </EntityPreviewFieldList>
          </EntityPreviewSection>
        </EntityPreviewCardBody>
      </EntityPreviewCard>
    );
  }

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
