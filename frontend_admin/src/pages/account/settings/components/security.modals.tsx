import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Form,
  Input,
  List,
  Modal,
  message,
  QRCode,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import type { CurrentUser } from '../data';
import {
  activateTotp,
  addAccountEmail,
  confirmPhoneChange,
  deleteAuthenticator,
  getRecoveryCodes,
  getTotpSetup,
  listAccountEmails,
  listAuthenticators,
  reauthenticate,
  removeAccountEmail,
  requestPhoneChangeCode,
  setPrimaryAccountEmail,
  updatePassword,
} from '../service';
import type {
  AccountEmail,
  AuthenticatorSummary,
  SecurityAction,
  TotpSetup,
} from './security.types';
import { getAuthenticatorLabel } from './security.utils';
import { normalizeEmailLikeInput } from '@/utils/email';
import { getAccountPhoneValidationError } from '@/utils/phone';

const COUNTRY_CODES = [
  { value: '+86', label: '+86 (中国)' },
  { value: '+852', label: '+852 (香港)' },
  { value: '+853', label: '+853 (澳门)' },
  { value: '+886', label: '+886 (台湾)' },
  { value: '+1', label: '+1 (美国)' },
  { value: '+81', label: '+81 (日本)' },
  { value: '+82', label: '+82 (韩国)' },
  { value: '+65', label: '+65 (新加坡)' },
  { value: '+60', label: '+60 (马来西亚)' },
  { value: '+44', label: '+44 (英国)' },
];

type SecurityModalsProps = {
  activeModal: SecurityAction | null;
  currentUser?: CurrentUser;
  onClose: () => void;
};

function getErrorMessage(error: any, fallback: string) {
  const detail =
    error?.response?.data?.errors?.[0] || error?.data?.errors?.[0] || null;
  if (detail?.code === 'incorrect_code') {
    return '验证码不正确，请确认扫描的是当前二维码，并检查验证器时间是否已自动同步。';
  }
  return (
    detail?.message ||
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function hasReauthenticateFlow(error: any) {
  const flows =
    error?.response?.data?.flows ||
    error?.response?.data?.data?.flows ||
    error?.data?.flows ||
    error?.data?.data?.flows ||
    [];
  return Array.isArray(flows)
    ? flows.some((flow: any) => flow.id === 'reauthenticate')
    : false;
}

export const SecurityModals: React.FC<SecurityModalsProps> = ({
  activeModal,
  currentUser,
  onClose,
}) => {
  const queryClient = useQueryClient();

  const handleSuccess = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['current-user'] }),
      queryClient.invalidateQueries({ queryKey: ['security-authenticators'] }),
    ]);
  };

  return (
    <>
      <PasswordChangeModal
        open={activeModal === 'password'}
        onClose={onClose}
      />
      <PhoneChangeModal
        open={activeModal === 'phone'}
        onClose={onClose}
        onSuccess={handleSuccess}
      />
      <EmailChangeModal
        open={activeModal === 'email'}
        currentEmail={currentUser?.email}
        onClose={onClose}
        onSuccess={handleSuccess}
      />
      <MfaManageModal
        open={activeModal === 'mfa'}
        onClose={onClose}
        onSuccess={handleSuccess}
      />
    </>
  );
};

type PasswordChangeModalProps = {
  open: boolean;
  onClose: () => void;
};

const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
  open,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [errorMessage, setErrorMessage] = useState('');
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (values: {
      currentPassword: string;
      newPassword: string;
    }) => updatePassword(values.currentPassword, values.newPassword),
  });

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setErrorMessage('');
    }
  }, [form, open]);

  return (
    <Modal
      open={open}
      title="修改密码"
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          setErrorMessage('');
          try {
            await mutateAsync(values);
            message.success('密码已更新');
            onClose();
          } catch (error) {
            setErrorMessage(getErrorMessage(error, '密码更新失败，请稍后重试'));
          }
        }}
      >
        {errorMessage ? (
          <Alert
            style={{ marginBottom: 16 }}
            type="error"
            showIcon
            title={errorMessage}
          />
        ) : null}
        <Form.Item
          label="当前密码"
          name="currentPassword"
          rules={[{ required: true, message: '请输入当前密码' }]}
        >
          <Input.Password />
        </Form.Item>
        <Form.Item
          label="新密码"
          name="newPassword"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '新密码至少 8 位' },
          ]}
        >
          <Input.Password />
        </Form.Item>
        <Form.Item
          label="确认新密码"
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || value === getFieldValue('newPassword')) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的新密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>
        <Button htmlType="submit" type="primary" loading={isPending}>
          确认修改密码
        </Button>
      </Form>
    </Modal>
  );
};

type PhoneChangeModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
};

const PhoneChangeModal: React.FC<PhoneChangeModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [errorMessage, setErrorMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setCooldown((previous) => Math.max(previous - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setErrorMessage('');
      setCooldown(0);
    }
  }, [form, open]);

  return (
    <Modal
      open={open}
      title="修改手机号"
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          setErrorMessage('');
          setSubmitting(true);
          try {
            await confirmPhoneChange(values.code);
            await onSuccess();
            message.success('手机号已更新');
            onClose();
          } catch (error) {
            setErrorMessage(
              getErrorMessage(error, '手机号验证失败，请稍后重试'),
            );
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {errorMessage ? (
          <Alert
            style={{ marginBottom: 16 }}
            type="error"
            showIcon
            title={errorMessage}
          />
        ) : null}
        <Form.Item label="新手机号" required>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              noStyle
              name="countryCode"
              initialValue="+86"
              rules={[{ required: true, message: '请选择国家区号' }]}
            >
              <Select
                showSearch
                style={{ width: 140 }}
                options={COUNTRY_CODES}
                placeholder="区号"
              />
            </Form.Item>
            <Form.Item
              noStyle
              name="nationalNumber"
              dependencies={['countryCode']}
              rules={[
                { required: true, message: '请输入手机号' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const error = getAccountPhoneValidationError(
                      getFieldValue('countryCode'),
                      value,
                    );
                    return error
                      ? Promise.reject(new Error(error))
                      : Promise.resolve();
                  },
                }),
              ]}
            >
              <Input
                style={{ flex: 1 }}
                placeholder="请输入手机号"
                inputMode="tel"
                autoComplete="tel-national"
              />
            </Form.Item>
          </Space.Compact>
        </Form.Item>
        <Form.Item
          label="验证码"
          name="code"
          rules={[{ required: true, message: '请输入验证码' }]}
        >
          <Input />
        </Form.Item>
        <Space>
          <Button
            onClick={async () => {
              setErrorMessage('');
              setSendingCode(true);
              try {
                const { countryCode, nationalNumber } =
                  await form.validateFields(['countryCode', 'nationalNumber']);
                await requestPhoneChangeCode(countryCode, nationalNumber);
                setCooldown(60);
                message.success('验证码已发送');
              } catch (error: any) {
                if (error?.errorFields) {
                  return;
                }
                setErrorMessage(
                  getErrorMessage(error, '验证码发送失败，请稍后重试'),
                );
              } finally {
                setSendingCode(false);
              }
            }}
            loading={sendingCode}
            disabled={cooldown > 0}
          >
            {cooldown > 0 ? `${cooldown}s 后重试` : '发送验证码'}
          </Button>
          <Button htmlType="submit" type="primary" loading={submitting}>
            确认修改手机号
          </Button>
        </Space>
      </Form>
    </Modal>
  );
};

type EmailChangeModalProps = {
  open: boolean;
  currentEmail?: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
};

