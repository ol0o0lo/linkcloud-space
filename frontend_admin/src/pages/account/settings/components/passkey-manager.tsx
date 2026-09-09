import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useRef, useState } from 'react';
import {
  createPasskey,
  deletePasskey,
  reauthenticate,
  reauthenticateWithPasskey,
  renamePasskey,
} from '../service';
import type { AuthenticatorSummary } from './security.types';

type PasskeyManagerProps = {
  authenticators: AuthenticatorSummary[];
  loading: boolean;
  onError: (message: string) => void;
  onRecoveryCodesGenerated: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onSuccess: () => Promise<void>;
};

type PasskeyFormValues = {
  name: string;
};

type PendingAction = {
  run: () => Promise<void>;
  fallback: string;
};

function getPasskeyErrorMessage(error: any, fallback: string) {
  return String(
    error?.response?.data?.errors?.[0]?.message ||
      error?.data?.errors?.[0]?.message ||
      error?.response?.data?.message ||
      error?.data?.message ||
      error?.message ||
      fallback,
  );
}

function requiresReauthentication(error: any) {
  const flows =
    error?.response?.data?.flows ||
    error?.response?.data?.data?.flows ||
    error?.data?.flows ||
    error?.data?.data?.flows ||
    [];
  return Array.isArray(flows)
    ? flows.some((flow) => flow?.id === 'reauthenticate' && flow?.is_pending)
    : false;
}

