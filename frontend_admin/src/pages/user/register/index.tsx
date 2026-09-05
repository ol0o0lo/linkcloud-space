import { history, Link, useSearchParams } from '@umijs/max';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Select,
  Space,
  Typography,
} from 'antd';
import React, { useState } from 'react';
import {
  getPendingPublicAuthFlow,
  getPublicAuthErrorMessage,
  signupPublicAccount,
} from '@/services/manual/publicAuth';
import {
  buildAuthRedirectPath,
  getSafeAdminRedirect,
  LOGIN_PATH,
  VERIFY_PHONE_PATH,
} from '@/utils/adminRouting';
import { normalizeEmailLikeInput } from '@/utils/email';

type RegisterValues = {
  email: string;
  password: string;
  confirmPassword: string;
  phoneCountryCode: string;
  phoneNationalNumber: string;
  inviteCode?: string;
  acceptedTerms: boolean;
};

const RegisterPage: React.FC = () => {
  const [params] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const queryInviteCode = (params.get('invite_code') || '')
    .trim()
    .toUpperCase();
  const referralSource =
    params.get('referral_source') === 'link' ? 'link' : 'code';
  const requestedRedirect = params.get('redirect');
  const redirect = getSafeAdminRedirect(requestedRedirect, '/');

  const submit = async (values: RegisterValues) => {
    setSubmitting(true);
    setError('');
    const phoneCountryCode = values.phoneCountryCode || '+86';
    const phoneNationalNumber = values.phoneNationalNumber.trim();
    try {
      await signupPublicAccount({
        email: values.email,
        phoneCountryCode,
        phoneNationalNumber,
        password: values.password,
        inviteCode: values.inviteCode,
        referralSource,
      });
      history.replace(redirect);
    } catch (requestError) {
      if (getPendingPublicAuthFlow(requestError) === 'verify_phone') {
        const nextParams = new URLSearchParams({
          phone: `${phoneCountryCode}${phoneNationalNumber}`,
          redirect,
        });
        history.push(`${VERIFY_PHONE_PATH}?${nextParams.toString()}`);
        return;
      }
      setError(
        getPublicAuthErrorMessage(requestError, '注册失败，请稍后重试。'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        width: 'min(420px, calc(100vw - 32px))',
        margin: '40px auto',
      }}
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Typography.Title level={2}>创建账号</Typography.Title>
          <Typography.Text type="secondary">
            注册后需要完成手机验证，才能进入管理端。
          </Typography.Text>
        </div>
        {queryInviteCode ? (
          <Alert
            showIcon
            type="info"
            title={`已应用邀请码 ${queryInviteCode}`}
          />
        ) : null}
        {error ? <Alert showIcon type="error" title={error} /> : null}
        <Form<RegisterValues>
          layout="vertical"
          initialValues={{
            phoneCountryCode: '+86',
            inviteCode: queryInviteCode,
            acceptedTerms: false,
          }}
          onFinish={submit}
        >
          <Form.Item
            label="邮箱"
            name="email"
            normalize={normalizeEmailLikeInput}
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input size="large" autoComplete="email" placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item label="手机号" required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="phoneCountryCode" noStyle>
                <Select
                  size="large"
                  style={{ width: 112 }}
                  options={[{ label: '中国 +86', value: '+86' }]}
                />
              </Form.Item>
              <Form.Item
                name="phoneNationalNumber"
                noStyle
                rules={[
                  { required: true, message: '请输入手机号' },
                  {
                    pattern: /^1\d{10}$/,
                    message: '请输入 11 位中国大陆手机号',
                  },
                ]}
              >
                <Input
                  size="large"
                  autoComplete="tel-national"
                  placeholder="请输入手机号"
                />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password
              size="large"
              autoComplete="new-password"
              placeholder="请输入密码"
            />
          </Form.Item>
          <Form.Item
            label="确认密码"
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
            <Input.Password
              size="large"
              autoComplete="new-password"
              placeholder="请确认密码"
            />
          </Form.Item>
          <Form.Item label="邀请码（选填）" name="inviteCode">
            <Input size="large" placeholder="请输入邀请码" />
          </Form.Item>
          <Form.Item
            name="acceptedTerms"
            valuePropName="checked"
            rules={[
              {
                validator: (_, checked) =>
                  checked
                    ? Promise.resolve()
                    : Promise.reject(new Error('请确认同意服务条款和隐私政策')),
              },
            ]}
          >
            <Checkbox>我已阅读并同意服务条款和隐私政策</Checkbox>
          </Form.Item>
          <Button
            block
            size="large"
            type="primary"
            htmlType="submit"
            loading={submitting}
          >
            创建账号
          </Button>
        </Form>
        <Typography.Text>
          已有账号？{' '}
          <Link to={buildAuthRedirectPath(LOGIN_PATH, requestedRedirect)}>
            返回登录
          </Link>
        </Typography.Text>
      </Space>
    </div>
  );
};

export default RegisterPage;