const EmailChangeModal: React.FC<EmailChangeModalProps> = ({
  open,
  currentEmail,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [errorMessage, setErrorMessage] = useState('');
  const [emails, setEmails] = useState<AccountEmail[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshEmails = async () => {
    const emails = await listAccountEmails();
    setEmails(emails);
  };

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setErrorMessage('');
      setEmails([]);
      return;
    }

    setLoading(true);
    refreshEmails()
      .catch((error) =>
        setErrorMessage(getErrorMessage(error, '邮箱列表加载失败')),
      )
      .finally(() => setLoading(false));
  }, [form, open]);

  return (
    <Modal
      open={open}
      title="修改邮箱"
      width={660}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
        <Alert
          type="info"
          showIcon
          title={`当前主邮箱：${currentEmail || '未绑定邮箱'}`}
        />
        {errorMessage ? (
          <Alert type="error" showIcon title={errorMessage} />
        ) : null}
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            setErrorMessage('');
            try {
              await addAccountEmail(values.email);
              await refreshEmails();
              await onSuccess();
              message.success('验证邮件已发送，请完成验证后再设为主邮箱');
              form.resetFields();
            } catch (error) {
              setErrorMessage(
                getErrorMessage(error, '邮箱添加失败，请稍后重试'),
              );
            }
          }}
        >
          <Form.Item
            label="新邮箱"
            name="email"
            normalize={normalizeEmailLikeInput}
            rules={[
              { required: true, message: '请输入新邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input />
          </Form.Item>
          <Button htmlType="submit" type="primary">
            发送验证邮件
          </Button>
        </Form>
        <List
          bordered
          loading={loading}
          dataSource={emails}
          locale={{ emptyText: '暂无邮箱记录' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                item.primary ? (
                  <Tag color="blue" key={`${item.email}-primary`}>
                    主邮箱
                  </Tag>
                ) : item.verified ? (
                  <Button
                    key={`${item.email}-primary`}
                    type="link"
                    onClick={async () => {
                      setErrorMessage('');
                      try {
                        await setPrimaryAccountEmail(item.email);
                        await refreshEmails();
                        await onSuccess();
                        message.success('主邮箱已更新');
                      } catch (error) {
                        setErrorMessage(
                          getErrorMessage(error, '设置主邮箱失败'),
                        );
                      }
                    }}
                  >
                    设为主邮箱
                  </Button>
                ) : (
                  <Tag color="orange" key={`${item.email}-pending`}>
                    待验证
                  </Tag>
                ),
                !item.primary ? (
                  <Button
                    key={`${item.email}-delete`}
                    danger
                    type="link"
                    style={{ marginLeft: 8 }}
                    onClick={async () => {
                      setErrorMessage('');
                      try {
                        await removeAccountEmail(item.email);
                        await refreshEmails();
                        await onSuccess();
                        message.success('邮箱已删除');
                      } catch (error) {
                        setErrorMessage(getErrorMessage(error, '删除邮箱失败'));
                      }
                    }}
                  >
                    删除
                  </Button>
                ) : (
                  <Button
                    key={`${item.email}-delete`}
                    danger
                    type="link"
                    disabled
                    style={{ marginLeft: 8 }}
                    onClick={() => {
                      message.info(
                        '主邮箱无法删除，请先将其他邮箱设为主邮箱后再删除',
                      );
                    }}
                  >
                    删除
                  </Button>
                ),
              ]}
            >
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <Space>
                  <Typography.Text>{item.email}</Typography.Text>
                  {item.verified ? (
                    <Tag color="green">已验证</Tag>
                  ) : (
                    <Tag>未验证</Tag>
                  )}
                </Space>
              </div>
            </List.Item>
          )}
        />
      </Space>
    </Modal>
  );
};

type MfaManageModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
};