export const PasskeyManager: React.FC<PasskeyManagerProps> = ({
  authenticators,
  loading,
  onError,
  onRecoveryCodesGenerated,
  onRefresh,
  onSuccess,
}) => {
  const [form] = Form.useForm<PasskeyFormValues>();
  const [reauthForm] = Form.useForm<{ password: string }>();
  const [editing, setEditing] = useState<
    AuthenticatorSummary | 'create' | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [reauthVisible, setReauthVisible] = useState(false);
  const [reauthSubmitting, setReauthSubmitting] = useState(false);
  const [passkeyReauthSubmitting, setPasskeyReauthSubmitting] = useState(false);
  const pendingActionRef = useRef<PendingAction | null>(null);

  const passkeys = authenticators.filter(
    (item): item is AuthenticatorSummary & { id: number } =>
      item.type === 'webauthn' && typeof item.id === 'number',
  );

  const runProtectedAction = async (
    run: () => Promise<void>,
    fallback: string,
  ) => {
    try {
      await run();
    } catch (error) {
      if (requiresReauthentication(error)) {
        pendingActionRef.current = { run, fallback };
        setReauthVisible(true);
        return;
      }
      onError(getPasskeyErrorMessage(error, fallback));
    }
  };

  const finishPasskeyChange = async () => {
    await onRefresh();
    await onSuccess();
  };

  const finishReauthentication = async () => {
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    setReauthVisible(false);
    reauthForm.resetFields();
    if (pendingAction) {
      await runProtectedAction(pendingAction.run, pendingAction.fallback);
    }
  };

  const savePasskey = async ({ name }: PasskeyFormValues) => {
    const normalizedName = name.trim();
    const currentEditing = editing;
    if (!currentEditing) return;

    await runProtectedAction(
      async () => {
        setSubmitting(true);
        try {
          if (currentEditing === 'create') {
            const result = await createPasskey(normalizedName);
            await finishPasskeyChange();
            setEditing(null);
            form.resetFields();
            if (result.recoveryCodesGenerated) {
              await onRecoveryCodesGenerated();
            }
            message.success('通行密钥已添加');
            return;
          }

          await renamePasskey(currentEditing.id as number, normalizedName);
          await finishPasskeyChange();
          setEditing(null);
          form.resetFields();
          message.success('通行密钥名称已更新');
        } finally {
          setSubmitting(false);
        }
      },
      currentEditing === 'create' ? '通行密钥添加失败' : '通行密钥重命名失败',
    );
  };

  const removePasskey = async (
    passkey: AuthenticatorSummary & { id: number },
  ) => {
    await runProtectedAction(async () => {
      setRemovingId(passkey.id);
      try {
        await deletePasskey(passkey.id);
        await finishPasskeyChange();
        message.success('通行密钥已删除');
      } finally {
        setRemovingId(null);
      }
    }, '通行密钥删除失败');
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Typography.Text strong>通行密钥（Passkey）</Typography.Text>
          <Typography.Paragraph type="secondary" className="mb-0">
            使用设备指纹、面容或系统解锁方式快速登录。
          </Typography.Paragraph>
        </div>
        <Button
          type="primary"
          onClick={() => {
            form.setFieldsValue({ name: '' });
            setEditing('create');
          }}
        >
          添加通行密钥
        </Button>
      </div>
      <Card size="small" loading={loading}>
        {passkeys.length ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            {passkeys.map((item) => (
              <div
                className="flex items-center justify-between gap-3"
                key={item.id}
              >
                <Space wrap>
                  <Typography.Text>{item.name || '未命名设备'}</Typography.Text>
                  <Tag color={item.is_passwordless ? 'green' : 'blue'}>
                    {item.is_passwordless ? '可用于登录' : '安全密钥'}
                  </Tag>
                </Space>
                <Space>
                  <Button
                    type="link"
                    onClick={() => {
                      form.setFieldsValue({
                        name: item.name || '我的通行密钥',
                      });
                      setEditing(item);
                    }}
                  >
                    重命名
                  </Button>
                  <Popconfirm
                    title={`删除通行密钥「${item.name || '未命名设备'}」吗？`}
                    description="删除后，这台设备将不能再使用该通行密钥登录。"
                    okText="删除通行密钥"
                    cancelText="取消"
                    onConfirm={() => void removePasskey(item)}
                  >
                    <Button danger type="link" loading={removingId === item.id}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </Space>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="当前没有通行密钥"
          />
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        title={editing === 'create' ? '添加通行密钥' : '重命名通行密钥'}
        okText={editing === 'create' ? '添加通行密钥' : '保存名称'}
        cancelText="取消"
        confirmLoading={submitting}
        destroyOnHidden
        onCancel={() => {
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => void form.submit()}
      >
        {editing === 'create' ? (
          <Alert
            type="info"
            showIcon
            className="mb-4"
            title="确认后，浏览器将打开当前设备的通行密钥创建窗口。"
          />
        ) : null}
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          onFinish={savePasskey}
        >
          <Form.Item
            label="设备名称"
            name="name"
            rules={[
              { required: true, message: '请输入设备名称' },
              { max: 64, message: '设备名称最多 64 个字符' },
            ]}
          >
            <Input autoFocus placeholder="例如：办公 MacBook" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={reauthVisible}
        title="重新验证身份"
        footer={null}
        destroyOnHidden
        onCancel={() => {
          setReauthVisible(false);
          pendingActionRef.current = null;
          reauthForm.resetFields();
        }}
      >
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          title="管理通行密钥前需要再次验证身份，可使用当前密码或已绑定的通行密钥。"
        />
        <Form
          form={reauthForm}
          layout="vertical"
          onFinish={async ({ password }) => {
            setReauthSubmitting(true);
            try {
              await reauthenticate(password);
              await finishReauthentication();
            } catch (error) {
              onError(getPasskeyErrorMessage(error, '身份验证失败'));
            } finally {
              setReauthSubmitting(false);
            }
          }}
        >
          <Form.Item
            label="当前密码"
            name="password"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password autoFocus />
          </Form.Item>
          <Space wrap>
            <Button type="primary" htmlType="submit" loading={reauthSubmitting}>
              使用密码验证
            </Button>
            {passkeys.length ? (
              <Button
                loading={passkeyReauthSubmitting}
                onClick={async () => {
                  setPasskeyReauthSubmitting(true);
                  try {
                    await reauthenticateWithPasskey();
                    await finishReauthentication();
                  } catch (error) {
                    onError(
                      getPasskeyErrorMessage(error, '通行密钥身份验证失败'),
                    );
                  } finally {
                    setPasskeyReauthSubmitting(false);
                  }
                }}
              >
                使用通行密钥验证
              </Button>
            ) : null}
          </Space>
        </Form>
      </Modal>
    </>
  );
};
