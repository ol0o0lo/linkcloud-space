import { Card, Space } from 'antd';
import React from 'react';
import { TenantSelectionGuard } from '@/pages/tenant/shared';

const AccessOverviewPage: React.FC = () => {
  return (
    <TenantSelectionGuard title="权限管理" subtitle="管理空间和团队的角色与授权。">
      <Card title="权限入口">
        <Space direction="vertical" size={12}>
          <a href="/dashboard/access/organization-roles">空间角色</a>
          <a href="/dashboard/access/organization-bindings">空间授权</a>
          <a href="/dashboard/access/team-roles">团队角色</a>
          <a href="/dashboard/access/team-bindings">团队授权</a>
        </Space>
      </Card>
    </TenantSelectionGuard>
  );
};

export default AccessOverviewPage;