const MfaManageModal: React.FC<MfaManageModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [authenticators, setAuthenticators] = useState<AuthenticatorSummary[]>(
    [],
  );
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [startingTotp, setStartingTotp] = useState(false);
  const [bindingTotp, setBindingTotp] = useState(false);
  const [totpStep, setTotpStep] = useState<0 | 1>(0);
  const [removingType, setRemovingType] = useState<string | null>(null);
  const [pendingTotpCode, setPendingTotpCode] = useState<string | null>(null);
  const [reauthVisible, setReauthVisible] = useState(false);
  const [recoveryCodesVisible, setRecoveryCodesVisible] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [reauthForm] = Form.useForm();
  const [reauthSubmitting, setReauthSubmitting] = useState(false);

  const refreshAuthenticators = async () => {
    const authenticators = await listAuthenticators();
    setAuthenticators(authenticators);
  };

  const hasTotp = authenticators.some((item) => item.type === 'totp');
  const hasRecoveryCodes = authenticators.some(
    (item) => item.type === 'recovery_codes',
  );
  const showSetupPanel = !hasTotp || Boolean(totpSetup);

  const removeAuthenticatorGroup = async (type: string) => {
    setRemovingType(type);
    try {
      await deleteAuthenticator(type);
      if (type === 'totp' && hasRecoveryCodes) {
        await deleteAuthenticator('recovery_codes');
      }
      await refreshAuthenticators();
      await onSuccess();
      message.success(
        type === 'totp' ? 'TOTP 与恢复码已移除' : 'MFA 设备已移除',
      );
    } finally {
      setRemovingType(null);
    }
  };

  useEffect(() => {
    if (!open) {
      setAuthenticators([]);
      setTotpSetup(null);
      setErrorMessage('');
      setTotpStep(0);
      setRecoveryCodesVisible(false);
      setRecoveryCodes([]);
      return;
    }

    setLoading(true);
    refreshAuthenticators()
      .catch((error) =>
        setErrorMessage(getErrorMessage(error, 'MFA 状态加载失败')),
      )
      .finally(() => setLoading(false));
  }, [open]);

  const openRecoveryCodesModal = async () => {
    const codes = await getRecoveryCodes();
    setRecoveryCodes(codes);
    setRecoveryCodesVisible(true);
  };

  const completeTotpActivation = async () => {
    await refreshAuthenticators();
    await onSuccess();
    setTotpSetup(null);
    setTotpStep(0);
    await openRecoveryCodesModal();
    message.success('TOTP 已启用');
  };

  return (
    <Modal
      open={open}
      title="MFA 设备"
      width={640}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
        {errorMessage ? (
          <Alert type="error" showIcon title={errorMessage} />
        ) : null}
        {showSetupPanel ? (
          <Space orientation="vertical" size={12} style={{ display: 'flex' }}>
            <div
              style={{
                padding: 20,
                border: '1px solid var(--ant-color-border-secondary)',
                borderRadius: 16,
                background: 'var(--ant-color-fill-quaternary)',
              }}
            >
              <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
                <div>
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    {hasTotp ? '重新配置 TOTP' : '绑定身份验证器'}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    推荐使用 Google Authenticator、Microsoft Authenticator 或
                    1Password 等验证器应用。
                  </Typography.Text>
                </div>
                {!totpSetup ? (
                  <Space
                    orientation="vertical"
                    size={12}
                    style={{ display: 'flex' }}
                  >
                    <Button
                      type="primary"
                      onClick={async () => {
                        setErrorMessage('');
                        setStartingTotp(true);
                        try {
                          setTotpSetup(await getTotpSetup());
                          setTotpStep(0);
                        } catch (error) {
                          setErrorMessage(
                            getErrorMessage(error, 'TOTP 初始化失败'),
                          );
                        } finally {
                          setStartingTotp(false);
                        }
                      }}
                      loading={startingTotp}
                    >
                      开始绑定 TOTP
                    </Button>
                  </Space>
                ) : (
                  <Space
                    orientation="vertical"
                    size={16}
                    style={{ display: 'flex' }}
                  >
                    {totpStep === 0 ? (
                      <Space
                        orientation="vertical"
                        size={16}
                        style={{ display: 'flex' }}
                      >
                        <div
                          style={{
                            padding: 20,
                            borderRadius: 12,
                            background: 'var(--ant-color-bg-container)',
                            border:
                              '1px solid var(--ant-color-border-secondary)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <Typography.Text
                            strong
                            style={{ alignSelf: 'flex-start' }}
                          >
                            第 1 步：扫码或录入密钥
                          </Typography.Text>
                          <QRCode
                            value={totpSetup.totpUrl || 'otpauth://invalid'}
                          />
                          <Typography.Paragraph
                            type="secondary"
                            style={{
                              margin: 0,
                              textAlign: 'center',
                              maxWidth: 320,
                            }}
                          >
                            打开验证器应用，扫描二维码完成添加
                          </Typography.Paragraph>
                        </div>
                        <Alert
                          type="warning"
                          showIcon
                          title="如果无法扫码，可以复制下方密钥手动添加；请务必使用当前页面展示的最新密钥。"
                        />
                        <div
                          style={{
                            padding: 16,
                            borderRadius: 12,
                            background: 'var(--ant-color-bg-container)',
                            border:
                              '1px solid var(--ant-color-border-secondary)',
                          }}
                        >
                          <Typography.Text strong>手动录入密钥</Typography.Text>
                          <Typography.Paragraph
                            copyable
                            style={{
                              marginBottom: 0,
                              marginTop: 8,
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 18,
                              letterSpacing: 0.5,
                              wordBreak: 'break-all',
                            }}
                          >
                            {totpSetup.secret}
                          </Typography.Paragraph>
                        </div>
                        <Typography.Text type="secondary">
                          完成添加后，输入验证器当前显示的 6
                          位动态验证码以确认绑定。
                        </Typography.Text>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <Button type="primary" onClick={() => setTotpStep(1)}>
                            我已完成添加，下一步
                          </Button>
                        </div>
                      </Space>
                    ) : (
                      <div
                        style={{
                          padding: 20,
                          borderRadius: 12,
                          background: 'var(--ant-color-bg-container)',
                          border: '1px solid var(--ant-color-border-secondary)',
                        }}
                      >
                        <Typography.Text strong>
                          第 2 步：输入验证码
                        </Typography.Text>
                        <Form
                          layout="vertical"
                          style={{ marginTop: 16 }}
                          onFinish={async (values) => {
                            const code = String(values.code || '').replace(
                              /\s+/g,
                              '',
                            );
                            setErrorMessage('');
                            setBindingTotp(true);
                            try {
                              await activateTotp(code);
                              await completeTotpActivation();
                            } catch (error) {
                              const isReauthRequired =
                                hasReauthenticateFlow(error);
                              if (isReauthRequired) {
                                setPendingTotpCode(code);
                                setReauthVisible(true);
                              } else {
                                setErrorMessage(
                                  getErrorMessage(error, 'TOTP 绑定失败'),
                                );
                              }
                            } finally {
                              setBindingTotp(false);
                            }
                          }}
                        >
                          <Form.Item
                            label="6 位验证码"
                            name="code"
                            extra="如果连续失败，请检查手机系统时间是否开启自动同步。"
                            rules={[
                              { required: true, message: '请输入 6 位验证码' },
                              {
                                pattern: /^\d{6}$/,
                                message: '验证码应为 6 位数字',
                              },
                            ]}
                          >
                            <Input
                              inputMode="numeric"
                              maxLength={6}
                              autoComplete="one-time-code"
                              placeholder="请输入验证器当前显示的 6 位数字"
                            />
                          </Form.Item>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Button onClick={() => setTotpStep(0)}>
                              返回上一步
                            </Button>
                            <Button
                              htmlType="submit"
                              type="primary"
                              loading={bindingTotp}
                            >
                              确认绑定 TOTP
                            </Button>
                          </div>
                        </Form>
                      </div>
                    )}
                  </Space>
                )}
              </Space>
            </div>
          </Space>
        ) : null}
        {hasRecoveryCodes ? (
          <Alert type="success" showIcon title="系统已为当前账户生成恢复码" />
        ) : null}
        {!totpSetup ? (
          <>
            <Typography.Text strong>已绑定的 MFA 设备</Typography.Text>
            <List
              bordered
              loading={loading}
              dataSource={authenticators}
              locale={{ emptyText: '当前未启用 MFA 设备' }}
              renderItem={(item) => (
                <List.Item
                  actions={
                    item.type === 'totp'
                      ? [
                          <Button
                            key={`${item.type}-delete`}
                            danger
                            type="link"
                            loading={removingType === item.type}
                            onClick={async () => {
                              setErrorMessage('');
                              try {
                                await removeAuthenticatorGroup(item.type);
                              } catch (error) {
                                setErrorMessage(
                                  getErrorMessage(error, '移除 MFA 设备失败'),
                                );
                              }
                            }}
                          >
                            移除
                          </Button>,
                        ]
                      : []
                  }
                >
                  <Space>
                    <Typography.Text>
                      {getAuthenticatorLabel(item.type)}
                    </Typography.Text>
                    {item.type === 'totp' ? <Tag color="blue">TOTP</Tag> : null}
                    {item.type === 'recovery_codes' ? (
                      <Tag color="green">恢复码已生成</Tag>
                    ) : null}
                    {item.type === 'webauthn' ? (
                      <Tag color="gold">暂不支持在此管理</Tag>
                    ) : null}
                  </Space>
                </List.Item>
              )}
            />
          </>
        ) : null}
      </Space>
      <Modal
        open={reauthVisible}
        title="身份验证"
        onCancel={() => {
          setReauthVisible(false);
          setPendingTotpCode(null);
          reauthForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="绑定 TOTP 需要重新验证身份，请输入密码后继续"
        />
        <Form
          form={reauthForm}
          layout="vertical"
          onFinish={async (values) => {
            setErrorMessage('');
            setReauthSubmitting(true);
            try {
              await reauthenticate(values.password);
              setReauthVisible(false);
              reauthForm.resetFields();
              if (pendingTotpCode) {
                setBindingTotp(true);
                try {
                  await activateTotp(pendingTotpCode);
                  await completeTotpActivation();
                } catch (retryError) {
                  setErrorMessage(getErrorMessage(retryError, 'TOTP 绑定失败'));
                } finally {
                  setBindingTotp(false);
                  setPendingTotpCode(null);
                }
              }
            } catch (error) {
              setErrorMessage(getErrorMessage(error, '身份验证失败'));
            } finally {
              setReauthSubmitting(false);
            }
          }}
        >
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password />
          </Form.Item>
          <Button htmlType="submit" type="primary" loading={reauthSubmitting}>
            确认
          </Button>
        </Form>
      </Modal>
      <Modal
        open={recoveryCodesVisible}
        title="请保存恢复码"
        width={560}
        onCancel={() => setRecoveryCodesVisible(false)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setRecoveryCodesVisible(false)}
          >
            我已保存
          </Button>,
        ]}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title="每个恢复码只显示一次。请复制或下载，并离线妥善保存。"
        />
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: 'var(--ant-color-fill-quaternary)',
            border: '1px solid var(--ant-color-border-secondary)',
            marginBottom: 12,
          }}
        >
          <Space orientation="vertical" size={4} style={{ display: 'flex' }}>
            <Typography.Text strong>
              已生成 {recoveryCodes.length} 条恢复码，请立即复制或下载保存。
            </Typography.Text>
            <Typography.Text type="secondary">
              无法使用验证器 App 时，可用任意一条恢复码替代 6 位动态验证码，每条仅可使用一次。
            </Typography.Text>
          </Space>
        </div>
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: 'var(--ant-color-bg-container)',
            border: '1px solid var(--ant-color-border-secondary)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
              gap: 8,
            }}
          >
            {recoveryCodes.map((code) => (
              <div
                key={code}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--ant-color-fill-quaternary)',
                  border: '1px solid var(--ant-color-border-secondary)',
                  lineHeight: 1.4,
                }}
              >
                <Typography.Text
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 16,
                    wordBreak: 'break-all',
                  }}
                >
                  {code}
                </Typography.Text>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginTop: 12,
          }}
        >
          <Space wrap>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(recoveryCodes.join('\n'));
                message.success('恢复码已复制');
              }}
            >
              复制恢复码
            </Button>
            <Button
              onClick={() => {
                const blob = new Blob([recoveryCodes.join('\n')], {
                  type: 'text/plain;charset=utf-8',
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'recovery-codes.txt';
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              下载文本
            </Button>
          </Space>
        </div>
      </Modal>
    </Modal>
  );
};
