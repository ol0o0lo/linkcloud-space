import {
  CheckCircleOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Alert, Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd';
import React from 'react';

const { Paragraph, Text, Title } = Typography;

const Welcome: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const isAdmin = currentUser?.access === 'admin';

  return (
    <PageContainer
      title="后台工作台"
      content="LinkCloud Space 已接入 Django 后端会话，当前页面展示真实登录用户信息。"
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="success"
          showIcon
          message="后端连接正常"
          description="登录、退出、当前用户和基础路由鉴权已经通过 Django session 工作。"
        />

        <Card>
          <Space direction="vertical" size={8}>
            <Title level={4} style={{ margin: 0 }}>
              {currentUser?.name || currentUser?.userid || '当前用户'}
            </Title>
            <Paragraph style={{ margin: 0 }}>
              <Text type="secondary">{currentUser?.email || '未设置邮箱'}</Text>
            </Paragraph>
            <Space wrap>
              <Tag icon={<SafetyCertificateOutlined />} color={isAdmin ? 'blue' : 'default'}>
                {isAdmin ? '管理员' : '普通用户'}
              </Tag>
              <Tag icon={<CheckCircleOutlined />} color="success">
                已登录
              </Tag>
            </Space>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="登录标识"
                value={currentUser?.userid || '-'}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="权限级别"
                value={isAdmin ? 'admin' : 'user'}
                prefix={<IdcardOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="未读通知"
                value={currentUser?.unreadCount ?? 0}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      </Space>
    </PageContainer>
  );
};

export default Welcome;
