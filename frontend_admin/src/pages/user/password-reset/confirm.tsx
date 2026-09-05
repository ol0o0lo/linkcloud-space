import { Link, useParams } from '@umijs/max';
import { Alert, Button, Form, Input, Result, Space, Typography } from 'antd';
import React, { useState } from 'react';
import {
  getPublicAuthErrorMessage,
  resetPublicPassword,
} from '@/services/manual/publicAuth';

type PasswordValues = {
  password: string;
  confirmPassword: string;
};

const PasswordResetConfirmPage: React.FC = () => {
  const { key = '' } = useParams<{ key: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  const submit = async ({ password }: PasswordValues) => {
    setSubmitting(true);
    setError('');
    try {
      await resetPublicPassword(key, password);
      setCompleted(true);
    } catch (requestError) {
      setError(
        getPublicAuthErrorMessage(
          requestError,
          '重置链接无效或已过期，请重新申请。',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <Result
        status="success"
        title="密码已更新"
        extra={<Link to="/user/login">返回登录</Link>}
      />
    );
  }

  return (
    <div
      style={{ width: 'min(420px, calc(100vw - 32px))', margin: '64px auto' }}
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Typography.Title level={2}>设置新密码</Typography.Title>
        {error ? <Alert showIcon type="error" title={error} /> : null}
        <Form<PasswordValues> layout="vertical" onFinish={submit}>
          <Form.Item
            label="新密码"
            name="password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password size="large" placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('password') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password size="large" placeholder="请确认新密码" />
          </Form.Item>
          <Button
            block
            size="large"
            type="primary"
            htmlType="submit"
            loading={submitting}
          >
            更新密码
          </Button>
        </Form>
      </Space>
    </div>
  );
};

export default PasswordResetConfirmPage;
