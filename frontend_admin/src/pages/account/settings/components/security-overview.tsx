import { Card, Space } from 'antd';
import React from 'react';
import BindingView from './binding';
import { RealNameView } from './real-name';
import SecurityView from './security';

const SecurityOverview: React.FC = () => {
  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card title="登录与验证" bordered={false} style={{ width: '100%' }}>
        <SecurityView />
      </Card>
      <Card title="第三方绑定" bordered={false} style={{ width: '100%' }}>
        <BindingView />
      </Card>
      <Card title="身份认证" bordered={false} style={{ width: '100%' }}>
        <RealNameView />
      </Card>
    </Space>
  );
};

export default SecurityOverview;
