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
  getTotpSetup,
  listAccountEmails,
  listAuthenticators,
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

type SecurityModalsProps = {
  activeModal: SecurityAction | null;
  currentUser?: CurrentUser;
  onClose: () => void;
};

function getErrorMessage(error: any, fallback: string) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
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
            message={errorMessage}
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
            message={errorMessage}
          />
        ) : null}
        <Form.Item
          label="新手机号"
          name="phone"
          rules={[{ required: true, message: '请输入新手机号' }]}
        >
          <Input />
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
                const { phone } = await form.validateFields(['phone']);
                await requestPhoneChangeCode(phone);
                setCooldown(60);
                message.success('验证码已发送');
              } catch (error) {
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
    const response = await listAccountEmails();
    setEmails(response.data || []);
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
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        <Alert
          type="info"
          showIcon
          message={`当前主邮箱：${currentEmail || '未绑定邮箱'}`}
        />
        {errorMessage ? (
          <Alert type="error" showIcon message={errorMessage} />
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
              ]}
            >
              <Space>
                <Typography.Text>{item.email}</Typography.Text>
                {item.verified ? (
                  <Tag color="green">已验证</Tag>
                ) : (
                  <Tag>未验证</Tag>
                )}
              </Space>
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
  const [removingType, setRemovingType] = useState<string | null>(null);

  const refreshAuthenticators = async () => {
    const response = await listAuthenticators();
    setAuthenticators(response.data || []);
  };

  const hasTotp = authenticators.some((item) => item.type === 'totp');
  const hasRecoveryCodes = authenticators.some(
    (item) => item.type === 'recovery_codes',
  );

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
      return;
    }

    setLoading(true);
    refreshAuthenticators()
      .catch((error) =>
        setErrorMessage(getErrorMessage(error, 'MFA 状态加载失败')),
      )
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Modal
      open={open}
      title="MFA 设备"
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        {errorMessage ? (
          <Alert type="error" showIcon message={errorMessage} />
        ) : null}
        {!hasTotp ? (
          <Button
            onClick={async () => {
              setErrorMessage('');
              setStartingTotp(true);
              try {
                setTotpSetup(await getTotpSetup());
              } catch (error) {
                setErrorMessage(getErrorMessage(error, 'TOTP 初始化失败'));
              } finally {
                setStartingTotp(false);
              }
            }}
            loading={startingTotp}
          >
            开始绑定 TOTP
          </Button>
        ) : null}
        {totpSetup ? (
          <Space direction="vertical" size={12} style={{ display: 'flex' }}>
            <QRCode value={totpSetup.totpUrl || 'otpauth://invalid'} />
            <Typography.Paragraph copyable>
              {totpSetup.secret}
            </Typography.Paragraph>
            <Form
              layout="vertical"
              onFinish={async (values) => {
                setErrorMessage('');
                setBindingTotp(true);
                try {
                  await activateTotp(values.code);
                  await refreshAuthenticators();
                  await onSuccess();
                  setTotpSetup(null);
                  message.success('TOTP 已启用');
                } catch (error) {
                  setErrorMessage(getErrorMessage(error, 'TOTP 绑定失败'));
                } finally {
                  setBindingTotp(false);
                }
              }}
            >
              <Form.Item
                label="6 位验证码"
                name="code"
                rules={[{ required: true, message: '请输入 6 位验证码' }]}
              >
                <Input />
              </Form.Item>
              <Button htmlType="submit" type="primary" loading={bindingTotp}>
                确认绑定 TOTP
              </Button>
            </Form>
          </Space>
        ) : null}
        {hasRecoveryCodes ? (
          <Alert type="success" showIcon message="系统已为当前账户生成恢复码" />
        ) : null}
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
      </Space>
    </Modal>
  );
};
