import {
  GithubOutlined,
  WechatOutlined,
} from '@ant-design/icons';
import { Alert, Button, List, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { querySocialBindings, startSocialBinding } from '../service';
import type { SocialBindingProvider } from '../data';

const iconMap: Record<SocialBindingProvider, React.ReactNode> = {
  github: <GithubOutlined />,
  weixin: <WechatOutlined />,
};

const BindingView: React.FC = () => {
  const { data, error, isLoading } = useQuery({
    queryKey: ['social-bindings'],
    queryFn: querySocialBindings,
  });

  if (isLoading) {
    return <Spin />;
  }

  if (error) {
    return <Alert title="账号绑定状态加载失败，请刷新重试" type="error" showIcon />;
  }

  return (
    <List
      itemLayout="horizontal"
      dataSource={data?.items || []}
      renderItem={(item) => {
        const description = item.connected
          ? `当前已绑定${item.label}账号`
          : `当前未绑定 ${item.label} 账号`;
        const actions = item.connected
          ? [<span key={`${item.provider}-connected`}>已绑定</span>]
          : [
              <Button key={`${item.provider}-bind`} type="link" onClick={() => startSocialBinding(item.provider)}>
                {`绑定${item.label}`}
              </Button>,
            ];

        return (
          <List.Item actions={actions}>
            <List.Item.Meta avatar={iconMap[item.provider]} title={item.label} description={description} />
          </List.Item>
        );
      }}
    />
  );
};

export default BindingView;
