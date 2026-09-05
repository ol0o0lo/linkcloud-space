import { history, Link, useSearchParams } from '@umijs/max';
import { Alert, Button, Form, Input, Space, Typography } from 'antd';
import React, { useState } from 'react';
import {
  getPublicAuthErrorMessage,
  resendPublicPhoneCode,
  verifyPublicPhone,
} from '@/services/manual/publicAuth';
import {
  buildAuthRedirectPath,
  getSafeAdminRedirect,
  LOGIN_PATH,
} from '@/utils/adminRouting';

const VerifyPhonePage: React.FC = () => {
  const [params] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const phone = params.get('phone') || '当前手机号';
  const requestedRedirect = params.get('redirect');
  const redirect = getSafeAdminRedirect(requestedRedirect, '/');

  const verify = async ({ code }: { code: string }) => {
    setSubmitting(true);
    setError('');
    try {
      await verifyPublicPhone(code);
      history.replace(redirect);
    } catch (requestError) {
      setError(
        getPublicAuthErrorMessage(requestError, '验证码校验失败，请重新输入。'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError('');
    setNotice('');
    try {
      await resendPublicPhoneCode();
      setNotice('验证码已重新发送');
    } catch (requestError) {
      setError(
        getPublicAuthErrorMessage(requestError, '验证码发送失败，请稍后重试。'),
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      style={{ width: 'min(420px, calc(100vw - 32px))', margin: '64px auto' }}
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Typography.Title level={2}>验证手机号</Typography.Title>
          <Typography.Text type="secondary">
            验证码已发送至 <Typography.Text strong>{phone}</Typography.Text>
          </Typography.Text>
        </div>
        {error ? <Alert showIcon type="error" title={error} /> : null}
        {notice ? <Alert showIcon type="success" title={notice} /> : null}
        <Form layout="vertical" onFinish={verify}>
          <Form.Item
            label="短信验证码"
            name="code"
            rules={[{ required: true, message: '请输入短信验证码' }]}
          >
            <Input
              size="large"
              inputMode="numeric"
              maxLength={8}
              placeholder="请输入短信验证码"
            />
          </Form.Item>
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Button
              block
              size="large"
              type="primary"
              htmlType="submit"
              loading={submitting}
            >
              确认验证
            </Button>
            <Button block onClick={resend} loading={resending}>
              重新发送
            </Button>
          </Space>
        </Form>
        <Link to={buildAuthRedirectPath(LOGIN_PATH, requestedRedirect)}>
          返回登录
        </Link>
      </Space>
    </div>
  );
};

export default VerifyPhonePage;
