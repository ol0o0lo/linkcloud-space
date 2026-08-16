import { Card, Space } from 'antd';
import React from 'react';
import { TenantSelectionGuard } from '@/pages/space/shared';

const AccessOverviewPage: React.FC = () => {
  return (
    <TenantSelectionGuard title="权限管理">
      <Card title="权限入口">
        <Space direction="vertical" size={12}>
          <a href="/dashboard/space/access/organization-roles">空间角色</a>
          <a href="/dashboard/space/access/organization-bindings">空间授权</a>
          <a href="/dashboard/space/access/team-roles">团队角色</a>
          <a href="/dashboard/space/access/team-bindings">团队授权</a>
        </Space>
      </Card>
    </TenantSelectionGuard>
  );
};

export default AccessOverviewPage;
