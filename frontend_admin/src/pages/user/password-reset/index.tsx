import { Link, useSearchParams } from '@umijs/max';
import { Alert, Button, Form, Input, Space, Typography } from 'antd';
import React, { useState } from 'react';
import {
  getPublicAuthErrorMessage,
  requestPublicPasswordReset,
} from '@/services/manual/publicAuth';
import { buildAuthRedirectPath, LOGIN_PATH } from '@/utils/adminRouting';
import { normalizeEmailLikeInput } from '@/utils/email';

const PasswordResetPage: React.FC = () => {
  const [params] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async ({ email }: { email: string }) => {
    setSubmitting(true);
    setError('');
    try {
      await requestPublicPasswordReset(email);
      setSent(true);
    } catch (requestError) {
      setError(
        getPublicAuthErrorMessage(
          requestError,
          '重置邮件发送失败，请稍后重试。',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{ width: 'min(420px, calc(100vw - 32px))', margin: '64px auto' }}
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Typography.Title level={2}>重置密码</Typography.Title>
          <Typography.Text type="secondary">
            输入注册邮箱，我们会发送一次性重置链接。
          </Typography.Text>
        </div>
        {sent ? (
          <Alert
            showIcon
            type="success"
            title="重置邮件已发送"
            description="请检查收件箱和垃圾邮件，并在链接失效前完成重置。"
          />
        ) : null}
        {error ? <Alert showIcon type="error" title={error} /> : null}
        <Form layout="vertical" onFinish={submit}>
          <Form.Item
            label="注册邮箱"
            name="email"
            normalize={normalizeEmailLikeInput}
            rules={[
              { required: true, message: '请输入注册邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input size="large" placeholder="请输入注册邮箱" />
          </Form.Item>
          <Button
            block
            size="large"
            type="primary"
            htmlType="submit"
            loading={submitting}
          >
            发送重置邮件
          </Button>
        </Form>
        <Link to={buildAuthRedirectPath(LOGIN_PATH, params.get('redirect'))}>
          返回登录
        </Link>
      </Space>
    </div>
  );
};

export default PasswordResetPage;
